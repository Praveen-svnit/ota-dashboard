import { getSql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getSql();
  const users = await sql`
    SELECT id, name FROM users WHERE active = 1 ORDER BY name
  ` as { id: string; name: string }[];

  return Response.json({ users });
}
