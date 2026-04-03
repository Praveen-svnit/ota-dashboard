import { getSql } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";

export interface TaskNotificationRecord {
  id: number;
  taskId: number | null;
  type: string;
  title: string;
  message: string;
  recipientUserId: string | null;
  recipientName: string | null;
  status: "unread" | "read";
  metadata: string | null;
  createdAt: string;
  readAt: string | null;
}

function normalizeName(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

export async function getAdminRecipient(): Promise<{ id: string; name: string } | undefined> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, name FROM users WHERE role = 'admin' AND active = 1 ORDER BY created_at ASC LIMIT 1
  `;
  return rows[0] as { id: string; name: string } | undefined;
}

export async function createTaskNotification(input: {
  taskId?: number | null;
  type: string;
  title: string;
  message: string;
  recipientUserId?: string | null;
  recipientName?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  if (!input.recipientUserId && !input.recipientName) return;

  const sql = getSql();
  const taskId = input.taskId ?? null;
  const type = input.type;
  const title = input.title;
  const message = input.message;
  const recipientUserId = input.recipientUserId ?? null;
  const recipientName = input.recipientName ?? null;
  const metadata = input.metadata ? JSON.stringify(input.metadata) : null;

  await sql`
    INSERT INTO task_notifications (
      task_id, type, title, message, recipient_user_id, recipient_name, status, metadata, created_at
    ) VALUES (
      ${taskId}, ${type}, ${title}, ${message}, ${recipientUserId}, ${recipientName}, 'unread', ${metadata}, NOW()
    )
  `;
}

export async function fetchNotificationsForSession(session: SessionUser): Promise<TaskNotificationRecord[]> {
  const sql = getSql();
  const recipientUserId = session.id;
  const normalizedName = normalizeName(session.name);
  const normalizedUsername = normalizeName(session.username);

  const rows = await sql`
    SELECT
      id,
      task_id AS "taskId",
      type,
      title,
      message,
      recipient_user_id AS "recipientUserId",
      recipient_name AS "recipientName",
      status,
      metadata,
      created_at AS "createdAt",
      read_at AS "readAt"
    FROM task_notifications
    WHERE status = 'unread'
      AND (
        recipient_user_id = ${recipientUserId}
        OR LOWER(COALESCE(recipient_name, '')) IN (${normalizedName}, ${normalizedUsername})
      )
    ORDER BY created_at DESC, id DESC
    LIMIT 20
  `;
  return rows as TaskNotificationRecord[];
}
