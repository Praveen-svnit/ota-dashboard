import { getSql } from "@/lib/db";
import { CHANNEL_TO_OTA, OTA_CHANNELS, OTAS } from "@/lib/constants";
import {
  OTA_STATUS, MTD_LISTINGS, L12M_OTA_LIVE, L12M_MONTHS, L12M_ONBOARDED, FH_PLATFORM_LIVE
} from "@/lib/data";

/* ── Month key helpers ─────────────────────────────────────────────────── */
const MONTH_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function toMonthKey(year: number, month0: number): string {
  return `${MONTH_ABBR[month0]}-${String(year).slice(-2)}`;
}

function monthKeyToYM(key: string): { year: number; month0: number } {
  const [mon, yr] = key.split("-");
  return { year: 2000 + parseInt(yr, 10), month0: MONTH_ABBR.indexOf(mon) };
}

/* ── DB queries for listing data ───────────────────────────────────────── */
async function getListingDataFromDb() {
  const sql = getSql();
  const now = new Date();

  const [totalRow] = await sql`SELECT COUNT(*) AS n FROM inventory`;
  if (Number(totalRow.n) === 0) return null;

  // Generate last 12 months dynamically
  const l12mMonths: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    l12mMonths.push(`${MONTH_ABBR[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`);
  }

  const cmStart  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lmDate   = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lmStart  = `${lmDate.getFullYear()}-${String(lmDate.getMonth() + 1).padStart(2, "0")}-01`;
  const lmEnd    = cmStart;
  const daysDone = now.getDate();
  const { year: l12mY0, month0: l12mM0 } = monthKeyToYM(l12mMonths[0]);
  const l12mStart = `${l12mY0}-${String(l12mM0 + 1).padStart(2, "0")}-01`;

  const [
    [fhLiveRow],
    [fhSoldOutRow],
    [fhOnboardedRow],
    otaStatusRows,
    mtdRows,
    l12mRows,
    onboardedRows,
  ] = await Promise.all([
    sql`SELECT COUNT(*) AS n FROM inventory WHERE LOWER(fh_status) = 'live'`,
    sql`SELECT COUNT(*) AS n FROM inventory WHERE LOWER(fh_status) = 'soldout'`,
    sql`SELECT COUNT(*) AS n FROM inventory WHERE fh_live_date IS NOT NULL AND fh_live_date::date >= ${cmStart}::date`,
    sql`
      SELECT ota,
        SUM(CASE WHEN LOWER(sub_status) = 'live' THEN 1 ELSE 0 END) AS live,
        COUNT(*) AS total
      FROM ota_listing
      GROUP BY ota
    `,
    sql`
      SELECT ota,
        SUM(CASE WHEN live_date::date >= ${cmStart}::date THEN 1 ELSE 0 END) AS "cmMTD",
        SUM(CASE WHEN live_date::date >= ${lmStart}::date AND live_date::date < ${lmEnd}::date
                  AND EXTRACT(day FROM live_date::date) <= ${daysDone}
             THEN 1 ELSE 0 END) AS "lmSameDay",
        SUM(CASE WHEN live_date::date >= ${lmStart}::date AND live_date::date < ${lmEnd}::date
             THEN 1 ELSE 0 END) AS "lmTotal"
      FROM ota_listing
      WHERE live_date IS NOT NULL
      GROUP BY ota
    `,
    sql`
      SELECT ota, TO_CHAR(live_date::date, 'YYYY-MM') AS ym, COUNT(*) AS cnt
      FROM ota_listing
      WHERE live_date IS NOT NULL AND live_date::date >= ${l12mStart}::date
      GROUP BY ota, TO_CHAR(live_date::date, 'YYYY-MM')
    `,
    sql`
      SELECT TO_CHAR(fh_live_date::date, 'YYYY-MM') AS ym, COUNT(*) AS cnt
      FROM inventory
      WHERE fh_live_date IS NOT NULL AND fh_live_date::date >= ${l12mStart}::date
      GROUP BY TO_CHAR(fh_live_date::date, 'YYYY-MM')
    `,
  ]);

  const fhLiveCount          = Number(fhLiveRow.n);
  const fhSoldOutCount       = Number(fhSoldOutRow.n);
  const fhTotalProps         = fhLiveCount + fhSoldOutCount;
  const fhOnboardedThisMonth = Number(fhOnboardedRow.n);

  // OTA status
  const otaStatusMap = new Map(
    (otaStatusRows as Array<{ ota: string; live: unknown; total: unknown }>).map((r) => [r.ota, r])
  );
  const otaStatus = OTA_STATUS.map(({ ota }) => {
    const r = otaStatusMap.get(ota);
    return r
      ? { ota, live: Number(r.live), notLive: Number(r.total) - Number(r.live) }
      : { ota, live: 0, notLive: 0 };
  });

  // MTD listings
  const mtdMap = new Map(
    (mtdRows as Array<{ ota: string; cmMTD: unknown; lmSameDay: unknown; lmTotal: unknown }>).map((r) => [r.ota, r])
  );
  const mtdListings = MTD_LISTINGS.map(({ ota }) => {
    const r = mtdMap.get(ota);
    return r
      ? { ota, cmMTD: Number(r.cmMTD), lmSameDay: Number(r.lmSameDay), lmTotal: Number(r.lmTotal) }
      : { ota, cmMTD: 0, lmSameDay: 0, lmTotal: 0 };
  });

  // L12M OTA live
  const ymToIdx = new Map(
    l12mMonths.map((key, i) => {
      const { year, month0 } = monthKeyToYM(key);
      return [`${year}-${String(month0 + 1).padStart(2, "0")}`, i];
    })
  );

  const l12mOtaLive: Record<string, number[]> = {};
  for (const ota of OTAS) l12mOtaLive[ota] = new Array(l12mMonths.length).fill(0);
  for (const row of l12mRows as Array<{ ota: string; ym: string; cnt: unknown }>) {
    const idx = ymToIdx.get(row.ym);
    if (idx !== undefined) {
      if (!l12mOtaLive[row.ota]) l12mOtaLive[row.ota] = new Array(l12mMonths.length).fill(0);
      l12mOtaLive[row.ota][idx] = Number(row.cnt);
    }
  }

  // L12M onboarded
  const l12mOnboarded = new Array(l12mMonths.length).fill(0);
  for (const row of onboardedRows as Array<{ ym: string; cnt: unknown }>) {
    const idx = ymToIdx.get(row.ym);
    if (idx !== undefined) l12mOnboarded[idx] = Number(row.cnt);
  }

  return {
    fhLiveCount, fhTotalProps, fhSoldOutCount, fhOnboardedThisMonth,
    otaStatus, mtdListings,
    l12mOtaLive, l12mOnboarded, l12mMonths,
  };
}

