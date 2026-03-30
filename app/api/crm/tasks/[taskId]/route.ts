import { getSql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { enrichTaskRecord } from "@/lib/dashboard-task-analytics";
import { findTeamMemberByName } from "@/lib/team-directory";

export async function PATCH(req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await params;
  const body = await req.json();
  const { status, title, description, priority, assignedTo, assignedName, dueDate, followUpAt, comment } = body;

  const sql = await getSql();
  const currentRows = await sql`SELECT * FROM tasks WHERE id = ${taskId}` as Array<Record<string, unknown>>;
  const current = currentRows[0];
  if (!current) return Response.json({ error: "Task not found" }, { status: 404 });

  const resolvedTitle = typeof title === "string" ? title.trim() : String(current.title ?? "");
  const resolvedDescription = typeof description === "string" ? description.trim() : String(current.description ?? "");
  const resolvedPriority = typeof priority === "string" ? priority : String(current.priority ?? "medium");
  const resolvedAssignedName = assignedName !== undefined
    ? (typeof assignedName === "string" && assignedName.trim() ? assignedName.trim() : null)
    : ((current.assigned_name as string | null) ?? null);
  const resolvedAssignedTo = assignedTo !== undefined
    ? (typeof assignedTo === "string" && assignedTo.trim() ? assignedTo.trim() : null)
    : ((current.assigned_to as string | null) ?? null);
  const member = findTeamMemberByName(resolvedAssignedName);

  if (status === "done" && !(typeof comment === "string" && comment.trim())) {
    return Response.json({ error: "Completion comment is required before marking a task complete." }, { status: 400 });
  }

  const enriched = enrichTaskRecord({
    title: resolvedTitle,
    description: resolvedDescription,
    priority: resolvedPriority as "low" | "medium" | "high" | "critical",
    relatedOta: (current.related_ota as string | null) ?? null,
    assignedName: resolvedAssignedName,
    sourceLabel: (current.source_label as string | null) ?? null,
    sourceSection: (current.source_section as string | null) ?? null,
    sourcePage: (current.source_page as string | null) ?? null,
  });

  await sql`
    UPDATE tasks
    SET status            = COALESCE(${status ?? null}, status),
        title             = COALESCE(${resolvedTitle || null}, title),
        description       = COALESCE(${resolvedDescription || null}, description),
        priority          = COALESCE(${resolvedPriority || null}, priority),
        assigned_to       = ${resolvedAssignedTo},
        assigned_name     = ${resolvedAssignedName},
        assigned_role     = ${member?.role ?? null},
        assigned_team_lead = ${member?.teamLead ?? null},
        due_date          = COALESCE(${dueDate ?? null}, due_date),
        follow_up_at      = COALESCE(${followUpAt ?? null}, follow_up_at),
        completion_comment = CASE WHEN ${status ?? null} = 'done' THEN ${typeof comment === "string" ? comment.trim() : null} ELSE completion_comment END,
        completed_at      = CASE WHEN ${status ?? null} = 'done' THEN NOW() ELSE completed_at END,
        bucket            = ${enriched.bucket},
        ai_summary        = ${enriched.aiSummary},
        ai_insight        = ${enriched.aiInsight},
        updated_at        = NOW()
    WHERE id = ${taskId}
  `;

  if (typeof comment === "string" && comment.trim()) {
    await sql`
      INSERT INTO task_comments (task_id, comment, comment_type, created_by, created_by_name, created_at)
      VALUES (${taskId}, ${comment.trim()}, ${status === "done" ? "completion" : "update"}, ${session.id}, ${session.name}, NOW())
    `;
  }

  return Response.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ taskId: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { taskId } = await params;
  const sql = await getSql();
  await sql`DELETE FROM tasks WHERE id = ${taskId}`;

  return Response.json({ ok: true });
}
