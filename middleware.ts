import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SECRET      = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "ota-dashboard-secret-change-in-prod-32chars!!"
);
const COOKIE_NAME = "ota_session";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/sync-inventory", "/api/sync-rns", "/api/init-db"];

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

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.redirect(new URL("/login", req.url));

  try {
    await jwtVerify(token, SECRET);
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
