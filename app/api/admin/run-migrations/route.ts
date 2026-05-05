import { getSql } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function POST() {
  const session = await getSession();
  if (!session || !["admin", "head"].includes(session.role)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sql = getSql();
  const results: string[] = [];

  const run = async (label: string, ddl: string) => {
    try {
      await sql.query(ddl, []);
      results.push(`✓ ${label}`);
    } catch (e) {
      results.push(`✗ ${label}: ${(e as Error).message}`);
    }
  };

  // ── ota_listing indexes ──────────────────────────────────────────────────────
  // Functional index for LOWER(sub_status) — used by most listing-dashboard queries
  await run(
    "idx_ol_lower_sub_status",
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ol_lower_sub_status ON ota_listing(LOWER(sub_status))`
  );
  // Functional index for LOWER(status)
  await run(
    "idx_ol_lower_status",
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ol_lower_status ON ota_listing(LOWER(status))`
  );
  // Composite: most common filter pattern is OTA + sub_status
  await run(
    "idx_ol_ota_prop",
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ol_ota_prop ON ota_listing(ota, property_id)`
  );
  // live_date index for date range filters and TAT computation
  await run(
    "idx_ol_live_date",
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ol_live_date ON ota_listing(live_date)`
  );
  // Ensure basic scalar indexes exist (no-op if already created)
  await run(
    "idx_ol_ota",
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ota_listing_ota ON ota_listing(ota)`
  );
  await run(
    "idx_ol_sub_status",
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ota_listing_sub_status ON ota_listing(sub_status)`
  );
  await run(
    "idx_ol_property_id",
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ota_listing_prop ON ota_listing(property_id)`
  );

  // ── inventory indexes ────────────────────────────────────────────────────────
  // Composite for the JOIN + fh_status filter used in all listing-dashboard queries
  await run(
    "idx_inv_pid_fhstatus",
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inv_pid_fhstatus ON inventory(property_id, fh_status)`
  );
  await run(
    "idx_inv_fh_live_date",
    `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inv_fh_live_date ON inventory(fh_live_date)`
  );

  // ── crm / ota_listing extra columns ─────────────────────────────────────────
  await run(
    "batch_number column",
    `ALTER TABLE ota_listing ADD COLUMN IF NOT EXISTS batch_number TEXT`
  );

  return Response.json({ ok: true, results });
}
