import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { createHash } from "crypto";

const SECRET      = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "ota-dashboard-secret-change-in-prod-32chars!!"
);
const COOKIE_NAME = "ota_session";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/sync-inventory", "/api/sync-ota-listings", "/api/sync-rns", "/api/init-db", "/api/cron/"];

async function isValidApiKey(token: string, req: NextRequest): Promise<boolean> {
  if (!token.startsWith("ota_")) return false;
  const hash = createHash("sha256").update(token).digest("hex");

  // Call internal DB check via absolute URL
  const base = req.nextUrl.origin;
  try {
    const res = await fetch(`${base}/api/admin/api-keys/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal": "1" },
      body: JSON.stringify({ hash }),
    });
    if (!res.ok) return false;
    const data = await res.json() as { valid: boolean };
    return data.valid === true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths and static assets
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Allow internal api-key verify endpoint
  if (pathname === "/api/admin/api-keys/verify") {
    return NextResponse.next();
  }

  // Check session cookie first
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (token) {
    try {
      await jwtVerify(token, SECRET);
      return NextResponse.next();
    } catch {
      // fall through to API key check
    }
  }

  // Check Bearer API key
  const auth = req.headers.get("authorization") ?? "";
  if (auth.startsWith("Bearer ota_")) {
    const rawKey = auth.slice(7);
    if (await isValidApiKey(rawKey, req)) {
      return NextResponse.next();
    }
  }

  // For API routes return 401, for pages redirect to login
  if (pathname.startsWith("/api/")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("from", pathname + req.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
