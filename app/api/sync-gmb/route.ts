// GMB sync is deprecated. GMB is now managed as a regular OTA via ota_listing.
// This endpoint is kept as a stub to avoid 404s; it will be removed after full migration.

export async function POST() {
  return Response.json({ ok: true, synced: 0, log: "GMB sync is deprecated — GMB is now managed via ota_listing.", deprecated: true });
}
