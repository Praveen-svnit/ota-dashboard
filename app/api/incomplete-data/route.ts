import { getDb } from "@/lib/db";

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
    const db = getDb();

    const count = (db.prepare("SELECT COUNT(*) as n FROM Property").get() as { n: number }).n;
    if (count === 0) {
      return Response.json({ error: "No data — click Sync to DB in the topbar first" });
    }

    const rows = db.prepare(`
      SELECT p.id, p.name, p.city, o.ota, o.otaId, o.status, o.subStatus, o.liveDate, o.tatError
      FROM Property p
      JOIN OtaListing o ON o.propertyId = p.id
      WHERE (
        -- live listings: otaId, status, or liveDate missing
        (LOWER(COALESCE(o.subStatus,'')) = 'live'
          AND (o.otaId IS NULL OR o.status IS NULL OR o.liveDate IS NULL))
        OR
        -- not-live listings: status or subStatus missing
        (LOWER(COALESCE(o.subStatus,'')) != 'live'
          AND (o.status IS NULL OR o.subStatus IS NULL))
        OR
        -- TAT data errors: negative TAT
        o.tatError = 1
      )
      ORDER BY p.name, o.ota
    `).all() as Array<{
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

      if (row.tatError === 1) missing.push("Neg. TAT");

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
        tatError:  row.tatError,
        missing,
      });
    }

    return Response.json({ rows: out });

  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
