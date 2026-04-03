import { getSql } from "@/lib/db";
import { RNS_OTAS, CHANNEL_TO_OTA, OTA_CHANNELS } from "@/lib/constants";

export async function GET(req: Request) {
  try {
    const sql  = getSql();
    const type = new URL(req.url).searchParams.get("type") ?? "occupied"; // "sold" | "stay" | "occupied"

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
        const canonical = CHANNEL_TO_OTA[row.ota];
        if (!canonical) continue;
        const day = dayMap.get(row.day);
        if (!day) continue;
        // Canonical total
        day[canonical] = (day[canonical] ?? 0) + Number(row.rns);
        // Sub-source value for expand view
        day[`${canonical}.${row.ota}`] = (day[`${canonical}.${row.ota}`] ?? 0) + Number(row.rns);
      }
    };

    if (type === "occupied") {
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
      ...otaMap,
    }));

    return Response.json({ days, otas: RNS_OTAS, groups: OTA_CHANNELS });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
