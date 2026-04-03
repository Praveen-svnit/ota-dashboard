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
          d::date::text AS day,
          zone          AS city,
          ota_booking_source_desc AS ota,
          ROUND(SUM(rns::numeric / NULLIF(checkout::date - checkin::date, 0))) AS rns
        FROM stay_rns,
          LATERAL generate_series(checkin::date, checkout::date - 1, '1 day'::interval) d
        WHERE guest_status_desc IN ('Checkin', 'Checkout')
          AND checkin  <= ${fmt(end)}::date
          AND checkout >  ${fmt(start)}::date
          AND d::date  >= ${fmt(start)}::date
          AND d::date  <= ${fmt(end)}::date
        GROUP BY d::date, zone, ota_booking_source_desc
        ORDER BY d::date ASC
      ` as { day: string; city: string; ota: string; rns: number }[];
      populate(rows);
    } else if (type === "stay") {
      const rows = await sql`
        SELECT checkin::text AS day, zone AS city, ota_booking_source_desc AS ota, SUM(rns) AS rns
        FROM stay_rns
        WHERE guest_status_desc IN ('Checkin', 'Checkout')
          AND checkin >= ${fmt(start)}::date
          AND checkin <= ${fmt(end)}::date
        GROUP BY checkin, zone, ota_booking_source_desc
        ORDER BY checkin ASC
      ` as { day: string; city: string; ota: string; rns: number }[];
      populate(rows);
    } else {
      const rows = await sql`
        SELECT created_at::text AS day, zone AS city, ota_booking_source_desc AS ota, SUM(rns) AS rns
        FROM sold_rns
        WHERE guest_status_desc IN ('Checkin', 'Checkout')
          AND created_at >= ${fmt(start)}::date
          AND created_at <= ${fmt(end)}::date
        GROUP BY created_at, zone, ota_booking_source_desc
        ORDER BY created_at ASC
      ` as { day: string; city: string; ota: string; rns: number }[];
      populate(rows);
    }

    const cities = Object.keys(cityOtaDayRns).sort();

    return Response.json({ cities, dates: dateList, cityOtaDayRns, otas: RNS_OTAS });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
