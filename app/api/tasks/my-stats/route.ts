import { getSql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getSql();
  const today = new Date().toISOString().split("T")[0];
  const monthStart = today.slice(0, 7) + "-01";
  const weekStart = (() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().split("T")[0];
  })();

  const userName = session.name;
  const userId = session.id;

  const [
    totalAssignedRows,
    openTasksRows,
    overdueRows,
    doneThisMonthRows,
    doneThisWeekRows,
  ] = await Promise.all([
    sql`SELECT COUNT(*) AS n FROM tasks t WHERE (t.assigned_to = ${userId} OR t.assigned_name = ${userName})`,
    sql`SELECT COUNT(*) AS n FROM tasks t WHERE (t.assigned_to = ${userId} OR t.assigned_name = ${userName}) AND t.status = 'open'`,
    sql`SELECT COUNT(*) AS n FROM tasks t WHERE (t.assigned_to = ${userId} OR t.assigned_name = ${userName}) AND t.status = 'open' AND t.due_date < ${today}`,
    sql`SELECT COUNT(*) AS n FROM tasks t WHERE (t.assigned_to = ${userId} OR t.assigned_name = ${userName}) AND t.status = 'done' AND t.completed_at >= ${monthStart}`,
    sql`SELECT COUNT(*) AS n FROM tasks t WHERE (t.assigned_to = ${userId} OR t.assigned_name = ${userName}) AND t.status = 'done' AND t.completed_at >= ${weekStart}`,
  ]);

  const totalAssigned = Number(totalAssignedRows[0].n);
  const openTasks = Number(openTasksRows[0].n);
  const overdue = Number(overdueRows[0].n);
  const doneThisMonth = Number(doneThisMonthRows[0].n);
  const doneThisWeek = Number(doneThisWeekRows[0].n);

  const recentDone = await sql`
    SELECT
      t.id,
      t.title,
      t.completed_at AS "completedAt",
      t.completion_comment AS "completionComment",
      p.property_name AS "propName"
    FROM tasks t
    LEFT JOIN inventory p ON p.id = t.property_id
    WHERE (t.assigned_to = ${userId} OR t.assigned_name = ${userName})
      AND t.status = 'done'
    ORDER BY t.completed_at DESC
    LIMIT 5
  ` as { id: number; title: string; completedAt: string; completionComment: string; propName: string }[];

  const myOpen = await sql`
    SELECT
      t.id,
      t.title,
      t.priority,
      t.due_date AS "dueDate",
      p.property_name AS "propName",
      p.id AS "propId"
    FROM tasks t
    LEFT JOIN inventory p ON p.id = t.property_id
    WHERE (t.assigned_to = ${userId} OR t.assigned_name = ${userName})
      AND t.status = 'open'
    ORDER BY CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, t.due_date ASC
    LIMIT 10
  ` as { id: number; title: string; priority: string; dueDate: string; propName: string; propId: string }[];

  return Response.json({
    userName,
    totalAssigned,
    openTasks,
    overdue,
    doneThisMonth,
    doneThisWeek,
    recentDone,
    myOpen,
  });
}
