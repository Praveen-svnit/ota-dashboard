import { getSql } from "@/lib/db";

const OTAS = ["GoMMT", "Booking.com", "Agoda", "Expedia", "Cleartrip", "EaseMyTrip", "Yatra", "Ixigo", "Akbar Travels"];

// DB OTA name → canonical OTA name
// "Goibibo / MMT" is the combined MakeMyTrip+Goibibo channel in the DB
// "AgodaYCS" is what the DB calls Agoda's channel manager bookings
const DB_TO_OTA: Record<string, string> = {
  "MakeMyTrip":    "GoMMT",
  "Goibibo":       "GoMMT",
  "Goibibo / MMT": "GoMMT",
  "MyBiz":         "GoMMT",
  "Booking.com":   "Booking.com",
  "Agoda":         "Agoda",
  "AgodaYCS":      "Agoda",
  "AgodaB2B":      "Agoda",
  "Expedia":       "Expedia",
  "Cleartrip":     "Cleartrip",
  "EaseMyTrip":    "EaseMyTrip",
  "Yatra":         "Yatra",
  "YatraB2B":      "Yatra",
  "Travelguru":    "Yatra",
  "Ixigo":         "Ixigo",
  "ixigo":         "Ixigo",
  "Akbar Travels": "Akbar Travels",
  "AkbarTravel":   "Akbar Travels",
};

export async function GET(req: Request) {
  try {
    const sql  = getSql();
    const type = new URL(req.url).searchParams.get("type") ?? "sold"; // "sold" | "stay" | "occupied"

    const end   = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 29);
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    // Build day map
    const dayMap = new Map<string, Record<string, number>>();
    for (let i = 0; i < 30; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dayMap.set(fmt(d), {});
    }

    const populate = (rows: { day: string; ota: string; rns: number }[]) => {
      for (const row of rows) {
        const canonical = DB_TO_OTA[row.ota];
        if (!canonical) continue;
        const day = dayMap.get(row.day);
        if (day) day[canonical] = (day[canonical] ?? 0) + Number(row.rns);
      }
    };

    if (type === "occupied") {
      // Occupied: 1 RN per booking per day it spans (checkin inclusive, checkout exclusive)
      // A guest checking in Mar 31 and out Apr 5 contributes 1 RN to each of Mar 31–Apr 4
      const rows = await sql`
        SELECT
          d::date::text AS day,
          ota_booking_source_desc AS ota,
          ROUND(SUM(rns::numeric / NULLIF(checkout::date - checkin::date, 0))) AS rns
        FROM stay_rns,
          LATERAL generate_series(checkin::date, checkout::date - 1, '1 day'::interval) d
        WHERE guest_status_desc IN ('Checkin', 'Checkout')
          AND checkin <= ${fmt(end)}::date
          AND checkout  > ${fmt(start)}::date
          AND d::date  >= ${fmt(start)}::date
          AND d::date  <= ${fmt(end)}::date
        GROUP BY d::date, ota_booking_source_desc
        ORDER BY d::date ASC
      ` as { day: string; ota: string; rns: number }[];
      populate(rows);
    } else if (type === "stay") {
      // Stay: guests checking in on each day
      const rows = await sql`
        SELECT checkin::text AS day, ota_booking_source_desc AS ota, SUM(rns) AS rns
        FROM stay_rns
        WHERE checkin >= ${fmt(start)} AND checkin <= ${fmt(end)}
          AND guest_status_desc IN ('Checkin', 'Checkout')
        GROUP BY checkin, ota_booking_source_desc
        ORDER BY checkin ASC
      ` as { day: string; ota: string; rns: number }[];
      populate(rows);
    } else {
      // Sold: bookings created on each day — from sold_rns table
      const rows = await sql`
        SELECT created_at::text AS day, ota_booking_source_desc AS ota, SUM(rns) AS rns
        FROM sold_rns
        WHERE created_at >= ${fmt(start)} AND created_at <= ${fmt(end)}
          AND guest_status_desc IN ('Checkin', 'Checkout')
        GROUP BY created_at, ota_booking_source_desc
        ORDER BY created_at ASC
      ` as { day: string; ota: string; rns: number }[];
      populate(rows);
    }

    const days = Array.from(dayMap.entries()).map(([date, otaMap]) => ({
      date,
      ...Object.fromEntries(OTAS.map((o) => [o, otaMap[o] ?? 0])),
    }));

    return Response.json({ days, otas: OTAS });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
