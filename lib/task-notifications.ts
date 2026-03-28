import type Database from "better-sqlite3";
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

export function getAdminRecipient(db: Database.Database) {
  return db.prepare("SELECT id, name FROM Users WHERE role = 'admin' AND active = 1 ORDER BY createdAt ASC LIMIT 1").get() as
    | { id: string; name: string }
    | undefined;
}

export function createTaskNotification(
  db: Database.Database,
  input: {
    taskId?: number | null;
    type: string;
    title: string;
    message: string;
    recipientUserId?: string | null;
    recipientName?: string | null;
    metadata?: Record<string, unknown> | null;
  }
) {
  if (!input.recipientUserId && !input.recipientName) return;

  db.prepare(`
    INSERT INTO TaskNotifications (
      taskId, type, title, message, recipientUserId, recipientName, status, metadata, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, 'unread', ?, datetime('now'))
  `).run(
    input.taskId ?? null,
    input.type,
    input.title,
    input.message,
    input.recipientUserId ?? null,
    input.recipientName ?? null,
    input.metadata ? JSON.stringify(input.metadata) : null,
  );
}

export function fetchNotificationsForSession(db: Database.Database, session: SessionUser) {
  return db.prepare(`
    SELECT *
    FROM TaskNotifications
    WHERE status = 'unread'
      AND (
        recipientUserId = ?
        OR LOWER(COALESCE(recipientName, '')) IN (?, ?)
      )
    ORDER BY createdAt DESC, id DESC
    LIMIT 20
  `).all(session.id, normalizeName(session.name), normalizeName(session.username)) as TaskNotificationRecord[];
}
