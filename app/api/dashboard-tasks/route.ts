import { getSession } from "@/lib/auth";
import { getSql } from "@/lib/db";
import {
  buildDashboardTaskInsights,
  enrichTaskRecord,
  withDerivedTaskFields,
  type DashboardTaskComment,
  type DashboardTaskPriority,
  type DashboardTaskRecord,
  type DashboardTaskStatus,
} from "@/lib/dashboard-task-analytics";
import { createTaskNotification } from "@/lib/task-notifications";
import { findTeamMemberByName, getTeamDirectory } from "@/lib/team-directory";

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function deriveSourcePageLabel(route: string | null | undefined) {
  if (!route) return "General";
  if (route === "/production-dashboard-2" || route === "/ota-analytics") return "OTA Analytics";
  if (route === "/todays-assigned-tasks") return "Today's Assigned Tasks";
  if (route === "/") return "Production Dashboard";
  if (route.startsWith("/crm")) return "Property CRM";
  if (route.startsWith("/listings")) return "Property Status";
  if (route.startsWith("/listing-dashboard")) return "Listing Dashboard";
  if (route.startsWith("/team")) return "Team";
  return route.replace(/^\//, "").replace(/-/g, " ") || "General";
}

function mapRow(row: Record<string, unknown>, comments: DashboardTaskComment[]) {
  return withDerivedTaskFields({
    id: Number(row.id),
    propertyId: String(row.propertyId ?? "dashboard-global"),
    taskType: String(row.taskType ?? "dashboard") as DashboardTaskRecord["taskType"],
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
    bucket: (row.bucket as DashboardTaskRecord["bucket"]) ?? null,
    aiSummary: (row.aiSummary as string | null) ?? null,
    aiInsight: (row.aiInsight as string | null) ?? null,
    tags: (row.tags as string | null) ?? null,
    createdAt: String(row.createdAt ?? ""),
    updatedAt: String(row.updatedAt ?? ""),
    comments,
  });
}

async function fetchDashboardTasks(filters: {
  route?: string | null;
  sourceAnchor?: string | null;
  includeCompleted?: boolean;
}) {
  const sql = getSql();
  const clauses: string[] = [];
  const params: Array<string | number> = [];
  let p = 0;

  if (!filters.includeCompleted) {
    clauses.push("t.status != 'done'");
  }
  if (filters.route) {
    clauses.push(`t.source_route = $${++p}`);
    params.push(filters.route);
  }
  if (filters.sourceAnchor) {
    clauses.push(`t.source_anchor = $${++p}`);
    params.push(filters.sourceAnchor);
  }

  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

  const rows = await sql.query(`
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
    ${whereClause}
    ORDER BY
      CASE t.priority
        WHEN 'critical' THEN 0
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        ELSE 3
      END,
      CASE t.status
        WHEN 'supervisor_attention' THEN 0
        WHEN 'pending' THEN 1
        WHEN 'open' THEN 2
        WHEN 'in_progress' THEN 3
        ELSE 4
      END,
      t.updated_at DESC,
      t.created_at DESC
  `, params) as Array<Record<string, unknown>>;

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

  return rows.map((row) => mapRow(row, commentsByTask.get(Number(row.id)) ?? []));
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const route = searchParams.get("route");
  const sourceAnchor = searchParams.get("sourceAnchor");
  const includeCompleted = searchParams.get("includeCompleted") === "1";
  const tasks = await fetchDashboardTasks({ route, sourceAnchor, includeCompleted });
  const insights = buildDashboardTaskInsights(tasks);
  const routeActiveTasks = route ? tasks.filter((task) => task.sourceRoute === route && task.status !== "done") : [];

  return Response.json({
    tasks,
    insights,
    teamMembers: getTeamDirectory(),
    currentUser: session,
    routeSummary: route
      ? {
          route,
          label: deriveSourcePageLabel(route),
          activeCount: routeActiveTasks.length,
          highPriorityCount: routeActiveTasks.filter((task) => task.priority === "high" || task.priority === "critical").length,
          blockedCount: routeActiveTasks.filter((task) => task.status === "pending" || task.status === "supervisor_attention").length,
          latestSourceLabel: routeActiveTasks[0]?.sourceLabel ?? null,
        }
      : null,
    today: localToday(),
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const priority = (typeof body.priority === "string" ? body.priority : "medium") as DashboardTaskPriority;
  const assignedTo = typeof body.assignedTo === "string" && body.assignedTo.trim() ? body.assignedTo.trim() : null;
  const explicitAssignedName = typeof body.assignedName === "string" && body.assignedName.trim() ? body.assignedName.trim() : null;
  const member = findTeamMemberByName(explicitAssignedName);
  const assignedName = explicitAssignedName ?? member?.name ?? null;
  const sourceRoute = typeof body.sourceRoute === "string" && body.sourceRoute.trim() ? body.sourceRoute.trim() : "/ota-analytics";
  const sourceLabel = typeof body.sourceLabel === "string" && body.sourceLabel.trim() ? body.sourceLabel.trim() : "Dashboard task";
  const sourceAnchor = typeof body.sourceAnchor === "string" && body.sourceAnchor.trim() ? body.sourceAnchor.trim() : null;
  const sourceSection = typeof body.sourceSection === "string" && body.sourceSection.trim() ? body.sourceSection.trim() : null;
  const relatedOta = typeof body.relatedOta === "string" && body.relatedOta.trim() ? body.relatedOta.trim() : null;
  const relatedCity = typeof body.relatedCity === "string" && body.relatedCity.trim() ? body.relatedCity.trim() : null;
  const dueDate = typeof body.dueDate === "string" && body.dueDate.trim() ? body.dueDate.trim() : null;
  const followUpAt = typeof body.followUpAt === "string" && body.followUpAt.trim() ? body.followUpAt.trim() : null;
  const taskType = (typeof body.taskType === "string" ? body.taskType : "dashboard") as DashboardTaskRecord["taskType"];
  const propertyId = typeof body.propertyId === "string" && body.propertyId.trim() ? body.propertyId.trim() : "dashboard-global";
  const tags = Array.isArray(body.tags) ? JSON.stringify(body.tags.filter((tag: unknown): tag is string => typeof tag === "string")) : null;

  if (!title) {
    return Response.json({ error: "Task title is required." }, { status: 400 });
  }

  const enriched = enrichTaskRecord({
    title,
    description,
    priority,
    relatedOta,
    assignedName,
    sourceLabel,
    sourceSection,
    sourcePage: deriveSourcePageLabel(sourceRoute),
  });

  const sql = getSql();
  const [insertedRow] = await sql`
    INSERT INTO tasks (
      property_id, task_type, title, description, status, priority,
      assigned_to, assigned_name, assigned_role, assigned_team_lead, created_by,
      due_date, follow_up_at, task_date, source_route, source_label, source_anchor,
      source_page, source_section, related_ota, related_city, bucket, ai_summary,
      ai_insight, tags, created_at, updated_at
    )
    VALUES (
      ${propertyId}, ${taskType}, ${title}, ${description || null}, 'open', ${priority},
      ${assignedTo}, ${assignedName}, ${member?.role ?? null}, ${member?.teamLead ?? null}, ${session.id},
      ${dueDate}, ${followUpAt}, CURRENT_DATE, ${sourceRoute}, ${sourceLabel}, ${sourceAnchor},
      ${deriveSourcePageLabel(sourceRoute)}, ${sourceSection}, ${relatedOta}, ${relatedCity}, ${enriched.bucket}, ${enriched.aiSummary},
      ${enriched.aiInsight}, ${tags}, NOW(), NOW()
    )
    RETURNING id
  `;
  const newTaskId = Number(insertedRow.id);

  if (description) {
    await sql`
      INSERT INTO task_comments (task_id, comment, comment_type, created_by, created_by_name, created_at)
      VALUES (${newTaskId}, ${description}, 'update', ${session.id}, ${session.name}, NOW())
    `;
  }

  if (assignedName || assignedTo) {
    await createTaskNotification({
      taskId: newTaskId,
      type: "assignment",
      title: `New task assigned: ${title}`,
      message: `${session.name} assigned you a ${priority} priority task from ${sourceLabel}.`,
      recipientUserId: assignedTo,
      recipientName: assignedName,
      metadata: {
        taskId: newTaskId,
        sourceRoute,
        sourceAnchor,
      },
    });
  }

  const tasks = await fetchDashboardTasks({ includeCompleted: false });
  const createdTask = tasks.find((task) => task.id === newTaskId) ?? null;

  return Response.json({
    task: createdTask,
    insights: buildDashboardTaskInsights(tasks),
  });
}
