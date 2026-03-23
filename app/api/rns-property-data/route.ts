import { RNS_SHEET_ID } from "@/lib/constants";
import { getListingData } from "@/lib/listing-cache";
import { CHANNEL_TO_OTA } from "@/lib/rns-sheet-parser";

const RNS_OTAS = [
  "GoMMT", "Booking.com", "Agoda", "Expedia",
  "Cleartrip", "EaseMyTrip", "Yatra", "Ixigo", "Akbar Travels",
];

const OTA_SUB_STATUS_COL: Record<string, string> = {
  "GoMMT":         "GoMMT Sub Status",
  "Booking.com":   "BDC Sub Status",
  "Agoda":         "Agoda Sub Status",
  "EaseMyTrip":    "EMT Sub Status",
  "Cleartrip":     "CT Sub Status",
  "Expedia":       "Exp Sub Status",
  "Yatra":         "Yatra Sub Status",
  "Akbar Travels": "AKT Sub Status",
  "Ixigo":         "Ixigo Sub Status",
};

// Confirmed column positions in Raw_data sheet (0-based):
//   H = 7  → date
//   I = 8  → channel (OTA)
//   J = 9  → status  (CICO | CNS)
//   K = 10 → RNs
//   L = 11 → property name/ID
const dC = 7;
const cC = 8;
const sC = 9;
const rC = 10;
const pC = 11;   // property identifier — Col L

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "", inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === "," && !inQ) { result.push(cur.trim()); cur = ""; }
    else { cur += ch; }
  }
  result.push(cur.trim());
  return result;
}

const CHANNEL_LOOKUP = new Map<string, string | null>(
  Object.entries(CHANNEL_TO_OTA).map(([k, v]) => [k.toLowerCase().trim(), v])
);
function lookupOta(raw: string): string | null {
  if (raw in CHANNEL_TO_OTA) return CHANNEL_TO_OTA[raw];
  return CHANNEL_LOOKUP.get(raw.toLowerCase().trim()) ?? null;
}

export interface OtaBuckets {
  zero:      number;  // live on OTA but 0 production
  lt10:      number;  // 1–9 RNs
  lt30:      number;  // 10–29 RNs
  lt60:      number;  // 30–59 RNs
  plus60:    number;  // 60+ RNs
  totalLive: number;  // total properties sub-status live on OTA
}

export async function GET() {
  try {
    const now     = new Date();
    const cmYear  = now.getFullYear();
    const cmMonth = now.getMonth();

    // ── 1. Fetch Raw_data ─────────────────────────────────────────────────
    const url = `https://docs.google.com/spreadsheets/d/${RNS_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("Raw_data")}`;
    const csv = await fetch(url, { cache: "no-store" }).then((r) => {
      if (!r.ok) throw new Error(`Raw_data fetch failed: ${r.status}`);
      return r.text();
    });

    const lines = csv.trim().split("\n");
    // lines[0] = header row — skip it
    const headerCols = parseCsvLine(lines[0]);
    const propColName = headerCols[pC] ?? `col_${pC}`;   // for debug

    // ── 2. Aggregate RNs per (property, OTA) for current month ───────────
    //    Include both CICO (check-in/out) and CNS (cancelled no-show)
    const propOtaRns = new Map<string, number>();

    for (let i = 1; i < lines.length; i++) {
      const row    = parseCsvLine(lines[i]);
      const status = row[sC]?.trim().toUpperCase();
      if (status !== "CICO" && status !== "CNS") continue;

      const channel = row[cC]?.trim();
      const ota     = lookupOta(channel);
      if (!ota) continue;

      const dateStr = row[dC]?.trim();
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) continue;
      if (d.getFullYear() !== cmYear || d.getMonth() !== cmMonth) continue;

      const rns     = Math.round(parseFloat((row[rC] ?? "").replace(/,/g, "")) || 0);
      const propKey = row[pC]?.trim() || `row_${i}`;

      const mapKey = `${propKey}|${ota}`;
      propOtaRns.set(mapKey, (propOtaRns.get(mapKey) ?? 0) + rns);
    }

    // ── 3. Total live per OTA from Listing Tracker sub-status ────────────
    const { trackerCols, trackerRows } = await getListingData();
    const otaTotalLive: Record<string, number> = {};
    for (const [ota, colName] of Object.entries(OTA_SUB_STATUS_COL)) {
      const idx = trackerCols.findIndex(
        (c) => c.trim().toLowerCase() === colName.toLowerCase()
      );
      otaTotalLive[ota] = idx !== -1
        ? trackerRows.filter((r) => r[idx]?.trim().toLowerCase() === "live").length
        : 0;
    }

    // ── 4. Bucket per OTA ─────────────────────────────────────────────────
    const otaBuckets: Record<string, OtaBuckets> = {};

    for (const ota of RNS_OTAS) {
      let lt10 = 0, lt30 = 0, lt60 = 0, plus60 = 0, withRns = 0;

      for (const [key, rns] of propOtaRns) {
        if (!key.endsWith(`|${ota}`)) continue;
        withRns++;
        if      (rns < 10)  lt10++;
        else if (rns < 30)  lt30++;
        else if (rns < 60)  lt60++;
        else                plus60++;
      }

      const totalLive = otaTotalLive[ota] ?? 0;
      otaBuckets[ota] = {
        zero:      Math.max(0, totalLive - withRns),
        lt10, lt30, lt60, plus60,
        totalLive,
      };
    }

    const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return Response.json({
      month:        `${MN[cmMonth]}-${String(cmYear).slice(-2)}`,
      otas:         otaBuckets,
      propColUsed:  propColName,
    });

  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
