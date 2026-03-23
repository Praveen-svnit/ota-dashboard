/**
 * Parser for the RNS production sheet (ID: RNS_SHEET_ID).
 * Extracts the "Stay Summary" section from DoD Summary and MoM Summary tabs.
 *
 * Approach: marker-based row scanning — finds "Stay Summary" by content, not by
 * hardcoded row numbers, so the parser survives future row insertions.
 */

// Maps channel names (as they appear in the sheet) → OTA display name used in RNS_OTAS.
// Multiple channels mapping to the same OTA are summed together.
// null = skip that channel.
export const CHANNEL_TO_OTA: Record<string, string | null> = {
  "Booking.com":   "Booking.com",
  "Agoda":         "Agoda",
  "Expedia":       "Expedia",
  "Cleartrip":     "Cleartrip",
  "EaseMyTrip":    "EaseMyTrip",
  // GoMMT group (MakeMyTrip Limited): Goibibo + MakeMyTrip + MyBiz
  "Goibibo":       "GoMMT",
  "MakeMyTrip":    "GoMMT",
  "MyBiz":         "GoMMT",
  // Yatra group: Yatra + Travelguru
  "Yatra":         "Yatra",
  "Travelguru":    "Yatra",
  "Ixigo":         "Ixigo",
  "Akbar Travels": "Akbar Travels",
  // No CICO data — skip
  "RoomsTonite":   null,
  "Other":         null,
};

// OTAs that have expandable sub-channels, keyed by OTA display name.
export const OTA_CHANNELS: Record<string, string[]> = {
  "GoMMT": ["Goibibo", "MakeMyTrip", "MyBiz"],
  "Yatra":  ["Yatra", "Travelguru"],
};

export interface RNPDChannelEntry {
  cmRNs:        number;
  lmSameDayRNs: number;
  lmTotalRNs:   number;
}

export interface RNPDEntry {
  cmRNs:         number;  // CM cumulative stay nights (D-1: excludes today)
  lmSameDayRNs:  number;  // LM same-day cumulative (same cutoff as CM)
  lmTotalRNs:    number;  // LM full-month stay nights
  channels?:     Record<string, RNPDChannelEntry>;
}

// ─── CSV helpers ────────────────────────────────────────────────────────────

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === "," && !inQ) { result.push(cur.trim()); cur = ""; }
    else { cur += ch; }
  }
  result.push(cur.trim());
  return result;
}

