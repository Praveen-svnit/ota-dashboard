import { getSql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { OTAS } from "@/lib/constants";

// Status → { preset sub-status, postset sub-status }
export type StatusSubStatusMap = Record<string, { preset: string; postset: string }>;

export type OtaStatusConfig = {
  ota: string;
  statusSubStatusMap: StatusSubStatusMap;
  subStatuses: string[];   // derived: unique sub-statuses from the map (for dropdowns etc.)
  updatedAt: string | null;
  updatedBy: string | null;
  isDefault: boolean;
};

// ── Agoda default mapping (from the gsheet logic) ─────────────────────────

const AGODA_DEFAULT_MAP: StatusSubStatusMap = {
  "Live":                     { preset: "Live",              postset: "Live"              },
  "Listing Claimed by Owner": { preset: "Revenue",           postset: "Supply/Operations" },
  "Delisted":                 { preset: "Churned",           postset: "Churned"           },
  "Not to List on OTA":       { preset: "Exception",         postset: "Exception"         },
  "Only FH":                  { preset: "Rev+",              postset: "Rev+"              },
  "Ready to go Live":         { preset: "Pending at OTA",    postset: "Pending at OTA"    },
  "Yet to be Shared":         { preset: "Pending at OTA",    postset: "Pending at OTA"    },
  "Listing Under Process":    { preset: "Pending at Agoda",  postset: "Pending at Agoda"  },
  "Live (Duplicate)":         { preset: "Live",              postset: "Live"              },
};

// Helper: derive unique sub-statuses from a statusSubStatusMap
function deriveSubStatuses(map: StatusSubStatusMap): string[] {
  const set = new Set<string>();
  for (const { preset, postset } of Object.values(map)) {
    if (preset)  set.add(preset);
    if (postset) set.add(postset);
  }
  return Array.from(set).sort();
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
    `SELECT ota, sub_statuses AS "rawMap",
            updated_at AS "updatedAt", updated_by AS "updatedBy"
     FROM ota_status_config`,
    []
  ) as { ota: string; rawMap: unknown; updatedAt: string; updatedBy: string }[];

  const dbMap: Record<string, typeof rows[0]> = {};
  for (const r of rows) dbMap[r.ota] = r;

  const configs: OtaStatusConfig[] = OTAS.map(ota => {
    const row = dbMap[ota];
    if (row) {
      const statusSubStatusMap: StatusSubStatusMap =
        (row.rawMap && typeof row.rawMap === "object" && !Array.isArray(row.rawMap))
          ? row.rawMap as StatusSubStatusMap
          : {};
      // If stored map is the old format (sub-status → parent), treat as empty
      const isNewFormat = Object.values(statusSubStatusMap).every(v => typeof v === "object" && ("preset" in v || "postset" in v));
      const resolvedMap = isNewFormat ? statusSubStatusMap : {};
      return {
        ota,
        statusSubStatusMap: resolvedMap,
        subStatuses: deriveSubStatuses(resolvedMap),
        updatedAt: row.updatedAt,
        updatedBy: row.updatedBy,
        isDefault: false,
      };
    }
    // Default: Agoda gets the built-in map, others get empty
    const defaultMap = ota === "Agoda" ? AGODA_DEFAULT_MAP : {};
    return {
      ota,
      statusSubStatusMap: defaultMap,
      subStatuses: deriveSubStatuses(defaultMap),
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

  const { ota, statusSubStatusMap } = await req.json() as {
    ota: string; statusSubStatusMap: StatusSubStatusMap;
  };

  if (!ota || !statusSubStatusMap)
    return Response.json({ error: "Invalid payload" }, { status: 400 });

  const sql = getSql();
  await ensureTable(sql);

  // statuses column: list of OTA status keys (for legacy compat)
  const statusKeys = Object.keys(statusSubStatusMap);

  await sql.query(`
    INSERT INTO ota_status_config (ota, statuses, sub_statuses, updated_at, updated_by)
    VALUES ($1, $2::jsonb, $3::jsonb, NOW(), $4)
    ON CONFLICT (ota) DO UPDATE SET
      statuses     = $2::jsonb,
      sub_statuses = $3::jsonb,
      updated_at   = NOW(),
      updated_by   = $4
  `, [ota, JSON.stringify(statusKeys), JSON.stringify(statusSubStatusMap), session.name]);

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
