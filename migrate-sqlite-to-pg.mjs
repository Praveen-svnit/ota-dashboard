/**
 * One-time migration: SQLite (ota.db) → Neon PostgreSQL
 * Uses batched inserts (200 rows per query) to avoid rate limits.
 * Run: node migrate-sqlite-to-pg.mjs
 */
import Database from "better-sqlite3";
import { neon } from "@neondatabase/serverless";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, ".env.local") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error("DATABASE_URL not set"); process.exit(1); }

const sqliteDb = new Database(join(__dirname, "ota.db"), { readonly: true });
const sql = neon(DATABASE_URL);

const BATCH = 200;

function escVal(v) {
  if (v === null || v === undefined) return "NULL";
  const s = String(v).replace(/'/g, "''");
  return `'${s}'`;
}

/** Run batched inserts using sql.unsafe() — one INSERT per 200 rows */
async function batchInsert(tableName, colNames, rows, getVals) {
  let done = 0, skip = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const valClauses = batch.map(r => {
      try { return `(${getVals(r).map(escVal).join(", ")})`; }
      catch { skip++; return null; }
    }).filter(Boolean);

    if (!valClauses.length) continue;

    const query = `
      INSERT INTO ${tableName} (${colNames.join(", ")})
      VALUES ${valClauses.join(",\n")}
      ON CONFLICT DO NOTHING
    `;
    try {
      await sql.query(query, []);
      done += valClauses.length;
      process.stdout.write(`\r   ${done}/${rows.length}  `);
    } catch (e) {
      // Try row-by-row for this batch if batch fails
      for (const clause of valClauses) {
        try {
          await sql.query(`INSERT INTO ${tableName} (${colNames.join(", ")}) VALUES ${clause} ON CONFLICT DO NOTHING`, []);
          done++;
        } catch { skip++; }
      }
      process.stdout.write(`\r   ${done}/${rows.length}  `);
    }
  }
  console.log(`\r   ✓ ${done} inserted, ${skip} skipped           `);
}

// ── 1. inventory ──────────────────────────────────────────────────────────────
console.log("\n1. Property → inventory …");
{
  const rows = sqliteDb.prepare(`
    SELECT id, name, city, fhLiveDate, fhStatus
    FROM Property
    WHERE id IS NOT NULL AND name IS NOT NULL AND TRIM(name) != ''
  `).all();
  console.log(`   ${rows.length} rows`);
  await batchInsert(
    "inventory",
    ["property_id", "property_name", "city", "fh_live_date", "fh_status", "synced_at"],
    rows,
    r => [String(r.id), r.name, r.city || null, r.fhLiveDate || null, r.fhStatus || null, new Date().toISOString()]
  );
}

// ── 2. ota_listing ────────────────────────────────────────────────────────────
console.log("2. OtaListing → ota_listing …");
{
  const rows = sqliteDb.prepare(`
    SELECT propertyId, ota, status, subStatus, liveDate, otaId, tat, tatError,
           assignedTo, crmNote, crmUpdatedAt, prePost, listingLink
    FROM OtaListing
    WHERE propertyId IS NOT NULL AND ota IS NOT NULL
  `).all();
  console.log(`   ${rows.length} rows`);
  await batchInsert(
    "ota_listing",
    ["property_id","ota","status","sub_status","live_date","ota_id","tat","tat_error",
     "assigned_to","crm_note","crm_updated_at","pre_post","listing_link","synced_at"],
    rows,
    r => [
      String(r.propertyId), r.ota,
      r.status    || null, r.subStatus || null, r.liveDate  || null,
      r.otaId     || null,
      r.tat       || 0,    r.tatError  || 0,
      r.assignedTo   || null, r.crmNote      || null,
      r.crmUpdatedAt || null, r.prePost      || null,
      r.listingLink  || null, new Date().toISOString()
    ]
  );
}

// ── 3. stay_rns ───────────────────────────────────────────────────────────────
console.log("3. RnsStay → stay_rns …");
{
  const rows = sqliteDb.prepare(`SELECT stay_date, ota, guest_status, rns, revenue FROM RnsStay WHERE stay_date IS NOT NULL AND ota IS NOT NULL`).all();
  console.log(`   ${rows.length} rows`);
  // Use guest_status as initial_prop_id so CICO/CNS rows don't conflict
  await batchInsert(
    "stay_rns",
    ["date","channel","rns","revenue","initial_prop_id","final_prop_id","status","synced_at"],
    rows,
    r => [r.stay_date, r.ota, r.rns || 0, r.revenue || 0, r.guest_status || "", "", r.guest_status || null, new Date().toISOString()]
  );
}

