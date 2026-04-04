import { getSql } from "@/lib/db";
import { CHANNEL_TO_OTA, RNS_OTAS } from "@/lib/constants";

const fmt = (d: Date) => d.toISOString().split("T")[0];

export async function GET(req: Request) {
  try {
    const sql    = getSql();
    const url    = new URL(req.url);
    const type   = url.searchParams.get("type") ?? "occupied"; // "sold" | "stay" | "occupied"
    const month  = url.searchParams.get("month") ?? "";        // "YYYY-MM" or "" for last 30 days

    let start: Date, end: Date;
    if (month) {
      const [y, m] = month.split("-").map(Number);
      start = new Date(y, m - 1, 1);
      end   = new Date(y, m, 0); // last day of month
    } else {
      end   = new Date();
      start = new Date();
      start.setDate(end.getDate() - 29);
    }

    // Build date list
    const dateList: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dateList.push(fmt(new Date(d)));
    }

    // cityOtaDayRns[city][ota][date] = rns
    const cityOtaDayRns: Record<string, Record<string, Record<string, number>>> = {};

    const populate = (rows: { day: string; city: string; ota: string; rns: number }[]) => {
      for (const row of rows) {
        const canonical = CHANNEL_TO_OTA[row.ota];
        if (!canonical || !row.city) continue;
        const city = row.city.trim();
        cityOtaDayRns[city]            ??= {};
        cityOtaDayRns[city][canonical] ??= {};
        cityOtaDayRns[city][canonical][row.day] =
          (cityOtaDayRns[city][canonical][row.day] ?? 0) + Number(row.rns);
      }
    };

    if (type === "occupied") {
      const rows = await sql`
        SELECT
          d::date::text        AS day,
          i.city               AS city,
          s.ota_booking_source_desc AS ota,
          ROUND(SUM(s.rns::numeric / NULLIF(s.checkout::date - s.checkin::date, 0))) AS rns
        FROM stay_rns s
        JOIN inventory i ON i.property_id = s.property_id,
          LATERAL generate_series(s.checkin::date, s.checkout::date - 1, '1 day'::interval) d
        WHERE s.guest_status_desc IN ('Checkin', 'Checkout')
          AND i.city IS NOT NULL AND i.city <> ''
          AND s.checkin  <= ${fmt(end)}::date
          AND s.checkout >  ${fmt(start)}::date
          AND d::date    >= ${fmt(start)}::date
          AND d::date    <= ${fmt(end)}::date
        GROUP BY d::date, i.city, s.ota_booking_source_desc
        ORDER BY d::date ASC
      ` as { day: string; city: string; ota: string; rns: number }[];
      populate(rows);
    } else if (type === "stay") {
      const rows = await sql`
        SELECT s.checkin::text AS day, i.city AS city, s.ota_booking_source_desc AS ota, SUM(s.rns) AS rns
        FROM stay_rns s
        JOIN inventory i ON i.property_id = s.property_id
        WHERE s.guest_status_desc IN ('Checkin', 'Checkout')
          AND i.city IS NOT NULL AND i.city <> ''
          AND s.checkin >= ${fmt(start)}::date
          AND s.checkin <= ${fmt(end)}::date
        GROUP BY s.checkin, i.city, s.ota_booking_source_desc
        ORDER BY s.checkin ASC
      ` as { day: string; city: string; ota: string; rns: number }[];
      populate(rows);
    } else {
      const rows = await sql`
        SELECT r.created_at::text AS day, i.city AS city, r.ota_booking_source_desc AS ota, SUM(r.rns) AS rns
        FROM sold_rns r
        JOIN inventory i ON i.property_id = r.property_id
        WHERE r.guest_status_desc IN ('Checkin', 'Checkout')
          AND i.city IS NOT NULL AND i.city <> ''
          AND r.created_at >= ${fmt(start)}::date
          AND r.created_at <= ${fmt(end)}::date
        GROUP BY r.created_at, i.city, r.ota_booking_source_desc
        ORDER BY r.created_at ASC
      ` as { day: string; city: string; ota: string; rns: number }[];
      populate(rows);
    }

    const cities = Object.keys(cityOtaDayRns).sort();

    return Response.json({ cities, dates: dateList, cityOtaDayRns, otas: RNS_OTAS });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
