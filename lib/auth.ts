import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SECRET = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "ota-dashboard-secret-change-in-prod-32chars!!"
);

const COOKIE_NAME = "ota_session";
const EXPIRES_IN  = 60 * 60 * 24 * 7; // 7 days

export interface SessionUser {
  id:       string;
  username: string;
  name:     string;
  role:     "admin" | "tl" | "intern";
  ota:      string | null;
  teamLead: string | null;
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${EXPIRES_IN}s`)
    .sign(SECRET);
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const jar   = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export function sessionCookieOptions(token: string) {
  return {
    name:     COOKIE_NAME,
    value:    token,
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path:     "/",
    maxAge:   EXPIRES_IN,
  };
}

export function clearCookieOptions() {
  return {
    name:     COOKIE_NAME,
    value:    "",
    httpOnly: true,
    path:     "/",
    maxAge:   0,
  };
}
