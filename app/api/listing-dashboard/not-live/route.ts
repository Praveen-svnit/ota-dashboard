import { getDb } from "@/lib/db";
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
    const db     = getDb();
    const sp     = req.nextUrl.searchParams;
    const page   = Math.max(1, parseInt(sp.get("page") ?? "1",  10));
    const size   = Math.min(100, parseInt(sp.get("size") ?? "50", 10));
    const search   = (sp.get("search")   ?? "").trim();
    const category = (sp.get("category") ?? "").trim(); // "inProcess" | "tatExhausted" | ""
    const otaList  = (sp.get("otas") ?? "").split(",").map(s => s.trim()).filter(Boolean);
    const sssList  = (sp.get("sss")  ?? "").split(",").map(s => s.trim()).filter(Boolean);
    const fhMonth  = (sp.get("fhMonth") ?? "").trim(); // "Mar 2025" → filter p.fhLiveDate LIKE '2025-03-%'
    const offset   = (page - 1) * size;

    // When fhMonth is set (click-through from Month-wise table) and no explicit category chosen,
    // use the same conditions as overdue-listings API: fhStatus=Live + subStatus!='live' (includes exception).
    // This ensures the property count matches exactly what the month table shows.
    const monthMode = !!fhMonth && !category;

    let conditions: string[];
    if (monthMode) {
      conditions = ["LOWER(COALESCE(o.subStatus,'')) != 'live'", "p.fhStatus = 'Live'"];
    } else if (category === "live") {
      conditions = ["LOWER(COALESCE(o.subStatus,'')) = 'live'"];
    } else if (category === "exception") {
      conditions = ["LOWER(COALESCE(o.subStatus,'')) = 'exception'"];
    } else if (category === "all") {
      conditions = [];
    } else {
      conditions = ["(LOWER(o.subStatus) != 'live' OR o.subStatus IS NULL)", "LOWER(COALESCE(o.subStatus,'')) != 'exception'"];
      if (category === "inProcess")    conditions.push("o.tat <= 15");
      if (category === "tatExhausted") conditions.push("o.tat > 15");
    }

    const params: (string | number)[] = [];

    if (search) {
      conditions.push("(p.name LIKE ? OR o.propertyId LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }
    if (otaList.length > 0) {
      conditions.push(`o.ota IN (${otaList.map(() => "?").join(",")})`);
      params.push(...otaList);
    }
    if (sssList.length > 0) {
      const rawVals = expandToRaw(sssList);
      conditions.push(`LOWER(COALESCE(o.subStatus,'')) IN (${rawVals.map(() => "?").join(",")})`);
      params.push(...rawVals);
    }
    if (fhMonth) {
      const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
      const [mon, yr] = fhMonth.split(" ");
      const mi = MONTH_NAMES.indexOf(mon ?? "");
      if (mi >= 0 && yr) {
        conditions.push(`p.fhLiveDate LIKE ?`);
        params.push(`${yr}-${String(mi + 1).padStart(2, "0")}-%`);
      }
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const total = (db.prepare(`
      SELECT COUNT(*) as n FROM OtaListing o
      JOIN Property p ON p.id = o.propertyId
      ${where}
    `).get(...params) as { n: number }).n;

    const rows = db.prepare(`
      SELECT o.propertyId, p.name, p.city, p.fhLiveDate,
             o.ota, o.status, o.subStatus, o.liveDate, o.tat, o.tatError
      FROM OtaListing o
      JOIN Property p ON p.id = o.propertyId
      ${where}
      ORDER BY o.tat DESC, p.name, o.ota
      LIMIT ? OFFSET ?
    `).all(...params, size, offset);

    return Response.json({ rows, total, page, size, pages: Math.ceil(total / size) });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
