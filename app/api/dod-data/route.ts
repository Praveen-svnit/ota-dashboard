import { getDb } from "@/lib/db";

const OTAS = ["GoMMT", "Booking.com", "Agoda", "Expedia", "Cleartrip", "EaseMyTrip", "Yatra", "Ixigo", "Akbar Travels"];

// DB stores GoMMT as separate channels — map them to canonical OTA names
const DB_TO_OTA: Record<string, string> = {
  "MakeMyTrip":    "GoMMT",
  "Goibibo":       "GoMMT",
  "MyBiz":         "GoMMT",
  "Booking.com":   "Booking.com",
  "Agoda":         "Agoda",
  "Expedia":       "Expedia",
  "Cleartrip":     "Cleartrip",
  "EaseMyTrip":    "EaseMyTrip",
  "Yatra":         "Yatra",
  "Travelguru":    "Yatra",
  "Ixigo":         "Ixigo",
  "Akbar Travels": "Akbar Travels",
};

export async function GET() {
  try {
    const db = getDb();

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

    const populate = (rows: { sold_date: string; ota: string; rns: number }[]) => {
      for (const row of rows) {
        const canonical = DB_TO_OTA[row.ota];
        if (!canonical) continue;
        const day = dayMap.get(row.sold_date);
        if (day) day[canonical] = (day[canonical] ?? 0) + row.rns;
      }
    };

    const soldRows = db.prepare(`
      SELECT sold_date, ota, SUM(rns) as rns
      FROM RnsSold
      WHERE sold_date >= ? AND sold_date <= ?
      GROUP BY sold_date, ota
      ORDER BY sold_date ASC
    `).all(fmt(start), fmt(end)) as { sold_date: string; ota: string; rns: number }[];

    if (soldRows.length > 0) {
      populate(soldRows);
    } else {
      // fallback to RnsStay
      const stayRows = db.prepare(`
        SELECT stay_date as sold_date, ota, SUM(rns) as rns
        FROM RnsStay
        WHERE stay_date >= ? AND stay_date <= ?
        GROUP BY stay_date, ota
        ORDER BY stay_date ASC
      `).all(fmt(start), fmt(end)) as { sold_date: string; ota: string; rns: number }[];
      populate(stayRows);
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
