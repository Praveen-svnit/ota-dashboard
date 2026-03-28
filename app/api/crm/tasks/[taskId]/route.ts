import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { enrichTaskRecord } from "@/lib/dashboard-task-analytics";
import { findTeamMemberByName } from "@/lib/team-directory";

export async function PATCH(req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await params;
  const body = await req.json();
  const { status, title, description, priority, assignedTo, assignedName, dueDate, followUpAt, comment } = body;

  const db = getDb();
  const current = db.prepare("SELECT * FROM Tasks WHERE id = ?").get(taskId) as Record<string, unknown> | undefined;
  if (!current) return Response.json({ error: "Task not found" }, { status: 404 });

  const resolvedTitle = typeof title === "string" ? title.trim() : String(current.title ?? "");
  const resolvedDescription = typeof description === "string" ? description.trim() : String(current.description ?? "");
  const resolvedPriority = typeof priority === "string" ? priority : String(current.priority ?? "medium");
  const resolvedAssignedName = assignedName !== undefined
    ? (typeof assignedName === "string" && assignedName.trim() ? assignedName.trim() : null)
    : ((current.assignedName as string | null) ?? null);
  const resolvedAssignedTo = assignedTo !== undefined
    ? (typeof assignedTo === "string" && assignedTo.trim() ? assignedTo.trim() : null)
    : ((current.assignedTo as string | null) ?? null);
  const member = findTeamMemberByName(resolvedAssignedName);

  if (status === "done" && !(typeof comment === "string" && comment.trim())) {
    return Response.json({ error: "Completion comment is required before marking a task complete." }, { status: 400 });
  }

  const enriched = enrichTaskRecord({
    title: resolvedTitle,
    description: resolvedDescription,
    priority: resolvedPriority as "low" | "medium" | "high" | "critical",
    relatedOta: (current.relatedOta as string | null) ?? null,
    assignedName: resolvedAssignedName,
    sourceLabel: (current.sourceLabel as string | null) ?? null,
    sourceSection: (current.sourceSection as string | null) ?? null,
    sourcePage: (current.sourcePage as string | null) ?? null,
  });

  db.prepare(`
    UPDATE Tasks
    SET status = COALESCE(?, status),
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        priority = COALESCE(?, priority),
        assignedTo = ?,
        assignedName = ?,
        assignedRole = ?,
        assignedTeamLead = ?,
        dueDate = COALESCE(?, dueDate),
        followUpAt = COALESCE(?, followUpAt),
        completionComment = CASE WHEN ? = 'done' THEN ? ELSE completionComment END,
        completedAt = CASE WHEN ? = 'done' THEN datetime('now') ELSE completedAt END,
        bucket = ?,
        aiSummary = ?,
        aiInsight = ?,
        updatedAt = datetime('now')
    WHERE id = ?
  `).run(
    status ?? null,
    resolvedTitle || null,
    resolvedDescription || null,
    resolvedPriority || null,
    resolvedAssignedTo,
    resolvedAssignedName,
    member?.role ?? null,
    member?.teamLead ?? null,
    dueDate ?? null,
    followUpAt ?? null,
    status ?? null,
    typeof comment === "string" ? comment.trim() : null,
    status ?? null,
    enriched.bucket,
    enriched.aiSummary,
    enriched.aiInsight,
    taskId,
  );

  if (typeof comment === "string" && comment.trim()) {
    db.prepare(`
      INSERT INTO TaskComments (taskId, comment, commentType, createdBy, createdByName, createdAt)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(taskId, comment.trim(), status === "done" ? "completion" : "update", session.id, session.name);
  }

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
