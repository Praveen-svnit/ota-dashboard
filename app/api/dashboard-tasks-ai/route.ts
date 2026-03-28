import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { generateDashboardTaskCopilotAnswer, withDerivedTaskFields, type DashboardTaskComment, type DashboardTaskRecord } from "@/lib/dashboard-task-analytics";

function fetchTasks(): DashboardTaskRecord[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      t.*,
      COALESCE(NULLIF(t.assignedName, ''), u.name) AS assignedNameResolved,
      c.name AS createdByName
    FROM Tasks t
    LEFT JOIN Users u ON u.id = t.assignedTo
    LEFT JOIN Users c ON c.id = t.createdBy
    WHERE t.status != 'done'
    ORDER BY t.updatedAt DESC, t.createdAt DESC
  `).all() as Array<Record<string, unknown>>;

  const taskIds = rows.map((row) => Number(row.id)).filter(Boolean);
  const comments = taskIds.length > 0
    ? db.prepare(`
        SELECT id, taskId, comment, commentType, createdBy, createdByName, createdAt
        FROM TaskComments
        WHERE taskId IN (${taskIds.map(() => "?").join(",")})
        ORDER BY createdAt ASC, id ASC
      `).all(...taskIds) as DashboardTaskComment[]
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

    const tasks = fetchTasks();
    const result = await generateDashboardTaskCopilotAnswer(question, tasks, history);
    return Response.json({ ...result, tasks });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to answer the task question." },
      { status: 500 }
    );
  }
}
