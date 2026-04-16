import { getSql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const otasParam = searchParams.get("otas") ?? "";
  const requested = otasParam ? otasParam.split(",").map(s => s.trim()).filter(Boolean) : [];

  // If the user has an assigned OTA, lock the scope to that OTA regardless of what was requested
  const effectiveOtas: string[] = session.ota
    ? [session.ota]
    : requested;

  const sql = getSql();

  const otaCond   = effectiveOtas.length > 0 ? `WHERE ota = ANY($1)` : "";
  const otaParams = effectiveOtas.length > 0 ? [effectiveOtas]       : [];

  const [statusCounts, statusTopCounts] = await Promise.all([
    sql.query(
      `SELECT LOWER(COALESCE(NULLIF(TRIM(sub_status), ''), 'New')) AS "subStatus", COUNT(*) AS cnt
       FROM ota_listing ol
       JOIN inventory inv ON inv.property_id = ol.property_id AND inv.fh_status IN ('Live','SoldOut')
       ${otaCond}
       GROUP BY LOWER(COALESCE(NULLIF(TRIM(sub_status), ''), 'New'))
       ORDER BY cnt DESC`,
      otaParams
    ),
    sql.query(
      `SELECT LOWER(COALESCE(NULLIF(TRIM(status), ''), 'New')) AS status, COUNT(*) AS cnt
       FROM ota_listing ol
       JOIN inventory inv ON inv.property_id = ol.property_id AND inv.fh_status IN ('Live','SoldOut')
       ${otaCond}
       GROUP BY LOWER(COALESCE(NULLIF(TRIM(status), ''), 'New'))
       ORDER BY cnt DESC`,
      otaParams
    ),
  ]);

  return Response.json({ statusCounts, statusTopCounts });
}
