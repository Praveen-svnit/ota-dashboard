import { getSql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status      = searchParams.get("status")      ?? "open";
  const priority    = searchParams.get("priority")    ?? "all";
  const assignee    = searchParams.get("assignee")    ?? "all";
  const ota         = searchParams.get("ota")         ?? "all";
  const search      = searchParams.get("search")      ?? "";
  const dueDateFrom = searchParams.get("dueDateFrom") ?? "";
  const dueDateTo   = searchParams.get("dueDateTo")   ?? "";
  const createdFrom = searchParams.get("createdFrom") ?? "";
  const createdTo   = searchParams.get("createdTo")   ?? "";

  const sql = getSql();

  const conditions: string[] = [];
  const params: unknown[] = [];

  // ── Role-based access control ──────────────────────────────
  if (session.role === "intern") {
    // Intern: only their own tasks
    params.push(session.id);
    conditions.push(`t.assigned_to = $${params.length}`);

  } else if (session.role === "tl") {
    // TL: tasks assigned to their interns
    const internRows = await sql`
      SELECT id FROM users WHERE team_lead = ${session.name} AND role = 'intern' AND active = true
    ` as { id: string }[];

    if (internRows.length === 0) {
      return Response.json({ tasks: [], counts: [], assignees: [] });
    }
    const ids = internRows.map(r => r.id);
    params.push(...ids);
    const placeholders = ids.map((_, i) => `$${params.length - ids.length + i + 1}`).join(",");
    conditions.push(`t.assigned_to IN (${placeholders})`);
  }
  // head / admin: no role restriction

  // ── User-driven filters ────────────────────────────────────
  if (status === "overdue") {
    conditions.push("t.status = 'open'");
    conditions.push("t.due_date IS NOT NULL");
    conditions.push("t.due_date < CURRENT_DATE");
  } else if (status !== "all") {
    params.push(status);
    conditions.push(`t.status = $${params.length}`);
  }
  if (priority !== "all") {
    params.push(priority);
    conditions.push(`t.priority = $${params.length}`);
  }
  if (assignee !== "all") {
    params.push(assignee, assignee);
    conditions.push(`(t.assigned_to = $${params.length - 1} OR t.assigned_name = $${params.length})`);
  }
  if (search) {
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    conditions.push(`(t.title ILIKE $${params.length - 2} OR p.property_name ILIKE $${params.length - 1} OR p.city ILIKE $${params.length})`);
  }
  if (ota !== "all") {
    params.push(ota);
    conditions.push(`t.related_ota = $${params.length}`);
  }
  if (dueDateFrom) {
    params.push(dueDateFrom);
    conditions.push(`t.due_date::date >= $${params.length}`);
  }
  if (dueDateTo) {
    params.push(dueDateTo);
    conditions.push(`t.due_date::date <= $${params.length}`);
  }
  if (createdFrom) {
    params.push(createdFrom);
    conditions.push(`t.created_at::date >= $${params.length}`);
  }
  if (createdTo) {
    params.push(createdTo);
    conditions.push(`t.created_at::date <= $${params.length}`);
  }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  // Build a role-scoped base filter for counts/assignees (without status/priority/assignee/search)
  const roleConditions: string[] = [];
  const roleParams: unknown[] = [];

  if (session.role === "intern") {
    roleParams.push(session.id);
    roleConditions.push(`t.assigned_to = $${roleParams.length}`);
  } else if (session.role === "tl") {
    const internRows = await sql`
      SELECT id FROM users WHERE team_lead = ${session.name} AND role = 'intern' AND active = true
    ` as { id: string }[];
    if (internRows.length > 0) {
      const ids = internRows.map(r => r.id);
      roleParams.push(...ids);
      const placeholders = ids.map((_, i) => `$${roleParams.length - ids.length + i + 1}`).join(",");
      roleConditions.push(`t.assigned_to IN (${placeholders})`);
    }
  }
  const roleWhere = roleConditions.length ? "WHERE " + roleConditions.join(" AND ") : "";

  const tasksQuery = `
    SELECT t.id,
           t.property_id AS "propertyId",
           t.title,
           t.description,
           t.status,
           t.priority,
           t.assigned_to AS "assignedTo",
           t.assigned_name AS "assignedName",
           t.due_date AS "dueDate",
           t.created_at AS "createdAt",
           t.completed_at AS "completedAt",
           t.related_ota AS "relatedOta",
           t.completion_comment AS "completionComment",
           p.property_name AS "propName",
           p.city AS "propCity",
           COALESCE(NULLIF(t.assigned_name,''), u.name) AS "displayAssignee"
    FROM tasks t
    LEFT JOIN inventory p ON p.property_id = t.property_id
    LEFT JOIN users u ON u.id = t.assigned_to
    ${where}
    ORDER BY
      CASE t.status WHEN 'open' THEN 0 ELSE 1 END,
      CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      t.due_date ASC,
      t.created_at DESC
    LIMIT 200
  `;

  const countsQuery = `
    SELECT status, priority, COUNT(*) AS cnt
    FROM tasks t
    ${roleWhere}
    GROUP BY status, priority
  `;

  const assigneesQuery = `
    SELECT DISTINCT name FROM (
      SELECT COALESCE(NULLIF(t.assigned_name,''), u.name) AS name
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_to
      ${roleWhere}
    ) sub
    WHERE name IS NOT NULL AND name != ''
    ORDER BY name
  `;

  const [tasks, countsRaw, assignees] = await Promise.all([
    sql.unsafe(tasksQuery, params),
    sql.unsafe(countsQuery, roleParams),
    sql.unsafe(assigneesQuery, roleParams),
  ]);

  const counts = (countsRaw as { status: string; priority: string; cnt: string | number }[]).map(r => ({
    status: r.status,
    priority: r.priority,
    cnt: Number(r.cnt),
  }));

  return Response.json({ tasks, counts, assignees });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status, completionComment } = await req.json();
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  const sql = getSql();
  await sql`
    UPDATE tasks
    SET
      status = ${status},
      completion_comment = ${completionComment || null},
      completed_at = ${status === "done" ? new Date().toISOString() : null},
      updated_at = NOW()
    WHERE id = ${id}
  `;

  return Response.json({ ok: true });
}
