import { getSql } from "@/lib/db";
import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const sql  = getSql();
    const rows = await req.json() as Array<Record<string, string>>;

    if (!Array.isArray(rows) || rows.length === 0) {
      return Response.json({ ok: true, upserted: 0 });
    }

    let upserted = 0;
    const now = new Date().toISOString();

    for (const row of rows) {
      const bdc_id       = row.bdc_id       ?? row.bdcId       ?? "";
      const prop_id      = row.prop_id      ?? row.propId      ?? null;
      const prop_name    = row.prop_name    ?? row.propName    ?? "";
      const city         = row.city         ?? "";
      const genius_status = row.genius_status ?? row.geniusStatus ?? null;

      if (!bdc_id) continue;

      // Upsert into genius_data
      await sql.query(
        `INSERT INTO genius_data (prop_id, bdc_id, prop_name, city, fh_status, bdc_status, genius_status, last_checked, remark, synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT DO NOTHING`,
        [prop_id, bdc_id, prop_name, city,
         row.fh_status ?? null, row.bdc_status ?? null, genius_status,
         row.last_checked ?? null, row.remark ?? null, now]
      );

      // Consolidate into ota_metrics
      if (prop_id && genius_status && genius_status !== "" && genius_status !== "—") {
        await sql.query(
          `INSERT INTO ota_metrics (property_id, ota, metric_key, metric_value, updated_by, updated_at)
           VALUES ($1, 'Booking.com', 'genius', $2, 'genius_scraper', $3)
           ON CONFLICT (property_id, ota, metric_key) DO UPDATE SET
             metric_value = excluded.metric_value,
             updated_by   = excluded.updated_by,
             updated_at   = excluded.updated_at`,
          [prop_id, genius_status, now]
        );
      }
      upserted++;
    }

    return Response.json({ ok: true, upserted });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
