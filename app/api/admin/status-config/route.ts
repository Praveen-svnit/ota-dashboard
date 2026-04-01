import { getSql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { OTAS } from "@/lib/constants";

// sub_statuses is now a map: { [status]: string[] }
export type OtaStatusConfig = {
  ota: string;
  statuses: string[];
  subStatuses: Record<string, string[]>;  // keyed by status value
  updatedAt: string | null;
  updatedBy: string | null;
  isDefault: boolean;
};

// ── Defaults ───────────────────────────────────────────────────────────────

const DEFAULT_STATUSES = [
  "Shell Created", "Live", "Not Live", "Ready to Go Live",
  "Content in Progress", "Listing in Progress", "Pending", "Soldout", "Closed",
];

const DEFAULT_SUB_STATUS_MAP: Record<string, string[]> = {
  "Shell Created":          ["Shell Created", "Content Pending", "Images Pending"],
  "Live":                   ["Live"],
  "Not Live":               ["Not Live", "Suspended", "Duplicate"],
  "Ready to Go Live":       ["Ready to Go Live", "Approval Pending", "OTA Verification"],
  "Content in Progress":    ["Content in Progress", "Content Pending", "Images Pending"],
  "Listing in Progress":    ["Listing in Progress", "Under Review"],
  "Pending":                ["Pending", "Approval Pending"],
  "Soldout":                ["Soldout"],
  "Closed":                 ["Closed"],
};

const AGODA_STATUSES = [
  "Live", "Listing Claimed by Owner", "Delisted", "Not to List on OTA",
  "Only FH", "Ready to go Live", "Yet to be Shared",
  "Listing Under Process", "Live (Duplicate)",
];

const AGODA_SUB_STATUS_MAP: Record<string, string[]> = {
  "Live":                     ["Live"],
  "Listing Claimed by Owner": ["Revenue", "Supply/Operations"],
  "Delisted":                 ["Churned"],
  "Not to List on OTA":       ["Exception"],
  "Only FH":                  ["Rev+"],
  "Ready to go Live":         ["Pending at OTA"],
  "Yet to be Shared":         ["Pending at OTA"],
  "Listing Under Process":    ["Pending at Agoda"],
  "Live (Duplicate)":         ["Live"],
};

const DEFAULTS: Record<string, { statuses: string[]; subStatuses: Record<string, string[]> }> = {};
for (const ota of OTAS) {
  DEFAULTS[ota] = ota === "Agoda"
    ? { statuses: AGODA_STATUSES, subStatuses: AGODA_SUB_STATUS_MAP }
    : { statuses: DEFAULT_STATUSES, subStatuses: DEFAULT_SUB_STATUS_MAP };
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

// Normalise whatever shape is in the DB to Record<string, string[]>
function normaliseSubStatuses(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== "object") return {};
  // Old shape was string[] — migrate gracefully to empty map
  if (Array.isArray(raw)) return {};
  return raw as Record<string, string[]>;
}

// ── Route handlers ─────────────────────────────────────────────────────────

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
  ) as { ota: string; statuses: string[]; subStatuses: unknown; updatedAt: string; updatedBy: string }[];

  const dbMap: Record<string, typeof rows[0]> = {};
  for (const r of rows) dbMap[r.ota] = r;

  const configs: OtaStatusConfig[] = OTAS.map(ota => {
    const row = dbMap[ota];
    if (row) {
      return {
        ota,
        statuses: row.statuses,
        subStatuses: normaliseSubStatuses(row.subStatuses),
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy,
        isDefault: false,
      };
    }
    return {
      ota,
      ...(DEFAULTS[ota] ?? { statuses: DEFAULT_STATUSES, subStatuses: DEFAULT_SUB_STATUS_MAP }),
      updatedAt: null,
      updatedBy: null,
      isDefault: true,
    };
  });

  return Response.json({ configs });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "head"))
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const { ota, statuses, subStatuses } = await req.json() as {
    ota: string; statuses: string[]; subStatuses: Record<string, string[]>;
  };

  if (!ota || !Array.isArray(statuses) || typeof subStatuses !== "object")
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
