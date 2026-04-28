import { getSql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search   = (searchParams.get("search")  ?? "").toLowerCase().trim();
  const status   = searchParams.get("status")   ?? "all";
  const city     = searchParams.get("city")     ?? "all";
  const fhStatus = searchParams.get("fhStatus") ?? "Live,SoldOut";

  const sql = getSql();

  // Ensure table exists
  await sql`
    CREATE TABLE IF NOT EXISTS photoshoot_tracker (
      id                SERIAL PRIMARY KEY,
      property_id       TEXT NOT NULL UNIQUE,
      photoshoot_status TEXT NOT NULL DEFAULT 'Not Started',
      shoot_date        DATE,
      photographer      TEXT,
      remarks           TEXT,
      updated_by        TEXT,
      updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  const fhStatuses = fhStatus.split(",").filter(Boolean);

  const rows = await sql.query(
    `SELECT
       i.property_id,
       i.property_name,
       i.city,
       i.fh_status,
       i.fh_live_date,
       COALESCE(p.photoshoot_status, 'Not Started') AS photoshoot_status,
       p.shoot_date,
       p.photographer,
       p.remarks,
       p.updated_by,
       p.updated_at
     FROM inventory i
     LEFT JOIN photoshoot_tracker p ON p.property_id = i.property_id
     WHERE i.fh_status = ANY($1)
     ORDER BY i.city, i.property_name`,
    [fhStatuses]
  );

  const filtered = rows.filter(r => {
    if (search) {
      const s = String(r.property_id) + " " + String(r.property_name ?? "") + " " + String(r.city ?? "");
      if (!s.toLowerCase().includes(search)) return false;
    }
    if (status !== "all" && r.photoshoot_status !== status) return false;
    if (city   !== "all" && r.city !== city)                return false;
    return true;
  });

  const cities = [...new Set(rows.map(r => r.city as string).filter(Boolean))].sort();

  return Response.json({ rows: filtered, cities });
}
