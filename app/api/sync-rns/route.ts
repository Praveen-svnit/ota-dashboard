import { getDb } from "@/lib/db";
import { RNS_SHEET_ID } from "@/lib/constants";
import { CHANNEL_TO_OTA } from "@/lib/rns-sheet-parser";

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

const CHANNEL_LOOKUP = new Map<string, string | null>(
  Object.entries(CHANNEL_TO_OTA).map(([k, v]) => [k.toLowerCase().trim(), v])
);

function lookupOta(raw: string): string | null | undefined {
  if (raw in CHANNEL_TO_OTA) return CHANNEL_TO_OTA[raw];
  return CHANNEL_LOOKUP.get(raw.toLowerCase().trim());
}

export async function POST() {
  const url = `https://docs.google.com/spreadsheets/d/${RNS_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("Raw_data")}`;

  let csv: string;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);
    csv = await res.text();
  } catch (err: unknown) {
    return Response.json({ error: String(err) }, { status: 502 });
  }

  const rows = csv.trim().split("\n").map(parseCsvLine);
  // Raw_data columns (0-based): H=7 date, I=8 channel, J=9 status, K=10 rns
  const dC = 7, cC = 8, sC = 9, rC = 10;

  const now = new Date().toISOString();
  const db  = getDb();

  const upsert = db.prepare(`
    INSERT INTO RnsStay (stay_date, ota, guest_status, rns, revenue, syncedAt)
    VALUES (?, ?, ?, ?, 0, ?)
    ON CONFLICT (stay_date, ota, guest_status) DO UPDATE
      SET rns = excluded.rns, syncedAt = excluded.syncedAt
  `);

  type Row = { date: string; channel: string; ota: string; rns: number };
  const valid: Row[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row    = rows[i];
    const status = row[sC]?.trim();
    if (!status || status.toUpperCase() !== "CICO") continue;

    const channel = row[cC]?.trim();
    if (!channel) continue;

    const ota = lookupOta(channel);
    if (!ota) continue;

    const dateStr = row[dC]?.trim();
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) continue;
    const date = d.toISOString().split("T")[0];

    const rns = Math.round(parseFloat((row[rC] ?? "").replace(/,/g, "")) || 0);
    // Use canonical channel casing from CHANNEL_TO_OTA keys
    const canonicalChannel = Object.keys(CHANNEL_TO_OTA).find(
      (k) => k.toLowerCase().trim() === channel.toLowerCase().trim()
    ) ?? channel;

    valid.push({ date, channel: canonicalChannel, ota, rns });
  }

  const insertMany = db.transaction((rns: Row[]) => {
    for (const r of rns) upsert.run(r.date, r.ota, r.channel, r.rns, now);
    return rns.length;
  });

  const count = insertMany(valid);
  return Response.json({ ok: true, rows: count, syncedAt: now });
}
