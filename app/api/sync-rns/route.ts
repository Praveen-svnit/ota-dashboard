import { getSql } from "@/lib/db-postgres";
import { parseCSV } from "@/lib/sheets";
import { RNS_RAW_SHEET_ID, RNS_RAW_TAB } from "@/lib/constants";
import { getSession } from "@/lib/auth";

// Column index ranges within the sheet
// Sold RNS: cols A–F → indices 0–5
// Stay RNS: cols H–N → indices 7–13 (G is separator)
const SOLD_COLS = { start: 0, end: 5 };   // A B C D E F
const STAY_COLS = { start: 7, end: 13 };  // H I J K L M N

// Header → DB field mapping (case-insensitive)
const COL_MAP: Record<string, string> = {
  "date":                "date",
  "stay date":           "date",
  "sold date":           "date",
  "booking date":        "date",
  "channel":             "channel",
  "ota":                 "channel",
  "rns":                 "rns",
  "room nights":         "rns",
  "room nights sold":    "rns",
  "revenue":             "revenue",
  "rev":                 "revenue",
  "initial property id": "initial_prop_id",
  "initial prop id":     "initial_prop_id",
  "initial id":          "initial_prop_id",
  "final property id":   "final_prop_id",
  "final prop id":       "final_prop_id",
  "final id":            "final_prop_id",
  "property id":         "final_prop_id",
  "status":              "status",
  "guest status":        "status",
  "booking status":      "status",
};

function normalize(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, " ").trim().replace(/\s+/g, " ");
}

function parseDate(raw: string): string | null {
  if (!raw) return null;
  const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return null;
}

interface RnsRow { date: string; channel: string; rns: number; revenue: number; initId: string; finalId: string; status: string | null; }

function extractSection(
  headerRow: string[],
  dataRows: string[][],
  colStart: number,
  colEnd: number,
  label: string,
): RnsRow[] {
  // Map absolute column indices to DB fields using the header row
  const fieldMap: Record<number, string> = {};
  for (let i = colStart; i <= colEnd; i++) {
    const h = headerRow[i] ?? "";
    const key = normalize(h);
    if (COL_MAP[key]) fieldMap[i] = COL_MAP[key];
  }

  const fields = Object.values(fieldMap);
  if (!fields.includes("date"))
    throw new Error(`${label}: no 'date' header found in cols ${colStart}–${colEnd}. Found: ${headerRow.slice(colStart, colEnd + 1).join(", ")}`);
  if (!fields.includes("channel"))
    throw new Error(`${label}: no 'channel' header found in cols ${colStart}–${colEnd}. Found: ${headerRow.slice(colStart, colEnd + 1).join(", ")}`);

  const result: RnsRow[] = [];
  for (const row of dataRows) {
    const rec: Record<string, string | null> = {
      date: null, channel: null, rns: null, revenue: null,
      initial_prop_id: null, final_prop_id: null, status: null,
    };
    for (const [i, field] of Object.entries(fieldMap)) {
      rec[field] = row[Number(i)]?.trim() || null;
    }
    const date = parseDate(rec.date ?? "");
    if (!date || !rec.channel) continue;
    result.push({
      date,
      channel: rec.channel,
      rns:     parseInt(rec.rns ?? "0") || 0,
      revenue: parseFloat(rec.revenue ?? "0") || 0,
      initId:  rec.initial_prop_id ?? "",
      finalId: rec.final_prop_id ?? "",
      status:  rec.status ?? null,
    });
  }
  return result;
}

export async function POST() {
  const session = await getSession();
  if (session && session.role !== "admin" && session.role !== "head") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const url = `https://docs.google.com/spreadsheets/d/${RNS_RAW_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(RNS_RAW_TAB)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch ${RNS_RAW_TAB}: ${res.status}`);
    const csv = await res.text();

    const { cols: row1, rows: allRows } = parseCSV(csv);

    // Row 1 has merged section titles (SOLD / STAY); actual column headers are in row 2
    // Detect which row is the real header row: find the first row that contains a date-like field
    const COL_HEADER_KEYS = new Set(Object.keys(COL_MAP));
    let headerRow: string[] = row1;
    let dataRows: string[][] = allRows;
    if (allRows.length > 0) {
      const firstDataRow = allRows[0];
      const hasHeaders = firstDataRow.some((h) => COL_HEADER_KEYS.has(normalize(h)));
      if (hasHeaders) {
        headerRow = firstDataRow;
        dataRows  = allRows.slice(1);
      }
    }

    const soldRows = extractSection(headerRow, dataRows, SOLD_COLS.start, SOLD_COLS.end, "Sold RNS (A–F)");
    const stayRows = extractSection(headerRow, dataRows, STAY_COLS.start, STAY_COLS.end, "Stay RNS (H–N)");

    const sql = getSql();

    // Delete last 7 days from both tables, then re-insert fresh data
    await sql`DELETE FROM sold_rns WHERE date >= NOW()::DATE - INTERVAL '7 days'`;
    await sql`DELETE FROM stay_rns WHERE date >= NOW()::DATE - INTERVAL '7 days'`;

    let soldCount = 0;
    for (const r of soldRows) {
      await sql`
        INSERT INTO sold_rns (date, channel, rns, revenue, initial_prop_id, final_prop_id, synced_at)
        VALUES (${r.date}::date, ${r.channel}, ${r.rns}, ${r.revenue}, ${r.initId}, ${r.finalId}, NOW())
        ON CONFLICT (date, channel, initial_prop_id, final_prop_id) DO UPDATE SET
          rns = EXCLUDED.rns, revenue = EXCLUDED.revenue, synced_at = NOW()
      `;
      soldCount++;
    }

    let stayCount = 0;
    for (const r of stayRows) {
      await sql`
        INSERT INTO stay_rns (date, channel, rns, revenue, initial_prop_id, final_prop_id, status, synced_at)
        VALUES (${r.date}::date, ${r.channel}, ${r.rns}, ${r.revenue}, ${r.initId}, ${r.finalId}, ${r.status}, NOW())
        ON CONFLICT (date, channel, initial_prop_id, final_prop_id) DO UPDATE SET
          rns = EXCLUDED.rns, revenue = EXCLUDED.revenue, status = EXCLUDED.status, synced_at = NOW()
      `;
      stayCount++;
    }

    return Response.json({
      ok: true,
      sold: { upserted: soldCount, message: `Synced ${soldCount} sold RNS rows` },
      stay: { upserted: stayCount, message: `Synced ${stayCount} stay RNS rows` },
    });

  } catch (err) {
    console.error("sync-rns error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
