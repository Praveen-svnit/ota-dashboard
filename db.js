'use strict';

const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

const DB_PATH = path.join(__dirname, 'ota.db');

let _db = null;

function getDb() {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  initSchema(_db);
  return _db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS Property (
      id         TEXT PRIMARY KEY,
      name       TEXT NOT NULL,
      city       TEXT,
      fhLiveDate TEXT,
      fhStatus   TEXT,
      syncedAt   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS OtaListing (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      propertyId TEXT NOT NULL,
      ota        TEXT NOT NULL,
      otaId      TEXT,
      status     TEXT,
      subStatus  TEXT,
      liveDate   TEXT,
      fhLiveDate TEXT,
      tat        INTEGER NOT NULL DEFAULT 0,
      tatError   INTEGER NOT NULL DEFAULT 0,
      syncedAt   TEXT NOT NULL,
      FOREIGN KEY (propertyId) REFERENCES Property(id),
      UNIQUE (propertyId, ota)
    );

    CREATE INDEX IF NOT EXISTS idx_ota_propertyId ON OtaListing(propertyId);
    CREATE INDEX IF NOT EXISTS idx_ota_ota        ON OtaListing(ota);
    CREATE INDEX IF NOT EXISTS idx_ota_subStatus  ON OtaListing(subStatus);

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
  `);

  // Migrations for existing DBs
  try { db.exec("ALTER TABLE OtaListing ADD COLUMN tat      INTEGER NOT NULL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE OtaListing ADD COLUMN tatError INTEGER NOT NULL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE OtaListing ADD COLUMN fhLiveDate TEXT"); } catch {}
  try { db.exec("ALTER TABLE Property ADD COLUMN bdc_id TEXT"); } catch {}
  try { db.exec("ALTER TABLE Property ADD COLUMN genius_status TEXT"); } catch {}
  try { db.exec("ALTER TABLE Property ADD COLUMN genius_last_checked TEXT"); } catch {}

  // RnsStay / RnsSold — safe to re-run on existing connections
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
    CREATE INDEX IF NOT EXISTS idx_genius_status ON GeniusData(genius_status);
    CREATE INDEX IF NOT EXISTS idx_genius_bdc_id ON GeniusData(bdc_id);
    CREATE INDEX IF NOT EXISTS idx_genius_synced  ON GeniusData(syncedAt);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS HygieneData (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      prop_id               TEXT,
      bdc_id                TEXT NOT NULL,
      prop_name             TEXT,
      city                  TEXT,
      scrap_status          TEXT,
      review_score          TEXT,
      review_count          TEXT,
      genius_eligibility    TEXT,
      genius_status         TEXT,
      genius_level          TEXT,
      preferred_status      TEXT,
      preferred_eligibility TEXT,
      perf_score            TEXT,
      top_promotion         TEXT,
      commission_pct        TEXT,
      search_result_views   TEXT,
      views                 TEXT,
      conversion_pct        TEXT,
      page_score            TEXT,
      last_checked          TEXT,
      syncedAt              TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_hygiene_bdc_id ON HygieneData(bdc_id);
    CREATE INDEX IF NOT EXISTS idx_hygiene_synced  ON HygieneData(syncedAt);
  `);

  // ── Migrations for existing DBs ──────────────────────────────────────────

  // GeniusData: drop UNIQUE on bdc_id for append-only history tracking
  const hasGeniusUniq = db.prepare(
    "SELECT count(*) as c FROM sqlite_master WHERE type='index' AND name='idx_genius_bdc_id' AND sql LIKE '%UNIQUE%'"
  ).get().c;
  if (hasGeniusUniq) {
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

  // OtaListing: drop UNIQUE(propertyId, ota) to allow append-only status history.
  // Detect old schema by checking if the unique index exists.
  const hasOtaUniq = db.prepare(
    "SELECT count(*) as c FROM sqlite_master WHERE type='index' AND name='sqlite_autoindex_OtaListing_1'"
  ).get().c;
  const otaTableSql = db.prepare(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='OtaListing'"
  ).get()?.sql ?? '';
  if (hasOtaUniq || otaTableSql.includes('UNIQUE (propertyId, ota)')) {
    db.exec(`
      ALTER TABLE OtaListing RENAME TO OtaListing_old;
      CREATE TABLE OtaListing (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        propertyId TEXT NOT NULL,
        ota        TEXT NOT NULL,
        otaId      TEXT,
        status     TEXT,
        subStatus  TEXT,
        liveDate   TEXT,
        fhLiveDate TEXT,
        tat        INTEGER NOT NULL DEFAULT 0,
        tatError   INTEGER NOT NULL DEFAULT 0,
        syncedAt   TEXT NOT NULL,
        FOREIGN KEY (propertyId) REFERENCES Property(id)
      );
      INSERT INTO OtaListing SELECT * FROM OtaListing_old;
      DROP TABLE OtaListing_old;
      CREATE INDEX IF NOT EXISTS idx_ota_propertyId ON OtaListing(propertyId);
      CREATE INDEX IF NOT EXISTS idx_ota_ota        ON OtaListing(ota);
      CREATE INDEX IF NOT EXISTS idx_ota_subStatus  ON OtaListing(subStatus);
    `);
  }

  // HygieneData: add new columns to existing tables that were created with old schema
  const hygieneNewCols = [
    ['scrap_status',          'TEXT'],
    ['genius_eligibility',    'TEXT'],
    ['genius_status',         'TEXT'],
    ['preferred_status',      'TEXT'],
    ['preferred_eligibility', 'TEXT'],
    ['search_result_views',   'TEXT'],
  ];
  for (const [colName, colType] of hygieneNewCols) {
    try { db.exec(`ALTER TABLE HygieneData ADD COLUMN ${colName} ${colType}`); } catch {}
  }
}

module.exports = { getDb };
