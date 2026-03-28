import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search       = searchParams.get("search") ?? "";
  const otaFilter    = searchParams.get("ota")    ?? "all";
  const statusFilter = searchParams.get("status") ?? "all";
  const fhFrom       = searchParams.get("fhFrom")  ?? "";
  const fhTo         = searchParams.get("fhTo")    ?? "";
  const otaFrom      = searchParams.get("otaFrom") ?? "";
  const otaTo        = searchParams.get("otaTo")   ?? "";
  const exportAll    = searchParams.get("export") === "1";
  const page         = parseInt(searchParams.get("page") ?? "1", 10);
  const limit        = exportAll ? 99999 : 50;
  const offset       = exportAll ? 0 : (page - 1) * limit;

  const db = getDb();

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  // ── Role-based access control ──────────────────────────────
  if (session.role === "intern") {
    conditions.push("c.assignedTo = ?");
    params.push(session.id);
  } else if (session.role === "tl") {
    const internRows = db.prepare(
      "SELECT id FROM Users WHERE teamLead = ? AND role = 'intern' AND active = 1"
    ).all(session.name) as { id: string }[];

    if (internRows.length === 0) {
      return Response.json({ rows: [], total: 0, page, limit });
    }
    const placeholders = internRows.map(() => "?").join(",");
    conditions.push(`c.assignedTo IN (${placeholders})`);
    internRows.forEach(r => params.push(r.id));
  }

  // ── User-driven filters ────────────────────────────────────
  if (otaFilter !== "all") {
    conditions.push("c.ota = ?");
    params.push(otaFilter);
  }

  if (statusFilter !== "all") {
    conditions.push("LOWER(c.status) = LOWER(?)");
    params.push(statusFilter);
  }

  if (search) {
    conditions.push("(c.name LIKE ? OR c.id LIKE ? OR c.city LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }
  if (fhFrom) { conditions.push("DATE(c.fhLiveDate) >= ?"); params.push(fhFrom); }
  if (fhTo)   { conditions.push("DATE(c.fhLiveDate) <= ?"); params.push(fhTo); }
  if (otaFrom) { conditions.push("DATE(c.liveDate) >= ?"); params.push(otaFrom); }
  if (otaTo)   { conditions.push("DATE(c.liveDate) <= ?"); params.push(otaTo); }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  const rows = db.prepare(`
    WITH combined AS (
      SELECT p.id, p.name, p.city, p.fhStatus, p.fhLiveDate,
             ol.ota, ol.status, ol.subStatus, ol.liveDate,
             ol.tat, ol.tatError, ol.assignedTo, ol.crmNote, ol.crmUpdatedAt
      FROM Property p JOIN OtaListing ol ON ol.propertyId = p.id
      UNION ALL
      SELECT p.id, p.name, p.city, p.fhStatus, p.fhLiveDate,
             'GMB' AS ota, g.gmbStatus AS status, g.gmbSubStatus AS subStatus, NULL AS liveDate,
             0 AS tat, 0 AS tatError, NULL AS assignedTo, NULL AS crmNote, NULL AS crmUpdatedAt
      FROM Property p JOIN GmbTracker g ON g.propertyId = p.id
    )
    SELECT c.id, c.name, c.city, c.fhStatus, c.fhLiveDate,
           c.ota,
           COALESCE(NULLIF(TRIM(c.status),''), 'New')    AS status,
           COALESCE(NULLIF(TRIM(c.subStatus),''), 'New') AS subStatus,
           c.liveDate,
           c.tat, c.tatError, c.assignedTo, c.crmNote, c.crmUpdatedAt,
           u.name AS assignedName,
           (SELECT MIN(t.dueDate) FROM Tasks t WHERE t.propertyId = c.id AND t.status = 'open' AND t.dueDate IS NOT NULL) AS taskDueDate
    FROM combined c
    LEFT JOIN Users u ON u.id = c.assignedTo
    ${where}
    ORDER BY c.name ASC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as Array<{
    id: string; name: string; city: string; fhStatus: string; fhLiveDate: string;
    ota: string; status: string; subStatus: string; liveDate: string;
    tat: number; tatError: number; assignedTo: string; crmNote: string;
    crmUpdatedAt: string; assignedName: string; taskDueDate: string | null;
  }>;

  const totalRow = db.prepare(`
    WITH combined AS (
      SELECT p.id, p.name, p.city, p.fhStatus, p.fhLiveDate,
             ol.ota, ol.status, ol.subStatus, ol.assignedTo
      FROM Property p JOIN OtaListing ol ON ol.propertyId = p.id
      UNION ALL
      SELECT p.id, p.name, p.city, p.fhStatus, p.fhLiveDate,
             'GMB' AS ota, g.gmbStatus AS status, g.gmbSubStatus AS subStatus, NULL AS assignedTo
      FROM Property p JOIN GmbTracker g ON g.propertyId = p.id
    )
    SELECT COUNT(*) as n FROM combined c
    ${where}
  `).get(...params) as { n: number };

  return Response.json({ rows, total: totalRow.n, page, limit });
}
