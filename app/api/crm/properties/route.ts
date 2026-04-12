import { getSql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search          = searchParams.get("search")    ?? "";
  const otaFilter       = searchParams.get("ota")       ?? "all";
  const statusFilter    = searchParams.get("status")    ?? "all";
  const subStatusFilter = searchParams.get("subStatus") ?? "all";
  const fhFrom       = searchParams.get("fhFrom")  ?? "";
  const fhTo         = searchParams.get("fhTo")    ?? "";
  const otaFrom      = searchParams.get("otaFrom") ?? "";
  const otaTo        = searchParams.get("otaTo")   ?? "";
  const fhStatusRaw    = searchParams.get("fhStatus") ?? "";
  const fhStatusFilter = fhStatusRaw ? fhStatusRaw.split(",").filter(Boolean) : [];
  const exportAll    = searchParams.get("export") === "1";
  const page         = parseInt(searchParams.get("page") ?? "1", 10);
  const limit        = exportAll ? 99999 : 50;
  const offset       = exportAll ? 0 : (page - 1) * limit;

  const SORT_MAP: Record<string, string> = {
    name:       "c.property_name",
    city:       "c.city",
    fhLiveDate: "c.fh_live_date",
    fhStatus:   "c.fh_status",
    taskDue:    "task_due",
  };
  const sortByRaw  = searchParams.get("sortBy")  ?? "name";
  const sortDirRaw = searchParams.get("sortDir") ?? "asc";
  const sortCol    = SORT_MAP[sortByRaw] ?? "c.property_name";
  const sortDir    = sortDirRaw === "desc" ? "DESC" : "ASC";
  const nullsLast  = sortByRaw === "taskDue" || sortByRaw === "fhLiveDate" ? " NULLS LAST" : "";

  const sql = getSql();

  const conditions: string[] = [];
  const params: unknown[] = [];
  const p = () => params.length;

  // ── Role-based access control ──────────────────────────────
  if (session.role === "intern") {
    if (session.ota) {
      params.push(session.ota);
      conditions.push(`c.ota = $${p()}`);
    } else {
      params.push(session.id);
      conditions.push(`c.assigned_to = $${p()}`);
    }
  } else if (session.role === "tl") {
    const internRows = await sql`
      SELECT id FROM users
      WHERE team_lead = ${session.name} AND role = 'intern' AND active = 1
    ` as { id: string }[];

    if (internRows.length === 0) {
      return Response.json({ rows: [], total: 0, page, limit });
    }

    const inPlaceholders = internRows.map(r => {
      params.push(r.id);
      return `$${p()}`;
    }).join(", ");
    conditions.push(`c.assigned_to IN (${inPlaceholders})`);
  }

  // ── User-driven filters ────────────────────────────────────
  if (otaFilter !== "all") {
    params.push(otaFilter);
    conditions.push(`c.ota = $${p()}`);
  }

  if (statusFilter !== "all") {
    params.push(statusFilter.toLowerCase());
    conditions.push(`LOWER(c.status) = $${p()}`);
  }

  if (subStatusFilter !== "all") {
    params.push(subStatusFilter.toLowerCase());
    conditions.push(`LOWER(c.sub_status) = $${p()}`);
  }

  if (search) {
    params.push(`%${search}%`);
    const idx = p();
    conditions.push(`(c.property_name ILIKE $${idx} OR c.property_id ILIKE $${idx} OR c.city ILIKE $${idx})`);
  }

  if (fhStatusFilter.length > 0) {
    const placeholders = fhStatusFilter.map(s => { params.push(s); return `$${p()}`; }).join(", ");
    conditions.push(`c.fh_status IN (${placeholders})`);
  }

  if (fhFrom)  { params.push(fhFrom);  conditions.push(`c.fh_live_date::date >= $${p()}`); }
  if (fhTo)    { params.push(fhTo);    conditions.push(`c.fh_live_date::date <= $${p()}`); }
  if (otaFrom) { params.push(otaFrom); conditions.push(`c.live_date::date >= $${p()}`); }
  if (otaTo)   { params.push(otaTo);   conditions.push(`c.live_date::date <= $${p()}`); }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";
  const countParams = [...params];

  params.push(limit);
  const limitIdx = p();
  params.push(offset);
  const offsetIdx = p();

  const innerCte = `
    SELECT
      inv.property_id, inv.property_name, inv.city, inv.fh_status, inv.fh_live_date,
      ol.id AS ota_listing_id, ol.ota, ol.ota_id, ol.status, ol.sub_status, ol.live_date,
      COALESCE(NULLIF(ol.tat, 0), CASE WHEN inv.fh_live_date IS NOT NULL THEN CURRENT_DATE - inv.fh_live_date::date ELSE NULL END) AS tat,
      ol.tat_error, ol.pre_post, ol.listing_link, ol.batch_number, ol.assigned_to, ol.crm_note, ol.crm_updated_at
    FROM inventory inv
    JOIN ota_listing ol ON ol.property_id = inv.property_id
    WHERE 1=1
  `;

  if (exportAll) {
    // Export: flat rows (one per property×OTA)
    const rowsQuery = `
      SELECT
        c.ota_listing_id                                       AS "otaListingId",
        c.property_id                                          AS "propertyId",
        c.property_name                                        AS name,
        c.city,
        c.fh_status                                            AS "fhStatus",
        c.fh_live_date                                         AS "fhLiveDate",
        c.ota,
        c.ota_id                                               AS "otaId",
        COALESCE(NULLIF(TRIM(c.status),     ''), 'New')        AS status,
        COALESCE(NULLIF(TRIM(c.sub_status), ''), 'New')        AS "subStatus",
        c.live_date                                            AS "liveDate",
        c.tat,
        c.pre_post                                             AS "prePost",
        c.listing_link                                         AS "listingLink",
        c.batch_number                                         AS "batchNumber",
        c.assigned_to                                          AS "assignedTo",
        c.crm_note                                             AS "crmNote",
        c.crm_updated_at                                       AS "crmUpdatedAt",
        u.name                                                 AS "assignedName"
      FROM (${innerCte}) c
      LEFT JOIN users u ON u.id = c.assigned_to
      ${where}
      ORDER BY c.property_name ASC, c.ota ASC
    `;
    const rows = await sql.query(rowsQuery, countParams as unknown[]);
    return Response.json({ rows, total: (rows as unknown[]).length, page, limit });
  }

  // Grouped: one row per property with OTA array
  const rowsQuery = `
    SELECT
      c.property_id                  AS id,
      c.property_name                AS name,
      c.city,
      c.fh_status                    AS "fhStatus",
      c.fh_live_date                 AS "fhLiveDate",
      json_agg(json_build_object(
        'ota',       c.ota,
        'otaId',     c.ota_id,
        'status',    COALESCE(NULLIF(TRIM(c.status),     ''), 'New'),
        'subStatus', COALESCE(NULLIF(TRIM(c.sub_status), ''), 'New'),
        'liveDate',  c.live_date
      ) ORDER BY c.ota)              AS otas,
      (SELECT MIN(t.due_date) FROM tasks t
       WHERE t.property_id = c.property_id
         AND t.status = 'open'
         AND t.due_date IS NOT NULL) AS "taskDueDate",
      (SELECT MIN(t.due_date) FROM tasks t
       WHERE t.property_id = c.property_id
         AND t.status = 'open'
         AND t.due_date IS NOT NULL) AS task_due
    FROM (${innerCte}) c
    ${where}
    GROUP BY c.property_id, c.property_name, c.city, c.fh_status, c.fh_live_date
    ORDER BY ${sortCol} ${sortDir}${nullsLast}
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
  `;

  const countQuery = `
    SELECT COUNT(DISTINCT c.property_id) AS n
    FROM (${innerCte}) c
    ${where}
  `;

  const [rows, countRows] = await Promise.all([
    sql.query(rowsQuery, params as unknown[]),
    sql.query(countQuery, countParams as unknown[]),
  ]);

  const total = Number((countRows[0] as { n: string | number }).n);
  return Response.json({ rows, total, page, limit });
}
