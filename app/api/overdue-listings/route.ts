import { getSql } from "@/lib/db";

export async function GET() {
  try {
    const sql = getSql();

    // Live OTA listings from live FH properties only
    const rows = await sql`
      SELECT
        p.property_id   AS "fhId",
        p.property_name AS name,
        p.city          AS city,
        p.fh_live_date  AS "fhLiveDate",
        ol.live_date    AS "liveDate",
        ol.ota          AS ota,
        ol.tat          AS tat
      FROM ota_listing ol
      JOIN inventory p ON p.property_id = ol.property_id
      WHERE p.fh_status = 'Live'
        AND LOWER(COALESCE(ol.sub_status, '')) = 'live'
      ORDER BY ol.tat DESC
    ` as Array<{
      fhId: string; name: string; city: string;
      fhLiveDate: string | null; liveDate: string | null; ota: string; tat: number;
    }>;

    // Not-live OTA listings from live FH properties (tat = pending days)
    const notLiveRows = await sql`
      SELECT
        p.property_id  AS "fhId",
        p.fh_live_date AS "fhLiveDate",
        ol.ota         AS ota,
        ol.tat         AS tat
      FROM ota_listing ol
      JOIN inventory p ON p.property_id = ol.property_id
      WHERE p.fh_status = 'Live'
        AND LOWER(COALESCE(ol.sub_status, '')) != 'live'
    ` as Array<{ fhId: string; fhLiveDate: string | null; ota: string; tat: number; }>;

    // Coerce tat to number (Postgres may return numeric as string)
    const typedRows = rows.map(r => ({ ...r, tat: Number(r.tat) }));
    const typedNotLiveRows = notLiveRows.map(r => ({ ...r, tat: Number(r.tat) }));

    // Per-OTA aggregates (live rows only)
    const otaStats: Record<string, { count: number; totalTat: number; maxTat: number }> = {};
    for (const r of typedRows) {
      if (!otaStats[r.ota]) otaStats[r.ota] = { count: 0, totalTat: 0, maxTat: 0 };
      otaStats[r.ota].count++;
      otaStats[r.ota].totalTat += r.tat;
      if (r.tat > otaStats[r.ota].maxTat) otaStats[r.ota].maxTat = r.tat;
    }
    const otaSummary: Record<string, { count: number; avgTat: number; maxTat: number }> = {};
    for (const [ota, s] of Object.entries(otaStats)) {
      otaSummary[ota] = { count: s.count, avgTat: s.count > 0 ? Math.round(s.totalTat / s.count) : 0, maxTat: s.maxTat };
    }

    // TAT bucket distribution
    const buckets = {
      d0_7:   typedRows.filter(r => r.tat <= 7).length,
      d8_15:  typedRows.filter(r => r.tat > 7  && r.tat <= 15).length,
      d16_30: typedRows.filter(r => r.tat > 15 && r.tat <= 30).length,
      d31_60: typedRows.filter(r => r.tat > 30 && r.tat <= 60).length,
      d60p:   typedRows.filter(r => r.tat > 60).length,
    };

    const totalTat = typedRows.reduce((s, r) => s + r.tat, 0);
    const avgTat   = typedRows.length > 0 ? Math.round(totalTat / typedRows.length) : 0;
    const maxTat   = typedRows.length > 0 ? Math.max(...typedRows.map(r => r.tat)) : 0;

    return Response.json({ rows: typedRows, notLiveRows: typedNotLiveRows, otaSummary, buckets, total: typedRows.length, avgTat, maxTat });

  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
