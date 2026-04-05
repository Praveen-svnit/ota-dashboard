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
      ol.ota, ol.status, ol.sub_status, ol.live_date,
      ol.tat, ol.tat_error, ol.assigned_to, ol.crm_note, ol.crm_updated_at
    FROM inventory inv
    JOIN ota_listing ol ON ol.property_id = inv.property_id
    WHERE 1=1
  `;

  if (exportAll) {
    // Export: flat rows (one per property×OTA)
    const rowsQuery = `
      SELECT
        c.property_id                                          AS id,
        c.property_name                                        AS name,
        c.city,
        c.fh_status                                            AS "fhStatus",
        c.fh_live_date                                         AS "fhLiveDate",
        c.ota,
        COALESCE(NULLIF(TRIM(c.status),     ''), 'New')        AS status,
        COALESCE(NULLIF(TRIM(c.sub_status), ''), 'New')        AS "subStatus",
        c.live_date                                            AS "liveDate",
        c.assigned_to                                          AS "assignedTo",
        c.crm_note                                             AS "crmNote",
        u.name                                                 AS "assignedName",
        (SELECT MIN(t.due_date) FROM tasks t
         WHERE t.property_id = c.property_id
           AND t.status = 'open'
           AND t.due_date IS NOT NULL)                         AS "taskDueDate"
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
        'status',    COALESCE(NULLIF(TRIM(c.status),     ''), 'New'),
        'subStatus', COALESCE(NULLIF(TRIM(c.sub_status), ''), 'New'),
        'liveDate',  c.live_date
      ) ORDER BY c.ota)              AS otas,
      (SELECT MIN(t.due_date) FROM tasks t
       WHERE t.property_id = c.property_id
         AND t.status = 'open'
         AND t.due_date IS NOT NULL) AS "taskDueDate"
    FROM (${innerCte}) c
    ${where}
    GROUP BY c.property_id, c.property_name, c.city, c.fh_status, c.fh_live_date
    ORDER BY c.property_name ASC
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
