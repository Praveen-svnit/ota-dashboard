import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT prop_id, bdc_id, prop_name, city, fh_status, bdc_status,
             genius_status, last_checked, remark, syncedAt
      FROM GeniusData
      WHERE id IN (SELECT MAX(id) FROM GeniusData GROUP BY bdc_id)
      ORDER BY
        CASE genius_status
          WHEN 'G3' THEN 1 WHEN 'G2' THEN 2 WHEN 'G1' THEN 3
          WHEN 'Not Eligible' THEN 4 WHEN 'Unknown' THEN 5 ELSE 6
        END,
        prop_name ASC
    `).all();
    return Response.json({ rows, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
