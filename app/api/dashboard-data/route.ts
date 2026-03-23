import { getDb } from "@/lib/db";
import {
  parseDoDStay, parseMoMStay, getMoMStayCmTotal, parseRawDataRNS,
  CHANNEL_TO_OTA, OTA_CHANNELS, RawDataResult,
} from "@/lib/rns-sheet-parser";
import { RNS_SHEET_ID, OTAS } from "@/lib/constants";
import {
  OTA_STATUS, MTD_LISTINGS, L12M_OTA_LIVE, L12M_MONTHS, L12M_ONBOARDED, FH_PLATFORM_LIVE
} from "@/lib/data";

/* ── RNS sheet cache (refreshes once after 11 AM each day) ─────────────── */
let rnsCache: { data: unknown; fetchedAt: Date } | null = null;

function rnsNeedsRefresh(now: Date): boolean {
  if (!rnsCache) return true;
  const eleven = new Date(now);
  eleven.setHours(11, 0, 0, 0);
  return now >= eleven && rnsCache.fetchedAt < eleven;
}

function fetchRnsSheet(tab: string) {
  const url = `https://docs.google.com/spreadsheets/d/${RNS_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
  return fetch(url, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`RNS sheet "${tab}": ${r.status}`);
    return r.text();
  });
}

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
function getListingDataFromDb() {
  const db = getDb();
  const now = new Date();

  const totalProps = (db.prepare("SELECT COUNT(*) as n FROM Property").get() as { n: number }).n;
  if (totalProps === 0) return null;

  // Generate last 12 months dynamically
  const l12mMonths: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    l12mMonths.push(`${MONTH_ABBR[d.getMonth()]}-${String(d.getFullYear()).slice(-2)}`);
  }

  // Property counts
  const fhLiveCount = (
    db.prepare("SELECT COUNT(*) as n FROM Property WHERE LOWER(fhStatus) = 'live'").get() as { n: number }
  ).n;
  const fhSoldOutCount = (
    db.prepare("SELECT COUNT(*) as n FROM Property WHERE LOWER(fhStatus) = 'soldout'").get() as { n: number }
  ).n;
  const fhTotalProps = fhLiveCount + fhSoldOutCount;

  const cmStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const fhOnboardedThisMonth = (
    db.prepare("SELECT COUNT(*) as n FROM Property WHERE fhLiveDate IS NOT NULL AND fhLiveDate >= ?")
      .get(cmStart) as { n: number }
  ).n;

  // OTA status: live = subStatus='live'; notLive = everything else with a record
  const otaStatusRows = db.prepare(`
    SELECT ota,
      SUM(CASE WHEN LOWER(subStatus) = 'live' THEN 1 ELSE 0 END) AS live,
      COUNT(*) AS total
    FROM OtaListing
    GROUP BY ota
  `).all() as Array<{ ota: string; live: number; total: number }>;

  const otaStatusMap = new Map(otaStatusRows.map((r) => [r.ota, r]));
  const otaStatus = OTA_STATUS.map(({ ota }) => {
    const r = otaStatusMap.get(ota);
    return r
      ? { ota, live: r.live, notLive: r.total - r.live }
      : { ota, live: 0, notLive: 0 };
  });

  // MTD listings: current month + last month same-day + last month total
  const lmDate  = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lmStart = `${lmDate.getFullYear()}-${String(lmDate.getMonth() + 1).padStart(2, "0")}-01`;
  const lmEnd   = cmStart; // exclusive
  const daysDone = now.getDate();

  const mtdRows = db.prepare(`
    SELECT ota,
      SUM(CASE WHEN liveDate >= ? THEN 1 ELSE 0 END) AS cmMTD,
      SUM(CASE WHEN liveDate >= ? AND liveDate < ? AND CAST(strftime('%d', liveDate) AS INTEGER) <= ? THEN 1 ELSE 0 END) AS lmSameDay,
      SUM(CASE WHEN liveDate >= ? AND liveDate < ? THEN 1 ELSE 0 END) AS lmTotal
    FROM OtaListing
    WHERE liveDate IS NOT NULL
    GROUP BY ota
  `).all(cmStart, lmStart, lmEnd, daysDone, lmStart, lmEnd) as Array<{
    ota: string; cmMTD: number; lmSameDay: number; lmTotal: number;
  }>;

  const mtdMap = new Map(mtdRows.map((r) => [r.ota, r]));
  const mtdListings = MTD_LISTINGS.map(({ ota }) => {
    const r = mtdMap.get(ota);
    return r
      ? { ota, cmMTD: r.cmMTD, lmSameDay: r.lmSameDay, lmTotal: r.lmTotal }
      : { ota, cmMTD: 0, lmSameDay: 0, lmTotal: 0 };
  });

  // L12M OTA live: counts by month for last 12 months
  const { year: l12mY0, month0: l12mM0 } = monthKeyToYM(l12mMonths[0]);
  const l12mStart = `${l12mY0}-${String(l12mM0 + 1).padStart(2, "0")}-01`;

  const l12mRows = db.prepare(`
    SELECT ota, strftime('%Y-%m', liveDate) AS ym, COUNT(*) AS cnt
    FROM OtaListing
    WHERE liveDate IS NOT NULL AND liveDate >= ?
    GROUP BY ota, strftime('%Y-%m', liveDate)
  `).all(l12mStart) as Array<{ ota: string; ym: string; cnt: number }>;

  // Build ym → month key mapping
  const ymToIdx = new Map(
    l12mMonths.map((key, i) => {
      const { year, month0 } = monthKeyToYM(key);
      return [`${year}-${String(month0 + 1).padStart(2, "0")}`, i];
    })
  );

  const l12mOtaLive: Record<string, number[]> = {};
  for (const ota of OTAS) {
    l12mOtaLive[ota] = new Array(l12mMonths.length).fill(0);
  }
  for (const row of l12mRows) {
    const idx = ymToIdx.get(row.ym);
    if (idx !== undefined) {
      if (!l12mOtaLive[row.ota]) l12mOtaLive[row.ota] = new Array(l12mMonths.length).fill(0);
      l12mOtaLive[row.ota][idx] = row.cnt;
    }
  }

  // L12M onboarded: new properties by fhLiveDate per month
  const onboardedRows = db.prepare(`
    SELECT strftime('%Y-%m', fhLiveDate) AS ym, COUNT(*) AS cnt
    FROM Property
    WHERE fhLiveDate IS NOT NULL AND fhLiveDate >= ?
    GROUP BY strftime('%Y-%m', fhLiveDate)
  `).all(l12mStart) as Array<{ ym: string; cnt: number }>;

  const l12mOnboarded = new Array(l12mMonths.length).fill(0);
  for (const row of onboardedRows) {
    const idx = ymToIdx.get(row.ym);
    if (idx !== undefined) l12mOnboarded[idx] = row.cnt;
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
    if (!mappedOta) continue;                              // skip unmapped channels (Desiya, Other, etc.)
    const d  = new Date(row.date + "T00:00:00");
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

/* ── Stay RNS from DB (RnsStay, CICO only) ─────────────────────────────── */
function getRnsFromDb(): RawDataResult | null {
  const db = getDb();
  const count = (db.prepare("SELECT COUNT(*) as n FROM RnsStay").get() as { n: number }).n;
  if (count === 0) return null;

  const now = new Date();
  const rows = db.prepare(
    "SELECT stay_date AS date, ota AS channel, rns FROM RnsStay WHERE UPPER(guest_status) = 'CICO' ORDER BY stay_date"
  ).all() as Array<{ date: string; channel: string; rns: number }>;

  const { daily, chanDaily } = buildDMap(rows);
  const allOtas = [...new Set(Object.values(CHANNEL_TO_OTA).filter((v): v is string => v !== null))];

  const seen = new Set<string>();
  for (const y of Object.keys(daily))
    for (const m of Object.keys(daily[Number(y)])) seen.add(`${y}:${m}`);

  const monthlyData: RawDataResult["monthlyData"] = {};
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

/* ── Sold RNS from DB (RnsSold) ────────────────────────────────────────── */
export type SoldMonthlyData = Record<string, Record<string, { cmMTD: number; lmMTD: number; lmTotal: number }>>;

function getSoldFromDb(): SoldMonthlyData | null {
  const db = getDb();
  const count = (db.prepare("SELECT COUNT(*) as n FROM RnsSold").get() as { n: number }).n;
  if (count === 0) return null;

  const now = new Date();
  const rows = db.prepare(
    "SELECT sold_date AS date, ota AS channel, rns FROM RnsSold ORDER BY sold_date"
  ).all() as Array<{ date: string; channel: string; rns: number }>;

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

/* ── Revenue from DB (RnsStay.revenue, CICO only) ─────────────────────── */
function getRevFromDb(): Record<string, Record<string, { cmMTD: number; cmTotal: number; lmMTD: number; lmTotal: number }>> | null {
  const db = getDb();
  const count = (db.prepare("SELECT COUNT(*) as n FROM RnsStay WHERE revenue > 0").get() as { n: number }).n;
  if (count === 0) return null;

  const now = new Date();
  const rows = db.prepare(
    "SELECT stay_date AS date, ota AS channel, revenue AS rns FROM RnsStay WHERE UPPER(guest_status) = 'CICO' ORDER BY stay_date"
  ).all() as Array<{ date: string; channel: string; rns: number }>;

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
  const force = new URL(req.url).searchParams.has("force");
  const now   = new Date();

  const cmMonthKey = toMonthKey(now.getFullYear(), now.getMonth());
  const d1Days     = Math.max(now.getDate() - 1, 1);

  // Try DB first; fall back to Google Sheets if not yet synced
  let rawParsed = getRnsFromDb();
  let momStay: ReturnType<typeof parseMoMStay> | null = null;

  if (!rawParsed || force) {
    // Fetch RNS sheets (cached)
    let dodResult: PromiseSettledResult<string> | null = null;
    let momResult: PromiseSettledResult<string> | null = null;
    let rawResult: PromiseSettledResult<string> | null = null;

    if (force || rnsNeedsRefresh(now)) {
      [dodResult, momResult, rawResult] = await Promise.allSettled([
        fetchRnsSheet("DoD Summary"),
        fetchRnsSheet("MoM Summary"),
        fetchRnsSheet("Raw_data"),
      ]);
      if (rawResult.status === "rejected") {
        console.error("[dashboard-data] Raw_data fetch failed:", rawResult.reason);
      }
      rnsCache = { data: { dodResult, momResult, rawResult }, fetchedAt: now };
    } else if (rnsCache) {
      const cached = rnsCache.data as {
        dodResult: PromiseSettledResult<string>;
        momResult: PromiseSettledResult<string>;
        rawResult: PromiseSettledResult<string>;
      };
      dodResult = cached.dodResult;
      momResult = cached.momResult;
      rawResult = cached.rawResult;
    }

    if (!rawParsed) {
      rawParsed = rawResult?.status === "fulfilled" ? parseRawDataRNS(rawResult.value) : null;
    }
    momStay = momResult?.status === "fulfilled" ? parseMoMStay(momResult.value) : null;

    // rnpdLive fallback to DoD sheet if raw data unavailable
    if (!rawParsed && dodResult?.status === "fulfilled") {
      const dodStay = parseDoDStay(dodResult.value);
      // store as minimal rnpdLive only (no monthlyData)
      const rnpdFallback = Object.fromEntries(
        Object.entries(dodStay).map(([ota, e]) => [ota, {
          cmRNs: e.cmRNs, lmSameDayRNs: e.lmSameDayRNs, lmTotalRNs: e.lmTotalRNs, channels: e.channels,
        }])
      );
      const rnsPerDayCmAvgFallback = (() => {
        const t = momResult?.status === "fulfilled" ? getMoMStayCmTotal(momResult.value) : null;
        return t !== null ? Math.round(t / d1Days) : null;
      })();
      const listingData = getListingDataFromDb();
      if (!listingData) {
        return Response.json({
          fhLiveCount: FH_PLATFORM_LIVE, fhTotalProps: 1877, fhSoldOutCount: 0, fhOnboardedThisMonth: 0,
          rnpdLive: rnpdFallback, momStay, rnsPerDayCmAvg: rnsPerDayCmAvgFallback, rnsLiveMonthly: null,
          otaStatus: OTA_STATUS, mtdListings: MTD_LISTINGS,
          l12mOtaLive: L12M_OTA_LIVE, l12mMonths: L12M_MONTHS, l12mOnboarded: L12M_ONBOARDED,
          source: "seed", fetchedAt: now.toISOString(), error: "No data — click Sync to DB first",
        });
      }
      return Response.json({
        ...listingData, rnpdLive: rnpdFallback, momStay,
        rnsPerDayCmAvg: rnsPerDayCmAvgFallback, rnsLiveMonthly: null,
        source: "db", fetchedAt: now.toISOString(),
      });
    }
  }

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

  // Get listing + sold data from DB
  const listingData    = getListingDataFromDb();
  const rnsSoldMonthly = getSoldFromDb();
  const revLiveMonthly = getRevFromDb();

  const fetchedAt = now.toISOString();

  if (!listingData) {
    return Response.json({
      fhLiveCount:          FH_PLATFORM_LIVE,
      fhTotalProps:         1877,
      fhSoldOutCount:       0,
      fhOnboardedThisMonth: 0,
      rnpdLive,
      momStay,
      rnsPerDayCmAvg,
      rnsLiveMonthly,
      rnsSoldMonthly,
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
    momStay,
    rnsPerDayCmAvg,
    rnsLiveMonthly,
    rnsSoldMonthly,
    revLiveMonthly,
    source:     "db",
    fetchedAt,
  });
}
