import { getDb } from "@/lib/db";
import { SHEET_ID } from "@/lib/constants";

const TAB = "BDC Genious";

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const cols: string[] = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === "," && !inQ) { cols.push(cur); cur = ""; }
      else cur += ch;
    }
    cols.push(cur);
    rows.push(cols);
  }
  return rows;
}

export async function POST() {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(TAB)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);

    const rows = parseCSV(await res.text());
    if (rows.length < 2) return Response.json({ synced: 0, message: "Sheet empty" });

    const headers = rows[0].map(h => h.trim().toLowerCase());
    const idx = (name: string) => headers.indexOf(name);

    const iId     = idx("prop id");
    const iName   = idx("prop name");
    const iCity   = idx("city");
    const iFhSt   = idx("fh status");
    const iBdcId  = idx("bdc id");
    const iBdcSt  = idx("bdc status");
    const iStatus = idx("genius status");
    const iDate   = idx("last checked");
    const iRemark = idx("remarks");

    const db = getDb();
    // Append-only insert — only when status changed from last recorded value
    const insert = db.prepare(`
      INSERT INTO GeniusData (prop_id, bdc_id, prop_name, city, fh_status, bdc_status, genius_status, last_checked, remark, syncedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `);
    const getLatest = db.prepare(`
      SELECT genius_status FROM GeniusData WHERE bdc_id = ? ORDER BY id DESC LIMIT 1
    `);
    const updateProperty = db.prepare(`
      UPDATE Property
      SET bdc_id              = ?,
          genius_status       = ?,
          genius_last_checked = ?
      WHERE id = ?
    `);

    const col = (row: string[], i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");
    const syncedAt = new Date().toISOString();
    let synced = 0;

    db.transaction(() => {
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const bdcId = col(row, iBdcId);
        if (!bdcId || bdcId.toLowerCase() === "nan") continue;
        const propId       = col(row, iId);
        const geniusStatus = col(row, iStatus);
        const lastChecked  = col(row, iDate);

        // Only insert if status changed (or no prior record)
        const prev = getLatest.get(bdcId) as { genius_status: string } | undefined;
        if (!prev || prev.genius_status !== geniusStatus) {
          insert.run(
            propId, bdcId, col(row, iName), col(row, iCity),
            col(row, iFhSt), col(row, iBdcSt), geniusStatus,
            lastChecked, col(row, iRemark), syncedAt
          );
        }

        // Always keep Property current state up to date
        if (propId) {
          updateProperty.run(bdcId, geniusStatus, lastChecked, propId);
        }
        synced++;
      }
    })();

    return Response.json({ synced, fetchedAt: syncedAt });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
