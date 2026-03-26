import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function PATCH(req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await params;
  const body = await req.json();
  const { status, title, description, priority, assignedTo, dueDate } = body;

  const db = getDb();
  db.prepare(`
    UPDATE Tasks
    SET status = COALESCE(?, status),
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        priority = COALESCE(?, priority),
        assignedTo = ?,
        dueDate = COALESCE(?, dueDate),
        updatedAt = datetime('now')
    WHERE id = ?
  `).run(
    status ?? null,
    title ?? null,
    description ?? null,
    priority ?? null,
    assignedTo !== undefined ? assignedTo : db.prepare("SELECT assignedTo FROM Tasks WHERE id = ?").get(taskId) as string | null,
    dueDate ?? null,
    taskId,
  );

  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await params;
  const db = getDb();
  db.prepare("DELETE FROM Tasks WHERE id = ?").run(taskId);

  return Response.json({ ok: true });
}
