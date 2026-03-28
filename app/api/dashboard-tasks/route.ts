import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
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
  if (route === "/production-dashboard-2") return "Production Dashboard 2";
  if (route === "/todays-assigned-tasks") return "Today's Assigned Tasks";
  if (route === "/") return "Production Dashboard";
  if (route.startsWith("/crm")) return "Property CRM";
  if (route.startsWith("/listings")) return "Property Status";
  if (route.startsWith("/listing-dashboard")) return "Listing Dashboard";
  if (route.startsWith("/team")) return "Team";
  return route.replace(/^\//, "").replace(/-/g, " ") || "General";
}

function fetchDashboardTasks(filters: { route?: string | null; sourceAnchor?: string | null; includeCompleted?: boolean; onlyRouteSummary?: boolean }) {
  const db = getDb();
  const clauses: string[] = [];
  const params: Array<string | number> = [];

  if (!filters.includeCompleted) {
    clauses.push("t.status != 'done'");
  }

  if (filters.route) {
    clauses.push("t.sourceRoute = ?");
    params.push(filters.route);
  }

  if (filters.sourceAnchor) {
    clauses.push("t.sourceAnchor = ?");
    params.push(filters.sourceAnchor);
  }

  const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db.prepare(`
    SELECT
      t.*,
      COALESCE(NULLIF(t.assignedName, ''), u.name) AS assignedNameResolved,
      c.name AS createdByName
    FROM Tasks t
    LEFT JOIN Users u ON u.id = t.assignedTo
    LEFT JOIN Users c ON c.id = t.createdBy
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
      t.updatedAt DESC,
      t.createdAt DESC
  `).all(...params) as Array<Record<string, unknown>>;

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
      comments: commentsByTask.get(Number(row.id)) ?? [],
    })
  );
}

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const route = searchParams.get("route");
  const sourceAnchor = searchParams.get("sourceAnchor");
  const includeCompleted = searchParams.get("includeCompleted") === "1";
  const tasks = fetchDashboardTasks({ route, sourceAnchor, includeCompleted });
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
  const sourceRoute = typeof body.sourceRoute === "string" && body.sourceRoute.trim() ? body.sourceRoute.trim() : "/production-dashboard-2";
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

  const db = getDb();
  const result = db.prepare(`
    INSERT INTO Tasks (
      propertyId, taskType, title, description, status, priority,
      assignedTo, assignedName, assignedRole, assignedTeamLead, createdBy,
      dueDate, followUpAt, taskDate, sourceRoute, sourceLabel, sourceAnchor,
      sourcePage, sourceSection, relatedOta, relatedCity, bucket, aiSummary,
      aiInsight, tags, createdAt, updatedAt
    )
    VALUES (
      ?, ?, ?, ?, 'open', ?,
      ?, ?, ?, ?, ?,
      ?, ?, date('now','localtime'), ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, datetime('now'), datetime('now')
    )
  `).run(
    propertyId,
    taskType,
    title,
    description || null,
    priority,
    assignedTo,
    assignedName,
    member?.role ?? null,
    member?.teamLead ?? null,
    session.id,
    dueDate,
    followUpAt,
    sourceRoute,
    sourceLabel,
    sourceAnchor,
    deriveSourcePageLabel(sourceRoute),
    sourceSection,
    relatedOta,
    relatedCity,
    enriched.bucket,
    enriched.aiSummary,
    enriched.aiInsight,
    tags,
  );

  if (description) {
    db.prepare(`
      INSERT INTO TaskComments (taskId, comment, commentType, createdBy, createdByName, createdAt)
      VALUES (?, ?, 'update', ?, ?, datetime('now'))
    `).run(result.lastInsertRowid, description, session.id, session.name);
  }

  if (assignedName || assignedTo) {
    createTaskNotification(db, {
      taskId: Number(result.lastInsertRowid),
      type: "assignment",
      title: `New task assigned: ${title}`,
      message: `${session.name} assigned you a ${priority} priority task from ${sourceLabel}.`,
      recipientUserId: assignedTo,
      recipientName: assignedName,
      metadata: {
        taskId: Number(result.lastInsertRowid),
        sourceRoute,
        sourceAnchor,
      },
    });
  }

  const tasks = fetchDashboardTasks({ includeCompleted: false });
  const createdTask = tasks.find((task) => task.id === Number(result.lastInsertRowid)) ?? null;

  return Response.json({
    task: createdTask,
    insights: buildDashboardTaskInsights(tasks),
  });
}
