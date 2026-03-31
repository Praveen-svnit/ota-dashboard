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
        SELECT ota, sub_status AS "subStatus", COUNT(*) AS n
        FROM ota_listing
        GROUP BY ota, sub_status
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
        SELECT ota,
          SUM(CASE WHEN LOWER(sub_status) = 'live' THEN 1 ELSE 0 END) AS live,
          SUM(CASE WHEN LOWER(sub_status) = 'exception' THEN 1 ELSE 0 END) AS exception,
          SUM(CASE WHEN LOWER(COALESCE(status,'')) = 'ready to go live' THEN 1 ELSE 0 END) AS "readyToGoLive",
          SUM(CASE WHEN LOWER(sub_status) != 'live' AND LOWER(COALESCE(sub_status,'')) != 'exception'
                    AND LOWER(COALESCE(status,'')) != 'ready to go live'
                    AND COALESCE(tat, 0) <= ${TAT_THRESHOLD} THEN 1 ELSE 0 END) AS "inProcess",
          SUM(CASE WHEN LOWER(sub_status) != 'live' AND LOWER(COALESCE(sub_status,'')) != 'exception'
                    AND LOWER(COALESCE(status,'')) != 'ready to go live'
                    AND COALESCE(tat, 0) > ${TAT_THRESHOLD} THEN 1 ELSE 0 END) AS "tatExhausted"
        FROM ota_listing
        GROUP BY ota
        ORDER BY live DESC
      ` as Promise<Array<{ ota: string; live: number; exception: number; readyToGoLive: number; inProcess: number; tatExhausted: number }>>,

      sql`
        SELECT ota, sub_status AS "subStatus", COUNT(*) AS n
        FROM ota_listing
        WHERE LOWER(sub_status) != 'live'
          AND LOWER(COALESCE(sub_status,'')) != 'exception'
          AND COALESCE(tat, 0) > ${TAT_THRESHOLD}
        GROUP BY ota, sub_status
      ` as Promise<Array<{ ota: string; subStatus: string | null; n: number }>>,

      sql`
        SELECT ota,
          ROUND(AVG(tat)) AS "avgTat",
          SUM(CASE WHEN tat <= 7  THEN 1 ELSE 0 END) AS "d0_7",
          SUM(CASE WHEN tat > 7  AND tat <= 15 THEN 1 ELSE 0 END) AS "d8_15",
          SUM(CASE WHEN tat > 15 AND tat <= 30 THEN 1 ELSE 0 END) AS "d16_30",
          SUM(CASE WHEN tat > 30 AND tat <= 60 THEN 1 ELSE 0 END) AS "d31_60",
          SUM(CASE WHEN tat > 60 THEN 1 ELSE 0 END) AS "d60p"
        FROM ota_listing
        WHERE LOWER(sub_status) = 'live' AND live_date IS NOT NULL
        GROUP BY ota
      ` as Promise<Array<{ ota: string; avgTat: number; d0_7: number; d8_15: number; d16_30: number; d31_60: number; d60p: number }>>,

      sql`
        SELECT ota, sub_status AS "subStatus", status, COUNT(*) AS n
        FROM ota_listing
        GROUP BY ota, sub_status, status
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
