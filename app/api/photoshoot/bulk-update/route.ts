import { getSql } from "@/lib/db";
import { getSession } from "@/lib/auth";

const ALLOWED_FIELDS = [
  "photoshoot_status", "remarks",
  "ota_gommt","ota_booking","ota_agoda","ota_expedia","ota_cleartrip",
  "ota_yatra","ota_ixigo","ota_akbar","ota_easemytrip","ota_indigo","ota_gmb",
  "ai_editing_done",
  "ai_gommt","ai_booking","ai_agoda","ai_expedia","ai_cleartrip",
  "ai_yatra","ai_ixigo","ai_akbar","ai_easemytrip","ai_indigo","ai_gmb",
];

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { property_ids, field, value } = await req.json();

  if (!Array.isArray(property_ids) || property_ids.length === 0)
    return Response.json({ error: "property_ids required" }, { status: 400 });
  if (!field || !ALLOWED_FIELDS.includes(field))
    return Response.json({ error: "Invalid field" }, { status: 400 });

  const sql = getSql();
  const now = new Date().toISOString();
  const cleanValue = value === "" ? null : value;

  await sql.query(
    `INSERT INTO photoshoot_tracker (property_id, ${field}, updated_by, updated_at)
     SELECT unnest($1::text[]), $2, $3, $4
     ON CONFLICT (property_id) DO UPDATE SET
       ${field}    = EXCLUDED.${field},
       updated_by  = EXCLUDED.updated_by,
       updated_at  = EXCLUDED.updated_at`,
    [property_ids, cleanValue, session.name, now]
  );

  return Response.json({ ok: true, updated: property_ids.length });
}