/* ── Shared helpers for RNS DB aggregation ─────────────────────────────── */
type DMap = Record<number, Record<number, Record<number, Record<string, number>>>>;

function buildDMap(rows: Array<{ date: string; channel: string; rns: number }>): { daily: DMap; chanDaily: DMap } {
  const daily:     DMap = {};
  const chanDaily: DMap = {};
  for (const row of rows) {
    const mappedOta = CHANNEL_TO_OTA[row.channel] ?? null;
    if (!mappedOta) continue;
    const rawDate = typeof row.date === "string" ? row.date : (row.date as unknown as Date).toISOString().slice(0, 10);
    const d  = new Date(rawDate + "T00:00:00");
    const y  = d.getFullYear(), m = d.getMonth(), dy = d.getDate();
    daily[y] ??= {};    daily[y][m] ??= {};    daily[y][m][dy] ??= {};
    daily[y][m][dy][mappedOta] = (daily[y][m][dy][mappedOta] ?? 0) + row.rns;
    chanDaily[y] ??= {};  chanDaily[y][m] ??= {};  chanDaily[y][m][dy] ??= {};
    chanDaily[y][m][dy][row.channel] = (chanDaily[y][m][dy][row.channel] ?? 0) + row.rns;
  }
  return { daily, chanDaily };
}

