import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const today     = new Date().toISOString().split("T")[0];
  const monthStart = today.slice(0, 7) + "-01";
  const weekStart  = (() => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay()); return d.toISOString().split("T")[0];
  })();

  // Match by user id OR name
  const userName = session.name;
  const userId   = session.id;

  const base = `(t.assignedTo = ? OR t.assignedName = ?)`;
  const args = [userId, userName];

  const totalAssigned = (db.prepare(`SELECT COUNT(*) as n FROM Tasks t WHERE ${base}`).get(...args) as { n: number }).n;
  const openTasks     = (db.prepare(`SELECT COUNT(*) as n FROM Tasks t WHERE ${base} AND t.status = 'open'`).get(...args) as { n: number }).n;
  const overdue       = (db.prepare(`SELECT COUNT(*) as n FROM Tasks t WHERE ${base} AND t.status = 'open' AND t.dueDate < ?`).get(...args, today) as { n: number }).n;
  const doneThisMonth = (db.prepare(`SELECT COUNT(*) as n FROM Tasks t WHERE ${base} AND t.status = 'done' AND t.completedAt >= ?`).get(...args, monthStart) as { n: number }).n;
  const doneThisWeek  = (db.prepare(`SELECT COUNT(*) as n FROM Tasks t WHERE ${base} AND t.status = 'done' AND t.completedAt >= ?`).get(...args, weekStart) as { n: number }).n;

  // Recent completions
  const recentDone = db.prepare(`
    SELECT t.id, t.title, t.completedAt, t.completionComment, p.name as propName
    FROM Tasks t
    LEFT JOIN Property p ON p.id = t.propertyId
    WHERE ${base} AND t.status = 'done'
    ORDER BY t.completedAt DESC
    LIMIT 5
  `).all(...args) as { id: number; title: string; completedAt: string; completionComment: string; propName: string }[];

  // My open tasks (priority sorted)
  const myOpen = db.prepare(`
    SELECT t.id, t.title, t.priority, t.dueDate, p.name as propName, p.id as propId
    FROM Tasks t
    LEFT JOIN Property p ON p.id = t.propertyId
    WHERE ${base} AND t.status = 'open'
    ORDER BY CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, t.dueDate ASC
    LIMIT 10
  `).all(...args) as { id: number; title: string; priority: string; dueDate: string; propName: string; propId: string }[];

  return Response.json({
    userName, totalAssigned, openTasks, overdue, doneThisMonth, doneThisWeek, recentDone, myOpen,
  });
}
