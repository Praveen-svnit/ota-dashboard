import { getSql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(_req: Request, { params }: { params: Promise<{ propertyId: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { propertyId } = await params;
  const sql = getSql();

  // Fetch property from inventory
  const propRows = await sql`
    SELECT
      property_id   AS id,
      property_name AS name,
      city,
      fh_status     AS "fhStatus",
      fh_live_date  AS "fhLiveDate"
    FROM inventory
    WHERE property_id = ${propertyId}
  ` as { id: string; name: string; city: string; fhStatus: string; fhLiveDate: string }[];

  if (propRows.length === 0) return Response.json({ error: "Not found" }, { status: 404 });
  const property = propRows[0];

  // Fetch listings and logs in parallel
  const [listings, logs] = await Promise.all([
    sql`
      SELECT
        ol.id,
        ol.ota,
        ol.status,
        ol.sub_status      AS "subStatus",
        ol.live_date       AS "liveDate",
        ol.tat,
        ol.tat_error       AS "tatError",
        ol.ota_id          AS "otaId",
        ol.assigned_to     AS "assignedTo",
        ol.crm_note        AS "crmNote",
        ol.crm_updated_at  AS "crmUpdatedAt",
        ol.pre_post        AS "prePost",
        ol.listing_link    AS "listingLink",
        u.name             AS "assignedName"
      FROM ota_listing ol
      LEFT JOIN users u ON u.id = ol.assigned_to
      WHERE ol.property_id = ${propertyId}
      ORDER BY ol.ota ASC
    `,

    sql`
      SELECT
        pl.id,
        pl.ota_listing_id  AS "otaListingId",
        pl.action,
        pl.field,
        pl.old_value       AS "oldValue",
        pl.new_value       AS "newValue",
        pl.note,
        pl.created_at      AS "createdAt",
        u.name             AS "userName",
        u.role             AS "userRole"
      FROM property_log pl
      LEFT JOIN users u ON u.id = pl.user_id
      WHERE pl.property_id = ${propertyId}
      ORDER BY pl.created_at DESC
      LIMIT 100
    `,
  ]);

  return Response.json({ property, listings, logs });
}
