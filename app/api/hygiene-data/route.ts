import { getSql } from "@/lib/db";

export async function GET() {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT prop_id, bdc_id, prop_name, city,
             review_score, review_count, preferred, genius_level, perf_score, top_promotion, commission_pct, views, conversion_pct, page_score,
             last_checked, synced_at
      FROM hygiene_data
      WHERE id IN (SELECT MAX(id) FROM hygiene_data GROUP BY bdc_id)
      ORDER BY prop_name ASC
    `;
    return Response.json({ rows, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
