import { getSql } from "@/lib/db";
import { NextRequest } from "next/server";

// Hygiene metric keys to sync into ota_metrics
const METRIC_KEYS: Array<{ col: string; key: string }> = [
  { col: "preferred",      key: "preferred" },
  { col: "genius_level",   key: "genius" },
  { col: "perf_score",     key: "perf_score" },
  { col: "review_score",   key: "review_score" },
  { col: "review_count",   key: "review_count" },
  { col: "commission_pct", key: "commission" },
  { col: "top_promotion",  key: "top_promotion" },
  { col: "conversion_pct", key: "conversion_pct" },
  { col: "page_score",     key: "page_score" },
];

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
      const bdc_id    = row.bdc_id    ?? row.bdcId    ?? "";
      const prop_id   = row.prop_id   ?? row.propId   ?? null;
      const prop_name = row.prop_name ?? row.propName ?? "";
      const city      = row.city ?? "";

      if (!bdc_id) continue;

      // Upsert into hygiene_data
      await sql.query(
        `INSERT INTO hygiene_data (prop_id, bdc_id, prop_name, city, review_score, review_count, preferred, genius_level,
           perf_score, top_promotion, commission_pct, views, conversion_pct, page_score, last_checked, synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT DO NOTHING`,
        [prop_id, bdc_id, prop_name, city,
         row.review_score ?? null, row.review_count ?? null, row.preferred ?? null, row.genius_level ?? null,
         row.perf_score ?? null, row.top_promotion ?? null, row.commission_pct ?? null,
         row.views ?? null, row.conversion_pct ?? null, row.page_score ?? null,
         row.last_checked ?? null, now]
      );

      // Consolidate into ota_metrics (only if we have a prop_id)
      if (prop_id) {
        for (const { col, key } of METRIC_KEYS) {
          const val = row[col];
          if (!val || val === "" || val === "—" || val === "N/A") continue;
          await sql.query(
            `INSERT INTO ota_metrics (property_id, ota, metric_key, metric_value, updated_by, updated_at)
             VALUES ($1, 'Booking.com', $2, $3, 'hygiene_scraper', $4)
             ON CONFLICT (property_id, ota, metric_key) DO UPDATE SET
               metric_value = excluded.metric_value,
               updated_by   = excluded.updated_by,
               updated_at   = excluded.updated_at`,
            [prop_id, key, val, now]
          );
        }
      }
      upserted++;
    }

    return Response.json({ ok: true, upserted });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
