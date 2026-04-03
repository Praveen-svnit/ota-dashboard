import { getSql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";

export type MasterCombo = {
  subStatus: string;
  statuses: string[];
  sortOrder: number;
};

// Canonical default combos — seeded once when the master table is empty
const DEFAULT_MASTER: { subStatus: string; statuses: string[] }[] = [
  { subStatus: "Live",                statuses: ["Live"] },
  { subStatus: "Not Live",            statuses: ["Not Live"] },
  { subStatus: "Shell Created",       statuses: ["Shell Created"] },
  { subStatus: "Ready to Go Live",    statuses: ["Ready to Go Live"] },
  { subStatus: "Content in Progress", statuses: ["Content in Progress"] },
  { subStatus: "Listing in Progress", statuses: ["Listing in Progress"] },
  { subStatus: "Content Pending",     statuses: ["Content in Progress", "Shell Created"] },
  { subStatus: "Images Pending",      statuses: ["Content in Progress", "Shell Created"] },
  { subStatus: "Approval Pending",    statuses: ["Ready to Go Live"] },
  { subStatus: "OTA Verification",    statuses: ["Listing in Progress"] },
  { subStatus: "Under Review",        statuses: ["Listing in Progress"] },
  { subStatus: "Suspended",           statuses: ["Not Live"] },
  { subStatus: "Duplicate",           statuses: ["Not Live"] },
  { subStatus: "Pending",             statuses: ["Pending"] },
  { subStatus: "Soldout",             statuses: ["Soldout"] },
  { subStatus: "Closed",              statuses: ["Closed"] },
  // Agoda-specific
  { subStatus: "Revenue",             statuses: ["Listing Claimed by Owner"] },
  { subStatus: "Churned",             statuses: ["Delisted"] },
  { subStatus: "Exception",           statuses: ["Not to List on OTA"] },
  { subStatus: "Rev+",                statuses: ["Only FH"] },
  { subStatus: "Pending at OTA",      statuses: ["Ready to go Live", "Yet to be Shared"] },
  { subStatus: "Pending at Agoda",    statuses: ["Listing Under Process"] },
  { subStatus: "Supply/Operations",   statuses: ["Listing Claimed by Owner"] },
];

async function ensureMasterTable(sql: ReturnType<typeof getSql>) {
  await sql.query(`
    CREATE TABLE IF NOT EXISTS status_config_master (
      sub_status  TEXT PRIMARY KEY,
      statuses    JSONB NOT NULL DEFAULT '[]',
      sort_order  INTEGER DEFAULT 0,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      created_by  TEXT
    )
  `, []);

  // Seed once if empty
  const rows = await sql.query(`SELECT COUNT(*) AS n FROM status_config_master`, []) as { n: string }[];
  if (Number(rows[0].n) === 0) {
    for (let i = 0; i < DEFAULT_MASTER.length; i++) {
      const { subStatus, statuses } = DEFAULT_MASTER[i];
      await sql.query(
        `INSERT INTO status_config_master (sub_status, statuses, sort_order)
         VALUES ($1, $2::jsonb, $3) ON CONFLICT DO NOTHING`,
        [subStatus, JSON.stringify(statuses), i]
      );
    }
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getSql();
  await ensureMasterTable(sql);

  const rows = await sql.query(
    `SELECT sub_status AS "subStatus", statuses, sort_order AS "sortOrder"
     FROM status_config_master
     ORDER BY sort_order, sub_status`,
    []
  ) as MasterCombo[];

  return Response.json({ combos: rows });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "head"))
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const { subStatus, statuses, sortOrder } = await req.json() as {
    subStatus: string; statuses: string[]; sortOrder?: number;
  };

  if (!subStatus?.trim() || !Array.isArray(statuses))
    return Response.json({ error: "Invalid payload" }, { status: 400 });

  const sql = getSql();
  await ensureMasterTable(sql);

  if (typeof sortOrder === "number") {
    await sql.query(`
      INSERT INTO status_config_master (sub_status, statuses, sort_order, created_by)
      VALUES ($1, $2::jsonb, $3, $4)
      ON CONFLICT (sub_status) DO UPDATE SET
        statuses   = $2::jsonb,
        sort_order = $3,
        created_by = $4
    `, [subStatus.trim(), JSON.stringify(statuses), sortOrder, session.name]);
  } else {
    await sql.query(`
      INSERT INTO status_config_master (sub_status, statuses, created_by)
      VALUES ($1, $2::jsonb, $3)
      ON CONFLICT (sub_status) DO UPDATE SET
        statuses   = $2::jsonb,
        created_by = $3
    `, [subStatus.trim(), JSON.stringify(statuses), session.name]);
  }

  return Response.json({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "head"))
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const { oldSubStatus, newSubStatus } = await req.json() as {
    oldSubStatus: string; newSubStatus: string;
  };
  if (!oldSubStatus?.trim() || !newSubStatus?.trim())
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  if (oldSubStatus === newSubStatus) return Response.json({ ok: true });

  const sql = getSql();

  // 1. Rename in master (PK update — no FK constraints)
  await sql.query(
    `UPDATE status_config_master SET sub_status = $1 WHERE sub_status = $2`,
    [newSubStatus.trim(), oldSubStatus]
  );

  // 2. Replace in all OTA config statuses arrays
  await sql.query(`
    UPDATE ota_status_config
    SET statuses = (
      SELECT jsonb_agg(CASE WHEN s = $1 THEN $2 ELSE s END)
      FROM jsonb_array_elements_text(statuses) AS s
    )
    WHERE statuses @> $3::jsonb
  `, [oldSubStatus, newSubStatus.trim(), JSON.stringify([oldSubStatus])]);

  // 3. Rename on all properties
  await sql.query(
    `UPDATE ota_listing SET sub_status = $1, crm_updated_at = NOW() WHERE sub_status = $2`,
    [newSubStatus.trim(), oldSubStatus]
  );

  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "head"))
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const { subStatus, confirmed, autoClear } = await req.json() as {
    subStatus: string; confirmed?: boolean; autoClear?: boolean;
  };
  const sql = getSql();
  await ensureMasterTable(sql);

  // Count affected properties
  const affected = await sql.query(
    `SELECT COUNT(*) AS n FROM ota_listing WHERE sub_status = $1`,
    [subStatus]
  ) as { n: string }[];
  const affectedCount = Number(affected[0].n);

  // Return count for UI confirmation if properties are affected and not yet confirmed
  if (affectedCount > 0 && !confirmed) {
    return Response.json({ needsConfirm: true, affectedCount });
  }

  // Delete from master
  await sql.query(`DELETE FROM status_config_master WHERE sub_status = $1`, [subStatus]);

  // Optionally clear from all properties
  if (autoClear) {
    await sql.query(
      `UPDATE ota_listing SET sub_status = NULL, crm_updated_at = NOW() WHERE sub_status = $1`,
      [subStatus]
    );
  }

  // Remove from all OTA configs
  await sql.query(`
    UPDATE ota_status_config
    SET statuses = (
      SELECT COALESCE(jsonb_agg(s), '[]'::jsonb)
      FROM jsonb_array_elements_text(statuses) AS s
      WHERE s <> $1
    )
    WHERE statuses @> $2::jsonb
  `, [subStatus, JSON.stringify([subStatus])]);

  return Response.json({ ok: true });
}
