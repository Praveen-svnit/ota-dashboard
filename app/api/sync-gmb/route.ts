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

    // Map header names to indices (case-insensitive)
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
    const stmt = db.prepare(`
      INSERT INTO GmbTracker
        (propertyId, propertyName, city, createdAt, fhStatus, prePost,
         gmbStatus, gmbSubStatus, listingType, number, reviewLinkTracker,
         gmbRating, gmbReviewCount, syncedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(propertyId) DO UPDATE SET
        propertyName      = excluded.propertyName,
        city              = excluded.city,
        createdAt         = excluded.createdAt,
        fhStatus          = excluded.fhStatus,
        prePost           = excluded.prePost,
        gmbStatus         = excluded.gmbStatus,
        gmbSubStatus      = excluded.gmbSubStatus,
        listingType       = excluded.listingType,
        number            = excluded.number,
        reviewLinkTracker = excluded.reviewLinkTracker,
        gmbRating         = excluded.gmbRating,
        gmbReviewCount    = excluded.gmbReviewCount,
        syncedAt          = excluded.syncedAt
    `);

    const syncedAt = new Date().toISOString();
    const upsert   = db.transaction((rows: string[][]) => {
      let count = 0;
      for (const row of rows) {
        const pid = row[iId]?.trim();
        if (!pid) continue;
        stmt.run(
          pid,
          row[iName]     ?? null,
          row[iCity]     ?? null,
          row[iCreated]  ?? null,
          row[iStatus]   ?? null,
          row[iPrePost]  ?? null,
          row[iGmbSt]    ?? null,
          row[iGmbSub]   ?? null,
          row[iListType] ?? null,
          row[iNumber]   ?? null,
          row[iReview]   ?? null,
          row[iRating]   ?? null,
          row[iCount]    ?? null,
          syncedAt,
        );
        count++;
      }
      return count;
    });

    const count = upsert(rows);
    return Response.json({ ok: true, synced: count, log: `✓ GMB Tracker synced — ${count} rows upserted.` });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
