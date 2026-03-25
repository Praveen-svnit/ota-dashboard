import { getDb } from "@/lib/db";
import { OTAS } from "@/lib/constants";

function firstOfMonth(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function dodWindow(now: Date): { labels: string[]; dates: string[] } {
  const labels: string[] = [];
  const dates: string[] = [];
  for (let i = 14; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
    dates.push(d.toISOString().slice(0, 10));
  }
  return { labels, dates };
}

export async function GET() {
  try {
    const db  = getDb();
    const now = new Date();

    const count = (db.prepare("SELECT COUNT(*) as n FROM Property").get() as { n: number }).n;
    if (count === 0) {
      return Response.json({ error: "No data — click Sync to DB in the topbar first" });
    }

    // FH live count — Live + SoldOut (active properties)
    const fhLive = (
      db.prepare("SELECT COUNT(*) as n FROM Property WHERE LOWER(fhStatus) IN ('live', 'soldout')").get() as { n: number }
    ).n;

    const firstOfMon = firstOfMonth(now);

    // Exception OTAs: count 'ready to go live' as live (OTAs not yet formally signed)
    const EXCEPTION_OTAS = ["Ixigo", "Akbar Travels"];

    // Per-OTA metrics — only for active FH properties, using subStatus='live' as canonical signal
    const otaRows = db.prepare(`
      SELECT o.ota,
        SUM(CASE WHEN LOWER(o.subStatus) = 'live' THEN 1 ELSE 0 END) AS otaLiveCnt,
        SUM(CASE WHEN LOWER(o.subStatus) = 'live' THEN 1 ELSE 0 END) AS trackerLiveCnt,
        SUM(CASE WHEN o.liveDate IS NOT NULL AND o.liveDate >= ? THEN 1 ELSE 0 END) AS trackerMtdCnt,
        SUM(CASE WHEN LOWER(o.subStatus) IN ('live', 'ready to go live') THEN 1 ELSE 0 END) AS adjustedLiveCnt
      FROM OtaListing o
      JOIN Property p ON p.id = o.propertyId
      WHERE LOWER(p.fhStatus) IN ('live', 'soldout')
      GROUP BY o.ota
    `).all(firstOfMon) as Array<{
      ota: string; otaLiveCnt: number; trackerLiveCnt: number; trackerMtdCnt: number; adjustedLiveCnt: number;
    }>;

    const otaLive:         Record<string, number> = {};
    const adjustedOtaLive: Record<string, number> = {};
    const trackerLive:     Record<string, number> = {};
    const trackerMtd:      Record<string, number> = {};
    for (const ota of OTAS) { otaLive[ota] = 0; adjustedOtaLive[ota] = 0; trackerLive[ota] = 0; trackerMtd[ota] = 0; }
    for (const r of otaRows) {
      otaLive[r.ota]          = r.otaLiveCnt;
      adjustedOtaLive[r.ota]  = EXCEPTION_OTAS.includes(r.ota) ? r.adjustedLiveCnt : r.otaLiveCnt;
      trackerLive[r.ota]      = r.trackerLiveCnt;
      trackerMtd[r.ota]       = r.trackerMtdCnt;
    }

    // DoD — last 15 days per OTA
    const { labels: dodLabels, dates: refDates } = dodWindow(now);
    const cutoff15 = refDates[0];

    const dodRows = db.prepare(`
      SELECT ota, DATE(liveDate) AS d, COUNT(*) AS cnt
      FROM OtaListing
      WHERE liveDate IS NOT NULL AND DATE(liveDate) >= ?
      GROUP BY ota, DATE(liveDate)
    `).all(cutoff15) as Array<{ ota: string; d: string; cnt: number }>;

    const dodByOta: Record<string, number[]> = {};
    for (const ota of OTAS) dodByOta[ota] = new Array(15).fill(0);
    for (const row of dodRows) {
      const idx = refDates.indexOf(row.d);
      if (idx !== -1 && dodByOta[row.ota]) dodByOta[row.ota][idx] = row.cnt;
    }

    // In-TAT / After-TAT counts + avg TAT per OTA (threshold = 15 days, live listings only)
    const tatCountRows = db.prepare(`
      SELECT o.ota,
        SUM(CASE WHEN LOWER(o.subStatus) = 'live' AND o.tat <= 15 AND o.tatError = 0 THEN 1 ELSE 0 END) AS inTatCnt,
        SUM(CASE WHEN LOWER(o.subStatus) = 'live' AND o.tat > 15 THEN 1 ELSE 0 END) AS afterTatCnt,
        ROUND(AVG(CASE WHEN LOWER(o.subStatus) = 'live' AND o.tatError = 0 THEN o.tat END)) AS avgTat
      FROM OtaListing o
      JOIN Property p ON p.id = o.propertyId
      WHERE LOWER(p.fhStatus) IN ('live', 'soldout')
      GROUP BY o.ota
    `).all() as Array<{ ota: string; inTatCnt: number; afterTatCnt: number; avgTat: number | null }>;

    const tatCounts: Record<string, { inTat: number; afterTat: number; avgTat: number | null }> = {};
    for (const ota of OTAS) tatCounts[ota] = { inTat: 0, afterTat: 0, avgTat: null };
    for (const r of tatCountRows) {
      tatCounts[r.ota] = { inTat: r.inTatCnt, afterTat: r.afterTatCnt, avgTat: r.avgTat ?? null };
    }

    // Ready-to-go-live count per OTA (no fhStatus filter — RTGL can predate FH live)
    const rtglRows = db.prepare(`
      SELECT o.ota, COUNT(*) AS cnt
      FROM OtaListing o
      WHERE LOWER(o.status) IN ('ready to go live', 'ready to go live ')
      GROUP BY o.ota
    `).all() as Array<{ ota: string; cnt: number }>;

    const rtglCounts: Record<string, number> = {};
    for (const r of rtglRows) rtglCounts[r.ota] = r.cnt;

    // Monthly in-TAT / after-TAT breakdown per OTA (L12M)
    const l12mCutoff = new Date(now);
    l12mCutoff.setMonth(l12mCutoff.getMonth() - 11);
    const l12mCutoffStr = `${l12mCutoff.getFullYear()}-${String(l12mCutoff.getMonth() + 1).padStart(2, "0")}-01`;

    const tatMonthlyRows = db.prepare(`
      SELECT o.ota,
        strftime('%Y-%m', o.liveDate) AS month,
        SUM(CASE WHEN o.tat <= 15 AND o.tatError = 0 THEN 1 ELSE 0 END) AS inTatCnt,
        SUM(CASE WHEN o.tat > 15 THEN 1 ELSE 0 END) AS afterTatCnt
      FROM OtaListing o
      JOIN Property p ON p.id = o.propertyId
      WHERE LOWER(p.fhStatus) IN ('live', 'soldout')
        AND o.liveDate IS NOT NULL
        AND o.liveDate >= ?
      GROUP BY o.ota, strftime('%Y-%m', o.liveDate)
    `).all(l12mCutoffStr) as Array<{ ota: string; month: string; inTatCnt: number; afterTatCnt: number }>;

    const tatMonthly: Record<string, Record<string, { inTat: number; afterTat: number }>> = {};
    for (const ota of OTAS) tatMonthly[ota] = {};
    for (const r of tatMonthlyRows) {
      if (!tatMonthly[r.ota]) tatMonthly[r.ota] = {};
      tatMonthly[r.ota][r.month] = { inTat: r.inTatCnt, afterTat: r.afterTatCnt };
    }

    // TAT per OTA
    const tatRows = db.prepare(`
      SELECT o.ota,
        ROUND(AVG(julianday(o.liveDate) - julianday(p.fhLiveDate))) AS avgTat
      FROM OtaListing o
      JOIN Property p ON p.id = o.propertyId
      WHERE o.liveDate IS NOT NULL AND p.fhLiveDate IS NOT NULL
        AND julianday(o.liveDate) >= julianday(p.fhLiveDate)
      GROUP BY o.ota
    `).all() as Array<{ ota: string; avgTat: number | null }>;

    const tatByOta: Record<string, number | null> = {};
    for (const ota of OTAS) tatByOta[ota] = null;
    for (const row of tatRows) {
      tatByOta[row.ota] = row.avgTat !== null ? Math.round(row.avgTat) : null;
    }

    // Full daily DOD for L12M — used for month×day matrix in individual tab
    const dodFullRows = db.prepare(`
      SELECT ota, DATE(liveDate) AS d, COUNT(*) AS cnt
      FROM OtaListing
      WHERE liveDate IS NOT NULL AND liveDate >= ?
      GROUP BY ota, DATE(liveDate)
    `).all(l12mCutoffStr) as Array<{ ota: string; d: string; cnt: number }>;

    const dodFull: Record<string, Record<string, number>> = {};
    for (const r of dodFullRows) {
      if (!dodFull[r.ota]) dodFull[r.ota] = {};
      dodFull[r.ota][r.d] = r.cnt;
    }

    return Response.json({
      fhLive,
      otaLive,
      adjustedOtaLive,
      trackerMtd,
      trackerLive,
      tatCounts,
      tatMonthly,
      rtglCounts,
      dodFull,
      dod: { labels: dodLabels, byOta: dodByOta },
      tatByOta,
      fhColFound: "fhLiveDate",
    });

  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
