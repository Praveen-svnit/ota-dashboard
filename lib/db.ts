import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.OTA_DB_PATH ?? path.join(process.cwd(), "ota.db");

// Ensure the directory exists (needed for Railway volume mounts)
const DB_DIR = path.dirname(DB_PATH);
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

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
  try { db.exec("ALTER TABLE Users ADD COLUMN email TEXT"); } catch {}
  try { db.exec("ALTER TABLE Users ADD COLUMN phone TEXT"); } catch {}
  try { db.exec("ALTER TABLE Users ADD COLUMN empId TEXT"); } catch {}

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

  // Tasks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS Tasks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      propertyId  TEXT NOT NULL,
      taskType    TEXT NOT NULL DEFAULT 'property',
      title       TEXT NOT NULL,
      description TEXT,
      status      TEXT NOT NULL DEFAULT 'open',
      priority    TEXT NOT NULL DEFAULT 'medium',
      assignedTo  TEXT,
      assignedName TEXT,
      assignedRole TEXT,
      assignedTeamLead TEXT,
      createdBy   TEXT,
      dueDate     TEXT,
      followUpAt  TEXT,
      taskDate    TEXT NOT NULL DEFAULT (date('now','localtime')),
      sourceRoute TEXT,
      sourceLabel TEXT,
      sourceAnchor TEXT,
      sourcePage  TEXT,
      sourceSection TEXT,
      relatedOta  TEXT,
      relatedCity TEXT,
      completionComment TEXT,
      completedAt TEXT,
      bucket      TEXT,
      aiSummary   TEXT,
      aiInsight   TEXT,
      tags        TEXT,
      createdAt   TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt   TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_propertyId ON Tasks(propertyId);
    CREATE INDEX IF NOT EXISTS idx_tasks_status     ON Tasks(status);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS TaskComments (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      taskId         INTEGER NOT NULL,
      comment        TEXT NOT NULL,
      commentType    TEXT NOT NULL DEFAULT 'update',
      createdBy      TEXT,
      createdByName  TEXT,
      createdAt      TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (taskId) REFERENCES Tasks(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_task_comments_taskId ON TaskComments(taskId);
    CREATE INDEX IF NOT EXISTS idx_task_comments_createdAt ON TaskComments(createdAt);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS TaskNotifications (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      taskId           INTEGER,
      type             TEXT NOT NULL,
      title            TEXT NOT NULL,
      message          TEXT NOT NULL,
      recipientUserId  TEXT,
      recipientName    TEXT,
      status           TEXT NOT NULL DEFAULT 'unread',
      metadata         TEXT,
      createdAt        TEXT NOT NULL DEFAULT (datetime('now')),
      readAt           TEXT,
      FOREIGN KEY (taskId) REFERENCES Tasks(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_task_notifications_status ON TaskNotifications(status);
    CREATE INDEX IF NOT EXISTS idx_task_notifications_recipientUserId ON TaskNotifications(recipientUserId);
    CREATE INDEX IF NOT EXISTS idx_task_notifications_recipientName ON TaskNotifications(recipientName);
  `);

  try { db.exec("ALTER TABLE Tasks ADD COLUMN taskType TEXT NOT NULL DEFAULT 'property'"); } catch {}
  try { db.exec("ALTER TABLE Tasks ADD COLUMN assignedName TEXT"); } catch {}
  try { db.exec("ALTER TABLE Tasks ADD COLUMN assignedRole TEXT"); } catch {}
  try { db.exec("ALTER TABLE Tasks ADD COLUMN assignedTeamLead TEXT"); } catch {}
  try { db.exec("ALTER TABLE Tasks ADD COLUMN followUpAt TEXT"); } catch {}
  try { db.exec("ALTER TABLE Tasks ADD COLUMN taskDate TEXT"); } catch {}
  try { db.exec("ALTER TABLE Tasks ADD COLUMN sourceRoute TEXT"); } catch {}
  try { db.exec("ALTER TABLE Tasks ADD COLUMN sourceLabel TEXT"); } catch {}
  try { db.exec("ALTER TABLE Tasks ADD COLUMN sourceAnchor TEXT"); } catch {}
  try { db.exec("ALTER TABLE Tasks ADD COLUMN sourcePage TEXT"); } catch {}
  try { db.exec("ALTER TABLE Tasks ADD COLUMN sourceSection TEXT"); } catch {}
  try { db.exec("ALTER TABLE Tasks ADD COLUMN relatedOta TEXT"); } catch {}
  try { db.exec("ALTER TABLE Tasks ADD COLUMN relatedCity TEXT"); } catch {}
  try { db.exec("ALTER TABLE Tasks ADD COLUMN completionComment TEXT"); } catch {}
  try { db.exec("ALTER TABLE Tasks ADD COLUMN completedAt TEXT"); } catch {}
  try { db.exec("ALTER TABLE Tasks ADD COLUMN bucket TEXT"); } catch {}
  try { db.exec("ALTER TABLE Tasks ADD COLUMN aiSummary TEXT"); } catch {}
  try { db.exec("ALTER TABLE Tasks ADD COLUMN aiInsight TEXT"); } catch {}
  try { db.exec("ALTER TABLE Tasks ADD COLUMN tags TEXT"); } catch {}
  try { db.exec("UPDATE Tasks SET taskDate = COALESCE(taskDate, substr(createdAt, 1, 10), date('now','localtime'))"); } catch {}
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_taskDate ON Tasks(taskDate);
    CREATE INDEX IF NOT EXISTS idx_tasks_sourceRoute ON Tasks(sourceRoute);
    CREATE INDEX IF NOT EXISTS idx_tasks_sourceAnchor ON Tasks(sourceAnchor);
    CREATE INDEX IF NOT EXISTS idx_tasks_relatedOta ON Tasks(relatedOta);
    CREATE INDEX IF NOT EXISTS idx_tasks_assignedName ON Tasks(assignedName);
  `);

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