function sumDMap(map: DMap, y: number, m: number, maxDay: number): Record<string, number> {
  const acc: Record<string, number> = {};
  for (const dStr of Object.keys(map[y]?.[m] ?? {})) {
    if (Number(dStr) > maxDay) continue;
    for (const [k, rns] of Object.entries(map[y][m][Number(dStr)])) {
      acc[k] = (acc[k] ?? 0) + rns;
    }
  }
  return acc;
}

function daysInYM(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }

/* ── Module-level cache (refreshes once per hour) ──────────────────────── */
type RnsResult = { monthlyData: Record<string, Record<string, any>>; totalCmMtd: number };
type RnsCache  = { checkin: RnsResult | null; occupied: SoldMonthlyData | null; ts: number };
let rnsCache: RnsCache | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/* ── Stay RNS from DB (stay_rns, CICO, last 13 months by checkin) ──────── */
async function getRnsFromDb(): Promise<RnsResult | null> {
  const sql = getSql();
  const [countRow] = await sql`SELECT COUNT(*) AS n FROM stay_rns`;
  if (Number(countRow.n) === 0) return null;

  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 12, 1);
  const fmt   = (d: Date) => d.toISOString().split("T")[0];

  const rows = await sql`
    SELECT checkin::text AS date, ota_booking_source_desc AS channel, rns
    FROM stay_rns
    WHERE guest_status_desc IN ('Checkin', 'Checkout')
      AND checkin >= ${fmt(start)}::date
    ORDER BY checkin
  ` as Array<{ date: string; channel: string; rns: number }>;

  const { daily, chanDaily } = buildDMap(rows);
  const allOtas = [...new Set(Object.values(CHANNEL_TO_OTA).filter((v): v is string => v !== null))];

  const seen = new Set<string>();
  for (const y of Object.keys(daily))
    for (const m of Object.keys(daily[Number(y)])) seen.add(`${y}:${m}`);

  const monthlyData: Record<string, Record<string, any>> = {};
  let totalCmMtd = 0;
  const todayYear = now.getFullYear(), todayMonth = now.getMonth(), todayDay = now.getDate();

  for (const ym of seen) {
    const [yStr, mStr] = ym.split(":");
    const year = Number(yStr), month0 = Number(mStr);
    const isCurrent  = year === todayYear && month0 === todayMonth;
    const d1Cutoff   = Math.max(todayDay - 1, 1);
    const fullCutoff = daysInYM(year, month0);
    const lmMonth0   = month0 === 0 ? 11 : month0 - 1;
    const lmYear     = month0 === 0 ? year - 1 : year;
    const lmCutoff   = daysInYM(lmYear, lmMonth0);

    const cmSums     = sumDMap(daily,     year,    month0,   d1Cutoff);
    const cmTotSums  = isCurrent ? cmSums : sumDMap(daily, year, month0, fullCutoff);
    const lmSameSums = sumDMap(daily,     lmYear,  lmMonth0, d1Cutoff);
    const lmFullSums = sumDMap(daily,     lmYear,  lmMonth0, lmCutoff);
    const chCmSums   = sumDMap(chanDaily, year,    month0,   d1Cutoff);
    const chLmSums   = sumDMap(chanDaily, lmYear,  lmMonth0, d1Cutoff);
    const chLmFull   = sumDMap(chanDaily, lmYear,  lmMonth0, lmCutoff);

    const key = toMonthKey(year, month0);
    monthlyData[key] = {};

    for (const ota of allOtas) {
      const entry: any = { cmMTD: cmSums[ota] ?? 0, cmTotal: cmTotSums[ota] ?? 0, lmMTD: lmSameSums[ota] ?? 0, lmTotal: lmFullSums[ota] ?? 0 };
      const chNames = OTA_CHANNELS[ota];
      if (chNames) {
        entry.channels = Object.fromEntries(
          chNames.map((ch) => [ch, { cmMTD: chCmSums[ch] ?? 0, lmMTD: chLmSums[ch] ?? 0, lmTotal: chLmFull[ch] ?? 0 }])
        );
      }
      monthlyData[key][ota] = entry;
    }
    if (isCurrent) totalCmMtd = Object.values(cmSums).reduce((s, v) => s + v, 0);
  }
  return { monthlyData, totalCmMtd };
}

