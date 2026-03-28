import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status   = searchParams.get("status") ?? "open";
  const priority = searchParams.get("priority") ?? "all";
  const assignee = searchParams.get("assignee") ?? "all";
  const search   = searchParams.get("search") ?? "";

  const db = getDb();

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  // ── Role-based access control ──────────────────────────────
  if (session.role === "intern") {
    // Intern: only their own tasks
    conditions.push("t.assignedTo = ?");
    params.push(session.id);

  } else if (session.role === "tl") {
    // TL: tasks assigned to their interns
    const internRows = db.prepare(
      "SELECT id FROM Users WHERE teamLead = ? AND role = 'intern' AND active = 1"
    ).all(session.name) as { id: string }[];

    if (internRows.length === 0) {
      return Response.json({ tasks: [], counts: [], assignees: [] });
    }
    const placeholders = internRows.map(() => "?").join(",");
    conditions.push(`t.assignedTo IN (${placeholders})`);
    internRows.forEach(r => params.push(r.id));
  }
  // head / admin: no role restriction

  // ── User-driven filters ────────────────────────────────────
  if (status === "overdue") {
    conditions.push("t.status = 'open'");
    conditions.push("t.dueDate IS NOT NULL");
    conditions.push("t.dueDate < date('now','localtime')");
  } else if (status !== "all") {
    conditions.push("t.status = ?");
    params.push(status);
  }
  if (priority !== "all") {
    conditions.push("t.priority = ?");
    params.push(priority);
  }
  if (assignee !== "all") {
    conditions.push("(t.assignedTo = ? OR t.assignedName = ?)");
    params.push(assignee, assignee);
  }
  if (search) {
    conditions.push("(t.title LIKE ? OR p.name LIKE ? OR p.city LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  // Build a role-scoped base filter for counts/assignees (without status/priority/assignee/search)
  const roleConditions: string[] = [];
  const roleParams: (string | number)[] = [];
  if (session.role === "intern") {
    roleConditions.push("t.assignedTo = ?");
    roleParams.push(session.id);
  } else if (session.role === "tl") {
    const internRows = db.prepare(
      "SELECT id FROM Users WHERE teamLead = ? AND role = 'intern' AND active = 1"
    ).all(session.name) as { id: string }[];
    if (internRows.length > 0) {
      const placeholders = internRows.map(() => "?").join(",");
      roleConditions.push(`t.assignedTo IN (${placeholders})`);
      internRows.forEach(r => roleParams.push(r.id));
    }
  }
  const roleWhere = roleConditions.length ? "WHERE " + roleConditions.join(" AND ") : "";

  const tasks = db.prepare(`
    SELECT t.id, t.propertyId, t.title, t.description, t.status, t.priority,
           t.assignedTo, t.assignedName, t.dueDate, t.createdAt, t.completedAt,
           t.relatedOta, t.completionComment,
           p.name as propName, p.city as propCity,
           COALESCE(NULLIF(t.assignedName,''), u.name) as displayAssignee
    FROM Tasks t
    LEFT JOIN Property p ON p.id = t.propertyId
    LEFT JOIN Users u ON u.id = t.assignedTo
    ${where}
    ORDER BY
      CASE t.status WHEN 'open' THEN 0 ELSE 1 END,
      CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      t.dueDate ASC,
      t.createdAt DESC
    LIMIT 200
  `).all(...params);

  const counts = db.prepare(`
    SELECT status, priority, COUNT(*) as cnt FROM Tasks t ${roleWhere} GROUP BY status, priority
  `).all(...roleParams) as { status: string; priority: string; cnt: number }[];

  const assignees = db.prepare(`
    SELECT DISTINCT COALESCE(NULLIF(t.assignedName,''), u.name) as name
    FROM Tasks t LEFT JOIN Users u ON u.id = t.assignedTo
    ${roleWhere ? roleWhere + " AND" : "WHERE"} name IS NOT NULL AND name != ''
    ORDER BY name
  `).all(...roleParams) as { name: string }[];

  return Response.json({ tasks, counts, assignees });
}

export async function PATCH(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id, status, completionComment } = await req.json();
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  const db = getDb();
  db.prepare(`
    UPDATE Tasks SET status = ?, completionComment = ?, completedAt = ?, updatedAt = datetime('now')
    WHERE id = ?
  `).run(status, completionComment || null, status === "done" ? new Date().toISOString() : null, id);

  return Response.json({ ok: true });
}
