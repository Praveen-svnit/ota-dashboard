import { getSql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getSql();

  // Run all independent queries in parallel
  const [
    statusCounts,
    statusTopCounts,
    otaBreakdown,
    fhPipeline,
    [tasksOpenRow, tasksHighRow, tasksOverdueRow, tasksDoneRow],
    recentLogs,
    openTasks,
  ] = await Promise.all([
    // Overall subStatus counts — null/blank → 'New'
    sql`
      SELECT LOWER(COALESCE(NULLIF(TRIM(sub_status), ''), 'New')) AS "subStatus",
             COUNT(*) AS cnt
      FROM ota_listing
      GROUP BY LOWER(COALESCE(NULLIF(TRIM(sub_status), ''), 'New'))
      ORDER BY cnt DESC
    `,

    // Overall status counts — null/blank → 'New'
    sql`
      SELECT LOWER(COALESCE(NULLIF(TRIM(status), ''), 'New')) AS status,
             COUNT(*) AS cnt
      FROM ota_listing
      GROUP BY LOWER(COALESCE(NULLIF(TRIM(status), ''), 'New'))
      ORDER BY cnt DESC
    `,

    // Per-OTA breakdown
    sql`
      SELECT ota,
             COUNT(*) AS total,
             SUM(CASE WHEN LOWER(sub_status) = 'live' THEN 1 ELSE 0 END) AS live,
             SUM(CASE WHEN LOWER(sub_status) = 'not live' THEN 1 ELSE 0 END) AS "notLive",
             SUM(CASE WHEN LOWER(sub_status) IN ('ready to go live','content in progress','listing in progress') THEN 1 ELSE 0 END) AS "inProgress"
      FROM ota_listing
      GROUP BY ota
      ORDER BY live DESC
    `,

    // FH pipeline: 8 parallel COUNT queries (today through D-7)
    // i is a trusted integer literal (0–7), safe to embed directly in SQL
    Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        sql.query(
          `SELECT COUNT(*) AS n FROM inventory WHERE fh_live_date::date = CURRENT_DATE - INTERVAL '${i} days'`
        ).then(rows => Number((rows[0] as { n: string | number }).n))
      )
    ),

    // Task counts — 4 in parallel
    Promise.all([
      sql`SELECT COUNT(*) AS n FROM tasks WHERE status = 'open'`,
      sql`SELECT COUNT(*) AS n FROM tasks WHERE status = 'open' AND priority = 'high'`,
      sql`SELECT COUNT(*) AS n FROM tasks WHERE status = 'open' AND due_date IS NOT NULL AND due_date < CURRENT_DATE`,
      sql`SELECT COUNT(*) AS n FROM tasks WHERE status = 'done'`,
    ]),

    // Recent activity logs
    sql`
      SELECT pl.action, pl.field,
             pl.old_value AS "oldValue", pl.new_value AS "newValue",
             pl.note, pl.created_at AS "createdAt",
             u.name AS "userName",
             p.property_name AS "propName", p.property_id AS "propId",
             pl.ota_listing_id AS "otaListingId"
      FROM property_log pl
      LEFT JOIN users u ON u.id = pl.user_id
      LEFT JOIN inventory p ON p.property_id = pl.property_id
      ORDER BY pl.created_at DESC
      LIMIT 8
    `,

    // Top 10 open tasks ordered by priority then due date
    sql`
      SELECT t.id,
             t.property_id AS "propertyId",
             t.title, t.priority,
             t.due_date AS "dueDate",
             t.assigned_to AS "assignedTo",
             u.name AS "assignedName",
             p.property_name AS "propName"
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_to
      LEFT JOIN inventory p ON p.property_id = t.property_id
      WHERE t.status = 'open'
      ORDER BY
        CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        t.due_date ASC NULLS LAST
      LIMIT 10
    `,
  ]);

  const tasksOpen    = Number(tasksOpenRow[0].n);
  const tasksHigh    = Number(tasksHighRow[0].n);
  const tasksOverdue = Number(tasksOverdueRow[0].n);
  const tasksDone    = Number(tasksDoneRow[0].n);

  return Response.json({
    statusCounts,
    statusTopCounts,
    otaBreakdown,
    tasksOpen,
    tasksHigh,
    tasksOverdue,
    tasksDone,
    recentLogs,
    openTasks,
    fhPipeline,
  });
}
