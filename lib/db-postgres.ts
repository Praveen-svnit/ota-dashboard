import { Pool } from "pg";

let _pool: Pool | null = null;

type SqlFn = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<Record<string, unknown>[]>;
  query(text: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
};

let _sql: SqlFn | null = null;

export function getSql(): SqlFn {
  if (!_sql) {
    const raw = process.env.DATABASE_URL;
    if (!raw) throw new Error("DATABASE_URL not set");

    _pool = new Pool({
      connectionString: raw,
      ssl: false,
      max: 10,
      idleTimeoutMillis: 30000,
      options: '-c search_path=public',
    });

    const sql = async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.reduce((acc, str, i) =>
        acc + str + (i < values.length ? `$${i + 1}` : ""), "");
      const res = await _pool!.query(text, values);
      return res.rows as Record<string, unknown>[];
    };

    sql.query = async (text: string, params: unknown[] = []) => {
      const res = await _pool!.query(text, params);
      return res.rows as Record<string, unknown>[];
    };

    _sql = sql;
  }
  return _sql;
}

export async function initPostgresSchema() {
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS inventory (
      id              SERIAL PRIMARY KEY,
      property_id     TEXT NOT NULL UNIQUE,
      property_name   TEXT NOT NULL,
      city            TEXT,
      fh_live_date    DATE,
      fh_status       TEXT,
      pre_post_set    TEXT,
      onboarding_type TEXT,
      master_id       TEXT,
      synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_inv_city      ON inventory(city)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_inv_fh_status ON inventory(fh_status)`;

  await sql`
    CREATE TABLE IF NOT EXISTS stay_rns (
      id                      SERIAL PRIMARY KEY,
      property_id             BIGINT,
      initial_property_id     BIGINT,
      booking_id              VARCHAR(64),
      created_at              DATE,
      checkin                 DATE,
      checkout                DATE,
      guest_status_desc       VARCHAR(128),
      booking_source_desc     VARCHAR(128),
      ota_booking_source_desc VARCHAR(128),
      ota_booking_source      INT,
      rns                     INT             NOT NULL DEFAULT 0,
      rev                     NUMERIC(18,4)   NOT NULL DEFAULT 0,
      zone                    TEXT,
      synced_at               TIMESTAMPTZ     NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_stay_checkin  ON stay_rns(checkin)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_stay_ota      ON stay_rns(ota_booking_source_desc)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_stay_property ON stay_rns(property_id)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_stay_booking_id ON stay_rns(booking_id) WHERE booking_id IS NOT NULL`;

  await sql`
    CREATE TABLE IF NOT EXISTS sold_rns (
      id                      SERIAL PRIMARY KEY,
      property_id             BIGINT,
      initial_property_id     BIGINT,
      booking_id              VARCHAR(64),
      created_at              DATE,
      checkin                 DATE,
      checkout                DATE,
      guest_status_desc       VARCHAR(128),
      booking_source_desc     VARCHAR(128),
      ota_booking_source_desc VARCHAR(128),
      ota_booking_source      INT,
      rns                     INT             NOT NULL DEFAULT 0,
      rev                     NUMERIC(18,4)   NOT NULL DEFAULT 0,
      zone                    TEXT,
      synced_at               TIMESTAMPTZ     NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_sold_checkin  ON sold_rns(checkin)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sold_ota      ON sold_rns(ota_booking_source_desc)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sold_property ON sold_rns(property_id)`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_sold_booking_id ON sold_rns(booking_id) WHERE booking_id IS NOT NULL`;

  // ── Users ──────────────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name          TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'intern',
      ota           TEXT,
      team_lead     TEXT,
      active        INTEGER NOT NULL DEFAULT 1,
      email         TEXT,
      phone         TEXT,
      emp_id        TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  // Seed admin if empty
  const rows = await sql`SELECT COUNT(*) AS n FROM users`;
  if (Number(rows[0].n) === 0) {
    await sql`
      INSERT INTO users (id, username, password_hash, name, role, created_at)
      VALUES ('user_admin_1', 'Admin', '$2b$10$AHZlj64k3tp37a3JEX0HQ.cAcrhCCJnjRsnbfzfgFRJp0mawvzvey', 'Admin', 'admin', NOW())
    `;
  }

  // ── OTA Listing ────────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS ota_listing (
      id              SERIAL PRIMARY KEY,
      property_id     TEXT NOT NULL,
      ota             TEXT NOT NULL,
      status          TEXT,
      sub_status      TEXT,
      live_date       DATE,
      ota_id          TEXT,
      tat             INTEGER NOT NULL DEFAULT 0,
      tat_error       INTEGER NOT NULL DEFAULT 0,
      assigned_to     TEXT,
      updated_by      TEXT,
      crm_note        TEXT,
      crm_updated_at  TIMESTAMPTZ,
      pre_post        TEXT,
      listing_link    TEXT,
      synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (property_id, ota)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_ota_listing_ota        ON ota_listing(ota)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_ota_listing_sub_status ON ota_listing(sub_status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_ota_listing_prop       ON ota_listing(property_id)`;

  // ── OTA Metrics ────────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS ota_metrics (
      id           SERIAL PRIMARY KEY,
      property_id  TEXT NOT NULL,
      ota          TEXT NOT NULL,
      metric_key   TEXT NOT NULL,
      metric_value TEXT,
      updated_by   TEXT,
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (property_id, ota, metric_key)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_ota_metrics_prop ON ota_metrics(property_id, ota)`;

  // ── Property Log ───────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS property_log (
      id              SERIAL PRIMARY KEY,
      property_id     TEXT NOT NULL,
      ota_listing_id  INTEGER,
      user_id         TEXT NOT NULL,
      action          TEXT NOT NULL,
      field           TEXT,
      old_value       TEXT,
      new_value       TEXT,
      note            TEXT,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_property_log_prop      ON property_log(property_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_property_log_user      ON property_log(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_property_log_created   ON property_log(created_at)`;

  // ── Tasks ──────────────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS tasks (
      id                  SERIAL PRIMARY KEY,
      property_id         TEXT NOT NULL,
      task_type           TEXT NOT NULL DEFAULT 'property',
      title               TEXT NOT NULL,
      description         TEXT,
      status              TEXT NOT NULL DEFAULT 'open',
      priority            TEXT NOT NULL DEFAULT 'medium',
      assigned_to         TEXT,
      assigned_name       TEXT,
      assigned_role       TEXT,
      assigned_team_lead  TEXT,
      created_by          TEXT,
      due_date            DATE,
      follow_up_at        TIMESTAMPTZ,
      task_date           DATE NOT NULL DEFAULT CURRENT_DATE,
      source_route        TEXT,
      source_label        TEXT,
      source_anchor       TEXT,
      source_page         TEXT,
      source_section      TEXT,
      related_ota         TEXT,
      related_city        TEXT,
      completion_comment  TEXT,
      completed_at        TIMESTAMPTZ,
      bucket              TEXT,
      ai_summary          TEXT,
      ai_insight          TEXT,
      tags                TEXT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_prop      ON tasks(property_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_status    ON tasks(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_task_date ON tasks(task_date)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_tasks_assigned  ON tasks(assigned_name)`;

  await sql`
    CREATE TABLE IF NOT EXISTS task_comments (
      id            SERIAL PRIMARY KEY,
      task_id       INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      comment       TEXT NOT NULL,
      comment_type  TEXT NOT NULL DEFAULT 'update',
      created_by    TEXT,
      created_by_name TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id)`;

  await sql`
    CREATE TABLE IF NOT EXISTS task_notifications (
      id                SERIAL PRIMARY KEY,
      task_id           INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
      type              TEXT NOT NULL,
      title             TEXT NOT NULL,
      message           TEXT NOT NULL,
      recipient_user_id TEXT,
      recipient_name    TEXT,
      status            TEXT NOT NULL DEFAULT 'unread',
      metadata          TEXT,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at           TIMESTAMPTZ
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_notif_status    ON task_notifications(status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_notif_recipient ON task_notifications(recipient_user_id)`;

  // ── Genius / Hygiene ───────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS genius_data (
      id            SERIAL PRIMARY KEY,
      prop_id       TEXT,
      bdc_id        TEXT NOT NULL,
      prop_name     TEXT,
      city          TEXT,
      fh_status     TEXT,
      bdc_status    TEXT,
      genius_status TEXT,
      last_checked  TEXT,
      remark        TEXT,
      synced_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_genius_bdc_id ON genius_data(bdc_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_genius_status ON genius_data(genius_status)`;

  await sql`
    CREATE TABLE IF NOT EXISTS hygiene_data (
      id              SERIAL PRIMARY KEY,
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
      synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_hygiene_bdc_id ON hygiene_data(bdc_id)`;

  // ── GMB Tracker ────────────────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS gmb_tracker (
      id                  SERIAL PRIMARY KEY,
      property_id         TEXT NOT NULL,
      property_name       TEXT,
      city                TEXT,
      created_at          TEXT,
      fh_status           TEXT,
      pre_post            TEXT,
      gmb_status          TEXT,
      gmb_sub_status      TEXT,
      listing_type        TEXT,
      number              TEXT,
      review_link_tracker TEXT,
      gmb_rating          TEXT,
      gmb_review_count    TEXT,
      synced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (property_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_gmb_property_id ON gmb_tracker(property_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_gmb_status      ON gmb_tracker(gmb_status)`;
}
