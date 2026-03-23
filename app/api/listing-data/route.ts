import { getDb } from "@/lib/db";

export async function GET() {
  const db = getDb();

  const propCount = (db.prepare("SELECT COUNT(*) as n FROM Property").get() as { n: number }).n;
  if (propCount === 0) {
    return Response.json({
      error: "No data — click Sync to DB first",
      properties: [],
      fetchedAt: new Date().toISOString(),
      source: "empty",
    });
  }

  const props = db.prepare(
    "SELECT id, name, city, fhLiveDate, fhStatus FROM Property WHERE fhStatus IN ('Live', 'SoldOut') ORDER BY id ASC"
  ).all() as Array<{
    id: string; name: string; city: string | null;
    fhLiveDate: string | null; fhStatus: string | null;
  }>;

  const otaRows = db.prepare(
    "SELECT propertyId, ota, status, subStatus, liveDate, otaId FROM OtaListing"
  ).all() as Array<{
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
