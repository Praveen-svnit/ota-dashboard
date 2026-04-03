import { getSql } from "@/lib/db-postgres";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "head")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const ota = searchParams.get("ota");
  if (!ota) return Response.json({ error: "ota param required" }, { status: 400 });

  const sql = getSql();

  // Insert a blank ota_listing row for every active property that doesn't have one yet
  const result = await sql.query(
    `INSERT INTO ota_listing (property_id, ota, synced_at)
     SELECT property_id, $1, NOW()
     FROM inventory
     WHERE fh_status IN ('Live', 'SoldOut')
     ON CONFLICT (property_id, ota) DO NOTHING`,
    [ota]
  ) as { rowCount: number };

  const created = result.rowCount ?? 0;
  return Response.json({ ok: true, created, message: `Created ${created} new ${ota} listings` });
}
