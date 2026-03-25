import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("propertyId");
  const ota        = searchParams.get("ota");
  if (!propertyId || !ota) return Response.json({ error: "propertyId and ota required" }, { status: 400 });

  const db   = getDb();
  const rows = db.prepare(
    "SELECT metricKey, metricValue, updatedBy, updatedAt FROM OtaMetrics WHERE propertyId = ? AND ota = ?"
  ).all(propertyId, ota) as Array<{ metricKey: string; metricValue: string; updatedBy: string; updatedAt: string }>;

  const metrics: Record<string, string> = {};
  for (const r of rows) metrics[r.metricKey] = r.metricValue ?? "";

  return Response.json({ metrics });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { propertyId, ota, metricKey, metricValue, valueKey: explicitValueKey } = await req.json();
  if (!propertyId || !ota || !metricKey) {
    return Response.json({ error: "propertyId, ota, metricKey required" }, { status: 400 });
  }

  const db  = getDb();
  const now = new Date().toISOString();

  // Get old value for logging
  const existing = db.prepare(
    "SELECT metricValue FROM OtaMetrics WHERE propertyId = ? AND ota = ? AND metricKey = ?"
  ).get(propertyId, ota, metricKey) as { metricValue: string } | undefined;

  db.prepare(`
    INSERT INTO OtaMetrics (propertyId, ota, metricKey, metricValue, updatedBy, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(propertyId, ota, metricKey) DO UPDATE SET
      metricValue = excluded.metricValue,
      updatedBy   = excluded.updatedBy,
      updatedAt   = excluded.updatedAt
  `).run(propertyId, ota, metricKey, metricValue ?? null, session.id, now);

  // Only log when the metric VALUE and ALL its companion dates are present.
  // Use explicitValueKey if provided (handles custom date keys like ai_paused_date).
  const isDateKey = metricKey.endsWith("_date");
  const valueKey  = explicitValueKey ?? (isDateKey ? null : metricKey);

  // Only write the log when saving the VALUE key (not a date key)
  if (isDateKey && !explicitValueKey) {
    return Response.json({ ok: true }); // date-only save, no log
  }

  if (!valueKey) return Response.json({ ok: true }); // safety guard

  // Check value is present
  const valueRow = db.prepare(
    "SELECT metricValue FROM OtaMetrics WHERE propertyId = ? AND ota = ? AND metricKey = ?"
  ).get(propertyId, ota, valueKey) as { metricValue: string } | undefined;

  // Check at least one companion date exists (any key starting with valueKey + "_")
  const dateRows = db.prepare(
    "SELECT metricValue FROM OtaMetrics WHERE propertyId = ? AND ota = ? AND metricKey LIKE ? AND metricValue IS NOT NULL AND metricValue != ''"
  ).all(propertyId, ota, valueKey + "_%") as Array<{ metricValue: string }>;

  const bothPresent = !!(valueRow?.metricValue) && dateRows.length > 0;

  if (bothPresent) {
    const listing = db.prepare(
      "SELECT id FROM OtaListing WHERE propertyId = ? AND ota = ?"
    ).get(propertyId, ota) as { id: number } | undefined;

    db.prepare(`
      INSERT INTO PropertyLog (propertyId, otaListingId, userId, action, field, oldValue, newValue, note, createdAt)
      VALUES (?, ?, ?, 'metric_updated', ?, ?, ?, NULL, ?)
    `).run(
      propertyId,
      listing?.id ?? null,
      session.id,
      valueKey,
      existing?.metricValue ?? null,
      metricValue ?? null,
      now,
    );
  }

  return Response.json({ ok: true });
}
