import { getSql } from "@/lib/db-postgres";
import { parseCSV } from "@/lib/sheets";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";

const COL_MAP: Record<string, string> = {
  "date":                 "date",
  "stay date":            "date",
  "sold date":            "date",
  "booking date":         "date",
  "channel":              "channel",
  "ota":                  "channel",
  "rns":                  "rns",
  "room nights":          "rns",
  "room night sold":      "rns",
  "room nights sold":     "rns",
  "revenue":              "revenue",
  "rev":                  "revenue",
  "initial property id":  "initial_prop_id",
  "initial prop id":      "initial_prop_id",
  "initial_prop_id":      "initial_prop_id",
  "initial id":           "initial_prop_id",
  "final property id":    "final_prop_id",
  "final prop id":        "final_prop_id",
  "final_prop_id":        "final_prop_id",
  "final id":             "final_prop_id",
  "property id":          "final_prop_id",
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

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || (session.role !== "admin" && session.role !== "head")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file     = formData.get("file") as File | null;
    const table    = formData.get("table") as string | null;

    if (!file)  return Response.json({ error: "No file uploaded" }, { status: 400 });
    if (!table || !["stay", "sold"].includes(table))
      return Response.json({ error: "table must be 'stay' or 'sold'" }, { status: 400 });

    const csv = await file.text();
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

    const sql = getSql();
    let upserted = 0;
    let skipped  = 0;

    for (const row of rows) {
      const rec: Record<string, string | null> = {
        date: null, channel: null, rns: null, revenue: null,
        initial_prop_id: null, final_prop_id: null,
      };
      for (const [i, field] of Object.entries(fieldMap)) {
        rec[field] = row[Number(i)]?.trim() || null;
      }

      const date = parseDate(rec.date ?? "");
      if (!date || !rec.channel) { skipped++; continue; }

      const rns     = parseInt(rec.rns ?? "0") || 0;
      const revenue = parseFloat(rec.revenue ?? "0") || 0;
      const initId  = rec.initial_prop_id ?? "";
      const finalId = rec.final_prop_id ?? "";

      if (table === "stay") {
        await sql`
          INSERT INTO stay_rns (date, channel, rns, revenue, initial_prop_id, final_prop_id, synced_at)
          VALUES (${date}::date, ${rec.channel}, ${rns}, ${revenue}, ${initId}, ${finalId}, NOW())
          ON CONFLICT (date, channel, initial_prop_id, final_prop_id) DO UPDATE SET
            rns = EXCLUDED.rns, revenue = EXCLUDED.revenue, synced_at = NOW()
        `;
      } else {
        await sql`
          INSERT INTO sold_rns (date, channel, rns, revenue, initial_prop_id, final_prop_id, synced_at)
          VALUES (${date}::date, ${rec.channel}, ${rns}, ${revenue}, ${initId}, ${finalId}, NOW())
          ON CONFLICT (date, channel, initial_prop_id, final_prop_id) DO UPDATE SET
            rns = EXCLUDED.rns, revenue = EXCLUDED.revenue, synced_at = NOW()
        `;
      }
      upserted++;
    }

    const tableName = table === "stay" ? "stay_rns" : "sold_rns";
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