/* ── Sold RNS from DB (sold_rns) ───────────────────────────────────────── */
export type SoldMonthlyData = Record<string, Record<string, { cmMTD: number; lmMTD: number; lmTotal: number }>>;

async function getSoldFromDb(): Promise<SoldMonthlyData | null> {
  const sql = getSql();
  const [countRow] = await sql`SELECT COUNT(*) AS n FROM sold_rns`;
  if (Number(countRow.n) === 0) return null;

  const now = new Date();
  const rows = await sql`
    SELECT checkin::text AS date, ota_booking_source_desc AS channel, rns
    FROM sold_rns
    ORDER BY checkin
  ` as Array<{ date: string; channel: string; rns: number }>;

  const { daily } = buildDMap(rows);
  const allOtas = [...new Set(Object.values(CHANNEL_TO_OTA).filter((v): v is string => v !== null))];

  const seen = new Set<string>();
  for (const y of Object.keys(daily))
    for (const m of Object.keys(daily[Number(y)])) seen.add(`${y}:${m}`);

  const soldMonthly: SoldMonthlyData = {};
  const todayYear = now.getFullYear(), todayMonth = now.getMonth(), todayDay = now.getDate();

  for (const ym of seen) {
    const [yStr, mStr] = ym.split(":");
    const year = Number(yStr), month0 = Number(mStr);
    const isCurrent = year === todayYear && month0 === todayMonth;
    const cmCutoff  = isCurrent ? Math.max(todayDay - 1, 1) : daysInYM(year, month0);
    const lmMonth0  = month0 === 0 ? 11 : month0 - 1;
    const lmYear    = month0 === 0 ? year - 1 : year;
    const lmCutoff  = daysInYM(lmYear, lmMonth0);

    const cmSums     = sumDMap(daily, year,   month0,   cmCutoff);
    const lmSameSums = sumDMap(daily, lmYear, lmMonth0, cmCutoff);
    const lmFullSums = sumDMap(daily, lmYear, lmMonth0, lmCutoff);

    const key = toMonthKey(year, month0);
    soldMonthly[key] = {};
    for (const ota of allOtas) {
      soldMonthly[key][ota] = {
        cmMTD:   cmSums[ota]     ?? 0,
        lmMTD:   lmSameSums[ota] ?? 0,
        lmTotal: lmFullSums[ota] ?? 0,
      };
    }
  }
  return soldMonthly;
}

