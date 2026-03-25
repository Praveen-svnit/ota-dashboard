import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { otaListingId, propertyId, field, value, note } = await req.json();

  if (!otaListingId || !propertyId || !field) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  const db  = getDb();
  const now = new Date().toISOString();

  // Get current value (note field maps to crmNote column)
  const selectCol = field === "note" ? "crmNote" : field;
  const listing = db.prepare(
    `SELECT ${selectCol} AS fieldVal, ota FROM OtaListing WHERE id = ? AND propertyId = ?`
  ).get(otaListingId, propertyId) as { fieldVal: string; ota: string } | undefined;

  if (!listing) return Response.json({ error: "Listing not found" }, { status: 404 });

  const oldValue = listing.fieldVal ?? null;

  // Role guard: interns can only update their OTA
  if (session.role === "intern" && session.ota && listing.ota !== session.ota) {
    return Response.json({ error: "Permission denied" }, { status: 403 });
  }

  // Update the field
  if (field === "note") {
    db.prepare(`UPDATE OtaListing SET crmNote = ?, crmUpdatedAt = ?, updatedBy = ? WHERE id = ?`)
      .run(value, now, session.id, otaListingId);
  } else {
    db.prepare(`UPDATE OtaListing SET ${field} = ?, crmUpdatedAt = ?, updatedBy = ? WHERE id = ?`)
      .run(value, now, session.id, otaListingId);
  }

  // Write log
  db.prepare(`
    INSERT INTO PropertyLog (propertyId, otaListingId, userId, action, field, oldValue, newValue, note, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    propertyId,
    otaListingId,
    session.id,
    field === "note" ? "note_added" : "field_updated",
    field === "note" ? null : field,
    field === "note" ? null : oldValue,
    field === "note" ? null : value,
    field === "note" ? value : (note ?? null),
    now,
  );

  return Response.json({ ok: true, updatedAt: now });
}
