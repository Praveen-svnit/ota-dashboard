import { getDb } from "@/lib/db";
import { SHEET_ID } from "@/lib/constants";

const TAB = "BDC Hygiene";

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

    const iId      = idx("prop id");
    const iName    = idx("prop name");
    const iCity    = idx("city");
    const iBdcId   = idx("bdc id");
    const iScore   = idx("review score");
    const iCount   = idx("review count");
    const iPref    = idx("preferred status");
    const iGenius  = idx("genius level");
    const iPerfSc  = idx("performance score");
    const iPromo   = idx("top promotion");
    const iComm    = idx("commission %");
    const iViews   = idx("views");
    const iConv    = idx("conversion %");
    const iPage    = idx("property page score");
    const iDate    = idx("last checked");

    const db = getDb();
    const insert = db.prepare(`
      INSERT INTO HygieneData
        (prop_id, bdc_id, prop_name, city, review_score, review_count, preferred, genius_level, perf_score, top_promotion, commission_pct, views, conversion_pct, page_score, last_checked, syncedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `);
    const getLatest = db.prepare(`
      SELECT review_score, review_count, preferred, genius_level, perf_score, top_promotion, commission_pct, views, conversion_pct, page_score
      FROM HygieneData WHERE bdc_id = ? ORDER BY id DESC LIMIT 1
    `);

    const col = (row: string[], i: number) => (i >= 0 ? (row[i] ?? "").trim() : "");
    const syncedAt = new Date().toISOString();
    let synced = 0;

    db.transaction(() => {
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const bdcId = col(row, iBdcId);
        if (!bdcId || bdcId.toLowerCase() === "nan") continue;

        const reviewScore   = col(row, iScore);
        const reviewCount   = col(row, iCount);
        const preferred     = col(row, iPref);
        const geniusLevel   = col(row, iGenius);
        const perfScore     = col(row, iPerfSc);
        const topPromotion  = col(row, iPromo);
        const commissionPct = col(row, iComm);
        const views         = col(row, iViews);
        const conversionPct = col(row, iConv);
        const pageScore     = col(row, iPage);
        const lastChecked   = col(row, iDate);

        // Only insert if any metric changed (or no prior record)
        const prev = getLatest.get(bdcId) as {
          review_score: string; review_count: string; preferred: string;
          genius_level: string; perf_score: string; top_promotion: string;
          commission_pct: string; views: string; conversion_pct: string; page_score: string;
        } | undefined;

        const changed = !prev
          || prev.review_score   !== reviewScore
          || prev.review_count   !== reviewCount
          || prev.preferred      !== preferred
          || prev.genius_level   !== geniusLevel
          || prev.perf_score     !== perfScore
          || prev.top_promotion  !== topPromotion
          || prev.commission_pct !== commissionPct
          || prev.views          !== views
          || prev.conversion_pct !== conversionPct
          || prev.page_score     !== pageScore;

        if (changed) {
          insert.run(
            col(row, iId), bdcId, col(row, iName), col(row, iCity),
            reviewScore, reviewCount, preferred, geniusLevel, perfScore,
            topPromotion, commissionPct, views, conversionPct, pageScore,
            lastChecked, syncedAt
          );
        }
        synced++;
      }
    })();

    return Response.json({ synced, fetchedAt: syncedAt });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
