import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();

  // Overall subStatus counts
  const statusCounts = db.prepare(`
    SELECT LOWER(subStatus) as subStatus, COUNT(*) as cnt
    FROM OtaListing
    WHERE subStatus IS NOT NULL AND subStatus != ''
    GROUP BY LOWER(subStatus)
    ORDER BY cnt DESC
  `).all() as { subStatus: string; cnt: number }[];

  // Per-OTA breakdown: live vs total
  const otaBreakdown = db.prepare(`
    SELECT ota,
      COUNT(*) as total,
      SUM(CASE WHEN LOWER(subStatus) = 'live' THEN 1 ELSE 0 END) as live,
      SUM(CASE WHEN LOWER(subStatus) = 'not live' THEN 1 ELSE 0 END) as notLive,
      SUM(CASE WHEN LOWER(subStatus) IN ('ready to go live','content in progress','listing in progress') THEN 1 ELSE 0 END) as inProgress
    FROM OtaListing
    GROUP BY ota
    ORDER BY live DESC
  `).all() as { ota: string; total: number; live: number; notLive: number; inProgress: number }[];

  // Task counts
  const tasksOpen = (db.prepare(`SELECT COUNT(*) as n FROM Tasks WHERE status = 'open'`).get() as { n: number }).n;
  const tasksHigh = (db.prepare(`SELECT COUNT(*) as n FROM Tasks WHERE status = 'open' AND priority = 'high'`).get() as { n: number }).n;
  const tasksOverdue = (db.prepare(`SELECT COUNT(*) as n FROM Tasks WHERE status = 'open' AND dueDate IS NOT NULL AND dueDate < date('now','localtime')`).get() as { n: number }).n;
  const tasksDone = (db.prepare(`SELECT COUNT(*) as n FROM Tasks WHERE status = 'done'`).get() as { n: number }).n;

  // Recent activity (last 5 logs)
  const recentLogs = db.prepare(`
    SELECT pl.action, pl.field, pl.oldValue, pl.newValue, pl.note, pl.createdAt,
           u.name as userName, p.name as propName, p.id as propId, pl.otaListingId
    FROM PropertyLog pl
    LEFT JOIN Users u ON u.id = pl.userId
    LEFT JOIN Property p ON p.id = pl.propertyId
    ORDER BY pl.createdAt DESC
    LIMIT 8
  `).all() as { action: string; field: string; oldValue: string; newValue: string; note: string; createdAt: string; userName: string; propName: string; propId: string; otaListingId: number }[];

  // Top 5 open tasks
  const openTasks = db.prepare(`
    SELECT t.id, t.propertyId, t.title, t.priority, t.dueDate, t.assignedTo,
           u.name as assignedName, p.name as propName
    FROM Tasks t
    LEFT JOIN Users u ON u.id = t.assignedTo
    LEFT JOIN Property p ON p.id = t.propertyId
    WHERE t.status = 'open'
    ORDER BY
      CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      t.dueDate ASC
    LIMIT 10
  `).all() as { id: number; propertyId: string; title: string; priority: string; dueDate: string; assignedTo: string; assignedName: string; propName: string }[];

  return Response.json({ statusCounts, otaBreakdown, tasksOpen, tasksHigh, tasksOverdue, tasksDone, recentLogs, openTasks });
}
