import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();

    const total = (db.prepare("SELECT COUNT(*) as n FROM GmbTracker").get() as { n: number }).n;
    if (total === 0) return Response.json({ empty: true, rows: [], stats: {} });

    const rows = db.prepare(`
      SELECT propertyId, propertyName, city, createdAt, fhStatus, prePost,
             gmbStatus, gmbSubStatus, listingType, number, reviewLinkTracker,
             gmbRating, gmbReviewCount
      FROM GmbTracker
      ORDER BY CAST(propertyId AS INTEGER) ASC
    `).all() as Array<{
      propertyId: string; propertyName: string; city: string; createdAt: string;
      fhStatus: string; prePost: string; gmbStatus: string; gmbSubStatus: string;
      listingType: string; number: string; reviewLinkTracker: string;
      gmbRating: string; gmbReviewCount: string;
    }>;

    // Summary stats
    const stats = {
      total,
      gmbLive:    rows.filter((r) => r.gmbStatus?.toLowerCase() === "live").length,
      gmbNotLive: rows.filter((r) => r.gmbStatus?.toLowerCase() !== "live").length,
      fhLive:     rows.filter((r) => r.fhStatus?.toLowerCase()  === "live").length,
      preset:     rows.filter((r) => r.prePost?.toLowerCase()   === "preset").length,
      postset:    rows.filter((r) => r.prePost?.toLowerCase()   === "postset").length,
      avgRating:  (() => {
        const vals = rows.map((r) => parseFloat(r.gmbRating)).filter((v) => !isNaN(v));
        return vals.length ? +(vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : null;
      })(),
    };

    return Response.json({ rows, stats });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
