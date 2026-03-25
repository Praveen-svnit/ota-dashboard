import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search    = searchParams.get("search") ?? "";
  const otaFilter = searchParams.get("ota")    ?? "all";
  const statusFilter = searchParams.get("status") ?? "all";
  const page      = parseInt(searchParams.get("page") ?? "1", 10);
  const limit     = 50;
  const offset    = (page - 1) * limit;

  const db = getDb();

  // Build WHERE conditions
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  // Role-based filtering
  if (session.role === "intern" && session.ota) {
    conditions.push("ol.ota = ?");
    params.push(session.ota);
  } else if (otaFilter !== "all") {
    conditions.push("ol.ota = ?");
    params.push(otaFilter);
  }

  if (statusFilter !== "all") {
    conditions.push("LOWER(ol.status) = LOWER(?)");
    params.push(statusFilter);
  }

  if (search) {
    conditions.push("(p.name LIKE ? OR p.id LIKE ? OR p.city LIKE ?)");
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const where = conditions.length ? "WHERE " + conditions.join(" AND ") : "";

  const rows = db.prepare(`
    SELECT p.id, p.name, p.city, p.fhStatus, p.fhLiveDate,
           ol.ota, ol.status, ol.subStatus, ol.liveDate, ol.tat, ol.tatError,
           ol.assignedTo, ol.crmNote, ol.crmUpdatedAt,
           u.name AS assignedName,
           (SELECT COUNT(*) FROM PropertyLog pl WHERE pl.propertyId = p.id) AS logCount,
           g.gmbStatus, g.gmbSubStatus, g.listingType, g.gmbRating, g.gmbReviewCount
    FROM Property p
    JOIN OtaListing ol ON ol.propertyId = p.id
    LEFT JOIN Users u ON u.id = ol.assignedTo
    LEFT JOIN GmbTracker g ON g.propertyId = p.id
    ${where}
    ORDER BY p.name ASC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as Array<{
    id: string; name: string; city: string; fhStatus: string; fhLiveDate: string;
    ota: string; status: string; subStatus: string; liveDate: string;
    tat: number; tatError: number; assignedTo: string; crmNote: string;
    crmUpdatedAt: string; assignedName: string; logCount: number;
    gmbStatus: string; gmbSubStatus: string; listingType: string;
    gmbRating: string; gmbReviewCount: string;
  }>;

  const totalRow = db.prepare(`
    SELECT COUNT(*) as n FROM Property p
    JOIN OtaListing ol ON ol.propertyId = p.id
    ${where}
  `).get(...params) as { n: number };

  return Response.json({ rows, total: totalRow.n, page, limit });
}
