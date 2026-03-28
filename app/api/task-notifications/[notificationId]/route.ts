import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function PATCH(_req: Request, { params }: { params: Promise<{ notificationId: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { notificationId } = await params;
  const db = getDb();
  db.prepare(`
    UPDATE TaskNotifications
    SET status = 'read',
        readAt = datetime('now')
    WHERE id = ?
      AND (
        recipientUserId = ?
        OR LOWER(COALESCE(recipientName, '')) IN (?, ?)
      )
  `).run(notificationId, session.id, session.name.toLowerCase(), session.username.toLowerCase());

  return Response.json({ ok: true });
}
