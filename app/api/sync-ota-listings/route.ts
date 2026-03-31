import { getSql } from "@/lib/db-postgres";
import { parseCSV } from "@/lib/sheets";
import { SHEET_ID } from "@/lib/constants";
import { getSession } from "@/lib/auth";

const BATCH = 200;

function escVal(v: string | null): string {
  if (v === null || v === undefined) return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}

/** Parse various date formats from sheets into YYYY-MM-DD */
function parseDate(v: string | null): string | null {
  if (!v || !v.trim() || v.startsWith("#")) return null;
  const s = v.trim();

  // Excel serial number (e.g. 46059)
  if (/^\d{4,5}$/.test(s)) {
    const serial = parseInt(s);
    if (serial > 30000 && serial < 60000) {
      const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      return d.toISOString().slice(0, 10);
    }
    return null;
  }

  // DD-Mon-YYYY or DD-Mon-YY  e.g. "24-Aug-2021" or "15-Mar-18"
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

  // M/D/YYYY  e.g. "1/25/2015"
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;

  // Already YYYY-MM-DD
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

/** Find column index by header name (case-insensitive partial match) */
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

async function batchUpsert(sql: ReturnType<typeof getSql>, records: OtaRecord[], updateSubStatus: boolean): Promise<number> {
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
        status     = COALESCE(EXCLUDED.status, ota_listing.status),
        ${subStatusUpdate}
        live_date  = COALESCE(EXCLUDED.live_date, ota_listing.live_date),
        ota_id     = COALESCE(EXCLUDED.ota_id,    ota_listing.ota_id),
        pre_post   = COALESCE(EXCLUDED.pre_post,  ota_listing.pre_post),
        synced_at  = NOW()
    `, []);
    upserted += batch.length;
  }
  return upserted;
}

export async function POST() {
  const session = await getSession();
  if (session && session.role !== "admin" && session.role !== "head") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const sql = getSql();
  const results: Record<string, number> = {};
  const errors: string[] = [];

  // ── 1. GoMMT ──────────────────────────────────────────────────────────────
  try {
    const { cols, rows } = await fetchTab("GoMMT");
    const pidCol  = col(cols, "listing property_id");
    const staCol  = col(cols, "mmt shell status");
    const ssCol   = col(cols, "sub status");
    const dateCol = col(cols, "property live date on go-mmt");
    const idCol   = col(cols, "go-mmt id");
    const ppCol   = col(cols, "set");

    const records: OtaRecord[] = [];
    for (const r of rows) {
      const pid = clean(r[pidCol]);
      if (!pid) continue;
      records.push({
        property_id: pid, ota: "GoMMT",
        status:    clean(r[staCol]),
        sub_status: clean(r[ssCol]),
        live_date:  parseDate(r[dateCol]),
        ota_id:    clean(r[idCol]),
        pre_post:  clean(r[ppCol]),
      });
    }
    results["GoMMT"] = await batchUpsert(sql, records, true);
  } catch (e) { errors.push(`GoMMT: ${e}`); }

  // ── 2. Agoda ──────────────────────────────────────────────────────────────
  try {
    const { cols, rows } = await fetchTab("Agoda");
    const pidCol  = col(cols, "property_id");
    const staCol  = col(cols, "agoda status");
    const ssCol   = col(cols, "sub status");
    const dateCol = col(cols, "agoda live date");
    const idCol   = col(cols, "agoda id");

    const records: OtaRecord[] = [];
    for (const r of rows) {
      const pid = clean(r[pidCol]);
      if (!pid) continue;
      records.push({
        property_id: pid, ota: "Agoda",
        status:    clean(r[staCol]),
        sub_status: clean(r[ssCol]),
        live_date:  parseDate(r[dateCol]),
        ota_id:    clean(r[idCol]),
        pre_post:  null,
      });
    }
    results["Agoda"] = await batchUpsert(sql, records, true);
  } catch (e) { errors.push(`Agoda: ${e}`); }

  // ── 3. Expedia ────────────────────────────────────────────────────────────
  try {
    const { cols, rows } = await fetchTab("Expedia");
    const pidCol  = col(cols, "fh id");
    const staCol  = col(cols, "expedia status");
    const ssCol   = col(cols, "sub status");
    const dateCol = col(cols, "expedia live date");
    const idCol   = col(cols, "expedia id");

    const records: OtaRecord[] = [];
    for (const r of rows) {
      const pid = clean(r[pidCol]);
      if (!pid) continue;
      records.push({
        property_id: pid, ota: "Expedia",
        status:    clean(r[staCol]),
        sub_status: clean(r[ssCol]),
        live_date:  parseDate(r[dateCol]),
        ota_id:    clean(r[idCol]),
        pre_post:  null,
      });
    }
    results["Expedia"] = await batchUpsert(sql, records, true);
  } catch (e) { errors.push(`Expedia: ${e}`); }

  // ── 4. Yatra ──────────────────────────────────────────────────────────────
  try {
    const { cols, rows } = await fetchTab("Yatra");
    const pidCol  = col(cols, "property_id");
    const staCol  = col(cols, "yatra status");
    const ssCol   = col(cols, "sub status");
    const dateCol = col(cols, "live date");
    const idCol   = col(cols, "vid");
    const ppCol   = col(cols, "prop set");

    const records: OtaRecord[] = [];
    for (const r of rows) {
      const pid = clean(r[pidCol]);
      if (!pid) continue;
      records.push({
        property_id: pid, ota: "Yatra",
        status:    clean(r[staCol]),
        sub_status: clean(r[ssCol]),
        live_date:  parseDate(r[dateCol]),
        ota_id:    clean(r[idCol]),
        pre_post:  clean(r[ppCol]),
      });
    }
    results["Yatra"] = await batchUpsert(sql, records, true);
  } catch (e) { errors.push(`Yatra: ${e}`); }

  // ── 5. Ixigo ──────────────────────────────────────────────────────────────
  try {
    const { cols, rows } = await fetchTab("Ixigo");
    const pidCol  = col(cols, "property_id");
    const staCol  = col(cols, "ixigo status");
    const ssCol   = col(cols, "sub status");
    const dateCol = col(cols, "live date");
    const idCol   = col(cols, "ixigo id");
    const ppCol   = col(cols, "prop set");

    const records: OtaRecord[] = [];
    for (const r of rows) {
      const pid = clean(r[pidCol]);
      if (!pid) continue;
      records.push({
        property_id: pid, ota: "Ixigo",
        status:    clean(r[staCol]),
        sub_status: clean(r[ssCol]),
        live_date:  parseDate(r[dateCol]),
        ota_id:    clean(r[idCol]),
        pre_post:  clean(r[ppCol]),
      });
    }
    results["Ixigo"] = await batchUpsert(sql, records, true);
  } catch (e) { errors.push(`Ixigo: ${e}`); }

  // ── 6. Akbar Travels ──────────────────────────────────────────────────────
  try {
    const { cols, rows } = await fetchTab("Akbar Travels");
    const pidCol  = col(cols, "property_id");
    const staCol  = col(cols, "akt status");
    const ssCol   = col(cols, "sub status");
    const dateCol = col(cols, "akt live date");
    const idCol   = col(cols, "akt_id");
    const ppCol   = col(cols, "prop set");

    const records: OtaRecord[] = [];
    for (const r of rows) {
      const pid = clean(r[pidCol]);
      if (!pid) continue;
      records.push({
        property_id: pid, ota: "Akbar Travels",
        status:    clean(r[staCol]),
        sub_status: clean(r[ssCol]),
        live_date:  parseDate(r[dateCol]),
        ota_id:    clean(r[idCol]),
        pre_post:  clean(r[ppCol]),
      });
    }
    results["Akbar Travels"] = await batchUpsert(sql, records, true);
  } catch (e) { errors.push(`Akbar Travels: ${e}`); }

  // ── 7. Booking.com, Cleartrip, EaseMyTrip (multi-OTA sheet) ───────────────
  try {
    const { cols, rows } = await fetchTab("Booking.com");
    const pidCol = col(cols, "property_id");
    const ppCol  = col(cols, "pre/post");

    const otaMap: { ota: string; idCol: number; statusCol: number }[] = [
      { ota: "Booking.com",   idCol: col(cols, "bdc id"),     statusCol: col(cols, "bdc status")     },
      { ota: "Cleartrip",     idCol: col(cols, "ct id"),      statusCol: col(cols, "ct status")      },
      { ota: "EaseMyTrip",    idCol: col(cols, "emt id"),     statusCol: col(cols, "emt status")     },
    ];

    for (const { ota, idCol, statusCol } of otaMap) {
      const records: OtaRecord[] = [];
      for (const r of rows) {
        const pid = clean(r[pidCol]);
        if (!pid) continue;
        records.push({
          property_id: pid, ota,
          status:    clean(r[statusCol]),
          sub_status: null,           // not in multi-OTA sheet — preserve existing
          live_date:  null,
          ota_id:    clean(r[idCol]),
          pre_post:  clean(r[ppCol]),
        });
      }
      results[ota] = await batchUpsert(sql, records, false); // false = don't overwrite sub_status
    }
  } catch (e) { errors.push(`Multi-OTA (BDC/CT/EMT): ${e}`); }

  const total = Object.values(results).reduce((a, b) => a + b, 0);
  const summary = Object.entries(results).map(([k, v]) => `${k}: ${v}`).join(", ");
  const message = `Synced ${total} OTA listing rows. ${summary}${errors.length ? ` | Errors: ${errors.join("; ")}` : ""}`;

  return Response.json({ ok: errors.length === 0, message, results, errors });
}
