import { getSql } from "@/lib/db";

export async function GET() {
  const sql = getSql();

  const countRows = await sql`SELECT COUNT(*) as n FROM inventory`;
  const propCount = Number((countRows[0] as { n: number }).n);
  if (propCount === 0) {
    return Response.json({
      error: "No data — click Sync to DB first",
      properties: [],
      fetchedAt: new Date().toISOString(),
      source: "empty",
    });
  }

  const props = await sql`
    SELECT
      property_id AS id,
      property_name AS name,
      city,
      fh_live_date AS "fhLiveDate",
      fh_status AS "fhStatus"
    FROM inventory
    WHERE fh_status IN ('Live', 'SoldOut')
    ORDER BY property_id ASC
  ` as Array<{
    id: string; name: string; city: string | null;
    fhLiveDate: string | null; fhStatus: string | null;
  }>;

  const otaRows = await sql`
    SELECT
      property_id AS "propertyId",
      ota,
      status,
      sub_status AS "subStatus",
      live_date AS "liveDate",
      ota_id AS "otaId"
    FROM ota_listing
  ` as Array<{
    propertyId: string; ota: string;
    status: string | null; subStatus: string | null;
    liveDate: string | null; otaId: string | null;
  }>;

  const otaMap = new Map<string, Record<string, {
    status: string | null; subStatus: string | null;
    liveDate: string | null; otaId: string | null;
  }>>();
  for (const row of otaRows) {
    if (!otaMap.has(row.propertyId)) otaMap.set(row.propertyId, {});
    otaMap.get(row.propertyId)![row.ota] = {
      status: row.status, subStatus: row.subStatus,
      liveDate: row.liveDate, otaId: row.otaId,
    };
  }

  const properties = props.map((p) => ({
    fhId:       p.id,
    name:       p.name,
    city:       p.city ?? "",
    fhLiveDate: p.fhLiveDate,
    fhStatus:   p.fhStatus,
    otas:       otaMap.get(p.id) ?? {},
  }));

  return Response.json({
    properties,
    fetchedAt: new Date().toISOString(),
    source: "db",
  });
}
