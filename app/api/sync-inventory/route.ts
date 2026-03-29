import { getSql } from "@/lib/db-postgres";
import { parseCSV, fetchSheet } from "@/lib/sheets";
import { INV_SHEET_ID, INV_SHEET_TAB } from "@/lib/constants";
import { getServerSession } from "@/lib/auth";
import { NextRequest } from "next/server";

// Column header → DB field mapping (case-insensitive, flexible)
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

function normalize(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9/]/g, " ").trim();
}

export async function POST(req: NextRequest) {
  // Allow both authenticated users (admin/head) and internal cron calls
  const session = await getServerSession(req);
  if (session && session.role !== "admin" && session.role !== "head") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (INV_SHEET_ID === "YOUR_INV_SHEET_ID_HERE") {
    return Response.json({ error: "INV_SHEET_ID not configured in lib/constants.ts" }, { status: 500 });
  }

  try {
    // Fetch Inv sheet
    const url = `https://docs.google.com/spreadsheets/d/${INV_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(INV_SHEET_TAB)}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch Inv sheet: ${res.status}`);
    const csv = await res.text();

    const { cols, rows } = parseCSV(csv);

    // Map sheet columns to DB fields
    const fieldMap: Record<number, string> = {};
    cols.forEach((col, i) => {
      const key = normalize(col);
      if (COL_MAP[key]) fieldMap[i] = COL_MAP[key];
    });

    if (!Object.values(fieldMap).includes("property_id")) {
      return Response.json({ error: `Could not find 'Property ID' column. Headers found: ${cols.join(", ")}` }, { status: 400 });
    }

    const sql = getSql();
    let upserted = 0;
    let skipped  = 0;

    for (const row of rows) {
      const record: Record<string, string | null> = {
        property_id:     null,
        property_name:   null,
        city:            null,
        fh_live_date:    null,
        fh_status:       null,
        pre_post_set:    null,
        onboarding_type: null,
        master_id:       null,
      };

      for (const [i, field] of Object.entries(fieldMap)) {
        const val = row[Number(i)]?.trim() || null;
        record[field] = val;
      }

      if (!record.property_id) { skipped++; continue; }

      // Parse date — accept DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
      if (record.fh_live_date) {
        const d = record.fh_live_date;
        const dmy = d.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
        if (dmy) record.fh_live_date = `${dmy[3]}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}`;
      }

      await sql`
        INSERT INTO inventory (property_id, property_name, city, fh_live_date, fh_status, pre_post_set, onboarding_type, master_id, synced_at)
        VALUES (
          ${record.property_id},
          ${record.property_name},
          ${record.city},
          ${record.fh_live_date}::date,
          ${record.fh_status},
          ${record.pre_post_set},
          ${record.onboarding_type},
          ${record.master_id},
          NOW()
        )
        ON CONFLICT (property_id) DO UPDATE SET
          property_name   = EXCLUDED.property_name,
          city            = EXCLUDED.city,
          fh_live_date    = EXCLUDED.fh_live_date,
          fh_status       = EXCLUDED.fh_status,
          pre_post_set    = EXCLUDED.pre_post_set,
          onboarding_type = EXCLUDED.onboarding_type,
          master_id       = EXCLUDED.master_id,
          synced_at       = NOW()
      `;
      upserted++;
    }

    return Response.json({
      ok: true,
      upserted,
      skipped,
      message: `Synced ${upserted} properties (${skipped} skipped — no property ID)`,
    });

  } catch (err) {
    console.error("sync-inventory error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
