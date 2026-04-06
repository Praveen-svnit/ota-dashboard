import { getSql } from "@/lib/db";
import { NextRequest } from "next/server";

// Returns aggregate metric counts + per-property values for a given OTA
export async function GET(req: NextRequest) {
  try {
    const sql = getSql();
    const ota = req.nextUrl.searchParams.get("ota") ?? "";
    if (!ota) return Response.json({ error: "ota required" }, { status: 400 });

    // Aggregate: for each metric_key × metric_value, count properties (Live+SoldOut only)
    const aggRows = await sql.query(
      `SELECT m.metric_key, m.metric_value, COUNT(*) AS cnt
       FROM ota_metrics m
       JOIN inventory inv ON inv.property_id = m.property_id
         AND inv.fh_status IN ('Live','SoldOut')
       JOIN ota_listing ol ON ol.property_id = m.property_id AND ol.ota = m.ota
       WHERE m.ota = $1
         AND m.metric_value IS NOT NULL AND m.metric_value != '' AND m.metric_value != '—'
       GROUP BY m.metric_key, m.metric_value
       ORDER BY m.metric_key, cnt DESC`,
      [ota]
    ) as Array<{ metric_key: string; metric_value: string; cnt: number }>;

    // Per-property: all metric values for this OTA (Live+SoldOut only)
    const propRows = await sql.query(
      `SELECT m.property_id, inv.property_name, inv.city, m.metric_key, m.metric_value,
              ol.sub_status, ol.live_date
       FROM ota_metrics m
       JOIN inventory inv ON inv.property_id = m.property_id
         AND inv.fh_status IN ('Live','SoldOut')
       JOIN ota_listing ol ON ol.property_id = m.property_id AND ol.ota = m.ota
       WHERE m.ota = $1
         AND m.metric_value IS NOT NULL AND m.metric_value != '' AND m.metric_value != '—'
       ORDER BY inv.property_name`,
      [ota]
    ) as Array<{ property_id: string; property_name: string; city: string; metric_key: string; metric_value: string; sub_status: string | null; live_date: string | null }>;

    // Group agg by metric_key
    const agg: Record<string, { value: string; count: number }[]> = {};
    for (const r of aggRows) {
      if (!agg[r.metric_key]) agg[r.metric_key] = [];
      agg[r.metric_key].push({ value: r.metric_value, count: Number(r.cnt) });
    }

    // Group per-property: property_id → { name, city, sub_status, live_date, metrics: Record<key,value> }
    const propMap: Record<string, { propertyId: string; name: string; city: string; subStatus: string | null; liveDate: string | null; metrics: Record<string, string> }> = {};
    for (const r of propRows) {
      if (!propMap[r.property_id]) {
        propMap[r.property_id] = { propertyId: r.property_id, name: r.property_name, city: r.city, subStatus: r.sub_status, liveDate: r.live_date, metrics: {} };
      }
      propMap[r.property_id].metrics[r.metric_key] = r.metric_value;
    }

    return Response.json({ agg, properties: Object.values(propMap) });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
