import { getSql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getSql();

  // OTA-scoped users (interns with an assigned OTA) see only their OTA's data
  const otaCond   = session.ota ? `AND ol.ota = $1` : "";
  const otaParams = session.ota ? [session.ota]     : [];

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
    // subStatus counts — active properties only
    sql.query(
      `SELECT LOWER(COALESCE(NULLIF(TRIM(ol.sub_status), ''), 'New')) AS "subStatus",
              COUNT(*) AS cnt
       FROM ota_listing ol
       JOIN inventory inv ON inv.property_id = ol.property_id
         AND inv.fh_status IN ('Live','SoldOut')
       ${otaCond}
       GROUP BY LOWER(COALESCE(NULLIF(TRIM(ol.sub_status), ''), 'New'))
       ORDER BY cnt DESC`,
      otaParams
    ),

    // status counts — active properties only
    sql.query(
      `SELECT LOWER(COALESCE(NULLIF(TRIM(ol.status), ''), 'New')) AS status,
              COUNT(*) AS cnt
       FROM ota_listing ol
       JOIN inventory inv ON inv.property_id = ol.property_id
         AND inv.fh_status IN ('Live','SoldOut')
       ${otaCond}
       GROUP BY LOWER(COALESCE(NULLIF(TRIM(ol.status), ''), 'New'))
       ORDER BY cnt DESC`,
      otaParams
    ),

    // Per-OTA breakdown — active properties only
    sql.query(
      `SELECT ol.ota,
              COUNT(*) AS total,
              SUM(CASE WHEN LOWER(ol.sub_status) = 'live' THEN 1 ELSE 0 END) AS live,
              SUM(CASE WHEN LOWER(ol.sub_status) = 'not live' THEN 1 ELSE 0 END) AS "notLive",
              SUM(CASE WHEN LOWER(ol.sub_status) IN ('ready to go live','content in progress','listing in progress') THEN 1 ELSE 0 END) AS "inProgress"
       FROM ota_listing ol
       JOIN inventory inv ON inv.property_id = ol.property_id
         AND inv.fh_status IN ('Live','SoldOut')
       ${otaCond}
       GROUP BY ol.ota
       ORDER BY live DESC`,
      otaParams
    ),

    // FH pipeline: active properties, today through D-29 (30 days)
    // Use IST timezone offset (+5:30) so dates match the sheet dates
    Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        sql.query(
          `SELECT COUNT(*) AS n FROM inventory WHERE fh_status IN ('Live','SoldOut') AND (fh_live_date AT TIME ZONE 'Asia/Kolkata')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date - INTERVAL '${i} days'`
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

  // Coerce Postgres numeric strings to JS numbers
  const statusCountsN    = (statusCounts    as Record<string,unknown>[]).map(r => ({ subStatus: r.subStatus, cnt: Number(r.cnt) }));
  const statusTopCountsN = (statusTopCounts as Record<string,unknown>[]).map(r => ({ status: r.status, cnt: Number(r.cnt) }));
  const otaBreakdownN    = (otaBreakdown    as Record<string,unknown>[]).map(r => ({
    ota: r.ota, total: Number(r.total), live: Number(r.live), notLive: Number(r.notLive), inProgress: Number(r.inProgress),
  }));

  return Response.json({
    statusCounts:    statusCountsN,
    statusTopCounts: statusTopCountsN,
    otaBreakdown:    otaBreakdownN,
    tasksOpen,
    tasksHigh,
    tasksOverdue,
    tasksDone,
    recentLogs,
    openTasks,
    fhPipeline,
  });
}
