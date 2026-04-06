import { getSql } from "@/lib/db";

// Normalize sub-status variants to a canonical label
function normalize(s: string | null): string {
  if (!s) return "Blank";
  const t = s.trim().toLowerCase();
  if (t === "not live" || t === "others - not live") return "Not Live";
  if (t === "pending at go-mmt")  return "Pending at GoMMT";
  if (t === "pending at bdc")     return "Pending at Booking.com";
  if (t === "pending at emt")     return "Pending at EaseMyTrip";
  if (t === "pending at ota")     return "Pending at OTA";
  if (t === "#n/a")               return "Blank";
  return s.trim();
}

// Display order for columns
const COL_ORDER = [
  "Live",
  "Not Live",
  "OTA Team",
  "Pending at GoMMT",
  "Pending at Booking.com",
  "Pending at EaseMyTrip",
  "Pending at OTA",
  "Supply/Operations",
  "Revenue",
  "Exception",
  "Duplicate - Listing Closed",
  "Duplicate - Pending Invoice",
  "Blank",
];

export async function GET() {
  try {
    const sql = getSql();

    const count = Number((await sql`SELECT COUNT(*) as n FROM ota_listing`)[0].n);
    if (count === 0) {
      return Response.json({ error: "No data — sync the DB first" });
    }

    const monthPrefix = new Date().toISOString().slice(0, 7); // e.g. "2026-03"

    const TAT_THRESHOLD = 15;

    // Run all independent queries in parallel
    const [
      rows,
      fhStatsRows,
      onboardedRows,
      mtdRows,
      categories,
      tatBreakdownRows,
      tatStatsRows,
      ssStatusRows,
    ] = await Promise.all([
      sql`
        SELECT ol.ota, ol.sub_status AS "subStatus", COUNT(*) AS n
        FROM ota_listing ol
        JOIN inventory inv ON inv.property_id = ol.property_id
          AND inv.fh_status IN ('Live','SoldOut')
        GROUP BY ol.ota, ol.sub_status
      ` as Promise<Array<{ ota: string; subStatus: string | null; n: number }>>,

      sql`
        SELECT
          SUM(CASE WHEN fh_status = 'Live'    THEN 1 ELSE 0 END) AS live,
          SUM(CASE WHEN fh_status = 'SoldOut' THEN 1 ELSE 0 END) AS "soldOut",
          SUM(CASE WHEN fh_status IN ('Live','SoldOut') THEN 1 ELSE 0 END) AS total
        FROM inventory
      ` as Promise<Array<{ live: number; soldOut: number; total: number }>>,

      sql`
        SELECT COUNT(*) AS "onboardedThisMonth"
        FROM inventory
        WHERE TO_CHAR(fh_live_date::date, 'YYYY-MM') = ${monthPrefix}
      ` as Promise<Array<{ onboardedThisMonth: number }>>,

      sql`
        SELECT COUNT(*) AS "mtdListings"
        FROM ota_listing
        WHERE TO_CHAR(live_date::date, 'YYYY-MM') = ${monthPrefix}
      ` as Promise<Array<{ mtdListings: number }>>,

      sql`
        SELECT
          ol.ota,
          SUM(CASE WHEN LOWER(COALESCE(ol.sub_status,'')) = 'live'      THEN 1 ELSE 0 END) AS live,
          SUM(CASE WHEN LOWER(COALESCE(ol.sub_status,'')) = 'exception' THEN 1 ELSE 0 END) AS exception,
          SUM(CASE WHEN LOWER(COALESCE(ol.status,'')) = 'ready to go live' THEN 1 ELSE 0 END) AS "readyToGoLive",
          SUM(CASE
            WHEN LOWER(COALESCE(ol.sub_status,'')) NOT IN ('live','exception')
             AND LOWER(COALESCE(ol.status,'')) != 'ready to go live'
             AND COALESCE(ol.tat, CASE WHEN inv.fh_live_date IS NOT NULL THEN CURRENT_DATE - inv.fh_live_date::date ELSE 0 END) <= ${TAT_THRESHOLD}
            THEN 1 ELSE 0 END) AS "inProcess",
          SUM(CASE
            WHEN LOWER(COALESCE(ol.sub_status,'')) NOT IN ('live','exception')
             AND LOWER(COALESCE(ol.status,'')) != 'ready to go live'
             AND COALESCE(ol.tat, CASE WHEN inv.fh_live_date IS NOT NULL THEN CURRENT_DATE - inv.fh_live_date::date ELSE 0 END) > ${TAT_THRESHOLD}
            THEN 1 ELSE 0 END) AS "tatExhausted"
        FROM ota_listing ol
        JOIN inventory inv ON inv.property_id = ol.property_id
          AND inv.fh_status IN ('Live','SoldOut')
        GROUP BY ol.ota
        ORDER BY live DESC
      ` as Promise<Array<{ ota: string; live: number; exception: number; readyToGoLive: number; inProcess: number; tatExhausted: number }>>,

      sql`
        SELECT ol.ota, ol.sub_status AS "subStatus", COUNT(*) AS n
        FROM ota_listing ol
        JOIN inventory inv ON inv.property_id = ol.property_id
          AND inv.fh_status IN ('Live','SoldOut')
        WHERE LOWER(COALESCE(ol.sub_status,'')) NOT IN ('live','exception')
          AND LOWER(COALESCE(ol.status,'')) != 'ready to go live'
          AND COALESCE(ol.tat, CASE WHEN inv.fh_live_date IS NOT NULL THEN CURRENT_DATE - inv.fh_live_date::date ELSE 0 END) > ${TAT_THRESHOLD}
        GROUP BY ol.ota, ol.sub_status
      ` as Promise<Array<{ ota: string; subStatus: string | null; n: number }>>,

      sql`
        SELECT ol.ota,
          ROUND(AVG(COALESCE(ol.tat,
            CASE WHEN ol.live_date IS NOT NULL AND inv.fh_live_date IS NOT NULL
            THEN ol.live_date::date - inv.fh_live_date::date ELSE NULL END))) AS "avgTat",
          SUM(CASE WHEN COALESCE(ol.tat, CASE WHEN ol.live_date IS NOT NULL AND inv.fh_live_date IS NOT NULL THEN ol.live_date::date - inv.fh_live_date::date ELSE NULL END) <= 7  THEN 1 ELSE 0 END) AS "d0_7",
          SUM(CASE WHEN COALESCE(ol.tat, CASE WHEN ol.live_date IS NOT NULL AND inv.fh_live_date IS NOT NULL THEN ol.live_date::date - inv.fh_live_date::date ELSE NULL END) > 7  AND COALESCE(ol.tat, CASE WHEN ol.live_date IS NOT NULL AND inv.fh_live_date IS NOT NULL THEN ol.live_date::date - inv.fh_live_date::date ELSE NULL END) <= 15 THEN 1 ELSE 0 END) AS "d8_15",
          SUM(CASE WHEN COALESCE(ol.tat, CASE WHEN ol.live_date IS NOT NULL AND inv.fh_live_date IS NOT NULL THEN ol.live_date::date - inv.fh_live_date::date ELSE NULL END) > 15 AND COALESCE(ol.tat, CASE WHEN ol.live_date IS NOT NULL AND inv.fh_live_date IS NOT NULL THEN ol.live_date::date - inv.fh_live_date::date ELSE NULL END) <= 30 THEN 1 ELSE 0 END) AS "d16_30",
          SUM(CASE WHEN COALESCE(ol.tat, CASE WHEN ol.live_date IS NOT NULL AND inv.fh_live_date IS NOT NULL THEN ol.live_date::date - inv.fh_live_date::date ELSE NULL END) > 30 AND COALESCE(ol.tat, CASE WHEN ol.live_date IS NOT NULL AND inv.fh_live_date IS NOT NULL THEN ol.live_date::date - inv.fh_live_date::date ELSE NULL END) <= 60 THEN 1 ELSE 0 END) AS "d31_60",
          SUM(CASE WHEN COALESCE(ol.tat, CASE WHEN ol.live_date IS NOT NULL AND inv.fh_live_date IS NOT NULL THEN ol.live_date::date - inv.fh_live_date::date ELSE NULL END) > 60 THEN 1 ELSE 0 END) AS "d60p"
        FROM ota_listing ol
        JOIN inventory inv ON inv.property_id = ol.property_id
          AND inv.fh_status IN ('Live','SoldOut')
        WHERE LOWER(ol.sub_status) = 'live' AND ol.live_date IS NOT NULL
        GROUP BY ol.ota
      ` as Promise<Array<{ ota: string; avgTat: number; d0_7: number; d8_15: number; d16_30: number; d31_60: number; d60p: number }>>,

      sql`
        SELECT ol.ota, ol.sub_status AS "subStatus", ol.status, COUNT(*) AS n
        FROM ota_listing ol
        JOIN inventory inv ON inv.property_id = ol.property_id
          AND inv.fh_status IN ('Live','SoldOut')
        GROUP BY ol.ota, ol.sub_status, ol.status
      ` as Promise<Array<{ ota: string; subStatus: string | null; status: string | null; n: number }>>,
    ]);

    // Build pivot: { ota -> { subStatus -> count } }
    const pivot: Record<string, Record<string, number>> = {};
    const subStatusSet = new Set<string>();

    for (const row of rows) {
      const label = normalize(row.subStatus);
      subStatusSet.add(label);
      if (!pivot[row.ota]) pivot[row.ota] = {};
      pivot[row.ota][label] = (pivot[row.ota][label] ?? 0) + Number(row.n);
    }

    // Column order: known first, then any extras
    const extras = [...subStatusSet].filter(s => !COL_ORDER.includes(s)).sort();
    const columns = [...COL_ORDER.filter(c => subStatusSet.has(c)), ...extras];

    const otas = Object.keys(pivot).sort((a, b) => (pivot[b]["Live"] ?? 0) - (pivot[a]["Live"] ?? 0));

    // KPI stats
    const { live, soldOut, total } = {
      live: Number(fhStatsRows[0].live),
      soldOut: Number(fhStatsRows[0].soldOut),
      total: Number(fhStatsRows[0].total),
    };
    const onboardedThisMonth = Number(onboardedRows[0].onboardedThisMonth);
    const mtdListings = Number(mtdRows[0].mtdListings);

    // TAT-exhausted sub-status breakdown
    const tatBreakdown: Record<string, Record<string, number>> = {};
    const tatSubStatuses = new Set<string>();
    for (const row of tatBreakdownRows) {
      const label = normalize(row.subStatus);
      tatSubStatuses.add(label);
      if (!tatBreakdown[row.ota]) tatBreakdown[row.ota] = {};
      tatBreakdown[row.ota][label] = (tatBreakdown[row.ota][label] ?? 0) + Number(row.n);
    }
    const tatSubStatusList = [...tatSubStatuses].sort();

    // TAT stats per OTA
    const tatStats: Record<string, { avgTat: number; d0_7: number; d8_15: number; d16_30: number; d31_60: number; d60p: number }> = {};
    for (const r of tatStatsRows) {
      tatStats[r.ota] = {
        avgTat: Number(r.avgTat),
        d0_7: Number(r.d0_7),
        d8_15: Number(r.d8_15),
        d16_30: Number(r.d16_30),
        d31_60: Number(r.d31_60),
        d60p: Number(r.d60p),
      };
    }

    // Sub-status x Status cross-pivot
    const ssStatusPivot: Record<string, Record<string, Record<string, number>>> = {};
    for (const row of ssStatusRows) {
      const ssLabel = normalize(row.subStatus);
      const stLabel = row.status?.trim() || "Blank";
      if (!ssStatusPivot[row.ota]) ssStatusPivot[row.ota] = {};
      if (!ssStatusPivot[row.ota][ssLabel]) ssStatusPivot[row.ota][ssLabel] = {};
      ssStatusPivot[row.ota][ssLabel][stLabel] = (ssStatusPivot[row.ota][ssLabel][stLabel] ?? 0) + Number(row.n);
    }

    // Coerce Postgres numeric strings to JS numbers
    const categoriesNorm = categories.map(r => ({
      ota: r.ota,
      live: Number(r.live),
      exception: Number(r.exception),
      readyToGoLive: Number(r.readyToGoLive),
      inProcess: Number(r.inProcess),
      tatExhausted: Number(r.tatExhausted),
    }));

    return Response.json({
      pivot,
      columns,
      otas,
      stats: { live, soldOut, total, onboardedThisMonth, mtdListings },
      categories: categoriesNorm,
      tatThreshold: TAT_THRESHOLD,
      tatBreakdown,
      tatSubStatusList,
      tatStats,
      ssStatusPivot,
    });

  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
