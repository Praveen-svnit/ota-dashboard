import { getSql } from "@/lib/db-postgres";
import { parseCSV } from "@/lib/sheets";
import { SHEET_ID } from "@/lib/constants";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";

const BATCH = 200;

function escVal(v: string | null): string {
  if (v === null || v === undefined) return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}

function parseDate(v: string | null): string | null {
  if (!v || !v.trim() || v.startsWith("#")) return null;
  const s = v.trim();
  if (/^\d{4,5}$/.test(s)) {
    const serial = parseInt(s);
    if (serial > 30000 && serial < 60000) {
      const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      return d.toISOString().slice(0, 10);
    }
    return null;
  }
  const dmy = s.match(/^(\d{1,2})[\/\-]([A-Za-z]+)[\/\-](\d{2,4})$/);
  if (dmy) {
    const months: Record<string, string> = {
      jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",
      jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12",
    };
    const m = months[dmy[2].toLowerCase().slice(0, 3)];
    if (!m) return null;
    let year = dmy[3];
    if (year.length === 2) year = (parseInt(year) > 50 ? "19" : "20") + year;
    return `${year}-${m}-${dmy[1].padStart(2, "0")}`;
  }
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}

function clean(v: string | undefined): string | null {
  if (!v) return null;
  const t = v.trim();
  if (!t || t === "#N/A" || t === "#REF!" || t === "#ERROR!" || t === "0") return null;
  return t;
}

