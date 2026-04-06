import { getSql } from "@/lib/db";
import { NextRequest } from "next/server";

// Map normalized sub-status labels → lowercase raw DB values for LOWER() comparison
const DENORM_SS: Record<string, string[]> = {
  "Not Live":               ["not live", "others - not live"],
  "Pending at GoMMT":       ["pending at go-mmt"],
  "Pending at Booking.com": ["pending at bdc"],
  "Pending at EaseMyTrip":  ["pending at emt"],
  "Pending at OTA":         ["pending at ota"],
  "Blank":                  ["#n/a", ""],
};

function expandToRaw(labels: string[]): string[] {
  return labels.flatMap(l => DENORM_SS[l] ?? [l.toLowerCase()]);
}

export async function GET(req: NextRequest) {
  try {
    const sql    = getSql();
    const sp     = req.nextUrl.searchParams;
    const page   = Math.max(1, parseInt(sp.get("page") ?? "1",  10));
    const size   = Math.min(100, parseInt(sp.get("size") ?? "50", 10));
    const search   = (sp.get("search")   ?? "").trim();
    const category = (sp.get("category") ?? "").trim(); // "inProcess" | "tatExhausted" | ""
    const otaList  = (sp.get("otas") ?? "").split(",").map(s => s.trim()).filter(Boolean);
    const sssList  = (sp.get("sss")  ?? "").split(",").map(s => s.trim()).filter(Boolean);
    const fhMonth  = (sp.get("fhMonth") ?? "").trim(); // "Mar 2025" → filter by p.fh_live_date month
    const offset   = (page - 1) * size;

    // When fhMonth is set (click-through from Month-wise table) and no explicit category chosen,
    // use the same conditions as overdue-listings API: fh_status=Live + sub_status!='live' (includes exception).
    // This ensures the property count matches exactly what the month table shows.
    const monthMode = !!fhMonth && !category;

    let conditions: string[];
    if (monthMode) {
      conditions = ["LOWER(COALESCE(o.sub_status,'')) != 'live'", "p.fh_status = 'Live'"];
    } else if (category === "live") {
      conditions = ["LOWER(COALESCE(o.sub_status,'')) = 'live'", "p.fh_status IN ('Live','SoldOut')"];
    } else if (category === "exception") {
      conditions = ["LOWER(COALESCE(o.sub_status,'')) = 'exception'", "p.fh_status IN ('Live','SoldOut')"];
    } else if (category === "all") {
      conditions = ["p.fh_status IN ('Live','SoldOut')"];
    } else {
      conditions = ["(LOWER(o.sub_status) != 'live' OR o.sub_status IS NULL)", "LOWER(COALESCE(o.sub_status,'')) != 'exception'", "p.fh_status IN ('Live','SoldOut')"];
      if (category === "inProcess")    conditions.push("o.tat <= 15");
      if (category === "tatExhausted") conditions.push("o.tat > 15");
    }

    const params: unknown[] = [];

    if (search) {
      params.push(`%${search}%`, `%${search}%`);
      conditions.push(`(p.property_name ILIKE $${params.length - 1} OR o.property_id ILIKE $${params.length})`);
    }
    if (otaList.length > 0) {
      params.push(...otaList);
      const placeholders = otaList.map((_, i) => `$${params.length - otaList.length + i + 1}`).join(",");
      conditions.push(`o.ota IN (${placeholders})`);
    }
    if (sssList.length > 0) {
      const rawVals = expandToRaw(sssList);
      params.push(...rawVals);
      const placeholders = rawVals.map((_, i) => `$${params.length - rawVals.length + i + 1}`).join(",");
      conditions.push(`LOWER(COALESCE(o.sub_status,'')) IN (${placeholders})`);
    }
    if (fhMonth) {
      const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const [mon, yr] = fhMonth.split(" ");
      const mi = MONTH_NAMES.indexOf(mon ?? "");
      if (mi >= 0 && yr) {
        const padded = String(mi + 1).padStart(2, "0");
        params.push(`${yr}-${padded}`);
        conditions.push(`TO_CHAR(p.fh_live_date::date, 'YYYY-MM') = $${params.length}`);
      }
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const countQuery = `
      SELECT COUNT(*) AS n
      FROM ota_listing o
      JOIN inventory p ON p.property_id = o.property_id
      ${where}
    `;

    const rowsQuery = `
      SELECT o.property_id AS "propertyId",
             p.property_name AS name,
             p.city,
             p.fh_live_date AS "fhLiveDate",
             o.ota,
             o.status,
             o.sub_status AS "subStatus",
             o.live_date AS "liveDate",
             o.tat,
             o.tat_error AS "tatError"
      FROM ota_listing o
      JOIN inventory p ON p.property_id = o.property_id
      ${where}
      ORDER BY o.tat DESC, p.property_name, o.ota
      LIMIT ${size} OFFSET ${offset}
    `;

    const [countRows, rows] = await Promise.all([
      sql.query(countQuery, params),
      sql.query(rowsQuery, params),
    ]);

    const total = Number((countRows as { n: string | number }[])[0]?.n ?? 0);

    return Response.json({ rows, total, page, size, pages: Math.ceil(total / size) });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
