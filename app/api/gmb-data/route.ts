// GMB is now managed as a regular OTA via ota_listing + ota_metrics.
// This endpoint is kept as a stub to avoid 404s; it will be removed after full migration.

export async function GET() {
  return Response.json({ rows: [], stats: { total: 0, gmbLive: 0, gmbNotLive: 0, fhLive: 0, preset: 0, postset: 0, avgRating: null }, deprecated: true });
}