function parseNum(raw: string): number {
  const n = parseInt((raw ?? "").replace(/,/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

// ─── Section finder ──────────────────────────────────────────────────────────

function findRow(rows: string[][], marker: string, startAfter = 0): number {
  for (let i = startAfter; i < rows.length; i++) {
    if (rows[i][0]?.trim().toLowerCase().includes(marker.toLowerCase())) return i;
  }
  return -1;
}

// ─── Date label parser ("12-Mar" → { year, month0, day }) ───────────────────

const MONTH_IDX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

function parseDodLabel(label: string, cmYear: number, cmMonth0: number) {
  // Expects "12-Mar", "28-Feb", "31-Jan" etc.
  const m = label.match(/^(\d{1,2})-([A-Za-z]{3})$/);
  if (!m) return null;
  const day   = parseInt(m[1], 10);
  const month0 = MONTH_IDX[m[2].toLowerCase()];
  if (month0 === undefined) return null;
  // Year: assume current year; if month is ahead of today's month, it's previous year
  const year = month0 <= cmMonth0 ? cmYear : cmYear - 1;
  return { year, month0, day };
}

// ─── DoD Summary Stay parser ─────────────────────────────────────────────────
// Returns per-OTA { cmRNs, lmSameDayRNs, lmTotalRNs } derived from daily columns.

export function parseDoDStay(csv: string): Record<string, RNPDEntry> {
  const rows = csv.trim().split("\n").map(parseCsvLine);

  const stayIdx = findRow(rows, "Stay Summary");
  if (stayIdx === -1) {
    console.warn("[rns-parser] 'Stay Summary' not found in DoD Summary");
    return {};
  }

  // Find "Day" header row within next 5 rows after marker
  let dayRowIdx = -1;
  for (let i = stayIdx + 1; i < Math.min(stayIdx + 6, rows.length); i++) {
    if (rows[i][0]?.trim() === "Day") { dayRowIdx = i; break; }
  }
  if (dayRowIdx === -1) {
    console.warn("[rns-parser] 'Day' header not found after Stay Summary in DoD");
    return {};
  }

  const now     = new Date();
  const cmYear  = now.getFullYear();
  const cmMonth = now.getMonth();   // 0-based
  const cmDay   = now.getDate();
  const lmDate  = new Date(cmYear, cmMonth - 1, 1);
  const lmYear  = lmDate.getFullYear();
  const lmMonth = lmDate.getMonth();

  // Build column index lists for CM and LM from Day row
  const dayRow = rows[dayRowIdx];
  const cmCols: { colIdx: number; day: number }[] = [];
  const lmCols: { colIdx: number; day: number }[] = [];

  for (let c = 0; c < dayRow.length; c++) {
    const label = dayRow[c]?.trim();
    if (!label) continue;
    const parsed = parseDodLabel(label, cmYear, cmMonth);
    if (!parsed) continue;
    if (parsed.year === cmYear && parsed.month0 === cmMonth) {
      cmCols.push({ colIdx: c, day: parsed.day });
    } else if (parsed.year === lmYear && parsed.month0 === lmMonth) {
      lmCols.push({ colIdx: c, day: parsed.day });
    }
  }

  // Data rows start after "Channel" row (dayRowIdx + 1)
  const dataStart = dayRowIdx + 2; // skip Channel label row
  const acc:     Record<string, RNPDEntry> = {};
  const chanAcc: Record<string, Record<string, RNPDChannelEntry>> = {};

  for (let i = dataStart; i < rows.length; i++) {
    const row     = rows[i];
    const channel = row[0]?.trim();
    if (!channel) continue;
    if (channel === "Total" || channel.startsWith("CNS")) break;

    const ota = CHANNEL_TO_OTA[channel];
    if (!ota) continue;

    if (!acc[ota])      acc[ota]      = { cmRNs: 0, lmSameDayRNs: 0, lmTotalRNs: 0 };
    if (!chanAcc[ota])  chanAcc[ota]  = {};
    if (!chanAcc[ota][channel]) chanAcc[ota][channel] = { cmRNs: 0, lmSameDayRNs: 0, lmTotalRNs: 0 };

    // CM: D-1 → exclude today (day === cmDay)
    for (const { colIdx, day } of cmCols) {
      if (day < cmDay) {
        const v = parseNum(row[colIdx]);
        acc[ota].cmRNs                += v;
        chanAcc[ota][channel].cmRNs   += v;
      }
    }

    // LM: all days → lmTotal; days < cmDay → lmSameDay (same D-1 cutoff)
    for (const { colIdx, day } of lmCols) {
      const v = parseNum(row[colIdx]);
      acc[ota].lmTotalRNs                += v;
      chanAcc[ota][channel].lmTotalRNs   += v;
      if (day < cmDay) {
        acc[ota].lmSameDayRNs              += v;
        chanAcc[ota][channel].lmSameDayRNs += v;
      }
    }
  }

  // Embed channel breakdowns
  for (const ota of Object.keys(chanAcc)) {
    acc[ota].channels = chanAcc[ota];
  }

  return acc;
}

// ─── MoM Stay grand total ────────────────────────────────────────────────────
// Reads the "Total" row from the Stay Summary section, col D (index 3).
// Using marker scan avoids raw row-number issues caused by gviz vs sheet offsets.

export function getMoMStayCmTotal(csv: string): number {
  const rows = csv.trim().split("\n").map(parseCsvLine);

  const stayIdx = findRow(rows, "Stay Summary");
  if (stayIdx === -1) return 0;

  // Find "Total" row after the Stay Summary marker
  for (let i = stayIdx + 1; i < rows.length; i++) {
    if (rows[i][0]?.trim() === "Total") return parseNum(rows[i][3]);
    // Stop if we hit the next major section
    if (rows[i][0]?.trim().startsWith("CNS")) break;
  }
  return 0;
}

// ─── Raw_data RNS parser ─────────────────────────────────────────────────────
// Reads "Raw_data" tab. Filters rows where Col J (idx 9) = "CICO".
// Builds MonthlyData for PerformanceTable + totalCmMtd for KPI card.
//
// Raw_data columns (0-based): H=7 bookedDate, I=8 channel, J=9 status, K=10 rns

export interface RawDataResult {
  monthlyData: Record<string, Record<string, { lmMTD: number; cmMTD: number; lmTotal: number }>>;
  totalCmMtd:  number;
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function toMonthKey(year: number, month0: number): string {
  return `${MONTH_NAMES[month0]}-${String(year).slice(-2)}`;
}

function daysInYM(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

// Case-insensitive channel → OTA lookup (resilient to casing differences in sheet)
const CHANNEL_LOOKUP = new Map<string, string | null>(
  Object.entries(CHANNEL_TO_OTA).map(([k, v]) => [k.toLowerCase().trim(), v])
);

function lookupOta(raw: string): string | null | undefined {
  // Exact match first, then case-insensitive
  if (raw in CHANNEL_TO_OTA) return CHANNEL_TO_OTA[raw];
  return CHANNEL_LOOKUP.get(raw.toLowerCase().trim());
}

export function parseRawDataRNS(csv: string): RawDataResult {
  const rows = csv.trim().split("\n").map(parseCsvLine);
  if (rows.length < 2) return { monthlyData: {}, totalCmMtd: 0 };

  // Confirmed column positions (user-verified): H=7 date, I=8 channel, J=9 status, K=10 rns
  const dC = 7, cC = 8, sC = 9, rC = 10;

  // Build daily[year][month0][day][ota] = rns (OTA-level)
  // Build chanDaily[year][month0][day][channel] = rns (channel-level, raw sheet names)
  type DMap = Record<number, Record<number, Record<number, Record<string, number>>>>;
  const daily:     DMap = {};
  const chanDaily: DMap = {};

  const unmatchedChannels = new Map<string, number>(); // channel → total skipped rns

  for (let i = 1; i < rows.length; i++) {
    const row     = rows[i];
    const dateStr = row[dC]?.trim();
    const channel = row[cC]?.trim();
    const status  = row[sC]?.trim();
    const rns     = Math.round(parseFloat((row[rC] ?? "").replace(/,/g, "")) || 0);

    if (!status || status.toUpperCase() !== "CICO") continue;
    if (!channel) continue;
    const ota = lookupOta(channel);
    if (!ota) {
      unmatchedChannels.set(channel, (unmatchedChannels.get(channel) ?? 0) + rns);
      continue;
    }

    const d = new Date(dateStr);
    if (isNaN(d.getTime())) continue;
    const y  = d.getFullYear();
    const m  = d.getMonth();
    const dy = d.getDate();

    if (!daily[y])          daily[y]          = {};
    if (!daily[y][m])       daily[y][m]       = {};
    if (!daily[y][m][dy])   daily[y][m][dy]   = {};
    daily[y][m][dy][ota] = (daily[y][m][dy][ota] ?? 0) + rns;

    // Use canonical channel name (from CHANNEL_TO_OTA key) for consistent lookup
    const canonicalChannel = Object.keys(CHANNEL_TO_OTA).find(
      (k) => k.toLowerCase().trim() === channel.toLowerCase().trim()
    ) ?? channel;

    if (!chanDaily[y])        chanDaily[y]        = {};
    if (!chanDaily[y][m])     chanDaily[y][m]     = {};
    if (!chanDaily[y][m][dy]) chanDaily[y][m][dy] = {};
    chanDaily[y][m][dy][canonicalChannel] = (chanDaily[y][m][dy][canonicalChannel] ?? 0) + rns;
  }

  if (unmatchedChannels.size > 0) {
    console.warn("[raw-data] CICO channels not in CHANNEL_TO_OTA (skipped RNs):",
      Object.fromEntries(unmatchedChannels));
  }

  // Unique OTAs from CHANNEL_TO_OTA values
  const allOtas = [...new Set(
    Object.values(CHANNEL_TO_OTA).filter((v): v is string => v !== null)
  )];

  // Sum a month's rns up to maxDay (inclusive) by key (ota or channel)
  function sumMonth(map: DMap, y: number, m: number, maxDay: number): Record<string, number> {
    const acc: Record<string, number> = {};
    const md = map[y]?.[m] ?? {};
    for (const dStr of Object.keys(md)) {
      if (Number(dStr) > maxDay) continue;
      for (const [k, rns] of Object.entries(md[Number(dStr)])) {
        acc[k] = (acc[k] ?? 0) + rns;
      }
    }
    return acc;
  }

  const now          = new Date();
  const todayYear    = now.getFullYear();
  const todayMonth   = now.getMonth();
  const todayDay     = now.getDate();

  const monthlyData: Record<string, Record<string, {
    lmMTD: number; cmMTD: number; lmTotal: number;
    channels?: Record<string, { lmMTD: number; cmMTD: number; lmTotal: number }>;
  }>> = {};
  let totalCmMtd = 0;

  // Build one entry per (year, month0) found in the data
  const seen = new Set<string>();
  for (const y of Object.keys(daily)) {
    for (const m of Object.keys(daily[Number(y)])) {
      seen.add(`${y}:${m}`);
    }
  }

  for (const ym of seen) {
    const [yStr, mStr] = ym.split(":");
    const year   = Number(yStr);
    const month0 = Number(mStr);

    const isCurrent = year === todayYear && month0 === todayMonth;
    const cmCutoff  = isCurrent ? Math.max(todayDay - 1, 1) : daysInYM(year, month0);

    const lmMonth0 = month0 === 0 ? 11 : month0 - 1;
    const lmYear   = month0 === 0 ? year - 1 : year;
    const lmCutoff = daysInYM(lmYear, lmMonth0);

    const cmSums      = sumMonth(daily,     year,   month0,  cmCutoff);
    const lmSameSums  = sumMonth(daily,     lmYear, lmMonth0, cmCutoff);
    const lmFullSums  = sumMonth(daily,     lmYear, lmMonth0, lmCutoff);

    const chCmSums    = sumMonth(chanDaily, year,   month0,  cmCutoff);
    const chLmSums    = sumMonth(chanDaily, lmYear, lmMonth0, cmCutoff);
    const chLmFull    = sumMonth(chanDaily, lmYear, lmMonth0, lmCutoff);

    const key = toMonthKey(year, month0);
    monthlyData[key] = {};

    for (const ota of allOtas) {
      const entry: (typeof monthlyData)[string][string] = {
        cmMTD:   cmSums[ota]     ?? 0,
        lmMTD:   lmSameSums[ota] ?? 0,
        lmTotal: lmFullSums[ota] ?? 0,
      };
      // Embed per-channel breakdown for expandable OTAs
      const chNames = OTA_CHANNELS[ota];
      if (chNames) {
        entry.channels = {};
        for (const ch of chNames) {
          entry.channels[ch] = {
            cmMTD:   chCmSums[ch]  ?? 0,
            lmMTD:   chLmSums[ch]  ?? 0,
            lmTotal: chLmFull[ch]  ?? 0,
          };
        }
      }
      monthlyData[key][ota] = entry;
    }

    if (isCurrent) {
      totalCmMtd = Object.values(cmSums).reduce((s, v) => s + v, 0);
    }
  }

  return { monthlyData, totalCmMtd };
}

// ─── MoM Summary Stay parser ─────────────────────────────────────────────────
// Returns per-OTA { cmMtd, lmRnpd, cmRnpd } from the aggregate columns.
// col 1 = CM RNPD, col 2 = LM RNPD, col 3 = CM MTD cumulative.

export interface MoMStayEntry {
  cmRnpd: number;  // current month room nights per day
  lmRnpd: number;  // last month room nights per day
  cmMtd:  number;  // current month MTD cumulative
}

export function parseMoMStay(csv: string): Record<string, MoMStayEntry> {
  const rows = csv.trim().split("\n").map(parseCsvLine);

  const stayIdx = findRow(rows, "Stay Summary");
  if (stayIdx === -1) {
    console.warn("[rns-parser] 'Stay Summary' not found in MoM Summary");
    return {};
  }

  // Find "Day" header row within next 5 rows
  let dayRowIdx = -1;
  for (let i = stayIdx + 1; i < Math.min(stayIdx + 6, rows.length); i++) {
    if (rows[i][0]?.trim() === "Day") { dayRowIdx = i; break; }
  }
  if (dayRowIdx === -1) {
    console.warn("[rns-parser] 'Day' header not found after Stay Summary in MoM");
    return {};
  }

  const dataStart = dayRowIdx + 2; // skip Channel label row
  const acc: Record<string, MoMStayEntry> = {};

  for (let i = dataStart; i < rows.length; i++) {
    const row     = rows[i];
    const channel = row[0]?.trim();
    if (!channel) continue;
    if (channel === "Total" || channel.startsWith("CNS")) break;

    const ota = CHANNEL_TO_OTA[channel];
    if (!ota) continue;

    if (!acc[ota]) acc[ota] = { cmRnpd: 0, lmRnpd: 0, cmMtd: 0 };
    // cols: [channel, cmRnpd, lmRnpd, cmMtd, ...]
    acc[ota].cmRnpd += parseNum(row[1]);
    acc[ota].lmRnpd += parseNum(row[2]);
    acc[ota].cmMtd  += parseNum(row[3]);
  }

  return acc;
}
