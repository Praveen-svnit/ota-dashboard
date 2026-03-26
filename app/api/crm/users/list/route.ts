import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const users = db.prepare(
    "SELECT id, name FROM Users WHERE active = 1 ORDER BY name"
  ).all() as { id: string; name: string }[];

  return Response.json({ users });
}
