import { getSql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { OTAS } from "@/lib/constants";

export type OtaStatusConfig = {
  ota: string;
  statuses: string[];
  subStatuses: string[];
  updatedAt: string | null;
  updatedBy: string | null;
  isDefault: boolean;
};

// Seed defaults — what was previously hardcoded in the CRM property page
const DEFAULT_STATUSES = [
  "Shell Created", "Live", "Not Live", "Ready to Go Live",
  "Content in Progress", "Listing in Progress", "Pending", "Soldout", "Closed",
];

const DEFAULT_SUB_STATUSES = [
  "Live", "Not Live", "Shell Created", "Ready to Go Live",
  "Content in Progress", "Listing in Progress",
  "Content Pending", "Images Pending", "Approval Pending",
  "OTA Verification", "Under Review", "Suspended", "Duplicate",
];

const AGODA_STATUSES = [
  "Live", "Listing Claimed by Owner", "Delisted", "Not to List on OTA",
  "Only FH", "Ready to go Live", "Yet to be Shared",
  "Listing Under Process", "Live (Duplicate)",
];

const AGODA_SUB_STATUSES = [
  "Live", "Revenue", "Churned", "Exception", "Rev+",
  "Pending at OTA", "Pending at Agoda", "Supply/Operations",
];

const DEFAULTS: Record<string, { statuses: string[]; subStatuses: string[] }> = {};
for (const ota of OTAS) {
  DEFAULTS[ota] = ota === "Agoda"
    ? { statuses: AGODA_STATUSES, subStatuses: AGODA_SUB_STATUSES }
    : { statuses: DEFAULT_STATUSES, subStatuses: DEFAULT_SUB_STATUSES };
}

async function ensureTable(sql: ReturnType<typeof getSql>) {
  await sql.query(`
    CREATE TABLE IF NOT EXISTS ota_status_config (
      ota         TEXT PRIMARY KEY,
      statuses    JSONB NOT NULL DEFAULT '[]',
      sub_statuses JSONB NOT NULL DEFAULT '[]',
      updated_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_by  TEXT
    )
  `, []);
}

export async function GET() {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "head"))
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const sql = getSql();
  await ensureTable(sql);

  const rows = await sql.query(
    `SELECT ota, statuses, sub_statuses AS "subStatuses",
            updated_at AS "updatedAt", updated_by AS "updatedBy"
     FROM ota_status_config`,
    []
  ) as { ota: string; statuses: string[]; subStatuses: string[]; updatedAt: string; updatedBy: string }[];

  const dbMap: Record<string, typeof rows[0]> = {};
  for (const r of rows) dbMap[r.ota] = r;

  const configs: OtaStatusConfig[] = OTAS.map(ota => {
    const row = dbMap[ota];
    if (row) {
      return { ota, statuses: row.statuses, subStatuses: row.subStatuses, updatedAt: row.updatedAt, updatedBy: row.updatedBy, isDefault: false };
    }
    return { ota, ...DEFAULTS[ota] ?? { statuses: DEFAULT_STATUSES, subStatuses: DEFAULT_SUB_STATUSES }, updatedAt: null, updatedBy: null, isDefault: true };
  });

  return Response.json({ configs });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "head"))
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const { ota, statuses, subStatuses } = await req.json() as {
    ota: string; statuses: string[]; subStatuses: string[];
  };

  if (!ota || !Array.isArray(statuses) || !Array.isArray(subStatuses))
    return Response.json({ error: "Invalid payload" }, { status: 400 });

  const sql = getSql();
  await ensureTable(sql);

  await sql.query(`
    INSERT INTO ota_status_config (ota, statuses, sub_statuses, updated_at, updated_by)
    VALUES ($1, $2::jsonb, $3::jsonb, NOW(), $4)
    ON CONFLICT (ota) DO UPDATE SET
      statuses     = $2::jsonb,
      sub_statuses = $3::jsonb,
      updated_at   = NOW(),
      updated_by   = $4
  `, [ota, JSON.stringify(statuses), JSON.stringify(subStatuses), session.name]);

  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "head"))
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const { ota } = await req.json() as { ota: string };
  const sql = getSql();
  await ensureTable(sql);
  await sql.query(`DELETE FROM ota_status_config WHERE ota = $1`, [ota]);
  return Response.json({ ok: true });
}
