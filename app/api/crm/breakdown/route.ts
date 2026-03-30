import { getSql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const otasParam = searchParams.get("otas") ?? "";
  const otaList = otasParam ? otasParam.split(",").map(s => s.trim()).filter(Boolean) : [];

  const sql = await getSql();

  const statusCounts = otaList.length > 0
    ? await sql`
        SELECT LOWER(COALESCE(NULLIF(TRIM(sub_status), ''), 'New')) AS "subStatus", COUNT(*) AS cnt
        FROM ota_listing
        WHERE ota = ANY(${otaList})
        GROUP BY LOWER(COALESCE(NULLIF(TRIM(sub_status), ''), 'New'))
        ORDER BY cnt DESC
      ` as { subStatus: string; cnt: number }[]
    : await sql`
        SELECT LOWER(COALESCE(NULLIF(TRIM(sub_status), ''), 'New')) AS "subStatus", COUNT(*) AS cnt
        FROM ota_listing
        GROUP BY LOWER(COALESCE(NULLIF(TRIM(sub_status), ''), 'New'))
        ORDER BY cnt DESC
      ` as { subStatus: string; cnt: number }[];

  const statusTopCounts = otaList.length > 0
    ? await sql`
        SELECT LOWER(COALESCE(NULLIF(TRIM(status), ''), 'New')) AS status, COUNT(*) AS cnt
        FROM ota_listing
        WHERE ota = ANY(${otaList})
        GROUP BY LOWER(COALESCE(NULLIF(TRIM(status), ''), 'New'))
        ORDER BY cnt DESC
      ` as { status: string; cnt: number }[]
    : await sql`
        SELECT LOWER(COALESCE(NULLIF(TRIM(status), ''), 'New')) AS status, COUNT(*) AS cnt
        FROM ota_listing
        GROUP BY LOWER(COALESCE(NULLIF(TRIM(status), ''), 'New'))
        ORDER BY cnt DESC
      ` as { status: string; cnt: number }[];

  return Response.json({ statusCounts, statusTopCounts });
}
