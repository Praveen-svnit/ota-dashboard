import { readFileSync, statSync, readdirSync } from "fs";
import { resolve, join } from "path";
import { parse } from "csv-parse/sync";
import pkg from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const [,, tableArg, pathArg] = process.argv;
if (!tableArg || !pathArg || !["stay", "sold"].includes(tableArg)) {
  console.error("Usage: node scripts/import-rns.mjs <stay|sold> <file-or-folder>");
  process.exit(1);
}

const TABLE = tableArg === "stay" ? "stay_rns" : "sold_rns";
const pool  = new pkg.Pool({ connectionString: process.env.DATABASE_URL });
const sql   = { query: (q) => pool.query(q) };
const BATCH = 500;

// Resolve list of CSV files
const target = resolve(pathArg);
const files  = statSync(target).isDirectory()
  ? readdirSync(target).filter(f => f.toLowerCase().endsWith(".csv")).map(f => join(target, f))
  : [target];

console.log(`Table  : ${TABLE}`);
console.log(`Files  : ${files.length}`);
files.forEach(f => console.log(`  ${f}`));

const esc = v => (v == null || v === "") ? "NULL" : `'${String(v).replace(/'/g, "''")}'`;
const dt  = v => v ? `${esc(v)}::date` : "NULL";
const num = v => (v !== "" && v != null && !isNaN(Number(v))) ? Number(v) : "NULL";

let totalInserted = 0;

for (const file of files) {
  console.log(`\n→ ${file}`);
  const raw  = readFileSync(file, "utf8");
  const rows = parse(raw, { columns: true, skip_empty_lines: true, trim: true });
  console.log(`  Parsed: ${rows.length} rows`);

  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    // Deduplicate by booking_id within the batch (keep last occurrence)
    const seen = new Map();
    for (const r of rows.slice(i, i + BATCH)) seen.set(r.booking_id || Symbol(), r);
    const batch = [...seen.values()];
    const values = batch.map(r =>
      `(${dt(r.checkin)}, ${esc(r.ota_booking_source_desc)}, ${num(r.rns)}, ${num(r.rev)}, ${num(r.initial_property_id)}, ${num(r.property_id)}, ${esc(r.booking_id)}, ${dt(r.created_at)}, ${dt(r.checkout)}, ${esc(r.guest_status_desc)}, ${esc(r.booking_source_desc)}, ${num(r.ota_booking_source)}, ${esc(r.zone)}, NOW())`
    ).join(",\n");

    await sql.query(`
      INSERT INTO ${TABLE} (
        checkin, ota_booking_source_desc, rns, rev,
        initial_property_id, property_id,
        booking_id, created_at, checkout,
        guest_status_desc, booking_source_desc, ota_booking_source,
        zone, synced_at
      ) VALUES ${values}
      ON CONFLICT (booking_id) WHERE booking_id IS NOT NULL DO UPDATE SET
        checkin                 = EXCLUDED.checkin,
        ota_booking_source_desc = EXCLUDED.ota_booking_source_desc,
        rns                     = EXCLUDED.rns,
        rev                     = EXCLUDED.rev,
        initial_property_id     = EXCLUDED.initial_property_id,
        property_id             = EXCLUDED.property_id,
        created_at              = EXCLUDED.created_at,
        checkout                = EXCLUDED.checkout,
        guest_status_desc       = EXCLUDED.guest_status_desc,
        booking_source_desc     = EXCLUDED.booking_source_desc,
        ota_booking_source      = EXCLUDED.ota_booking_source,
        zone                    = EXCLUDED.zone,
        synced_at               = NOW()
    `);
    inserted += batch.length;
    process.stdout.write(`\r  Progress: ${inserted}/${rows.length}`);
  }
  console.log(`\n  ✓ Done`);
  totalInserted += inserted;
}

console.log(`\nTotal inserted/upserted: ${totalInserted} rows → ${TABLE}`);
await pool.end();
