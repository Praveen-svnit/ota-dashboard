import { getDb } from "@/lib/db";

function monthKey(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function normalizeSubStatus(s: string | null) {
  if (!s) return "Blank";
  const t = s.trim().toLowerCase();
  if (t === "not live" || t === "others - not live") return "Not Live";
  if (t === "pending at go-mmt") return "Pending at GoMMT";
  if (t === "pending at bdc") return "Pending at Booking.com";
  if (t === "pending at emt") return "Pending at EaseMyTrip";
  if (t === "#n/a") return "Blank";
  return s.trim();
}

type MonthlyPoint = {
  month: string;
  liveListings: number;
  onboarded: number;
  soldRns: number;
  soldRevenue: number;
};

export async function GET() {
  try {
    const db = getDb();

    const tableNames = db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all() as Array<{ name: string }>;

    const tableCounts = tableNames.map(({ name }) => {
      const row = db.prepare(`SELECT COUNT(*) as n FROM ${name}`).get() as { n: number };
      return { table: name, rows: row.n };
    });

    const totals = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM Property) AS properties,
        (SELECT COUNT(*) FROM OtaListing) AS otaListings,
        (SELECT COUNT(*) FROM OtaListing WHERE LOWER(COALESCE(subStatus, '')) = 'live') AS liveListings,
        (SELECT COUNT(*) FROM OtaListing WHERE LOWER(COALESCE(subStatus, '')) = 'exception') AS exceptionListings,
        (SELECT COUNT(*) FROM OtaListing WHERE tat > 15 AND LOWER(COALESCE(subStatus, '')) NOT IN ('live', 'exception')) AS tatBreaches,
        (SELECT ROUND(AVG(tat), 1) FROM OtaListing WHERE LOWER(COALESCE(subStatus, '')) = 'live' AND fhLiveDate IS NOT NULL) AS avgTat,
        (SELECT ROUND(AVG(tat), 1) FROM OtaListing WHERE LOWER(COALESCE(subStatus, '')) NOT IN ('live', 'exception')) AS avgPendingTat
    `).get() as {
      properties: number;
      otaListings: number;
      liveListings: number;
      exceptionListings: number;
      tatBreaches: number;
      avgTat: number | null;
      avgPendingTat: number | null;
    };

    const liveRate = totals.otaListings > 0 ? Number((((totals.liveListings + totals.exceptionListings) / totals.otaListings) * 100).toFixed(1)) : 0;

    const otaBreakdown = db.prepare(`
      SELECT ota,
        SUM(CASE WHEN LOWER(COALESCE(subStatus, '')) = 'live' THEN 1 ELSE 0 END) AS live,
        SUM(CASE WHEN LOWER(COALESCE(subStatus, '')) = 'exception' THEN 1 ELSE 0 END) AS exception,
        SUM(CASE WHEN LOWER(COALESCE(subStatus, '')) NOT IN ('live', 'exception') AND tat <= 15 THEN 1 ELSE 0 END) AS inProcess,
        SUM(CASE WHEN LOWER(COALESCE(subStatus, '')) NOT IN ('live', 'exception') AND tat > 15 THEN 1 ELSE 0 END) AS tatExhausted
      FROM OtaListing
      GROUP BY ota
      ORDER BY COUNT(*) DESC
    `).all() as Array<{ ota: string; live: number; exception: number; inProcess: number; tatExhausted: number }>;

    const cityRows = db.prepare(`
      SELECT
        COALESCE(NULLIF(TRIM(p.city), ''), 'Unknown') AS city,
        COUNT(*) AS listings,
        SUM(CASE WHEN LOWER(COALESCE(o.subStatus, '')) = 'live' THEN 1 ELSE 0 END) AS live,
        SUM(CASE WHEN LOWER(COALESCE(o.subStatus, '')) = 'exception' THEN 1 ELSE 0 END) AS exception,
        ROUND(AVG(CASE WHEN o.tat > 0 THEN o.tat END), 1) AS avgTat
      FROM OtaListing o
      JOIN Property p ON p.id = o.propertyId
      GROUP BY COALESCE(NULLIF(TRIM(p.city), ''), 'Unknown')
      HAVING COUNT(*) > 0
      ORDER BY listings DESC
      LIMIT 10
    `).all() as Array<{ city: string; listings: number; live: number; exception: number; avgTat: number | null }>;

    const cities = cityRows.map((r) => ({
      ...r,
      liveRate: r.listings > 0 ? Number((((r.live + r.exception) / r.listings) * 100).toFixed(1)) : 0,
    }));

    const subStatusRaw = db.prepare(`
      SELECT subStatus, COUNT(*) AS total
      FROM OtaListing
      GROUP BY subStatus
      ORDER BY total DESC
    `).all() as Array<{ subStatus: string | null; total: number }>;

    const subStatusMap = new Map<string, number>();
    for (const row of subStatusRaw) {
      const key = normalizeSubStatus(row.subStatus);
      subStatusMap.set(key, (subStatusMap.get(key) ?? 0) + row.total);
    }
    const subStatusDistribution = [...subStatusMap.entries()]
      .map(([subStatus, total]) => ({ subStatus, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const monthlyMap = new Map<string, MonthlyPoint>();
    const liveRows = db.prepare(`
      SELECT liveDate
      FROM OtaListing
      WHERE liveDate IS NOT NULL
      ORDER BY liveDate
    `).all() as Array<{ liveDate: string }>;
    for (const row of liveRows) {
      const month = monthKey(row.liveDate);
      const current = monthlyMap.get(month) ?? { month, liveListings: 0, onboarded: 0, soldRns: 0, soldRevenue: 0 };
      current.liveListings += 1;
      monthlyMap.set(month, current);
    }

    const onboardedRows = db.prepare(`
      SELECT fhLiveDate
      FROM Property
      WHERE fhLiveDate IS NOT NULL
      ORDER BY fhLiveDate
    `).all() as Array<{ fhLiveDate: string }>;
    for (const row of onboardedRows) {
      const month = monthKey(row.fhLiveDate);
      const current = monthlyMap.get(month) ?? { month, liveListings: 0, onboarded: 0, soldRns: 0, soldRevenue: 0 };
      current.onboarded += 1;
      monthlyMap.set(month, current);
    }

    const soldRows = db.prepare(`
      SELECT sold_date, SUM(rns) as soldRns, ROUND(SUM(revenue), 0) as soldRevenue
      FROM RnsSold
      GROUP BY sold_date
      ORDER BY sold_date
    `).all() as Array<{ sold_date: string; soldRns: number; soldRevenue: number }>;
    for (const row of soldRows) {
      const month = monthKey(row.sold_date);
      const current = monthlyMap.get(month) ?? { month, liveListings: 0, onboarded: 0, soldRns: 0, soldRevenue: 0 };
      current.soldRns += row.soldRns ?? 0;
      current.soldRevenue += row.soldRevenue ?? 0;
      monthlyMap.set(month, current);
    }

    const monthlyTrend = [...monthlyMap.values()]
      .sort((a, b) => {
        const da = new Date(`01 ${a.month}`);
        const dbb = new Date(`01 ${b.month}`);
        return da.getTime() - dbb.getTime();
      })
      .slice(-12);

    let biggestRise: { month: string; delta: number } | null = null;
    let biggestDrop: { month: string; delta: number } | null = null;
    for (let i = 1; i < monthlyTrend.length; i += 1) {
      const delta = monthlyTrend[i].liveListings - monthlyTrend[i - 1].liveListings;
      if (!biggestRise || delta > biggestRise.delta) biggestRise = { month: monthlyTrend[i].month, delta };
      if (!biggestDrop || delta < biggestDrop.delta) biggestDrop = { month: monthlyTrend[i].month, delta };
    }

    const lowestCity = [...cities]
      .filter((c) => c.listings >= 20)
      .sort((a, b) => a.liveRate - b.liveRate)[0] ?? null;

    const topOta = [...otaBreakdown]
      .sort((a, b) => (b.live + b.exception + b.inProcess + b.tatExhausted) - (a.live + a.exception + a.inProcess + a.tatExhausted))[0] ?? null;

    const executiveSummary = [
      `${totals.properties.toLocaleString()} FH properties map to ${totals.otaListings.toLocaleString()} OTA listings, with an effective live rate of ${liveRate}%.`,
      topOta ? `${topOta.ota} currently carries the largest listing base, making it the highest-impact channel for operational improvements.` : "No OTA channel summary is available yet.",
      totals.avgTat !== null ? `Average live listing TAT is ${totals.avgTat} days, while pending listings average ${totals.avgPendingTat ?? 0} days.` : "TAT metrics are incomplete, so turnaround insight is limited.",
      biggestDrop && biggestDrop.delta < 0 ? `The sharpest monthly decline in listings occurred in ${biggestDrop.month} (${biggestDrop.delta.toLocaleString()}).` : "No significant monthly listing drop was detected in the latest 12-month view.",
      lowestCity ? `${lowestCity.city} shows the weakest live performance among large cities at ${lowestCity.liveRate}% live rate and should be reviewed first.` : "No city-level risk segment crossed the minimum volume threshold.",
      `There are ${totals.tatBreaches.toLocaleString()} listings beyond the TAT threshold, so backlog clearance should remain a priority.`
    ];

    const recommendations = [
      `Prioritize TAT-breached listings first, especially in cities and OTAs with the lowest live rate.`,
      `Use the OTA mix and sub-status distribution to assign owner-specific cleanup for Revenue, Supply/Operations, and pending-at-OTA buckets.`,
      `Track listing growth monthly against onboarding and sold RNS to separate inventory expansion from performance gains.`,
    ];

    return Response.json({
      profile: { tables: tableCounts.length, tableCounts },
      kpis: {
        ...totals,
        liveRate,
      },
      charts: {
        monthlyTrend,
        otaBreakdown,
        cities,
        subStatusDistribution,
      },
      insights: {
        biggestRise,
        biggestDrop,
        lowestCity,
        topOta,
      },
      executiveSummary,
      recommendations,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}