async function fetchTab(tab: string): Promise<{ cols: string[]; rows: string[][] }> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch tab "${tab}": ${res.status}`);
  return parseCSV(await res.text());
}

function col(cols: string[], name: string): number {
  const n = name.toLowerCase();
  return cols.findIndex(c => c.toLowerCase().trim() === n);
}

type OtaRecord = {
  property_id: string;
  ota: string;
  status: string | null;
  sub_status: string | null;
  live_date: string | null;
  ota_id: string | null;
  pre_post: string | null;
};

type DbRow = {
  id: number;
  property_id: string;
  status: string | null;
  sub_status: string | null;
  live_date: string | null;
  ota_id: string | null;
};

type LogEntry = {
  property_id: string;
  ota_listing_id: number | null;
  field: string;
  old_value: string | null;
  new_value: string;
};

const TRACKED_FIELDS: (keyof Pick<OtaRecord, "status" | "sub_status" | "live_date" | "ota_id">)[] = [
  "status", "sub_status", "live_date", "ota_id",
];

async function batchUpsert(
  sql: ReturnType<typeof getSql>,
  records: OtaRecord[],
  updateSubStatus: boolean,
  updateOnly: boolean = false
): Promise<{ upserted: number }> {
  if (records.length === 0) return { upserted: 0 };

  const ota = records[0].ota;

  // Fetch all existing rows for this OTA in one query
  const existing = await sql.query(
    `SELECT id, property_id, status, sub_status, live_date::text AS live_date, ota_id
     FROM ota_listing WHERE ota = $1`,
    [ota]
  ) as DbRow[];
  const existingMap = new Map(existing.map(r => [r.property_id, r]));

  if (updateOnly) {
    records = records.filter(r => existingMap.has(r.property_id));
  }

  // Diff and collect log entries
  const logEntries: LogEntry[] = [];
  for (const rec of records) {
    const dbRow = existingMap.get(rec.property_id) ?? null;
    for (const field of TRACKED_FIELDS) {
      if (field === "sub_status" && !updateSubStatus) continue;
      const incoming = rec[field];
      if (!incoming) continue; // don't log nulls coming from sheet
      const current = dbRow ? (dbRow[field as keyof DbRow] as string | null) : null;
      if (incoming !== current) {
        logEntries.push({
          property_id: rec.property_id,
          ota_listing_id: dbRow?.id ?? null,
          field,
          old_value: current,
          new_value: incoming,
        });
      }
    }
  }

  // Upsert ota_listing in batches
  let upserted = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const vals = batch.map(r =>
      `(${escVal(r.property_id)}, ${escVal(r.ota)}, ${escVal(r.status)}, ${escVal(r.sub_status)}, ${r.live_date ? `'${r.live_date}'::date` : "NULL"}, ${escVal(r.ota_id)}, ${escVal(r.pre_post)})`
    ).join(",\n");

    const subStatusUpdate = updateSubStatus
      ? `sub_status = COALESCE(EXCLUDED.sub_status, ota_listing.sub_status),`
      : "";

    await sql.query(`
      INSERT INTO ota_listing (property_id, ota, status, sub_status, live_date, ota_id, pre_post, synced_at)
      VALUES ${vals}
      ON CONFLICT (property_id, ota) DO UPDATE SET
        status     = COALESCE(EXCLUDED.status,    ota_listing.status),
        ${subStatusUpdate}
        live_date  = COALESCE(EXCLUDED.live_date, ota_listing.live_date),
        ota_id     = COALESCE(EXCLUDED.ota_id,    ota_listing.ota_id),
        pre_post   = COALESCE(EXCLUDED.pre_post,  ota_listing.pre_post),
        synced_at  = NOW()
    `, []);
    upserted += batch.length;
  }

  // Bulk insert log entries
  if (logEntries.length > 0) {
    for (let i = 0; i < logEntries.length; i += BATCH) {
      const chunk = logEntries.slice(i, i + BATCH);
      const logVals = chunk.map(e =>
        `(${escVal(e.property_id)}, ${e.ota_listing_id ?? "NULL"}, 'sheets_sync', 'field_updated', ${escVal(e.field)}, ${escVal(e.old_value)}, ${escVal(e.new_value)})`
      ).join(",\n");
      await sql.query(`
        INSERT INTO property_log (property_id, ota_listing_id, user_id, action, field, old_value, new_value)
        VALUES ${logVals}
      `, []);
    }
  }

  return { upserted };
}

// ── OTA definitions ───────────────────────────────────────────────────────────

type OtaDef = {
  ota: string;
  tab: string;
  updateSubStatus: boolean;
  updateOnly: boolean;
  buildRecords: (cols: string[], rows: string[][], propertyId?: string) => OtaRecord[];
};

const OTA_DEFS: OtaDef[] = [
  {
    ota: "GoMMT", tab: "GoMMT", updateSubStatus: true, updateOnly: false,
    buildRecords(cols, rows, pid?) {
      const pidC = col(cols, "listing property_id"), staC = col(cols, "mmt shell status");
      const ssC = col(cols, "sub status"), dateC = col(cols, "property live date on go-mmt");
      const idC = col(cols, "go-mmt id"), ppC = col(cols, "set");
      return rows.flatMap(r => {
        const p = clean(r[pidC]); if (!p || (pid && p !== pid)) return [];
        return [{ property_id: p, ota: "GoMMT", status: clean(r[staC]), sub_status: clean(r[ssC]), live_date: parseDate(r[dateC]), ota_id: clean(r[idC]), pre_post: clean(r[ppC]) }];
      });
    },
  },
  {
    ota: "Agoda", tab: "Agoda", updateSubStatus: true, updateOnly: false,
    buildRecords(cols, rows, pid?) {
      const pidC = col(cols, "property_id"), staC = col(cols, "agoda status");
      const ssC = col(cols, "sub status"), dateC = col(cols, "agoda live date"), idC = col(cols, "agoda id");
      return rows.flatMap(r => {
        const p = clean(r[pidC]); if (!p || (pid && p !== pid)) return [];
        return [{ property_id: p, ota: "Agoda", status: clean(r[staC]), sub_status: clean(r[ssC]), live_date: parseDate(r[dateC]), ota_id: clean(r[idC]), pre_post: null }];
      });
    },
  },
  {
    ota: "Expedia", tab: "Expedia", updateSubStatus: true, updateOnly: false,
    buildRecords(cols, rows, pid?) {
      const pidC = col(cols, "fh id"), staC = col(cols, "expedia status");
      const ssC = col(cols, "sub status"), dateC = col(cols, "expedia live date"), idC = col(cols, "expedia id");
      return rows.flatMap(r => {
        const p = clean(r[pidC]); if (!p || (pid && p !== pid)) return [];
        return [{ property_id: p, ota: "Expedia", status: clean(r[staC]), sub_status: clean(r[ssC]), live_date: parseDate(r[dateC]), ota_id: clean(r[idC]), pre_post: null }];
      });
    },
  },
  {
    ota: "Yatra", tab: "Yatra", updateSubStatus: true, updateOnly: false,
    buildRecords(cols, rows, pid?) {
      const pidC = col(cols, "property_id"), staC = col(cols, "yatra status");
      const ssC = col(cols, "sub status"), dateC = col(cols, "live date"), idC = col(cols, "vid"), ppC = col(cols, "prop set");
      return rows.flatMap(r => {
        const p = clean(r[pidC]); if (!p || (pid && p !== pid)) return [];
        return [{ property_id: p, ota: "Yatra", status: clean(r[staC]), sub_status: clean(r[ssC]), live_date: parseDate(r[dateC]), ota_id: clean(r[idC]), pre_post: clean(r[ppC]) }];
      });
    },
  },
  {
    ota: "Ixigo", tab: "Ixigo", updateSubStatus: true, updateOnly: false,
    buildRecords(cols, rows, pid?) {
      const pidC = col(cols, "property_id"), staC = col(cols, "ixigo status");
      const ssC = col(cols, "sub status"), dateC = col(cols, "live date"), idC = col(cols, "ixigo id"), ppC = col(cols, "prop set");
      return rows.flatMap(r => {
        const p = clean(r[pidC]); if (!p || (pid && p !== pid)) return [];
        return [{ property_id: p, ota: "Ixigo", status: clean(r[staC]), sub_status: clean(r[ssC]), live_date: parseDate(r[dateC]), ota_id: clean(r[idC]), pre_post: clean(r[ppC]) }];
      });
    },
  },
  {
    ota: "Akbar Travels", tab: "Akbar Travels", updateSubStatus: true, updateOnly: false,
    buildRecords(cols, rows, pid?) {
      const pidC = col(cols, "property_id"), staC = col(cols, "akt status");
      const ssC = col(cols, "sub status"), dateC = col(cols, "akt live date"), idC = col(cols, "akt_id"), ppC = col(cols, "prop set");
      return rows.flatMap(r => {
        const p = clean(r[pidC]); if (!p || (pid && p !== pid)) return [];
        return [{ property_id: p, ota: "Akbar Travels", status: clean(r[staC]), sub_status: clean(r[ssC]), live_date: parseDate(r[dateC]), ota_id: clean(r[idC]), pre_post: clean(r[ppC]) }];
      });
    },
  },
  {
    ota: "Booking.com", tab: "BDC", updateSubStatus: true, updateOnly: false,
    buildRecords(cols, rows, pid?) {
      const pidC = col(cols, "property_id"), idC = col(cols, "bdc id"), staC = col(cols, "bdc status");
      const ssC = col(cols, "sub status"), dateC = col(cols, "bdc listing date");
      return rows.flatMap(r => {
        const p = clean(r[pidC]); if (!p || (pid && p !== pid)) return [];
        return [{ property_id: p, ota: "Booking.com", status: clean(r[staC]), sub_status: clean(r[ssC]), live_date: parseDate(r[dateC]), ota_id: clean(r[idC]), pre_post: null }];
      });
    },
  },
  {
    ota: "Cleartrip", tab: "Clear Trip", updateSubStatus: true, updateOnly: false,
    buildRecords(cols, rows, pid?) {
      const pidC = col(cols, "property_id"), idC = col(cols, "ct hid"), staC = col(cols, "ct status");
      const ssC = col(cols, "sub status"), dateC = col(cols, "ct live date");
      return rows.flatMap(r => {
        const p = clean(r[pidC]); if (!p || (pid && p !== pid)) return [];
        return [{ property_id: p, ota: "Cleartrip", status: clean(r[staC]), sub_status: clean(r[ssC]), live_date: parseDate(r[dateC]), ota_id: clean(r[idC]), pre_post: null }];
      });
    },
  },
  {
    ota: "EaseMyTrip", tab: "EMT", updateSubStatus: true, updateOnly: false,
    buildRecords(cols, rows, pid?) {
      const pidC = col(cols, "fh id"), idC = col(cols, "emt hotel id"), staC = col(cols, "emt status");
      const ssC = col(cols, "sub status"), dateC = col(cols, "emt live date");
      return rows.flatMap(r => {
        const p = clean(r[pidC]); if (!p || (pid && p !== pid)) return [];
        return [{ property_id: p, ota: "EaseMyTrip", status: clean(r[staC]), sub_status: clean(r[ssC]), live_date: parseDate(r[dateC]), ota_id: clean(r[idC]), pre_post: null }];
      });
    },
  },
];

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (session && session.role !== "admin" && session.role !== "head") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const otaFilter    = searchParams.get("ota")        ?? null;  // e.g. "GoMMT"
  const propertyId   = searchParams.get("propertyId") ?? undefined; // e.g. "157"

  const sql = getSql();
  const results: Record<string, number> = {};
  const errors: string[] = [];

  // Determine which OTA defs to run
  const defs = otaFilter
    ? OTA_DEFS.filter(d => d.ota === otaFilter)
    : OTA_DEFS;

  if (defs.length === 0) {
    return Response.json({ error: `Unknown OTA: ${otaFilter}` }, { status: 400 });
  }

  // Fetch tabs (de-duplicate in case multiple OTAs share a tab)
  const tabCache: Record<string, { cols: string[]; rows: string[][] }> = {};
  for (const def of defs) {
    if (!tabCache[def.tab]) {
      try {
        tabCache[def.tab] = await fetchTab(def.tab);
      } catch (e) {
        errors.push(`Fetch "${def.tab}": ${e}`);
      }
    }
  }

  // Process each OTA
  for (const def of defs) {
    const tabData = tabCache[def.tab];
    if (!tabData) { errors.push(`${def.ota}: sheet not available`); continue; }
    try {
      const records = def.buildRecords(tabData.cols, tabData.rows, propertyId);
      const { upserted } = await batchUpsert(sql, records, def.updateSubStatus, def.updateOnly);
      results[def.ota] = upserted;
    } catch (e) {
      errors.push(`${def.ota}: ${e}`);
    }
  }

  const total = Object.values(results).reduce((a, b) => a + b, 0);
  const summary = Object.entries(results).map(([k, v]) => `${k}: ${v}`).join(", ");
  const message = `Synced ${total} rows. ${summary}${errors.length ? ` | Errors: ${errors.join("; ")}` : ""}`;

  return Response.json({ ok: errors.length === 0, message, results, errors });
}
