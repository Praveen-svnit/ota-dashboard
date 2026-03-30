import { getSession } from "@/lib/auth";
import { getSql } from "@/lib/db";
import { generateDashboardTaskCopilotAnswer, withDerivedTaskFields, type DashboardTaskComment, type DashboardTaskRecord } from "@/lib/dashboard-task-analytics";

async function fetchTasks(): Promise<DashboardTaskRecord[]> {
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
    WHERE t.status != 'done'
    ORDER BY t.updated_at DESC, t.created_at DESC
  ` as Array<Record<string, unknown>>;

  const taskIds = rows.map((row) => Number(row.id)).filter(Boolean);
  const comments: DashboardTaskComment[] = taskIds.length > 0
    ? (await sql`
        SELECT id, task_id AS "taskId", comment, comment_type AS "commentType",
               created_by AS "createdBy", created_by_name AS "createdByName", created_at AS "createdAt"
        FROM task_comments
        WHERE task_id = ANY(${taskIds})
        ORDER BY created_at ASC, id ASC
      `) as unknown as DashboardTaskComment[]
    : [];

  const commentsByTask = new Map<number, DashboardTaskComment[]>();
  for (const comment of comments) {
    const list = commentsByTask.get(comment.taskId) ?? [];
    list.push(comment);
    commentsByTask.set(comment.taskId, list);
  }

  return rows.map((row) =>
    withDerivedTaskFields({
      id: Number(row.id),
      propertyId: String(row.propertyId ?? "dashboard-global"),
      taskType: String(row.taskType ?? "dashboard") as DashboardTaskRecord["taskType"],
      title: String(row.title ?? ""),
      description: (row.description as string | null) ?? null,
      status: String(row.status ?? "open") as DashboardTaskRecord["status"],
      priority: String(row.priority ?? "medium") as DashboardTaskRecord["priority"],
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
      bucket: (row.bucket as DashboardTaskRecord["bucket"]) ?? null,
      aiSummary: (row.aiSummary as string | null) ?? null,
      aiInsight: (row.aiInsight as string | null) ?? null,
      tags: (row.tags as string | null) ?? null,
      createdAt: String(row.createdAt ?? ""),
      updatedAt: String(row.updatedAt ?? ""),
      comments: commentsByTask.get(Number(row.id)) ?? [],
    })
  );
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const history = Array.isArray(body.history)
      ? body.history.filter((message: unknown) =>
          typeof message === "object" &&
          message !== null &&
          message &&
          (message as { role?: string }).role &&
          (((message as { role?: string }).role === "user") || ((message as { role?: string }).role === "assistant")) &&
          typeof (message as { content?: unknown }).content === "string"
        )
      : [];

    if (!question) {
      return Response.json({ error: "Question is required." }, { status: 400 });
    }

    const tasks = await fetchTasks();
    const result = await generateDashboardTaskCopilotAnswer(question, tasks, history);
    return Response.json({ ...result, tasks });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to answer the task question." },
      { status: 500 }
    );
  }
}
