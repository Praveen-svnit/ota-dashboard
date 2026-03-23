import { getDb } from "@/lib/db";

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
    const db = getDb();

    const count = (db.prepare("SELECT COUNT(*) as n FROM OtaListing").get() as { n: number }).n;
    if (count === 0) {
      return Response.json({ error: "No data — sync the DB first" });
    }

    const rows = db.prepare(`
      SELECT ota, subStatus, COUNT(*) as n
      FROM OtaListing
      GROUP BY ota, subStatus
    `).all() as Array<{ ota: string; subStatus: string | null; n: number }>;

    // Build pivot: { ota -> { subStatus -> count } }
    const pivot: Record<string, Record<string, number>> = {};
    const subStatusSet = new Set<string>();

    for (const row of rows) {
      const label = normalize(row.subStatus);
      subStatusSet.add(label);
      if (!pivot[row.ota]) pivot[row.ota] = {};
      pivot[row.ota][label] = (pivot[row.ota][label] ?? 0) + row.n;
    }

    // Column order: known first, then any extras
    const extras = [...subStatusSet].filter(s => !COL_ORDER.includes(s)).sort();
    const columns = [...COL_ORDER.filter(c => subStatusSet.has(c)), ...extras];

    const otas = Object.keys(pivot).sort((a, b) => (pivot[b]["Live"] ?? 0) - (pivot[a]["Live"] ?? 0));

    // ── KPI stats from Property table ───────────────────────────────────────
    const monthPrefix = new Date().toISOString().slice(0, 7); // e.g. "2026-03"

    const { live, soldOut, total } = db.prepare(`
      SELECT
        SUM(CASE WHEN fhStatus = 'Live'    THEN 1 ELSE 0 END) AS live,
        SUM(CASE WHEN fhStatus = 'SoldOut' THEN 1 ELSE 0 END) AS soldOut,
        SUM(CASE WHEN fhStatus IN ('Live','SoldOut') THEN 1 ELSE 0 END) AS total
      FROM Property
    `).get() as { live: number; soldOut: number; total: number };

    const { onboardedThisMonth } = db.prepare(`
      SELECT COUNT(*) AS onboardedThisMonth
      FROM Property
      WHERE fhLiveDate LIKE ?
    `).get(`${monthPrefix}%`) as { onboardedThisMonth: number };

    const { mtdListings } = db.prepare(`
      SELECT COUNT(*) AS mtdListings
      FROM OtaListing
      WHERE liveDate LIKE ?
    `).get(`${monthPrefix}%`) as { mtdListings: number };

    const TAT_THRESHOLD = 15;

    const categories = db.prepare(`
      SELECT ota,
        SUM(CASE WHEN LOWER(subStatus) = 'live' THEN 1 ELSE 0 END) AS live,
        SUM(CASE WHEN LOWER(subStatus) = 'exception' THEN 1 ELSE 0 END) AS exception,
        SUM(CASE WHEN LOWER(subStatus) != 'live' AND LOWER(COALESCE(subStatus,'')) != 'exception'
                  AND tat <= ${TAT_THRESHOLD} THEN 1 ELSE 0 END) AS inProcess,
        SUM(CASE WHEN LOWER(subStatus) != 'live' AND LOWER(COALESCE(subStatus,'')) != 'exception'
                  AND tat > ${TAT_THRESHOLD} THEN 1 ELSE 0 END) AS tatExhausted
      FROM OtaListing
      GROUP BY ota
      ORDER BY live DESC
    `).all() as Array<{ ota: string; live: number; exception: number; inProcess: number; tatExhausted: number }>;

    // ── TAT-exhausted sub-status breakdown (for expandable row) ─────────────
    const tatBreakdownRows = db.prepare(`
      SELECT ota, subStatus, COUNT(*) as n
      FROM OtaListing
      WHERE LOWER(subStatus) != 'live'
        AND LOWER(COALESCE(subStatus,'')) != 'exception'
        AND tat > ${TAT_THRESHOLD}
      GROUP BY ota, subStatus
    `).all() as Array<{ ota: string; subStatus: string | null; n: number }>;

    const tatBreakdown: Record<string, Record<string, number>> = {};
    const tatSubStatuses = new Set<string>();
    for (const row of tatBreakdownRows) {
      const label = normalize(row.subStatus);
      tatSubStatuses.add(label);
      if (!tatBreakdown[row.ota]) tatBreakdown[row.ota] = {};
      tatBreakdown[row.ota][label] = (tatBreakdown[row.ota][label] ?? 0) + row.n;
    }
    const tatSubStatusList = [...tatSubStatuses].sort();

    // ── TAT stats per OTA (live listings only, for TAT breakdown rows) ─────────
    const tatStatsRows = db.prepare(`
      SELECT ota,
        ROUND(AVG(tat)) AS avgTat,
        SUM(CASE WHEN tat <= 7  THEN 1 ELSE 0 END) AS d0_7,
        SUM(CASE WHEN tat > 7  AND tat <= 15 THEN 1 ELSE 0 END) AS d8_15,
        SUM(CASE WHEN tat > 15 AND tat <= 30 THEN 1 ELSE 0 END) AS d16_30,
        SUM(CASE WHEN tat > 30 AND tat <= 60 THEN 1 ELSE 0 END) AS d31_60,
        SUM(CASE WHEN tat > 60 THEN 1 ELSE 0 END) AS d60p
      FROM OtaListing
      WHERE LOWER(subStatus) = 'live' AND fhLiveDate IS NOT NULL
      GROUP BY ota
    `).all() as Array<{ ota: string; avgTat: number; d0_7: number; d8_15: number; d16_30: number; d31_60: number; d60p: number }>;
    const tatStats: Record<string, { avgTat: number; d0_7: number; d8_15: number; d16_30: number; d31_60: number; d60p: number }> = {};
    for (const r of tatStatsRows) tatStats[r.ota] = r;

    // ── Sub-status × Status cross-pivot (for OTA detail page breakdown) ─────
    const ssStatusRows = db.prepare(`
      SELECT ota, subStatus, status, COUNT(*) as n
      FROM OtaListing
      GROUP BY ota, subStatus, status
    `).all() as Array<{ ota: string; subStatus: string | null; status: string | null; n: number }>;
    // shape: { ota → { subStatus → { status → count } } }
    const ssStatusPivot: Record<string, Record<string, Record<string, number>>> = {};
    for (const row of ssStatusRows) {
      const ssLabel = normalize(row.subStatus);
      const stLabel = row.status?.trim() || "Blank";
      if (!ssStatusPivot[row.ota]) ssStatusPivot[row.ota] = {};
      if (!ssStatusPivot[row.ota][ssLabel]) ssStatusPivot[row.ota][ssLabel] = {};
      ssStatusPivot[row.ota][ssLabel][stLabel] = (ssStatusPivot[row.ota][ssLabel][stLabel] ?? 0) + row.n;
    }

    return Response.json({ pivot, columns, otas, stats: { live, soldOut, total, onboardedThisMonth, mtdListings }, categories, tatThreshold: TAT_THRESHOLD, tatBreakdown, tatSubStatusList, tatStats, ssStatusPivot });

  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
