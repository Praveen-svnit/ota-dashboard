import { getSql } from "@/lib/db-postgres";
import { parseCSV } from "@/lib/sheets";
import { INV_SHEET_ID, INV_SHEET_TAB } from "@/lib/constants";
import { getSession } from "@/lib/auth";

const COL_MAP: Record<string, string> = {
  "property id":     "property_id",
  "propertyid":      "property_id",
  "property name":   "property_name",
  "propertyname":    "property_name",
  "property city":   "city",
  "city":            "city",
  "fh live date":    "fh_live_date",
  "fhlivedate":      "fh_live_date",
  "created at":      "fh_live_date",
  "createdat":       "fh_live_date",
  "fh status":       "fh_status",
  "fhstatus":        "fh_status",
  "status":          "fh_status",
  "pre/post set":    "pre_post_set",
  "prepost set":     "pre_post_set",
  "pre post set":    "pre_post_set",
  "prepostset":      "pre_post_set",
  "pre/post":        "pre_post_set",
  "prepost":         "pre_post_set",
  "onboarding type": "onboarding_type",
  "onboardingtype":  "onboarding_type",
  "master id":       "master_id",
  "masterid":        "master_id",
};

function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9/]/g, " ").trim();
}

function escVal(v: string | null): string {
  if (v === null || v === undefined) return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}

const BATCH = 200;

async function runSync() {
  if (INV_SHEET_ID === "YOUR_INV_SHEET_ID_HERE") {
    throw new Error("INV_SHEET_ID not configured in lib/constants.ts");
  }

  const url = `https://docs.google.com/spreadsheets/d/${INV_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(INV_SHEET_TAB)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch Inv sheet: ${res.status}`);
  const csv = await res.text();

  const { cols, rows } = parseCSV(csv);

  const fieldMap: Record<number, string> = {};
  cols.forEach((col, i) => {
    const key = normalizeHeader(col);
    if (COL_MAP[key]) fieldMap[i] = COL_MAP[key];
  });

  if (!Object.values(fieldMap).includes("property_id")) {
    throw new Error(`Could not find 'Property ID' column. Headers: ${cols.join(", ")}`);
  }

  type Rec = { property_id: string; property_name: string | null; city: string | null; fh_live_date: string | null; fh_status: string | null; pre_post_set: string | null; onboarding_type: string | null; master_id: string | null };
  const records: Rec[] = [];
  let skipped = 0;

  for (const row of rows) {
    const rec: Record<string, string | null> = { property_id: null, property_name: null, city: null, fh_live_date: null, fh_status: null, pre_post_set: null, onboarding_type: null, master_id: null };
    for (const [i, field] of Object.entries(fieldMap)) {
      rec[field] = row[Number(i)]?.trim() || null;
    }
    if (!rec.property_id) { skipped++; continue; }
    if (rec.fh_live_date) {
      const mdy = rec.fh_live_date.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (mdy) rec.fh_live_date = `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
    }
    records.push(rec as Rec);
  }

  const sql = getSql();
  let upserted = 0;

  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const valClauses = batch.map(r =>
      `(${escVal(r.property_id)}, ${escVal(r.property_name)}, ${escVal(r.city)}, ${r.fh_live_date ? `${escVal(r.fh_live_date)}::date` : "NULL"}, ${escVal(r.fh_status)}, ${escVal(r.pre_post_set)}, ${escVal(r.onboarding_type)}, ${escVal(r.master_id)})`
    ).join(",\n");

    await sql.query(`
      INSERT INTO inventory (property_id, property_name, city, fh_live_date, fh_status, pre_post_set, onboarding_type, master_id)
      VALUES ${valClauses}
      ON CONFLICT (property_id) DO UPDATE SET
        property_name   = EXCLUDED.property_name,
        city            = EXCLUDED.city,
        fh_live_date    = COALESCE(EXCLUDED.fh_live_date,    inventory.fh_live_date),
        fh_status       = COALESCE(EXCLUDED.fh_status,       inventory.fh_status),
        pre_post_set    = COALESCE(EXCLUDED.pre_post_set,     inventory.pre_post_set),
        onboarding_type = COALESCE(EXCLUDED.onboarding_type,  inventory.onboarding_type),
        master_id       = COALESCE(EXCLUDED.master_id,        inventory.master_id),
        synced_at       = NOW()
    `, []);
    upserted += batch.length;
  }

  // Bootstrap new properties — insert "New" status for all OTAs if no ota_listing row exists yet
  const OTA_LIST = ["GoMMT","Agoda","Expedia","Yatra","Ixigo","Akbar Travels","Booking.com","Cleartrip","EaseMyTrip","Indigo"];
  const allIds = records.map(r => r.property_id);

  for (let i = 0; i < allIds.length; i += BATCH) {
    const chunk = allIds.slice(i, i + BATCH);
    const placeholders = chunk.map((_, j) => `$${j + 1}`).join(", ");
    const existing = await sql.query(
      `SELECT DISTINCT property_id FROM ota_listing WHERE property_id IN (${placeholders})`,
      chunk
    ) as { property_id: string }[];
    const existingSet = new Set(existing.map(r => r.property_id));
    const newIds = chunk.filter(id => !existingSet.has(id));

    if (newIds.length > 0) {
      const bootstrapVals = newIds.flatMap(pid =>
        OTA_LIST.map(ota => `(${escVal(pid)}, ${escVal(ota)}, 'New', 'New', NOW())`)
      ).join(",\n");
      await sql.query(`
        INSERT INTO ota_listing (property_id, ota, status, sub_status, synced_at)
        VALUES ${bootstrapVals}
        ON CONFLICT (property_id, ota) DO NOTHING
      `, []);
    }
  }

  // Debug: show column mapping and first few date samples
  const fhLiveDateIdx = Object.entries(fieldMap).find(([, v]) => v === "fh_live_date")?.[0];
  const dateSamples = records.slice(0, 5).map(r => r.fh_live_date);
  const debug = {
    headers: cols,
    fieldMap,
    fhLiveDateColumnIndex: fhLiveDateIdx ?? "NOT FOUND",
    dateSamples,
    withDate: records.filter(r => r.fh_live_date !== null).length,
    withoutDate: records.filter(r => r.fh_live_date === null).length,
  };

  return { upserted, skipped, debug };
}

// Manual trigger — admin/head only
export async function POST() {
  const session = await getSession();
  if (session && session.role !== "admin" && session.role !== "head") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { upserted, skipped, debug } = await runSync();
    return Response.json({
      ok: true,
      upserted,
      skipped,
      message: `Synced ${upserted} properties (${skipped} skipped — no property ID)`,
      debug,
    });
  } catch (err) {
    console.error("sync-inventory error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

