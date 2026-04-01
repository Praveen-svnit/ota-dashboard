import { getSql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { OTAS } from "@/lib/constants";

// subStatuses = the primary list of sub-status values
// statusMap   = for each sub-status, which statuses it can roll up to
export type OtaStatusConfig = {
  ota: string;
  subStatuses: string[];
  statusMap: Record<string, string[]>;  // { [subStatus]: string[] }
  updatedAt: string | null;
  updatedBy: string | null;
  isDefault: boolean;
};

// ── Defaults ───────────────────────────────────────────────────────────────

const DEFAULT_SUB_STATUSES = [
  "Live",
  "Not Live",
  "Shell Created",
  "Ready to Go Live",
  "Content in Progress",
  "Listing in Progress",
  "Content Pending",
  "Images Pending",
  "Approval Pending",
  "OTA Verification",
  "Under Review",
  "Suspended",
  "Duplicate",
  "Pending",
  "Soldout",
  "Closed",
];

// Sub-status → which statuses it belongs to
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

// ── Route handlers ─────────────────────────────────────────────────────────

export async function GET() {
  const session = await getSession();
  if (!session)
    return Response.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getSql();
  await ensureTable(sql);

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
      const sm = (row.statusMap && typeof row.statusMap === "object" && !Array.isArray(row.statusMap))
        ? row.statusMap as Record<string, string[]>
        : {};
      return { ota, subStatuses: row.statuses, statusMap: sm, updatedAt: row.updatedAt, updatedBy: row.updatedBy, isDefault: false };
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

  const { ota, subStatuses, statusMap } = await req.json() as {
    ota: string; subStatuses: string[]; statusMap: Record<string, string[]>;
  };

  if (!ota || !Array.isArray(subStatuses) || typeof statusMap !== "object")
    return Response.json({ error: "Invalid payload" }, { status: 400 });

  const sql = getSql();
  await ensureTable(sql);

  // statuses column stores the sub-status list; sub_statuses column stores the map
  await sql.query(`
    INSERT INTO ota_status_config (ota, statuses, sub_statuses, updated_at, updated_by)
    VALUES ($1, $2::jsonb, $3::jsonb, NOW(), $4)
    ON CONFLICT (ota) DO UPDATE SET
      statuses     = $2::jsonb,
      sub_statuses = $3::jsonb,
      updated_at   = NOW(),
      updated_by   = $4
  `, [ota, JSON.stringify(subStatuses), JSON.stringify(statusMap), session.name]);

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
