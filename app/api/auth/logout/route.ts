import { cookies } from "next/headers";
import { clearCookieOptions } from "@/lib/auth";

export async function POST() {
  const jar = await cookies();
  jar.set(clearCookieOptions());
  return Response.json({ ok: true });
}
