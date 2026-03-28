import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { enrichTaskRecord, withDerivedTaskFields, type DashboardTaskComment, type DashboardTaskPriority, type DashboardTaskStatus } from "@/lib/dashboard-task-analytics";
import { createTaskNotification, getAdminRecipient } from "@/lib/task-notifications";
import { findTeamMemberByName } from "@/lib/team-directory";

function fetchTask(taskId: string) {
  const db = getDb();
  const row = db.prepare(`
    SELECT t.*, COALESCE(NULLIF(t.assignedName, ''), u.name) AS assignedNameResolved, c.name AS createdByName
    FROM Tasks t
    LEFT JOIN Users u ON u.id = t.assignedTo
    LEFT JOIN Users c ON c.id = t.createdBy
    WHERE t.id = ?
  `).get(taskId) as Record<string, unknown> | undefined;

  if (!row) return null;

  const comments = db.prepare(`
    SELECT id, taskId, comment, commentType, createdBy, createdByName, createdAt
    FROM TaskComments
    WHERE taskId = ?
    ORDER BY createdAt ASC, id ASC
  `).all(taskId) as DashboardTaskComment[];

  return withDerivedTaskFields({
    id: Number(row.id),
    propertyId: String(row.propertyId ?? "dashboard-global"),
    taskType: String(row.taskType ?? "dashboard") as "property" | "dashboard" | "adhoc",
    title: String(row.title ?? ""),
    description: (row.description as string | null) ?? null,
    status: String(row.status ?? "open") as DashboardTaskStatus,
    priority: String(row.priority ?? "medium") as DashboardTaskPriority,
    assignedTo: (row.assignedTo as string | null) ?? null,
    assignedName: (row.assignedNameResolved as string | null) ?? null,
    assignedRole: (row.assignedRole as string | null) ?? null,
    assignedTeamLead: (row.assignedTeamLead as string | null) ?? null,
    createdBy: (row.createdBy as string | null) ?? null,
    createdByName: (row.createdByName as string | null) ?? null,
    dueDate: (row.dueDate as string | null) ?? null,
    followUpAt: (row.followUpAt as string | null) ?? null,
    taskDate: (row.taskDate as string | null) ?? null,
    sourceRoute: (row.sourceRoute as string | null) ?? null,
    sourceLabel: (row.sourceLabel as string | null) ?? null,
    sourceAnchor: (row.sourceAnchor as string | null) ?? null,
    sourcePage: (row.sourcePage as string | null) ?? null,
    sourceSection: (row.sourceSection as string | null) ?? null,
    relatedOta: (row.relatedOta as string | null) ?? null,
    relatedCity: (row.relatedCity as string | null) ?? null,
    completionComment: (row.completionComment as string | null) ?? null,
    completedAt: (row.completedAt as string | null) ?? null,
    bucket: (row.bucket as ReturnType<typeof enrichTaskRecord>["bucket"]) ?? null,
    aiSummary: (row.aiSummary as string | null) ?? null,
    aiInsight: (row.aiInsight as string | null) ?? null,
    tags: (row.tags as string | null) ?? null,
    createdAt: String(row.createdAt ?? ""),
    updatedAt: String(row.updatedAt ?? ""),
    comments,
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await params;
  const existing = fetchTask(taskId);
  if (!existing) return Response.json({ error: "Task not found" }, { status: 404 });

  const body = await req.json();
  const status = (typeof body.status === "string" ? body.status : existing.status) as DashboardTaskStatus;
  const title = typeof body.title === "string" ? body.title.trim() : existing.title;
  const description = typeof body.description === "string" ? body.description.trim() : (existing.description ?? "");
  const priority = (typeof body.priority === "string" ? body.priority : existing.priority) as DashboardTaskPriority;
  const assignedTo = body.assignedTo !== undefined ? (typeof body.assignedTo === "string" && body.assignedTo.trim() ? body.assignedTo.trim() : null) : existing.assignedTo;
  const assignedName = body.assignedName !== undefined
    ? (typeof body.assignedName === "string" && body.assignedName.trim() ? body.assignedName.trim() : null)
    : existing.assignedName;
  const member = findTeamMemberByName(assignedName);
  const dueDate = body.dueDate !== undefined ? (typeof body.dueDate === "string" && body.dueDate.trim() ? body.dueDate.trim() : null) : existing.dueDate;
  const followUpAt = body.followUpAt !== undefined ? (typeof body.followUpAt === "string" && body.followUpAt.trim() ? body.followUpAt.trim() : null) : existing.followUpAt;
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";
  const completionComment = typeof body.completionComment === "string" ? body.completionComment.trim() : comment;

  if ((status === "done" || status === "pending" || status === "supervisor_attention") && !completionComment) {
    return Response.json({ error: "A comment is required for complete, pending, or supervisor-attention updates." }, { status: 400 });
  }

  const enriched = enrichTaskRecord({
    title,
    description,
    priority,
    relatedOta: existing.relatedOta,
    assignedName,
    sourceLabel: existing.sourceLabel,
    sourceSection: existing.sourceSection,
    sourcePage: existing.sourcePage,
  });

  const db = getDb();
  db.prepare(`
    UPDATE Tasks
    SET status = ?,
        title = ?,
        description = ?,
        priority = ?,
        assignedTo = ?,
        assignedName = ?,
        assignedRole = ?,
        assignedTeamLead = ?,
        dueDate = ?,
        followUpAt = ?,
        completionComment = CASE WHEN ? IN ('done', 'pending', 'supervisor_attention') THEN ? ELSE completionComment END,
        completedAt = CASE WHEN ? = 'done' THEN datetime('now') ELSE NULL END,
        bucket = ?,
        aiSummary = ?,
        aiInsight = ?,
        updatedAt = datetime('now')
    WHERE id = ?
  `).run(
    status,
    title,
    description || null,
    priority,
    assignedTo,
    assignedName,
    member?.role ?? existing.assignedRole ?? null,
    member?.teamLead ?? existing.assignedTeamLead ?? null,
    dueDate,
    followUpAt,
    status,
    ["done", "pending", "supervisor_attention"].includes(status) ? completionComment : null,
    status,
    enriched.bucket,
    enriched.aiSummary,
    enriched.aiInsight,
    taskId,
  );

  if (comment) {
    db.prepare(`
      INSERT INTO TaskComments (taskId, comment, commentType, createdBy, createdByName, createdAt)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(taskId, comment, status === "done" ? "completion" : status === "supervisor_attention" ? "follow_up" : "update", session.id, session.name);
  }

  if (status === "pending" || status === "supervisor_attention") {
    const admin = getAdminRecipient(db);
    if (admin) {
      createTaskNotification(db, {
        taskId: Number(taskId),
        type: status === "supervisor_attention" ? "supervisor_attention" : "pending_review",
        title: `${status === "supervisor_attention" ? "Supervisor attention required" : "Task marked pending"}: ${title}`,
        message: `${session.name} updated "${title}" to ${status.replace("_", " ")}.${comment ? ` Comment: ${comment}` : ""}`,
        recipientUserId: admin.id,
        recipientName: admin.name,
        metadata: {
          taskId: Number(taskId),
          sourceRoute: existing.sourceRoute,
          sourceAnchor: existing.sourceAnchor,
          status,
        },
      });
    }
  }

  return Response.json({ task: fetchTask(taskId) });
}
