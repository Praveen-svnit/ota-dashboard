import { getDb } from "@/lib/db";

// Same channel → OTA grouping used in dod-data
const DB_TO_OTA: Record<string, string> = {
  "MakeMyTrip": "GoMMT", "Goibibo": "GoMMT", "MyBiz": "GoMMT",
  "Booking.com": "Booking.com", "Agoda": "Agoda", "Expedia": "Expedia",
  "Cleartrip": "Cleartrip", "EaseMyTrip": "EaseMyTrip",
  "Yatra": "Yatra", "Travelguru": "Yatra",
  "Ixigo": "Ixigo", "Akbar Travels": "Akbar Travels",
};

export async function GET() {
  try {
    const db = getDb();

    const end   = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 29);
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    // All 30 dates
    const dates: string[] = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(fmt(d));
    }

    // Get city per property
    const props = db.prepare(`
      SELECT id, city FROM Property WHERE city IS NOT NULL AND city != ''
    `).all() as { id: string; city: string }[];
    const propCity = new Map(props.map((p) => [p.id, p.city]));

    // Get latest OTA listing per property to map property → canonical OTA
    const listings = db.prepare(`
      SELECT propertyId, ota FROM OtaListing
    `).all() as { propertyId: string; ota: string }[];

    // RnsSold: join by ota channel, but we need property-level data
    // RnsSold doesn't have propertyId — use RnsStay which might, or use city from Property via OtaListing
    // Actually RnsSold only has (sold_date, ota, rns) — no property link
    // We need to use a different approach: aggregate by city using Property.city
    // Since RnsSold has no property link, we estimate city share proportionally from property counts

    // Better: use RnsStay which also lacks property link
    // The only way to get city-level data is via the listing tracker / property table
    // For now: distribute total OTA RNs proportionally by city's live property count for that OTA

    // Get live property count per city
    const liveCounts = db.prepare(`
      SELECT p.city, ol.ota, COUNT(*) as cnt
      FROM OtaListing ol
      JOIN Property p ON p.id = ol.propertyId
      WHERE ol.subStatus = 'Live' AND p.city IS NOT NULL AND p.city != ''
      GROUP BY p.city, ol.ota
    `).all() as { city: string; ota: string; cnt: number }[];

    // Total live per OTA
    const otaTotalLive: Record<string, number> = {};
    for (const r of liveCounts) {
      const canonical = DB_TO_OTA[r.ota] ?? r.ota;
      otaTotalLive[canonical] = (otaTotalLive[canonical] ?? 0) + r.cnt;
    }

    // City share per canonical OTA
    const cityOtaShare: Record<string, Record<string, number>> = {}; // city → ota → share(0-1)
    for (const r of liveCounts) {
      const canonical = DB_TO_OTA[r.ota] ?? r.ota;
      const total     = otaTotalLive[canonical] ?? 1;
      if (!cityOtaShare[r.city]) cityOtaShare[r.city] = {};
      cityOtaShare[r.city][canonical] = (cityOtaShare[r.city][canonical] ?? 0) + r.cnt / total;
    }

    // Daily RNs per canonical OTA
    const soldRows = db.prepare(`
      SELECT sold_date, ota, SUM(rns) as rns
      FROM RnsSold
      WHERE sold_date >= ? AND sold_date <= ?
      GROUP BY sold_date, ota
    `).all(fmt(start), fmt(end)) as { sold_date: string; ota: string; rns: number }[];

    // canonical OTA daily totals
    const otaDayRns: Record<string, Record<string, number>> = {}; // date → canonicalOta → rns
    for (const r of soldRows) {
      const canonical = DB_TO_OTA[r.ota];
      if (!canonical) continue;
      if (!otaDayRns[r.sold_date]) otaDayRns[r.sold_date] = {};
      otaDayRns[r.sold_date][canonical] = (otaDayRns[r.sold_date][canonical] ?? 0) + r.rns;
    }

    // Cities sorted by total live properties
    const cityCounts: Record<string, number> = {};
    for (const r of liveCounts) {
      cityCounts[r.city] = (cityCounts[r.city] ?? 0) + r.cnt;
    }
    const cities = Object.keys(cityOtaShare).sort((a, b) => (cityCounts[b] ?? 0) - (cityCounts[a] ?? 0));

    // Build city-ota-day RNs: city → ota → date → rns
    const OTAS = ["GoMMT","Booking.com","Agoda","Expedia","Cleartrip","EaseMyTrip","Yatra","Ixigo","Akbar Travels"];
    const cityOtaDayRns: Record<string, Record<string, Record<string, number>>> = {};
    for (const city of cities) {
      cityOtaDayRns[city] = {};
      for (const ota of OTAS) {
        cityOtaDayRns[city][ota] = {};
        const share = cityOtaShare[city]?.[ota] ?? 0;
        for (const date of dates) {
          const otaTotal = otaDayRns[date]?.[ota] ?? 0;
          cityOtaDayRns[city][ota][date] = Math.round(otaTotal * share);
        }
      }
    }

    return Response.json({ cities, dates, cityOtaDayRns, otas: OTAS });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