/* ── Occupied RNS from DB (stay_rns, expanded per night via generate_series) */
async function getOccupiedFromDb(): Promise<SoldMonthlyData | null> {
  const sql   = getSql();
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 12, 1);
  const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0); // end of current month
  const fmt   = (d: Date) => d.toISOString().split("T")[0];

  const rows = await sql`
    SELECT
      d::date::text AS date,
      ota_booking_source_desc AS channel,
      ROUND(SUM(rns::numeric / NULLIF(checkout::date - checkin::date, 0)))::int AS rns
    FROM stay_rns,
      LATERAL generate_series(checkin::date, checkout::date - 1, '1 day'::interval) d
    WHERE guest_status_desc IN ('Checkin', 'Checkout')
      AND checkin  <= ${fmt(end)}::date
      AND checkout >  ${fmt(start)}::date
      AND d::date  >= ${fmt(start)}::date
      AND d::date  <= ${fmt(end)}::date
    GROUP BY d::date, ota_booking_source_desc
    ORDER BY d::date ASC
  ` as Array<{ date: string; channel: string; rns: number }>;

  if (rows.length === 0) return null;

  const { daily, chanDaily } = buildDMap(rows);
  const allOtas = [...new Set(Object.values(CHANNEL_TO_OTA).filter((v): v is string => v !== null))];

  const seen = new Set<string>();
  for (const y of Object.keys(daily))
    for (const m of Object.keys(daily[Number(y)])) seen.add(`${y}:${m}`);

  const occupiedMonthly: Record<string, Record<string, any>> = {};
  const todayYear = now.getFullYear(), todayMonth = now.getMonth(), todayDay = now.getDate();

  for (const ym of seen) {
    const [yStr, mStr] = ym.split(":");
    const year = Number(yStr), month0 = Number(mStr);
    const isCurrent = year === todayYear && month0 === todayMonth;
    const cmCutoff  = isCurrent ? Math.max(todayDay - 1, 1) : daysInYM(year, month0);
    const lmMonth0  = month0 === 0 ? 11 : month0 - 1;
    const lmYear    = month0 === 0 ? year - 1 : year;
    const lmCutoff  = daysInYM(lmYear, lmMonth0);

    const cmSums     = sumDMap(daily,     year,   month0,   cmCutoff);
    const lmSameSums = sumDMap(daily,     lmYear, lmMonth0, cmCutoff);
    const lmFullSums = sumDMap(daily,     lmYear, lmMonth0, lmCutoff);
    const chCmSums   = sumDMap(chanDaily, year,   month0,   cmCutoff);
    const chLmSums   = sumDMap(chanDaily, lmYear, lmMonth0, cmCutoff);
    const chLmFull   = sumDMap(chanDaily, lmYear, lmMonth0, lmCutoff);

    const key = toMonthKey(year, month0);
    occupiedMonthly[key] = {};
    for (const ota of allOtas) {
      const entry: any = {
        cmMTD:   cmSums[ota]     ?? 0,
        lmMTD:   lmSameSums[ota] ?? 0,
        lmTotal: lmFullSums[ota] ?? 0,
      };
      const chNames = OTA_CHANNELS[ota];
      if (chNames) {
        entry.channels = Object.fromEntries(
          chNames.map((ch) => [ch, { cmMTD: chCmSums[ch] ?? 0, lmMTD: chLmSums[ch] ?? 0, lmTotal: chLmFull[ch] ?? 0 }])
        );
      }
      occupiedMonthly[key][ota] = entry;
    }
  }
  return occupiedMonthly as SoldMonthlyData;
}

/* ── Revenue from DB (stay_rns.revenue, CICO only) ─────────────────────── */
async function getRevFromDb(): Promise<Record<string, Record<string, { cmMTD: number; cmTotal: number; lmMTD: number; lmTotal: number }>> | null> {
  const sql = getSql();
  const [countRow] = await sql`SELECT COUNT(*) AS n FROM stay_rns WHERE rev > 0`;
  if (Number(countRow.n) === 0) return null;

  const now = new Date();
  const rows = await sql`
    SELECT checkin::text AS date, ota_booking_source_desc AS channel, rev AS rns
    FROM stay_rns
    WHERE LOWER(guest_status_desc) = 'checkout'
    ORDER BY checkin
  ` as Array<{ date: string; channel: string; rns: number }>;

  const { daily } = buildDMap(rows);
  const allOtas = [...new Set(Object.values(CHANNEL_TO_OTA).filter((v): v is string => v !== null))];

  const seen = new Set<string>();
  for (const y of Object.keys(daily))
    for (const m of Object.keys(daily[Number(y)])) seen.add(`${y}:${m}`);

  const revMonthly: Record<string, Record<string, { cmMTD: number; cmTotal: number; lmMTD: number; lmTotal: number }>> = {};
  const todayYear = now.getFullYear(), todayMonth = now.getMonth(), todayDay = now.getDate();

  for (const ym of seen) {
    const [yStr, mStr] = ym.split(":");
    const year = Number(yStr), month0 = Number(mStr);
    const isCurrent  = year === todayYear && month0 === todayMonth;
    const d1Cutoff   = Math.max(todayDay - 1, 1);
    const fullCutoff = daysInYM(year, month0);
    const lmMonth0   = month0 === 0 ? 11 : month0 - 1;
    const lmYear     = month0 === 0 ? year - 1 : year;
    const lmCutoff   = daysInYM(lmYear, lmMonth0);

    const cmSums     = sumDMap(daily, year,   month0,   d1Cutoff);
    const cmTotSums  = isCurrent ? cmSums : sumDMap(daily, year, month0, fullCutoff);
    const lmSameSums = sumDMap(daily, lmYear, lmMonth0, d1Cutoff);
    const lmFullSums = sumDMap(daily, lmYear, lmMonth0, lmCutoff);

    const key = toMonthKey(year, month0);
    revMonthly[key] = {};
    for (const ota of allOtas) {
      revMonthly[key][ota] = {
        cmMTD:   Math.round(cmSums[ota]     ?? 0),
        cmTotal: Math.round(cmTotSums[ota]  ?? 0),
        lmMTD:   Math.round(lmSameSums[ota] ?? 0),
        lmTotal: Math.round(lmFullSums[ota] ?? 0),
      };
    }
  }
  return revMonthly;
}

