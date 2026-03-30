import { getSql } from "@/lib/db";

export interface IncompleteRow {
  fhId:      string;
  name:      string;
  city:      string;
  ota:       string;
  otaId:     string | null;
  status:    string | null;
  subStatus: string | null;
  liveDate:  string | null;
  tatError:  number;
  missing:   string[];
}

export async function GET() {
  try {
    const sql = getSql();

    const countRows = await sql`SELECT COUNT(*) as n FROM inventory`;
    const count = Number((countRows[0] as { n: number }).n);
    if (count === 0) {
      return Response.json({ error: "No data — click Sync to DB in the topbar first" });
    }

    const rows = await sql`
      SELECT
        p.property_id AS id,
        p.property_name AS name,
        p.city,
        ol.ota,
        ol.ota_id AS "otaId",
        ol.status,
        ol.sub_status AS "subStatus",
        ol.live_date AS "liveDate",
        ol.tat_error AS "tatError"
      FROM inventory p
      JOIN ota_listing ol ON ol.property_id = p.property_id
      WHERE (
        -- live listings: otaId, status, or liveDate missing
        (LOWER(COALESCE(ol.sub_status,'')) = 'live'
          AND (ol.ota_id IS NULL OR ol.status IS NULL OR ol.live_date IS NULL))
        OR
        -- not-live listings: status or subStatus missing
        (LOWER(COALESCE(ol.sub_status,'')) != 'live'
          AND (ol.status IS NULL OR ol.sub_status IS NULL))
        OR
        -- TAT data errors: negative TAT
        ol.tat_error = 1
      )
      ORDER BY p.property_name, ol.ota
    ` as Array<{
      id: string; name: string; city: string | null;
      ota: string; otaId: string | null; status: string | null;
      subStatus: string | null; liveDate: string | null; tatError: number;
    }>;

    const out: IncompleteRow[] = [];
    for (const row of rows) {
      const isLive = row.subStatus?.toLowerCase() === "live";
      const missing: string[] = [];

      if (isLive) {
        if (!row.otaId)    missing.push("OTA ID");
        if (!row.status)   missing.push("Status");
        if (!row.liveDate) missing.push("Live Date");
      } else {
        if (!row.status)    missing.push("Status");
        if (!row.subStatus) missing.push("Sub Status");
      }

      if (Number(row.tatError) === 1) missing.push("Neg. TAT");

      if (missing.length === 0) continue;

      out.push({
        fhId:      row.id,
        name:      row.name || "—",
        city:      row.city || "",
        ota:       row.ota,
        otaId:     row.otaId,
        status:    row.status,
        subStatus: row.subStatus,
        liveDate:  row.liveDate,
        tatError:  Number(row.tatError),
        missing,
      });
    }

    return Response.json({ rows: out });

  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
