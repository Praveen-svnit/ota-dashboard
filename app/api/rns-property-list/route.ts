import { NextRequest } from "next/server";
import { RNS_SHEET_ID } from "@/lib/constants";
import { CHANNEL_TO_OTA } from "@/lib/rns-sheet-parser";

// Raw_data column positions (0-based)
const dC = 7;  // Col H — date
const cC = 8;  // Col I — channel
const sC = 9;  // Col J — status (CICO | CNS)
const rC = 10; // Col K — RNs
const pC = 11; // Col L — property name

const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const otaFilter = searchParams.get("ota") ?? null;

    const now      = new Date();
    const cmYear   = now.getFullYear();
    const cmMonth  = now.getMonth();   // 0-based
    const cmDay    = now.getDate();

    const lmDate   = new Date(cmYear, cmMonth - 1, 1);
    const lmYear   = lmDate.getFullYear();
    const lmMonth  = lmDate.getMonth(); // 0-based

    // Fetch Raw_data sheet
    const url = `https://docs.google.com/spreadsheets/d/${RNS_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("Raw_data")}`;
    const csv = await fetch(url, { cache: "no-store" }).then((r) => {
      if (!r.ok) throw new Error(`Raw_data fetch failed: ${r.status}`);
      return r.text();
    });

    const lines = csv.trim().split("\n");

    // propOtaRns[propertyName][ota] = { cm, lm }
    const propOtaRns = new Map<string, Map<string, { cm: number; lm: number }>>();

    for (let i = 1; i < lines.length; i++) {
      const row    = parseCsvLine(lines[i]);
      const status = row[sC]?.trim().toUpperCase();
      if (status !== "CICO" && status !== "CNS") continue;

      const channel = row[cC]?.trim();
      const ota     = lookupOta(channel);
      if (!ota) continue;

      // If filtering by OTA, skip non-matching
      if (otaFilter && ota !== otaFilter) continue;

      const dateStr = row[dC]?.trim();
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) continue;

      const dYear  = d.getFullYear();
      const dMonth = d.getMonth();
      const dDay   = d.getDate();

      const rns      = Math.round(parseFloat((row[rC] ?? "").replace(/,/g, "")) || 0);
      const propName = row[pC]?.trim() || `row_${i}`;

      const isCm = dYear === cmYear && dMonth === cmMonth;
      // LM up to same day-of-month as today for fair comparison (D-1 equivalent)
      const isLm = dYear === lmYear && dMonth === lmMonth && dDay < cmDay;

      if (!isCm && !isLm) continue;

      if (!propOtaRns.has(propName)) propOtaRns.set(propName, new Map());
      const otaMap = propOtaRns.get(propName)!;
      if (!otaMap.has(ota)) otaMap.set(ota, { cm: 0, lm: 0 });
      const entry = otaMap.get(ota)!;

      if (isCm) entry.cm += rns;
      if (isLm) entry.lm += rns;
    }

    // Build properties array — only include properties that have any data
    const properties: Array<{
      name: string;
      otas: Record<string, { cm: number; lm: number }>;
    }> = [];

    for (const [propName, otaMap] of propOtaRns) {
      const otasObj: Record<string, { cm: number; lm: number }> = {};
      let hasAny = false;

      for (const [ota, vals] of otaMap) {
        if (vals.cm > 0 || vals.lm > 0) {
          otasObj[ota] = vals;
          hasAny = true;
        }
      }

      if (hasAny) {
        properties.push({ name: propName, otas: otasObj });
      }
    }

    return Response.json({
      month:      `${MN[cmMonth]}-${String(cmYear).slice(-2)}`,
      lmMonth:    `${MN[lmMonth]}-${String(lmYear).slice(-2)}`,
      properties,
    });

  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
