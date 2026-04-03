import { getSession } from "@/lib/auth";
import { fetchNotificationsForSession } from "@/lib/task-notifications";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const notifications = await fetchNotificationsForSession(session);
  return Response.json({ notifications });
}
