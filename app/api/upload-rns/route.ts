import { getSql } from "@/lib/db-postgres";
import { parseCSV } from "@/lib/sheets";
import { getSession } from "@/lib/auth";

const COL_MAP: Record<string, string> = {
  // Date
  "date":                  "date",
  "stay date":             "date",
  "sold date":             "date",
  "booking date":          "date",
  "checkin":               "date",      // Axisroom full export
  // Channel
  "channel":               "channel",
  "ota":                   "channel",
  "ota booking source desc": "channel", // Axisroom full export
  // RNS / Revenue
  "rns":                   "rns",
  "room nights":           "rns",
  "room night sold":       "rns",
  "room nights sold":      "rns",
  "revenue":               "revenue",
  "rev":                   "revenue",
  // Property IDs
  "initial property id":   "initial_prop_id",
  "initial prop id":       "initial_prop_id",
  "initial id":            "initial_prop_id",
  "final property id":     "final_prop_id",
  "final prop id":         "final_prop_id",
  "final id":              "final_prop_id",
  "property id":           "final_prop_id",
  // Axisroom full-schema extra columns
  "checkout":              "checkout",
  "booking id":            "booking_id",
  "created at":            "created_at",
  "guest status desc":     "guest_status_desc",
  "booking source desc":   "booking_source_desc",
  "ota booking source":    "ota_booking_source",
  "zone":                  "zone",
};

function normalize(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, " ").trim().replace(/\s+/g, " ");
}

function parseDate(raw: string): string | null {
  if (!raw) return null;
  const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return null;
}

function esc(v: string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}

const BATCH = 500;

export async function POST(req: Request) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "head")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { csv, table } = await req.json();

    if (!csv)   return Response.json({ error: "No CSV content" }, { status: 400 });
    if (!table || !["stay", "sold"].includes(table))
      return Response.json({ error: "table must be 'stay' or 'sold'" }, { status: 400 });

    const { cols, rows } = parseCSV(csv);

    const fieldMap: Record<number, string> = {};
    cols.forEach((col, i) => {
      const key = normalize(col);
      if (COL_MAP[key]) fieldMap[i] = COL_MAP[key];
    });

    if (!Object.values(fieldMap).includes("date"))
      return Response.json({ error: `No date column found. Headers: ${cols.join(", ")}` }, { status: 400 });
    if (!Object.values(fieldMap).includes("channel"))
      return Response.json({ error: `No channel column found. Headers: ${cols.join(", ")}` }, { status: 400 });

    const tableName = table === "stay" ? "stay_rns" : "sold_rns";
    const sql = getSql();
    let upserted = 0;
    let skipped  = 0;

    // Build typed row objects
    type Rec = {
      date: string; channel: string;
      rns: number; revenue: number;
      initId: string; finalId: string;
      bookingId: string | null; createdAt: string | null; checkout: string | null;
      guestStatus: string | null; bookingSource: string | null;
      otaSource: number | null; zone: string | null;
    };
    const records: Rec[] = [];

    for (const row of rows) {
      const rec: Record<string, string | null> = {
        date: null, channel: null, rns: null, revenue: null,
        initial_prop_id: null, final_prop_id: null,
        booking_id: null, created_at: null, checkout: null,
        guest_status_desc: null, booking_source_desc: null,
        ota_booking_source: null, zone: null,
      };
      for (const [i, field] of Object.entries(fieldMap)) {
        rec[field] = row[Number(i)]?.trim() || null;
      }

      const date = parseDate(rec.date ?? "");
      if (!date || !rec.channel) { skipped++; continue; }

      records.push({
        date,
        channel:       rec.channel,
        rns:           parseInt(rec.rns ?? "0") || 0,
        revenue:       parseFloat(rec.revenue ?? "0") || 0,
        initId:        rec.initial_prop_id ?? "",
        finalId:       rec.final_prop_id ?? "",
        bookingId:     rec.booking_id,
        createdAt:     parseDate(rec.created_at ?? ""),
        checkout:      parseDate(rec.checkout ?? ""),
        guestStatus:   rec.guest_status_desc,
        bookingSource: rec.booking_source_desc,
        otaSource:     rec.ota_booking_source ? parseInt(rec.ota_booking_source) || null : null,
        zone:          rec.zone,
      });
    }

    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH);
      const values = batch.map(r =>
        `(${esc(r.date)}::date, ${esc(r.channel)}, ${r.rns}, ${r.revenue}, ${esc(r.initId)}, ${esc(r.finalId)}, ${esc(r.bookingId)}, ${r.createdAt ? `${esc(r.createdAt)}::date` : "NULL"}, ${r.checkout ? `${esc(r.checkout)}::date` : "NULL"}, ${esc(r.guestStatus)}, ${esc(r.bookingSource)}, ${r.otaSource ?? "NULL"}, ${esc(r.zone)}, NOW())`
      ).join(",\n");

      await sql.query(`
        INSERT INTO ${tableName} (checkin, ota_booking_source_desc, rns, rev, initial_property_id, property_id, booking_id, created_at, checkout, guest_status_desc, booking_source_desc, ota_booking_source, zone, synced_at)
        VALUES ${values}
        ON CONFLICT (booking_id) WHERE booking_id IS NOT NULL DO UPDATE SET
          checkin                 = EXCLUDED.checkin,
          ota_booking_source_desc = EXCLUDED.ota_booking_source_desc,
          rns                     = EXCLUDED.rns,
          rev                     = EXCLUDED.rev,
          initial_property_id     = EXCLUDED.initial_property_id,
          property_id             = EXCLUDED.property_id,
          created_at              = EXCLUDED.created_at,
          checkout                = EXCLUDED.checkout,
          guest_status_desc       = EXCLUDED.guest_status_desc,
          booking_source_desc     = EXCLUDED.booking_source_desc,
          ota_booking_source      = EXCLUDED.ota_booking_source,
          zone                    = EXCLUDED.zone,
          synced_at               = NOW()
      `, []);
      upserted += batch.length;
    }

    return Response.json({
      ok: true,
      table: tableName,
      upserted,
      skipped,
      message: `Uploaded ${upserted} rows to ${tableName} (${skipped} skipped — missing date or channel)`,
    });

  } catch (err) {
    console.error("upload-rns error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
