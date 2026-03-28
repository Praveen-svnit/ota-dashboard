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

  if (status !== "all") {
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

  // Counts for summary
  const counts = db.prepare(`
    SELECT status, priority, COUNT(*) as cnt FROM Tasks GROUP BY status, priority
  `).all() as { status: string; priority: string; cnt: number }[];

  const assignees = db.prepare(`
    SELECT DISTINCT COALESCE(NULLIF(t.assignedName,''), u.name) as name
    FROM Tasks t LEFT JOIN Users u ON u.id = t.assignedTo
    WHERE name IS NOT NULL AND name != ''
    ORDER BY name
  `).all() as { name: string }[];

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
