import { getSql } from "@/lib/db";
import { getSession } from "@/lib/auth";

const OTA_FIELDS = [
  "ota_gommt","ota_booking","ota_agoda","ota_expedia","ota_cleartrip",
  "ota_yatra","ota_ixigo","ota_akbar","ota_easemytrip","ota_indigo","ota_gmb",
];
const AI_FIELDS = [
  "ai_gommt","ai_booking","ai_agoda","ai_expedia","ai_cleartrip",
  "ai_yatra","ai_ixigo","ai_akbar","ai_easemytrip","ai_indigo","ai_gmb",
];

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search   = (searchParams.get("search")  ?? "").toLowerCase().trim();
  const status   = searchParams.get("status")   ?? "all";
  const city     = searchParams.get("city")     ?? "all";
  const fhStatus = searchParams.get("fhStatus") ?? "Live,SoldOut";
  const sql = getSql();

  // Ensure all columns exist (safe to run repeatedly)
  await sql`ALTER TABLE photoshoot_tracker ADD COLUMN IF NOT EXISTS shoot_link      TEXT`;
  await sql`ALTER TABLE photoshoot_tracker ADD COLUMN IF NOT EXISTS shoot_source    TEXT`;
  await sql`ALTER TABLE photoshoot_tracker ADD COLUMN IF NOT EXISTS ai_editing_done TEXT`;
  for (const f of [...OTA_FIELDS, ...AI_FIELDS]) {
    await sql.query(`ALTER TABLE photoshoot_tracker ADD COLUMN IF NOT EXISTS ${f} TEXT`, []);
  }

  const otaCoalesce  = OTA_FIELDS.map(f => `COALESCE(p.${f},'Pending') AS ${f}`).join(",");
  const aiCoalesce   = AI_FIELDS.map(f  => `COALESCE(p.${f},'Pending') AS ${f}`).join(",");

  const fhStatuses = fhStatus.split(",").filter(Boolean);

  const rows = await sql.query(
    `SELECT
       i.property_id, i.property_name, i.city, i.fh_status, i.fh_live_date,
       COALESCE(p.photoshoot_status,'Shoot Pending') AS photoshoot_status,
       p.shoot_date, p.remarks, p.shoot_link, p.shoot_source,
       COALESCE(p.ai_editing_done,'No') AS ai_editing_done,
       ${otaCoalesce},
       ${aiCoalesce},
       p.updated_by, p.updated_at
     FROM inventory i
     LEFT JOIN photoshoot_tracker p ON p.property_id = i.property_id
     WHERE i.fh_status = ANY($1)
     ORDER BY i.city, i.property_name`,
    [fhStatuses]
  );

  const filtered = rows.filter(r => {
    if (search) {
      const s = `${r.property_id} ${r.property_name ?? ""} ${r.city ?? ""}`;
      if (!s.toLowerCase().includes(search)) return false;
    }
    if (status !== "all" && r.photoshoot_status !== status) return false;
    if (city   !== "all" && r.city !== city)                return false;
    return true;
  });

  const cities = [...new Set(rows.map(r => r.city as string).filter(Boolean))].sort();
  return Response.json({ rows: filtered, cities });
}
