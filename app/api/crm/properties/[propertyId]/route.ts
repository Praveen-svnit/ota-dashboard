import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ propertyId: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { propertyId } = await params;
  const db = getDb();

  const property = db.prepare(`
    SELECT id, name, city, fhStatus, fhLiveDate FROM Property WHERE id = ?
  `).get(propertyId) as { id: string; name: string; city: string; fhStatus: string; fhLiveDate: string } | undefined;

  if (!property) return Response.json({ error: "Not found" }, { status: 404 });

  // Auto-create OtaListing for GMB if GmbTracker has data and no listing exists yet
  const gmb = db.prepare(`
    SELECT gmbStatus, gmbSubStatus, listingType, number, reviewLinkTracker,
           gmbRating, gmbReviewCount, prePost, syncedAt
    FROM GmbTracker WHERE propertyId = ?
  `).get(propertyId) as {
    gmbStatus: string; gmbSubStatus: string; listingType: string; number: string;
    reviewLinkTracker: string; gmbRating: string; gmbReviewCount: string;
    prePost: string; syncedAt: string;
  } | undefined;

  if (gmb) {
    const existingGmb = db.prepare(
      "SELECT id FROM OtaListing WHERE propertyId = ? AND ota = 'GMB'"
    ).get(propertyId);

    if (!existingGmb) {
      db.prepare(`
        INSERT INTO OtaListing (propertyId, ota, status, subStatus, syncedAt)
        VALUES (?, 'GMB', ?, ?, ?)
      `).run(propertyId, gmb.gmbStatus ?? null, gmb.gmbSubStatus ?? null, gmb.syncedAt);

      // Seed GMB-specific metrics
      const now = new Date().toISOString();
      const seeds: Array<{ key: string; value: string | null }> = [
        { key: "listing_type",       value: gmb.listingType },
        { key: "review_link_status", value: gmb.reviewLinkTracker },
        { key: "gmb_rating",         value: gmb.gmbRating },
        { key: "gmb_review_count",   value: gmb.gmbReviewCount },
      ];
      for (const { key, value } of seeds) {
        if (value) {
          db.prepare(`
            INSERT OR IGNORE INTO OtaMetrics (propertyId, ota, metricKey, metricValue, updatedAt)
            VALUES (?, 'GMB', ?, ?, ?)
          `).run(propertyId, key, value, now);
        }
      }
    }
  }

  const listings = db.prepare(`
    SELECT ol.id, ol.ota, ol.status, ol.subStatus, ol.liveDate, ol.tat, ol.tatError,
           ol.otaId, ol.assignedTo, ol.crmNote, ol.crmUpdatedAt, ol.prePost, ol.listingLink,
           u.name AS assignedName
    FROM OtaListing ol
    LEFT JOIN Users u ON u.id = ol.assignedTo
    WHERE ol.propertyId = ?
    ORDER BY ol.ota ASC
  `).all(propertyId) as Array<{
    id: number; ota: string; status: string; subStatus: string; liveDate: string;
    tat: number; tatError: number; otaId: string; assignedTo: string;
    crmNote: string; crmUpdatedAt: string; assignedName: string; prePost: string; listingLink: string;
  }>;

  const logs = db.prepare(`
    SELECT pl.id, pl.otaListingId, pl.action, pl.field, pl.oldValue, pl.newValue,
           pl.note, pl.createdAt,
           u.name AS userName, u.role AS userRole
    FROM PropertyLog pl
    LEFT JOIN Users u ON u.id = pl.userId
    WHERE pl.propertyId = ?
    ORDER BY pl.createdAt DESC
    LIMIT 100
  `).all(propertyId) as Array<{
    id: number; otaListingId: number; action: string; field: string;
    oldValue: string; newValue: string; note: string; createdAt: string;
    userName: string; userRole: string;
  }>;

  return Response.json({ property, listings, logs });
}
