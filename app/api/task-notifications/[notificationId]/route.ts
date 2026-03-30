import { getSession } from "@/lib/auth";
import { getSql } from "@/lib/db";

export async function PATCH(_req: Request, { params }: { params: Promise<{ notificationId: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { notificationId } = await params;
  const sql = getSql();
  const id = Number(notificationId);
  const recipientUserId = session.id;
  const normalizedName = session.name.toLowerCase();
  const normalizedUsername = session.username.toLowerCase();

  await sql`
    UPDATE task_notifications
    SET status = 'read',
        read_at = NOW()
    WHERE id = ${id}
      AND (
        recipient_user_id = ${recipientUserId}
        OR LOWER(COALESCE(recipient_name, '')) IN (${normalizedName}, ${normalizedUsername})
      )
  `;

  return Response.json({ ok: true });
}
