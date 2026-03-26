import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "@/lib/db";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });

const SYSTEM_PROMPT = `You are OTA Guru, a senior data analytics consultant with 20+ years of experience in the hospitality and travel industry, specialising in OTA (Online Travel Agency) performance analytics, revenue management, and distribution strategy.

Your background:
- Ex-VP Revenue Analytics at a major hotel chain (15 years)
- Consulted for 50+ hotel groups across India on OTA optimisation
- Deep expertise in GoMMT (MakeMyTrip + Goibibo), Booking.com, Agoda, Expedia, and other OTA platforms
- Expert in Room Night (RN) metrics, TAT (Turn Around Time), MTD/LM comparisons, and listing performance
- You understand the Indian hotel distribution market deeply

Your communication style:
- Direct, data-driven, and actionable — no fluff
- Highlight anomalies, trends, and opportunities proactively
- Use industry benchmarks to contextualise numbers
- Flag risks and missed opportunities clearly
- Give prioritised recommendations (P1/P2/P3)
- Comfortable with abbreviations: RN = Room Nights, MTD = Month to Date, LM = Last Month, DoD = Day on Day, TAT = Turn Around Time, OTA = Online Travel Agency, FH = FabHotels, BDC = Booking.com

When analysing data:
1. First identify what is performing well vs. underperforming
2. Spot month-on-month or day-on-day trends
3. Compare against expected benchmarks
4. Provide specific, actionable recommendations
5. Flag any data anomalies or missing data that needs attention

You have access to live production dashboard data provided in each message. Always reference specific numbers from the data in your analysis.`;

function buildDataContext(dbData: Record<string, unknown>): string {
  return `
## Current Production Dashboard Data (as of today)

### OTA Status — Live vs Not Live
${JSON.stringify(dbData.otaStatus ?? [], null, 2)}

### RNS Monthly (Stay-based, current & last 3 months)
${JSON.stringify(dbData.rnsMonthly ?? {}, null, 2)}

### MTD Listings (New properties listed this month)
${JSON.stringify(dbData.mtdListings ?? [], null, 2)}

### FabHotels Platform KPIs
- FH Live Properties: ${dbData.fhLiveCount ?? "N/A"}
- Total Properties: ${dbData.fhTotalProps ?? "N/A"}
- Sold Out: ${dbData.fhSoldOutCount ?? "N/A"}
- Onboarded This Month: ${dbData.fhOnboardedThisMonth ?? "N/A"}
- Avg RNs/Day (CM): ${dbData.rnsPerDayCmAvg ?? "N/A"}

### Day-on-Day RNs — Last 30 Days (sample: last 7 days)
${JSON.stringify(dbData.dodSample ?? {}, null, 2)}
`.trim();
}

async function fetchDashboardContext() {
  try {
    const db = getDb();

    // OTA status from DB
    const otaRows = db.prepare(`
      SELECT ota,
        SUM(CASE WHEN subStatus = 'Live' THEN 1 ELSE 0 END) as live,
        SUM(CASE WHEN subStatus != 'Live' THEN 1 ELSE 0 END) as notLive
      FROM OtaListing
      WHERE ota IN ('GoMMT','Booking.com','Agoda','Expedia','Cleartrip','EaseMyTrip','Yatra','Ixigo','Akbar Travels')
      GROUP BY ota
    `).all() as { ota: string; live: number; notLive: number }[];

    // FH KPIs
    const fhLive = (db.prepare(`SELECT COUNT(*) as n FROM Property WHERE fhStatus='Live'`).get() as { n: number }).n;
    const fhTotal = (db.prepare(`SELECT COUNT(*) as n FROM Property`).get() as { n: number }).n;
    const fhSoldOut = (db.prepare(`SELECT COUNT(*) as n FROM Property WHERE fhStatus='Sold Out' OR fhStatus='SoldOut'`).get() as { n: number }).n;

    // DoD last 7 days
    const DB_TO_OTA: Record<string, string> = {
      "MakeMyTrip": "GoMMT", "Goibibo": "GoMMT", "MyBiz": "GoMMT",
      "Booking.com": "Booking.com", "Agoda": "Agoda", "Expedia": "Expedia",
      "Cleartrip": "Cleartrip", "EaseMyTrip": "EaseMyTrip",
      "Yatra": "Yatra", "Travelguru": "Yatra",
      "Ixigo": "Ixigo", "Akbar Travels": "Akbar Travels",
    };

    const end = new Date();
    const start = new Date(); start.setDate(end.getDate() - 6);
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    const dodRows = db.prepare(`
      SELECT sold_date, ota, SUM(rns) as rns
      FROM RnsSold
      WHERE sold_date >= ? AND sold_date <= ?
      GROUP BY sold_date, ota
    `).all(fmt(start), fmt(end)) as { sold_date: string; ota: string; rns: number }[];

    const dodMap: Record<string, Record<string, number>> = {};
    for (const r of dodRows) {
      const canonical = DB_TO_OTA[r.ota]; if (!canonical) continue;
      if (!dodMap[r.sold_date]) dodMap[r.sold_date] = {};
      dodMap[r.sold_date][canonical] = (dodMap[r.sold_date][canonical] ?? 0) + r.rns;
    }

    // RNS monthly totals from RnsSold
    const now = new Date();
    const months: string[] = [];
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mn = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()];
      months.push(`${mn}-${String(d.getFullYear()).slice(-2)}`);
    }

    const rnsMonthly: Record<string, Record<string, number>> = {};
    for (const monthLabel of months) {
      const [mon, yr] = monthLabel.split("-");
      const mnIdx = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"].indexOf(mon ?? "");
      const year = 2000 + parseInt(yr ?? "0");
      const mStart = new Date(year, mnIdx, 1);
      const mEnd = new Date(year, mnIdx + 1, 0);
      const rows = db.prepare(`
        SELECT ota, SUM(rns) as rns FROM RnsSold
        WHERE sold_date >= ? AND sold_date <= ? GROUP BY ota
      `).all(fmt(mStart), fmt(mEnd)) as { ota: string; rns: number }[];
      rnsMonthly[monthLabel] = {};
      for (const r of rows) {
        const canonical = DB_TO_OTA[r.ota]; if (!canonical) continue;
        rnsMonthly[monthLabel][canonical] = (rnsMonthly[monthLabel][canonical] ?? 0) + r.rns;
      }
    }

    return {
      otaStatus: otaRows,
      fhLiveCount: fhLive,
      fhTotalProps: fhTotal,
      fhSoldOutCount: fhSoldOut,
      fhOnboardedThisMonth: null,
      rnsPerDayCmAvg: null,
      rnsMonthly,
      mtdListings: [],
      dodSample: dodMap,
    };
  } catch {
    return {};
  }
}

export async function POST(req: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY is not set. Add it to your .env file." }), { status: 500 });
    }

    const body = await req.json();
    const messages: Anthropic.MessageParam[] = body.messages ?? [];

    if (!messages.length) {
      return new Response(JSON.stringify({ error: "No messages provided" }), { status: 400 });
    }

    // Fetch live dashboard data and inject as system context
    const dbData = await fetchDashboardContext();
    const dataContext = buildDataContext(dbData);

    const systemWithData = `${SYSTEM_PROMPT}\n\n---\n\n${dataContext}`;

    const stream = client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemWithData,
      messages,
    });

    // Return a ReadableStream for SSE
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const chunk = JSON.stringify({ text: event.delta.text });
              controller.enqueue(new TextEncoder().encode(`data: ${chunk}\n\n`));
            }
          }
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Stream error";
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500 }
    );
  }
}
