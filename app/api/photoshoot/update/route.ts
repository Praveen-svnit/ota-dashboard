import { getSql } from "@/lib/db";
import { getSession } from "@/lib/auth";

const ALLOWED_FIELDS = ["photoshoot_status", "shoot_date", "photographer", "remarks"];

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { property_id, field, value } = await req.json();

  if (!property_id || !field) return Response.json({ error: "property_id and field required" }, { status: 400 });
  if (!ALLOWED_FIELDS.includes(field)) return Response.json({ error: "Invalid field" }, { status: 400 });

  const sql = getSql();
  const now = new Date().toISOString();
  const cleanValue = value === "" ? null : value;

  await sql.query(
    `INSERT INTO photoshoot_tracker (property_id, ${field}, updated_by, updated_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (property_id) DO UPDATE
       SET ${field} = EXCLUDED.${field},
           updated_by = EXCLUDED.updated_by,
           updated_at = EXCLUDED.updated_at`,
    [property_id, cleanValue, session.name, now]
  );

  return Response.json({ ok: true });
}
