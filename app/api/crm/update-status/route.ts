import { getSql } from "@/lib/db";
import { getSession } from "@/lib/auth";

const FIELD_TO_COL: Record<string, string> = {
  status:      "status",
  subStatus:   "sub_status",
  note:        "crm_note",
  assignedTo:  "assigned_to",
  liveDate:    "live_date",
  otaId:       "ota_id",
  prePost:     "pre_post",
  listingLink: "listing_link",
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { otaListingId, propertyId, field, value, note } = await req.json();

  if (!otaListingId || !propertyId || !field) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!FIELD_TO_COL[field]) {
    return Response.json({ error: "Invalid field" }, { status: 400 });
  }

  const sql = await getSql();
  const now = new Date().toISOString();

  // Fetch all relevant columns so we can extract oldValue in JS
  const listingRows = await sql`
    SELECT crm_note, status, sub_status, assigned_to, live_date, ota_id, pre_post, listing_link, ota
    FROM ota_listing
    WHERE id = ${otaListingId} AND property_id = ${propertyId}
  ` as Array<{
    crm_note: string; status: string; sub_status: string; assigned_to: string;
    live_date: string; ota_id: string; pre_post: string; listing_link: string; ota: string;
  }>;

  const listing = listingRows[0];
  if (!listing) return Response.json({ error: "Listing not found" }, { status: 404 });

  // Map field name to the postgres column value for oldValue extraction
  const colToValue: Record<string, string> = {
    status:      listing.status,
    sub_status:  listing.sub_status,
    crm_note:    listing.crm_note,
    assigned_to: listing.assigned_to,
    live_date:   listing.live_date,
    ota_id:      listing.ota_id,
    pre_post:    listing.pre_post,
    listing_link: listing.listing_link,
  };
  const col = FIELD_TO_COL[field];
  const oldValue = colToValue[col] ?? null;

  // Role guard: interns can only update their OTA
  if (session.role === "intern" && session.ota && listing.ota !== session.ota) {
    return Response.json({ error: "Permission denied" }, { status: 403 });
  }

  // Update the field — switch on field to keep template literals static per column
  if (field === "note") {
    await sql`UPDATE ota_listing SET crm_note = ${value}, crm_updated_at = ${now}, updated_by = ${session.id} WHERE id = ${otaListingId}`;
  } else if (field === "status") {
    await sql`UPDATE ota_listing SET status = ${value}, crm_updated_at = ${now}, updated_by = ${session.id} WHERE id = ${otaListingId}`;
  } else if (field === "subStatus") {
    await sql`UPDATE ota_listing SET sub_status = ${value}, crm_updated_at = ${now}, updated_by = ${session.id} WHERE id = ${otaListingId}`;
  } else if (field === "assignedTo") {
    await sql`UPDATE ota_listing SET assigned_to = ${value}, crm_updated_at = ${now}, updated_by = ${session.id} WHERE id = ${otaListingId}`;
  } else if (field === "liveDate") {
    await sql`UPDATE ota_listing SET live_date = ${value}, crm_updated_at = ${now}, updated_by = ${session.id} WHERE id = ${otaListingId}`;
  } else if (field === "otaId") {
    await sql`UPDATE ota_listing SET ota_id = ${value}, crm_updated_at = ${now}, updated_by = ${session.id} WHERE id = ${otaListingId}`;
  } else if (field === "prePost") {
    await sql`UPDATE ota_listing SET pre_post = ${value}, crm_updated_at = ${now}, updated_by = ${session.id} WHERE id = ${otaListingId}`;
  } else if (field === "listingLink") {
    await sql`UPDATE ota_listing SET listing_link = ${value}, crm_updated_at = ${now}, updated_by = ${session.id} WHERE id = ${otaListingId}`;
  }

  // Write log
  await sql`
    INSERT INTO property_log (property_id, ota_listing_id, user_id, action, field, old_value, new_value, note, created_at)
    VALUES (
      ${propertyId},
      ${otaListingId},
      ${session.id},
      ${field === "note" ? "note_added" : "field_updated"},
      ${field === "note" ? null : field},
      ${field === "note" ? null : oldValue},
      ${field === "note" ? null : value},
      ${field === "note" ? value : (note ?? null)},
      ${now}
    )
  `;

  return Response.json({ ok: true, updatedAt: now });
}
