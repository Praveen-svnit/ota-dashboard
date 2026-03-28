import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const otasParam = searchParams.get("otas") ?? "";
  const otaList = otasParam ? otasParam.split(",").map(s => s.trim()).filter(Boolean) : [];

  const db = getDb();

  const otaWhere = otaList.length > 0
    ? `AND ota IN (${otaList.map(() => "?").join(",")})`
    : "";

  const statusCounts = db.prepare(`
    WITH combined AS (
      SELECT ota, COALESCE(NULLIF(TRIM(subStatus),''), 'New') AS subStatus FROM OtaListing
      UNION ALL
      SELECT 'GMB' AS ota, COALESCE(NULLIF(TRIM(gmbSubStatus),''), 'New') AS subStatus FROM GmbTracker
    )
    SELECT LOWER(subStatus) as subStatus, COUNT(*) as cnt
    FROM combined
    WHERE 1=1 ${otaWhere}
    GROUP BY LOWER(subStatus)
    ORDER BY cnt DESC
  `).all(...otaList) as { subStatus: string; cnt: number }[];

  const statusTopCounts = db.prepare(`
    WITH combined AS (
      SELECT ota, COALESCE(NULLIF(TRIM(status),''), 'New') AS status FROM OtaListing
      UNION ALL
      SELECT 'GMB' AS ota, COALESCE(NULLIF(TRIM(gmbStatus),''), 'New') AS status FROM GmbTracker
    )
    SELECT LOWER(status) as status, COUNT(*) as cnt
    FROM combined
    WHERE 1=1 ${otaWhere}
    GROUP BY LOWER(status)
    ORDER BY cnt DESC
  `).all(...otaList) as { status: string; cnt: number }[];

  return Response.json({ statusCounts, statusTopCounts });
}
