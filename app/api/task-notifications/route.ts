import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { fetchNotificationsForSession } from "@/lib/task-notifications";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const notifications = fetchNotificationsForSession(db, session);
  return Response.json({ notifications });
}
