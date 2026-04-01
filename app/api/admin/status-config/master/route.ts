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

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "head"))
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const { subStatus } = await req.json() as { subStatus: string };
  const sql = getSql();
  await ensureMasterTable(sql);
  await sql.query(`DELETE FROM status_config_master WHERE sub_status = $1`, [subStatus]);
  return Response.json({ ok: true });
}
