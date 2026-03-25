import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.OTA_DB_PATH ?? path.join(process.cwd(), "ota.db");

const globalForDb = globalThis as unknown as { _db?: Database.Database };

export function getDb(): Database.Database {
  if (!globalForDb._db) {
    globalForDb._db = new Database(DB_PATH);
    globalForDb._db.pragma("journal_mode = WAL");
    globalForDb._db.pragma("foreign_keys = ON");
    initSchema(globalForDb._db);
  }
  return globalForDb._db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS Property (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      city        TEXT,
      fhLiveDate  TEXT,
      fhStatus    TEXT,
      syncedAt    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS OtaListing (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      propertyId  TEXT NOT NULL,
      ota         TEXT NOT NULL,
      status      TEXT,
      subStatus   TEXT,
      liveDate    TEXT,
      otaId       TEXT,
      tat         INTEGER NOT NULL DEFAULT 0,
      tatError    INTEGER NOT NULL DEFAULT 0,
      syncedAt    TEXT NOT NULL,
      FOREIGN KEY (propertyId) REFERENCES Property(id),
      UNIQUE (propertyId, ota)
    );

    CREATE INDEX IF NOT EXISTS idx_ota_listing_ota        ON OtaListing(ota);
    CREATE INDEX IF NOT EXISTS idx_ota_listing_subStatus  ON OtaListing(subStatus);
    CREATE INDEX IF NOT EXISTS idx_ota_listing_propertyId ON OtaListing(propertyId);
    CREATE INDEX IF NOT EXISTS idx_ota_listing_liveDate   ON OtaListing(ota, liveDate);
    CREATE INDEX IF NOT EXISTS idx_ota_listing_status     ON OtaListing(status);
  `);

  // Migrations for existing DBs
  try { db.exec("ALTER TABLE OtaListing ADD COLUMN tat INTEGER NOT NULL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE OtaListing ADD COLUMN tatError INTEGER NOT NULL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE OtaListing ADD COLUMN fhLiveDate TEXT"); } catch {}
  try { db.exec("ALTER TABLE Property ADD COLUMN bdc_id TEXT"); } catch {}
  try { db.exec("ALTER TABLE Property ADD COLUMN genius_status TEXT"); } catch {}
  try { db.exec("ALTER TABLE Property ADD COLUMN genius_last_checked TEXT"); } catch {}

  // RnsStay / RnsSold — created by ota-inv-db sync scripts; ensure they exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS RnsStay (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      stay_date    TEXT NOT NULL,
      ota          TEXT NOT NULL,
      guest_status TEXT,
      rns          INTEGER NOT NULL DEFAULT 0,
      revenue      REAL    NOT NULL DEFAULT 0,
      syncedAt     TEXT NOT NULL,
      UNIQUE (stay_date, ota, guest_status)
    );
    CREATE INDEX IF NOT EXISTS idx_rns_stay_date ON RnsStay(stay_date);
    CREATE INDEX IF NOT EXISTS idx_rns_stay_ota  ON RnsStay(ota);
    CREATE TABLE IF NOT EXISTS RnsSold (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      sold_date TEXT NOT NULL,
      ota       TEXT NOT NULL,
      rns       INTEGER NOT NULL DEFAULT 0,
      revenue   REAL    NOT NULL DEFAULT 0,
      syncedAt  TEXT NOT NULL,
      UNIQUE (sold_date, ota)
    );
    CREATE INDEX IF NOT EXISTS idx_rns_sold_date ON RnsSold(sold_date);
    CREATE INDEX IF NOT EXISTS idx_rns_sold_ota  ON RnsSold(ota);

    CREATE TABLE IF NOT EXISTS GeniusData (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      prop_id       TEXT,
      bdc_id        TEXT NOT NULL UNIQUE,
      prop_name     TEXT,
      city          TEXT,
      fh_status     TEXT,
      bdc_status    TEXT,
      genius_status TEXT,
      last_checked  TEXT,
      remark        TEXT,
      syncedAt      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_genius_status ON GeniusData(genius_status);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS HygieneData (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      prop_id         TEXT,
      bdc_id          TEXT NOT NULL,
      prop_name       TEXT,
      city            TEXT,
      review_score    TEXT,
      review_count    TEXT,
      preferred       TEXT,
      genius_level    TEXT,
      perf_score      TEXT,
      top_promotion   TEXT,
      commission_pct  TEXT,
      views           TEXT,
      conversion_pct  TEXT,
      page_score      TEXT,
      last_checked    TEXT,
      syncedAt        TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_hygiene_bdc_id ON HygieneData(bdc_id);
    CREATE INDEX IF NOT EXISTS idx_hygiene_synced  ON HygieneData(syncedAt);

    CREATE TABLE IF NOT EXISTS GmbTracker (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      propertyId        TEXT NOT NULL UNIQUE,
      propertyName      TEXT,
      city              TEXT,
      createdAt         TEXT,
      fhStatus          TEXT,
      prePost           TEXT,
      gmbStatus         TEXT,
      gmbSubStatus      TEXT,
      listingType       TEXT,
      number            TEXT,
      reviewLinkTracker TEXT,
      gmbRating         TEXT,
      gmbReviewCount    TEXT,
      syncedAt          TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_gmb_status     ON GmbTracker(gmbStatus);
    CREATE INDEX IF NOT EXISTS idx_gmb_fhStatus   ON GmbTracker(fhStatus);
  `);

  // ── Phase 3: Auth + CRM ──────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS Users (
      id          TEXT PRIMARY KEY,
      username    TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      name        TEXT NOT NULL,
      role        TEXT NOT NULL DEFAULT 'intern',
      ota         TEXT,
      teamLead    TEXT,
      active      INTEGER NOT NULL DEFAULT 1,
      createdAt   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS PropertyLog (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      propertyId  TEXT NOT NULL,
      otaListingId INTEGER,
      userId      TEXT NOT NULL,
      action      TEXT NOT NULL,
      field       TEXT,
      oldValue    TEXT,
      newValue    TEXT,
      note        TEXT,
      createdAt   TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_property_log_propertyId ON PropertyLog(propertyId);
    CREATE INDEX IF NOT EXISTS idx_property_log_userId     ON PropertyLog(userId);
    CREATE INDEX IF NOT EXISTS idx_property_log_createdAt  ON PropertyLog(createdAt);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS OtaMetrics (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      propertyId  TEXT NOT NULL,
      ota         TEXT NOT NULL,
      metricKey   TEXT NOT NULL,
      metricValue TEXT,
      updatedBy   TEXT,
      updatedAt   TEXT NOT NULL,
      UNIQUE(propertyId, ota, metricKey)
    );
    CREATE INDEX IF NOT EXISTS idx_ota_metrics_prop ON OtaMetrics(propertyId, ota);
  `);

  // Migrate OtaListing for CRM fields
  try { db.exec("ALTER TABLE OtaListing ADD COLUMN assignedTo TEXT"); } catch {}
  try { db.exec("ALTER TABLE OtaListing ADD COLUMN updatedBy TEXT"); } catch {}
  try { db.exec("ALTER TABLE OtaListing ADD COLUMN crmNote TEXT"); } catch {}
  try { db.exec("ALTER TABLE OtaListing ADD COLUMN crmUpdatedAt TEXT"); } catch {}
  try { db.exec("ALTER TABLE OtaListing ADD COLUMN prePost TEXT"); } catch {}
  try { db.exec("ALTER TABLE OtaListing ADD COLUMN listingLink TEXT"); } catch {}

  // Seed default admin if no users exist
  const userCount = (db.prepare("SELECT COUNT(*) as n FROM Users").get() as { n: number }).n;
  if (userCount === 0) {
    // bcryptjs hash of "admin123"  — generated offline, salt rounds=10
    const adminHash = "$2b$10$/xPJxWaZgPZ0SKyRLUSQ/OhQbKmp.7BltjTR4i3D7y0Hy4VwapTky"; // "admin123"
    db.prepare(`INSERT INTO Users (id,username,passwordHash,name,role,createdAt) VALUES (?,?,?,?,?,?)`)
      .run("user_admin_1", "admin", adminHash, "Admin", "admin", new Date().toISOString());
  }

  // Migrate GeniusData to append-only (drop UNIQUE on bdc_id for history tracking)
  // If the UNIQUE index exists → recreate table without it
  const hasUniq = (db.prepare(
    "SELECT count(*) as c FROM sqlite_master WHERE type='index' AND name='idx_genius_bdc_id' AND sql LIKE '%UNIQUE%'"
  ).get() as { c: number }).c;
  if (hasUniq) {
    db.exec(`
      ALTER TABLE GeniusData RENAME TO GeniusData_old;
      CREATE TABLE GeniusData (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        prop_id       TEXT,
        bdc_id        TEXT NOT NULL,
        prop_name     TEXT,
        city          TEXT,
        fh_status     TEXT,
        bdc_status    TEXT,
        genius_status TEXT,
        last_checked  TEXT,
        remark        TEXT,
        syncedAt      TEXT NOT NULL
      );
      INSERT INTO GeniusData SELECT * FROM GeniusData_old;
      DROP TABLE GeniusData_old;
      CREATE INDEX IF NOT EXISTS idx_genius_status ON GeniusData(genius_status);
      CREATE INDEX IF NOT EXISTS idx_genius_bdc_id ON GeniusData(bdc_id);
      CREATE INDEX IF NOT EXISTS idx_genius_synced  ON GeniusData(syncedAt);
    `);
  }
}