export async function GET(req: Request) {
  const force      = new URL(req.url).searchParams.has("force");
  const now        = new Date();
  const cmMonthKey = toMonthKey(now.getFullYear(), now.getMonth());
  const d1Days     = Math.max(now.getDate() - 1, 1);

  // Refresh cache if stale or force-requested
  if (force || !rnsCache || Date.now() - rnsCache.ts > CACHE_TTL_MS) {
    const [checkin, occupied] = await Promise.all([getRnsFromDb(), getOccupiedFromDb()]);
    rnsCache = { checkin, occupied, ts: Date.now() };
  }

  const rawParsed          = rnsCache.checkin;
  const rnsOccupiedMonthly = rnsCache.occupied;

  const rnsLiveMonthly = rawParsed?.monthlyData ?? null;

  const rnpdLive = (() => {
    const rawMonth = rawParsed?.monthlyData[cmMonthKey];
    if (!rawMonth) return null;
    return Object.fromEntries(
      Object.entries(rawMonth).map(([ota, d]) => {
        const entry = d as any;
        return [ota, {
          cmRNs: entry.cmMTD, lmSameDayRNs: entry.lmMTD, lmTotalRNs: entry.lmTotal,
          channels: entry.channels
            ? Object.fromEntries(
                Object.entries(entry.channels).map(([ch, c]: [string, any]) => [ch, {
                  cmRNs: c.cmMTD, lmSameDayRNs: c.lmMTD, lmTotalRNs: c.lmTotal,
                }])
              )
            : undefined,
        }];
      })
    );
  })();

  const rnsPerDayCmAvg = rawParsed !== null
    ? Math.round(rawParsed.totalCmMtd / d1Days)
    : null;

  // Get listing + sold + revenue data from DB in parallel
  const [listingData, rnsSoldMonthly, revLiveMonthly] = await Promise.all([
    getListingDataFromDb(),
    getSoldFromDb(),
    getRevFromDb(),
  ]);

  const fetchedAt = now.toISOString();

  if (!listingData) {
    return Response.json({
      fhLiveCount:          FH_PLATFORM_LIVE,
      fhTotalProps:         1877,
      fhSoldOutCount:       0,
      fhOnboardedThisMonth: 0,
      rnpdLive,

      rnsPerDayCmAvg,
      rnsLiveMonthly,
      rnsSoldMonthly,
      rnsOccupiedMonthly,
      revLiveMonthly,
      otaStatus:     OTA_STATUS,
      mtdListings:   MTD_LISTINGS,
      l12mOtaLive:   L12M_OTA_LIVE,
      l12mMonths:    L12M_MONTHS,
      l12mOnboarded: L12M_ONBOARDED,
      source:    "seed",
      fetchedAt,
      error:     "No data — click Sync to DB in the topbar first",
    });
  }

  return Response.json({
    ...listingData,
    rnpdLive,
    rnsPerDayCmAvg,
    rnsLiveMonthly,
    rnsSoldMonthly,
    rnsOccupiedMonthly,
    revLiveMonthly,
    source:   "db",
    fetchedAt,
  });
}
