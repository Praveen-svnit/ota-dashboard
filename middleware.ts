import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SECRET      = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "ota-dashboard-secret-change-in-prod-32chars!!"
);
const COOKIE_NAME = "ota_session";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/sync-inventory", "/api/sync-rns", "/api/init-db"];

// Pages interns are allowed to visit
const INTERN_ALLOWED = ["/listing-dashboard", "/crm"];

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
    const { payload } = await jwtVerify(token, SECRET);
    const role = (payload as { role?: string }).role;

    // Interns can only access listing-dashboard and crm pages
    if (role === "intern" && !pathname.startsWith("/api")) {
      const allowed = INTERN_ALLOWED.some(p => pathname === p || pathname.startsWith(p + "/"));
      if (!allowed) {
        return NextResponse.redirect(new URL("/listing-dashboard", req.url));
      }
    }

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
