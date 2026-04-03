import { getSql } from "@/lib/db";
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
    const sql = getSql();
    const now = new Date();

    const count = Number((await sql`SELECT COUNT(*) AS n FROM inventory`)[0].n);
    if (count === 0) {
      return Response.json({ error: "No data — click Sync to DB in the topbar first" });
    }

    const firstOfMon = firstOfMonth(now);
    const EXCEPTION_OTAS = ["Ixigo", "Akbar Travels"];

    const { labels: dodLabels, dates: refDates } = dodWindow(now);
    const cutoff15 = refDates[0];

    const l12mCutoff = new Date(now);
    l12mCutoff.setMonth(l12mCutoff.getMonth() - 11);
    const l12mCutoffStr = `${l12mCutoff.getFullYear()}-${String(l12mCutoff.getMonth() + 1).padStart(2, "0")}-01`;

    // Run all independent queries in parallel
    const [
      fhLiveRows,
      otaRows,
      dodRows,
      tatCountRows,
      rtglRows,
      tatMonthlyRows,
      tatRows,
      dodFullRows,
    ] = await Promise.all([
      sql`
        SELECT COUNT(*) AS n FROM inventory WHERE LOWER(fh_status) IN ('live', 'soldout')
      ` as Promise<Array<{ n: number }>>,

      sql`
        SELECT ol.ota,
          SUM(CASE WHEN LOWER(ol.sub_status) = 'live' THEN 1 ELSE 0 END) AS "otaLiveCnt",
          SUM(CASE WHEN LOWER(ol.sub_status) = 'live' THEN 1 ELSE 0 END) AS "trackerLiveCnt",
          SUM(CASE WHEN ol.live_date IS NOT NULL AND ol.live_date::date >= ${firstOfMon}::date THEN 1 ELSE 0 END) AS "trackerMtdCnt",
          SUM(CASE WHEN LOWER(ol.sub_status) IN ('live', 'ready to go live') THEN 1 ELSE 0 END) AS "adjustedLiveCnt"
        FROM ota_listing ol
        JOIN inventory inv ON inv.property_id = ol.property_id
        WHERE LOWER(inv.fh_status) IN ('live', 'soldout')
        GROUP BY ol.ota
      ` as Promise<Array<{ ota: string; otaLiveCnt: number; trackerLiveCnt: number; trackerMtdCnt: number; adjustedLiveCnt: number }>>,

      sql`
        SELECT ota, live_date::date AS d, COUNT(*) AS cnt
        FROM ota_listing
        WHERE live_date IS NOT NULL AND live_date::date >= ${cutoff15}::date
        GROUP BY ota, live_date::date
      ` as Promise<Array<{ ota: string; d: string; cnt: number }>>,

      sql`
        SELECT ol.ota,
          SUM(CASE WHEN LOWER(ol.sub_status) = 'live' AND ol.tat <= 15 AND ol.tat_error = 0 THEN 1 ELSE 0 END) AS "inTatCnt",
          SUM(CASE WHEN LOWER(ol.sub_status) = 'live' AND ol.tat > 15 THEN 1 ELSE 0 END) AS "afterTatCnt",
          ROUND(AVG(CASE WHEN LOWER(ol.sub_status) = 'live' AND ol.tat_error = 0 THEN ol.tat END)) AS "avgTat"
        FROM ota_listing ol
        JOIN inventory inv ON inv.property_id = ol.property_id
        WHERE LOWER(inv.fh_status) IN ('live', 'soldout')
        GROUP BY ol.ota
      ` as Promise<Array<{ ota: string; inTatCnt: number; afterTatCnt: number; avgTat: number | null }>>,

      sql`
        SELECT ol.ota, COUNT(*) AS cnt
        FROM ota_listing ol
        WHERE LOWER(ol.status) IN ('ready to go live', 'ready to go live ')
        GROUP BY ol.ota
      ` as Promise<Array<{ ota: string; cnt: number }>>,

      sql`
        SELECT ol.ota,
          TO_CHAR(ol.live_date::date, 'YYYY-MM') AS month,
          SUM(CASE WHEN ol.tat <= 15 AND ol.tat_error = 0 THEN 1 ELSE 0 END) AS "inTatCnt",
          SUM(CASE WHEN ol.tat > 15 THEN 1 ELSE 0 END) AS "afterTatCnt"
        FROM ota_listing ol
        JOIN inventory inv ON inv.property_id = ol.property_id
        WHERE LOWER(inv.fh_status) IN ('live', 'soldout')
          AND ol.live_date IS NOT NULL
          AND ol.live_date::date >= ${l12mCutoffStr}::date
        GROUP BY ol.ota, TO_CHAR(ol.live_date::date, 'YYYY-MM')
      ` as Promise<Array<{ ota: string; month: string; inTatCnt: number; afterTatCnt: number }>>,

      sql`
        SELECT ol.ota,
          ROUND(AVG((ol.live_date::date - inv.fh_live_date::date))) AS "avgTat"
        FROM ota_listing ol
        JOIN inventory inv ON inv.property_id = ol.property_id
        WHERE ol.live_date IS NOT NULL AND inv.fh_live_date IS NOT NULL
          AND ol.live_date::date >= inv.fh_live_date::date
        GROUP BY ol.ota
      ` as Promise<Array<{ ota: string; avgTat: number | null }>>,

      sql`
        SELECT ota, live_date::date AS d, COUNT(*) AS cnt
        FROM ota_listing
        WHERE live_date IS NOT NULL AND live_date::date >= ${l12mCutoffStr}::date
        GROUP BY ota, live_date::date
      ` as Promise<Array<{ ota: string; d: string; cnt: number }>>,
    ]);

    const fhLive = Number(fhLiveRows[0].n);

    const otaLive:         Record<string, number> = {};
    const adjustedOtaLive: Record<string, number> = {};
    const trackerLive:     Record<string, number> = {};
    const trackerMtd:      Record<string, number> = {};
    for (const ota of OTAS) { otaLive[ota] = 0; adjustedOtaLive[ota] = 0; trackerLive[ota] = 0; trackerMtd[ota] = 0; }
    for (const r of otaRows) {
      otaLive[r.ota]          = Number(r.otaLiveCnt);
      adjustedOtaLive[r.ota]  = EXCEPTION_OTAS.includes(r.ota) ? Number(r.adjustedLiveCnt) : Number(r.otaLiveCnt);
      trackerLive[r.ota]      = Number(r.trackerLiveCnt);
      trackerMtd[r.ota]       = Number(r.trackerMtdCnt);
    }

    const dodByOta: Record<string, number[]> = {};
    for (const ota of OTAS) dodByOta[ota] = new Array(15).fill(0);
    for (const row of dodRows) {
      const d = typeof row.d === "string" ? row.d : (row.d as Date).toISOString().slice(0, 10);
      const idx = refDates.indexOf(d);
      if (idx !== -1 && dodByOta[row.ota]) dodByOta[row.ota][idx] = Number(row.cnt);
    }

    const tatCounts: Record<string, { inTat: number; afterTat: number; avgTat: number | null }> = {};
    for (const ota of OTAS) tatCounts[ota] = { inTat: 0, afterTat: 0, avgTat: null };
    for (const r of tatCountRows) {
      tatCounts[r.ota] = {
        inTat: Number(r.inTatCnt),
        afterTat: Number(r.afterTatCnt),
        avgTat: r.avgTat !== null ? Math.round(Number(r.avgTat)) : null,
      };
    }

    const rtglCounts: Record<string, number> = {};
    for (const r of rtglRows) rtglCounts[r.ota] = Number(r.cnt);

    const tatMonthly: Record<string, Record<string, { inTat: number; afterTat: number }>> = {};
    for (const ota of OTAS) tatMonthly[ota] = {};
    for (const r of tatMonthlyRows) {
      if (!tatMonthly[r.ota]) tatMonthly[r.ota] = {};
      tatMonthly[r.ota][r.month] = { inTat: Number(r.inTatCnt), afterTat: Number(r.afterTatCnt) };
    }

    const tatByOta: Record<string, number | null> = {};
    for (const ota of OTAS) tatByOta[ota] = null;
    for (const row of tatRows) {
      tatByOta[row.ota] = row.avgTat !== null ? Math.round(Number(row.avgTat)) : null;
    }

    const dodFull: Record<string, Record<string, number>> = {};
    for (const r of dodFullRows) {
      const d = typeof r.d === "string" ? r.d : (r.d as Date).toISOString().slice(0, 10);
      if (!dodFull[r.ota]) dodFull[r.ota] = {};
      dodFull[r.ota][d] = Number(r.cnt);
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
