export async function register() {
  // Only run in Node.js runtime (not edge), and only in the server process
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { default: cron } = await import("node-cron");
  const { getSql } = await import("@/lib/db-postgres");
  const { parseCSV } = await import("@/lib/sheets");
  const { INV_SHEET_ID, INV_SHEET_TAB } = await import("@/lib/constants");

  const COL_MAP: Record<string, string> = {
    "property id":     "property_id",
    "propertyid":      "property_id",
    "property name":   "property_name",
    "propertyname":    "property_name",
    "property city":   "city",
    "city":            "city",
    "fh live date":    "fh_live_date",
    "fhlivedate":      "fh_live_date",
    "fh status":       "fh_status",
    "fhstatus":        "fh_status",
    "pre/post set":    "pre_post_set",
    "prepost set":     "pre_post_set",
    "pre post set":    "pre_post_set",
    "prepostset":      "pre_post_set",
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

  async function syncInventory() {
    console.log("[cron] sync-inventory: starting");
    try {
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
          const dmy = rec.fh_live_date.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
          if (dmy) rec.fh_live_date = `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
        }
        records.push(rec as Rec);
      }

      const sql = getSql();
      let upserted = 0;
      const BATCH = 200;

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

      console.log(`[cron] sync-inventory: done — ${upserted} upserted, ${skipped} skipped`);
    } catch (err) {
      console.error("[cron] sync-inventory error:", err);
    }
  }

  // Run every hour at minute 0
  cron.schedule("0 * * * *", syncInventory);
  console.log("[cron] sync-inventory: scheduled (every hour)");
}
