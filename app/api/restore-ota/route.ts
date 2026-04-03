import { getDb } from "@/lib/db";
import { SHEET_ID } from "@/lib/constants";
import { parseCSV } from "@/lib/sheets";

const OTA_TABS = [
  { tab: "GoMMT",         ota: "GoMMT",         propIdRx: /^listing.?property.?id$/i, idCol: "go-mmt id",       statusCol: "mmt shell status", subStCol: "sub status", liveDateCol: "property live date on go-mmt" },
  { tab: "BDC",           ota: "Booking.com",   propIdRx: /^property.?id$/i,          idCol: "bdc id",          statusCol: "bdc status",       subStCol: "sub status", liveDateCol: "bdc listing date" },
  { tab: "Agoda",         ota: "Agoda",         propIdRx: /^property.?id$/i,          idCol: "agoda id",        statusCol: "agoda status",     subStCol: "sub status", liveDateCol: "agoda live date" },
  { tab: "EMT",           ota: "EaseMyTrip",    propIdRx: /^fh.?id$/i,                idCol: "emt shl id",      statusCol: "emt status",       subStCol: "sub status", liveDateCol: "emt live date" },
  { tab: "Clear Trip",    ota: "Cleartrip",     propIdRx: /^(fh.?id|property.?id)$/i, idCol: "ct hid",          statusCol: "ct status",        subStCol: "sub status", liveDateCol: "ct live date" },
  { tab: "Expedia",       ota: "Expedia",       propIdRx: /^fh.?id$/i,                idCol: "expedia id",      statusRx: /^expedia\s+status/i, subStCol: "sub status", liveDateRx: /^expedia\s+live\s+date/i },
  { tab: "Yatra",         ota: "Yatra",         propIdRx: /^property.?id$/i,          idCol: "vid",             statusCol: "yatra status",     subStCol: "sub status", liveDateCol: "live date" },
  { tab: "Akbar Travels", ota: "Akbar Travels", propIdRx: /^property.?id$/i,          idCol: "akt_id",          statusCol: "akt status",       subStCol: "sub status", liveDateCol: "akt live date" },
  { tab: "Ixigo",         ota: "Ixigo",         propIdRx: /^property.?id$/i,          idCol: "ixigo id",        statusCol: "ixigo status",     subStCol: "sub status", liveDateCol: "live date" },
];

function ci(cols: string[], name: string): number {
  return cols.findIndex((c) => c.trim().toLowerCase() === name.toLowerCase());
}
function ciRx(cols: string[], rx: RegExp): number {
  return cols.findIndex((c) => rx.test(c.trim()));
}
function col(row: string[], i: number): string {
  return i >= 0 ? (row[i] ?? "").trim() : "";
}

function parseDate(v: string | null | undefined): string | null {
  if (!v?.trim() || ["—", "#n/a", "#ref!", ""].includes(v.trim().toLowerCase())) return null;
  const s = v.trim();
  if (/^\d{5}$/.test(s)) {
    const n = parseInt(s, 10);
    if (n > 36526 && n < 73050) {
      return new Date(Date.UTC(1899, 11, 30) + n * 86400000).toISOString().slice(0, 10);
    }
    return null;
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  const yr = d.getUTCFullYear();
  if (yr < 1990 || yr > 2100) return null;
  return d.toISOString().slice(0, 10);
}

function calcTAT(fhLiveDate: string | null, otaLiveDate: string | null): { tat: number; tatError: number } {
  if (!fhLiveDate) return { tat: 0, tatError: 0 };
  const fh = new Date(fhLiveDate);
  if (isNaN(fh.getTime())) return { tat: 0, tatError: 0 };
  const ota = otaLiveDate ? new Date(otaLiveDate) : new Date();
  if (isNaN(ota.getTime())) return { tat: 0, tatError: 0 };
  const days = Math.round((ota.getTime() - fh.getTime()) / 86400000);
  if (days < 0) return { tat: 0, tatError: 1 };
  if (days === 0 && otaLiveDate) return { tat: 0, tatError: 3 };
  return { tat: days, tatError: 0 };
}

async function fetchSheet(sheetId: string, tab: string) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch "${tab}": HTTP ${res.status}`);
  return res.text();
}

export async function POST() {
  try {
    const db  = getDb();
    const now = new Date().toISOString();

    const propMap = new Map<string, string | null>();
    const props = db.prepare("SELECT id, fhLiveDate FROM Property").all() as { id: string; fhLiveDate: string | null }[];
    for (const p of props) propMap.set(p.id, p.fhLiveDate);

    const insert = db.prepare(`
      INSERT INTO OtaListing (propertyId, ota, otaId, status, subStatus, liveDate, fhLiveDate, tat, tatError, syncedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    db.exec("DELETE FROM OtaListing");

    let totalInserted = 0;
    for (const cfg of OTA_TABS) {
      const csv = await fetchSheet(SHEET_ID, cfg.tab);
      const { cols, rows } = parseCSV(csv);

      const pIdx  = ciRx(cols, cfg.propIdRx);
      const oiIdx = ci(cols, cfg.idCol);
      const stIdx = cfg.statusRx ? ciRx(cols, cfg.statusRx) : ci(cols, cfg.statusCol);
      const ssIdx = ci(cols, cfg.subStCol);
      const ldIdx = cfg.liveDateRx ? ciRx(cols, cfg.liveDateRx) : ci(cols, cfg.liveDateCol);

      if (pIdx < 0) continue;

      let inserted = 0;
      for (const row of rows) {
        const propId    = col(row, pIdx);
        if (!propId) continue;
        const otaId     = col(row, oiIdx) || null;
        const status    = col(row, stIdx) || null;
        const subStatus = col(row, ssIdx) || null;
        const liveDate  = ldIdx >= 0 ? parseDate(row[ldIdx]) : null;

        if (!otaId && !status && !subStatus && !liveDate) continue;

        const fhLiveDate = propMap.get(propId) || null;
        let { tat, tatError } = calcTAT(fhLiveDate, liveDate);
        if (subStatus?.trim().toLowerCase() !== "live") tatError = 2;

        insert.run(propId, cfg.ota, otaId, status, subStatus, liveDate, fhLiveDate, tat, tatError, now);
        inserted++;
      }
      totalInserted += inserted;
    }

    return Response.json({ ok: true, rowsInserted: totalInserted, syncedAt: now });
  } catch (err: unknown) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
