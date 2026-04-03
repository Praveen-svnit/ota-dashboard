import { getSql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get("propertyId");
  const ota        = searchParams.get("ota");
  if (!propertyId || !ota) return Response.json({ error: "propertyId and ota required" }, { status: 400 });

  const sql  = await getSql();
  const rows = await sql`
    SELECT metric_key AS "metricKey", metric_value AS "metricValue", updated_by AS "updatedBy", updated_at AS "updatedAt"
    FROM ota_metrics
    WHERE property_id = ${propertyId} AND ota = ${ota}
  ` as Array<{ metricKey: string; metricValue: string; updatedBy: string; updatedAt: string }>;

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

  const sql = await getSql();
  const now = new Date().toISOString();

  // Get old value for logging
  const existingRows = await sql`
    SELECT metric_value AS "metricValue"
    FROM ota_metrics
    WHERE property_id = ${propertyId} AND ota = ${ota} AND metric_key = ${metricKey}
  ` as Array<{ metricValue: string }>;
  const existing = existingRows[0];

  await sql`
    INSERT INTO ota_metrics (property_id, ota, metric_key, metric_value, updated_by, updated_at)
    VALUES (${propertyId}, ${ota}, ${metricKey}, ${metricValue ?? null}, ${session.id}, ${now})
    ON CONFLICT (property_id, ota, metric_key) DO UPDATE SET
      metric_value = excluded.metric_value,
      updated_by   = excluded.updated_by,
      updated_at   = excluded.updated_at
  `;

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
  const valueRows = await sql`
    SELECT metric_value AS "metricValue"
    FROM ota_metrics
    WHERE property_id = ${propertyId} AND ota = ${ota} AND metric_key = ${valueKey}
  ` as Array<{ metricValue: string }>;
  const valueRow = valueRows[0];

  // Check at least one companion date exists (any key starting with valueKey + "_")
  const dateRows = await sql`
    SELECT metric_value AS "metricValue"
    FROM ota_metrics
    WHERE property_id = ${propertyId} AND ota = ${ota}
      AND metric_key LIKE ${valueKey + "_%"}
      AND metric_value IS NOT NULL AND metric_value != ''
  ` as Array<{ metricValue: string }>;

  const bothPresent = !!(valueRow?.metricValue) && dateRows.length > 0;

  if (bothPresent) {
    const listingRows = await sql`
      SELECT id FROM ota_listing WHERE property_id = ${propertyId} AND ota = ${ota}
    ` as Array<{ id: number }>;
    const listing = listingRows[0];

    await sql`
      INSERT INTO property_log (property_id, ota_listing_id, user_id, action, field, old_value, new_value, note, created_at)
      VALUES (${propertyId}, ${listing?.id ?? null}, ${session.id}, 'metric_updated', ${valueKey}, ${existing?.metricValue ?? null}, ${metricValue ?? null}, NULL, ${now})
    `;
  }

  return Response.json({ ok: true });
}
