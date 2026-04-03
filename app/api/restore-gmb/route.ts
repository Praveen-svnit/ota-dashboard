import { getDb } from "@/lib/db";
import { GMB_SHEET_ID } from "@/lib/constants";
import { parseCSV } from "@/lib/sheets";

export async function POST() {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${GMB_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent("New Tracker")}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status}`);

    const csv = await res.text();
    const { cols, rows } = parseCSV(csv);

    const idx = (name: string) => cols.findIndex((c) => c.toLowerCase() === name.toLowerCase());
    const iId       = idx("property_id");
    const iName     = idx("property_name");
    const iCity     = idx("property_city");
    const iCreated  = idx("created_at");
    const iStatus   = idx("STATUS");
    const iPrePost  = idx("Pre/Post");
    const iGmbSt    = idx("GMB Status");
    const iGmbSub   = idx("GMB Sub Status");
    const iListType = idx("Listing Type");
    const iNumber   = idx("Number");
    const iReview   = idx("Review Link Tracker");
    const iRating   = idx("GMB Reviews");
    const iCount    = idx("GMB Ratings");

    const db   = getDb();
    const now  = new Date().toISOString();

    db.exec("DELETE FROM GmbTracker");

    const upsert = db.prepare(`
      INSERT INTO GmbTracker
        (propertyId, propertyName, city, createdAt, fhStatus, prePost, gmbStatus, gmbSubStatus,
         listingType, number, reviewLinkTracker, gmbRating, gmbReviewCount, syncedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let inserted = 0;
    for (const row of rows) {
      const propId = row[iId]?.trim();
      if (!propId) continue;

      upsert.run(
        propId,
        row[iName]?.trim() || null,
        row[iCity]?.trim() || null,
        row[iCreated]?.trim() || null,
        row[iStatus]?.trim() || null,
        row[iPrePost]?.trim() || null,
        row[iGmbSt]?.trim() || null,
        row[iGmbSub]?.trim() || null,
        row[iListType]?.trim() || null,
        row[iNumber]?.trim() || null,
        row[iReview]?.trim() || null,
        row[iRating]?.trim() || null,
        row[iCount]?.trim() || null,
        now
      );
      inserted++;
    }

    return Response.json({ ok: true, rowsInserted: inserted, syncedAt: now });
  } catch (err: unknown) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
