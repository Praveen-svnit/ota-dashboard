import { getSession } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { enrichTaskRecord, withDerivedTaskFields, type DashboardTaskComment, type DashboardTaskPriority, type DashboardTaskStatus } from "@/lib/dashboard-task-analytics";
import { createTaskNotification, getAdminRecipient } from "@/lib/task-notifications";
import { findTeamMemberByName } from "@/lib/team-directory";

async function fetchTask(taskId: string) {
  const sql = getSql();
  const rows = await sql`
    SELECT
      t.id,
      t.property_id        AS "propertyId",
      t.task_type          AS "taskType",
      t.title,
      t.description,
      t.status,
      t.priority,
      t.assigned_to        AS "assignedTo",
      t.assigned_name      AS "assignedName",
      t.assigned_role      AS "assignedRole",
      t.assigned_team_lead AS "assignedTeamLead",
      t.created_by         AS "createdBy",
      t.due_date           AS "dueDate",
      t.follow_up_at       AS "followUpAt",
      t.task_date          AS "taskDate",
      t.source_route       AS "sourceRoute",
      t.source_label       AS "sourceLabel",
      t.source_anchor      AS "sourceAnchor",
      t.source_page        AS "sourcePage",
      t.source_section     AS "sourceSection",
      t.related_ota        AS "relatedOta",
      t.related_city       AS "relatedCity",
      t.completion_comment AS "completionComment",
      t.completed_at       AS "completedAt",
      t.bucket,
      t.ai_summary         AS "aiSummary",
      t.ai_insight         AS "aiInsight",
      t.tags,
      t.created_at         AS "createdAt",
      t.updated_at         AS "updatedAt",
      COALESCE(NULLIF(t.assigned_name, ''), u.name) AS "assignedNameResolved",
      c.name AS "createdByName"
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assigned_to
    LEFT JOIN users c ON c.id = t.created_by
    WHERE t.id = ${Number(taskId)}
  `;

  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;

  const comments = await sql`
    SELECT id, task_id AS "taskId", comment, comment_type AS "commentType",
           created_by AS "createdBy", created_by_name AS "createdByName", created_at AS "createdAt"
    FROM task_comments
    WHERE task_id = ${Number(taskId)}
    ORDER BY created_at ASC, id ASC
  ` as unknown as DashboardTaskComment[];

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
  const existing = await fetchTask(taskId);
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

  const sql = getSql();
  const isTerminal = ["done", "pending", "supervisor_attention"].includes(status);

  await sql.query(`
    UPDATE tasks
    SET status             = $1,
        title              = $2,
        description        = $3,
        priority           = $4,
        assigned_to        = $5,
        assigned_name      = $6,
        assigned_role      = $7,
        assigned_team_lead = $8,
        due_date           = $9,
        follow_up_at       = $10,
        completion_comment = CASE WHEN $11 IN ('done', 'pending', 'supervisor_attention') THEN $12 ELSE completion_comment END,
        completed_at       = CASE WHEN $13 = 'done' THEN NOW() ELSE NULL END,
        bucket             = $14,
        ai_summary         = $15,
        ai_insight         = $16,
        updated_at         = NOW()
    WHERE id = $17
  `, [
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
    isTerminal ? completionComment : null,
    status,
    enriched.bucket,
    enriched.aiSummary,
    enriched.aiInsight,
    Number(taskId),
  ]);

  if (comment) {
    const commentType = status === "done" ? "completion" : status === "supervisor_attention" ? "follow_up" : "update";
    await sql`
      INSERT INTO task_comments (task_id, comment, comment_type, created_by, created_by_name, created_at)
      VALUES (${Number(taskId)}, ${comment}, ${commentType}, ${session.id}, ${session.name}, NOW())
    `;
  }

  if (status === "pending" || status === "supervisor_attention") {
    const admin = await getAdminRecipient();
    if (admin) {
      await createTaskNotification({
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

  return Response.json({ task: await fetchTask(taskId) });
}