// ── 4. sold_rns ───────────────────────────────────────────────────────────────
console.log("4. RnsSold → sold_rns …");
{
  const rows = sqliteDb.prepare(`SELECT sold_date, ota, rns, revenue FROM RnsSold WHERE sold_date IS NOT NULL AND ota IS NOT NULL`).all();
  console.log(`   ${rows.length} rows`);
  await batchInsert(
    "sold_rns",
    ["date","channel","rns","revenue","initial_prop_id","final_prop_id","synced_at"],
    rows,
    r => [r.sold_date, r.ota, r.rns || 0, r.revenue || 0, "", "", new Date().toISOString()]
  );
}

// ── 5. users ──────────────────────────────────────────────────────────────────
console.log("5. Users → users …");
{
  const rows = sqliteDb.prepare(`
    SELECT id, username, passwordHash, name, role, ota, teamLead, active, createdAt, email, phone, empId
    FROM Users
  `).all();
  console.log(`   ${rows.length} rows`);
  await batchInsert(
    "users",
    ["id","username","password_hash","name","role","ota","team_lead","active","email","phone","emp_id","created_at"],
    rows,
    r => [
      String(r.id), r.username, r.passwordHash, r.name,
      r.role      || "intern",
      r.ota       || null,
      r.teamLead  || null,
      r.active    ?? 1,
      r.email     || null,
      r.phone     || null,
      r.empId     || null,
      r.createdAt || new Date().toISOString()
    ]
  );
}

// ── 6. genius_data ────────────────────────────────────────────────────────────
console.log("6. GeniusData → genius_data …");
{
  await sql.query("TRUNCATE genius_data RESTART IDENTITY", []);
  const rows = sqliteDb.prepare(`SELECT prop_id, bdc_id, prop_name, city, fh_status, bdc_status, genius_status, last_checked, remark FROM GeniusData`).all();
  console.log(`   ${rows.length} rows`);
  await batchInsert(
    "genius_data",
    ["prop_id","bdc_id","prop_name","city","fh_status","bdc_status","genius_status","last_checked","remark","synced_at"],
    rows,
    r => [r.prop_id || null, r.bdc_id || "", r.prop_name || null, r.city || null, r.fh_status || null, r.bdc_status || null, r.genius_status || null, r.last_checked || null, r.remark || null, new Date().toISOString()]
  );
}

// ── 7. hygiene_data ───────────────────────────────────────────────────────────
console.log("7. HygieneData → hygiene_data …");
{
  await sql.query("TRUNCATE hygiene_data RESTART IDENTITY", []);
  const rows = sqliteDb.prepare(`
    SELECT prop_id, bdc_id, prop_name, city, review_score, review_count, preferred,
           genius_level, perf_score, top_promotion, commission_pct, views, conversion_pct,
           page_score, last_checked
    FROM HygieneData
  `).all();
  console.log(`   ${rows.length} rows`);
  await batchInsert(
    "hygiene_data",
    ["prop_id","bdc_id","prop_name","city","review_score","review_count","preferred",
     "genius_level","perf_score","top_promotion","commission_pct","views","conversion_pct",
     "page_score","last_checked","synced_at"],
    rows,
    r => [
      r.prop_id || null, r.bdc_id || "", r.prop_name || null, r.city || null,
      r.review_score || null, r.review_count || null, r.preferred || null,
      r.genius_level || null, r.perf_score || null, r.top_promotion || null,
      r.commission_pct || null, r.views || null, r.conversion_pct || null,
      r.page_score || null, r.last_checked || null, new Date().toISOString()
    ]
  );
}

// ── 8. gmb_tracker ────────────────────────────────────────────────────────────
console.log("8. GmbTracker → gmb_tracker …");
{
  await sql.query("TRUNCATE gmb_tracker RESTART IDENTITY", []);
  const rows = sqliteDb.prepare(`
    SELECT propertyId, propertyName, city, createdAt, fhStatus, prePost,
           gmbStatus, gmbSubStatus, listingType, number, reviewLinkTracker,
           gmbRating, gmbReviewCount
    FROM GmbTracker
    WHERE propertyId IS NOT NULL
  `).all();
  console.log(`   ${rows.length} rows`);
  await batchInsert(
    "gmb_tracker",
    ["property_id","property_name","city","created_at","fh_status","pre_post",
     "gmb_status","gmb_sub_status","listing_type","number","review_link_tracker",
     "gmb_rating","gmb_review_count","synced_at"],
    rows,
    r => [
      String(r.propertyId), r.propertyName || null, r.city || null,
      r.createdAt || null, r.fhStatus || null, r.prePost || null,
      r.gmbStatus || null, r.gmbSubStatus || null, r.listingType || null,
      r.number || null, r.reviewLinkTracker || null,
      r.gmbRating || null, r.gmbReviewCount || null, new Date().toISOString()
    ]
  );
}

console.log("\n✅ Migration complete!");
sqliteDb.close();
