import { getSql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { OTAS } from "@/lib/constants";

export type OtaStatusConfig = {
  ota: string;
  subStatuses: string[];
  statusMap: Record<string, string[]>;  // { [subStatus]: string[] }  derived from master
  updatedAt: string | null;
  updatedBy: string | null;
  isDefault: boolean;
};

// ── Defaults (used when no custom config saved AND master table empty) ─────

const DEFAULT_SUB_STATUSES = [
  "Live", "Not Live", "Shell Created", "Ready to Go Live",
  "Content in Progress", "Listing in Progress", "Content Pending",
  "Images Pending", "Approval Pending", "OTA Verification",
  "Under Review", "Suspended", "Duplicate", "Pending", "Soldout", "Closed",
];

const DEFAULT_STATUS_MAP: Record<string, string[]> = {
  "Live":                 ["Live"],
  "Not Live":             ["Not Live"],
  "Shell Created":        ["Shell Created"],
  "Ready to Go Live":     ["Ready to Go Live"],
  "Content in Progress":  ["Content in Progress"],
  "Listing in Progress":  ["Listing in Progress"],
  "Content Pending":      ["Content in Progress", "Shell Created"],
  "Images Pending":       ["Content in Progress", "Shell Created"],
  "Approval Pending":     ["Ready to Go Live"],
  "OTA Verification":     ["Listing in Progress"],
  "Under Review":         ["Listing in Progress"],
  "Suspended":            ["Not Live"],
  "Duplicate":            ["Not Live"],
  "Pending":              ["Pending"],
  "Soldout":              ["Soldout"],
  "Closed":               ["Closed"],
};

const AGODA_SUB_STATUSES = [
  "Live", "Revenue", "Churned", "Exception", "Rev+",
  "Pending at OTA", "Pending at Agoda", "Supply/Operations",
];

const AGODA_STATUS_MAP: Record<string, string[]> = {
  "Live":              ["Live", "Live (Duplicate)"],
  "Revenue":           ["Listing Claimed by Owner"],
  "Churned":           ["Delisted"],
  "Exception":         ["Not to List on OTA"],
  "Rev+":              ["Only FH"],
  "Pending at OTA":    ["Ready to go Live", "Yet to be Shared"],
  "Pending at Agoda":  ["Listing Under Process"],
  "Supply/Operations": ["Listing Claimed by Owner"],
};

const DEFAULTS: Record<string, { subStatuses: string[]; statusMap: Record<string, string[]> }> = {};
for (const ota of OTAS) {
  DEFAULTS[ota] = ota === "Agoda"
    ? { subStatuses: AGODA_SUB_STATUSES, statusMap: AGODA_STATUS_MAP }
    : { subStatuses: DEFAULT_SUB_STATUSES, statusMap: DEFAULT_STATUS_MAP };
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function ensureTable(sql: ReturnType<typeof getSql>) {
  await sql.query(`
    CREATE TABLE IF NOT EXISTS ota_status_config (
      ota          TEXT PRIMARY KEY,
      statuses     JSONB NOT NULL DEFAULT '[]',
      sub_statuses JSONB NOT NULL DEFAULT '{}',
      updated_at   TIMESTAMPTZ DEFAULT NOW(),
      updated_by   TEXT
    )
  `, []);
}

async function getMasterMap(sql: ReturnType<typeof getSql>): Promise<Record<string, string[]>> {
  try {
    const rows = await sql.query(
      `SELECT sub_status AS "subStatus", statuses FROM status_config_master ORDER BY sort_order`,
      []
    ) as { subStatus: string; statuses: string[] }[];
    const map: Record<string, string[]> = {};
    for (const r of rows) map[r.subStatus] = r.statuses;
    return map;
  } catch {
    return {}; // master table not yet created — fall back to stored statusMap
  }
}

// ── Route handlers ─────────────────────────────────────────────────────────

export async function GET() {
  const session = await getSession();
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getSql();
  await ensureTable(sql);

  const masterMap = await getMasterMap(sql);
  const hasMaster = Object.keys(masterMap).length > 0;

  const rows = await sql.query(
    `SELECT ota, statuses, sub_statuses AS "statusMap",
            updated_at AS "updatedAt", updated_by AS "updatedBy"
     FROM ota_status_config`,
    []
  ) as { ota: string; statuses: string[]; statusMap: unknown; updatedAt: string; updatedBy: string }[];

  const dbMap: Record<string, typeof rows[0]> = {};
  for (const r of rows) dbMap[r.ota] = r;

  const configs: OtaStatusConfig[] = OTAS.map(ota => {
    const row = dbMap[ota];
    if (row) {
      const enabledSubStatuses: string[] = Array.isArray(row.statuses) ? row.statuses : [];
      // Derive statusMap from master if available; fall back to stored map
      let statusMap: Record<string, string[]>;
      if (hasMaster) {
        statusMap = {};
        for (const ss of enabledSubStatuses) {
          if (masterMap[ss]) statusMap[ss] = masterMap[ss];
        }
      } else {
        statusMap = (row.statusMap && typeof row.statusMap === "object" && !Array.isArray(row.statusMap))
          ? row.statusMap as Record<string, string[]>
          : {};
      }
      return { ota, subStatuses: enabledSubStatuses, statusMap, updatedAt: row.updatedAt, updatedBy: row.updatedBy, isDefault: false };
    }
    return {
      ota,
      ...(DEFAULTS[ota] ?? { subStatuses: DEFAULT_SUB_STATUSES, statusMap: DEFAULT_STATUS_MAP }),
      updatedAt: null, updatedBy: null, isDefault: true,
    };
  });

  return Response.json({ configs });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "head"))
    return Response.json({ error: "Forbidden" }, { status: 403 });

  // Now only accepts subStatuses — the list of enabled sub_status names from master
  const { ota, subStatuses } = await req.json() as {
    ota: string; subStatuses: string[];
  };

  if (!ota || !Array.isArray(subStatuses))
    return Response.json({ error: "Invalid payload" }, { status: 400 });

  const sql = getSql();
  await ensureTable(sql);

  await sql.query(`
    INSERT INTO ota_status_config (ota, statuses, sub_statuses, updated_at, updated_by)
    VALUES ($1, $2::jsonb, '{}'::jsonb, NOW(), $3)
    ON CONFLICT (ota) DO UPDATE SET
      statuses     = $2::jsonb,
      sub_statuses = '{}'::jsonb,
      updated_at   = NOW(),
      updated_by   = $3
  `, [ota, JSON.stringify(subStatuses), session.name]);

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
