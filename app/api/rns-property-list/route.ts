import { getSql } from "@/lib/db";
import { CHANNEL_TO_OTA } from "@/lib/constants";

const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmt = (d: Date) => d.toISOString().split("T")[0];

export async function GET(req: Request) {
  try {
    const sql  = getSql();
    const url  = new URL(req.url);
    const type = url.searchParams.get("type") ?? "final"; // "initial" | "final"

    const now     = new Date();
    const cmYear  = now.getFullYear();
    const cmMonth = now.getMonth();   // 0-based
    const cmDay   = now.getDate();

    const lmDate  = new Date(cmYear, cmMonth - 1, 1);
    const lmYear  = lmDate.getFullYear();
    const lmMonth = lmDate.getMonth();

    const cmStart = fmt(new Date(cmYear, cmMonth, 1));
    const cmEnd   = fmt(now);
    const lmStart = fmt(new Date(lmYear, lmMonth, 1));
    // LM up to same day-of-month as today (day < cmDay → day <= cmDay-1)
    const lmEnd   = cmDay > 1
      ? fmt(new Date(lmYear, lmMonth, cmDay - 1))
      : fmt(new Date(lmYear, lmMonth, 1));

    // propRns[propId][canonicalOta] = { cm, lm }
    const propRns: Record<string, Record<string, { cm: number; lm: number }>> = {};

    const populate = (rows: { prop_id: string; ota: string; cm: number; lm: number }[]) => {
      for (const row of rows) {
        const canonical = CHANNEL_TO_OTA[row.ota];
        if (!canonical || !row.prop_id) continue;
        propRns[row.prop_id]            ??= {};
        propRns[row.prop_id][canonical] ??= { cm: 0, lm: 0 };
        propRns[row.prop_id][canonical].cm += Number(row.cm);
        propRns[row.prop_id][canonical].lm += Number(row.lm);
      }
    };

    if (type === "initial") {
      const rows = await sql`
        SELECT
          initial_property_id AS prop_id,
          ota_booking_source_desc AS ota,
          SUM(CASE WHEN checkin >= ${cmStart}::date AND checkin <= ${cmEnd}::date THEN rns ELSE 0 END) AS cm,
          SUM(CASE WHEN checkin >= ${lmStart}::date AND checkin <= ${lmEnd}::date THEN rns ELSE 0 END) AS lm
        FROM stay_rns
        WHERE guest_status_desc IN ('Checkin', 'Checkout')
          AND checkin >= ${lmStart}::date
          AND checkin <= ${cmEnd}::date
        GROUP BY initial_property_id, ota_booking_source_desc
      ` as { prop_id: string; ota: string; cm: number; lm: number }[];
      populate(rows);
    } else {
      const rows = await sql`
        SELECT
          property_id AS prop_id,
          ota_booking_source_desc AS ota,
          SUM(CASE WHEN checkin >= ${cmStart}::date AND checkin <= ${cmEnd}::date THEN rns ELSE 0 END) AS cm,
          SUM(CASE WHEN checkin >= ${lmStart}::date AND checkin <= ${lmEnd}::date THEN rns ELSE 0 END) AS lm
        FROM stay_rns
        WHERE guest_status_desc IN ('Checkin', 'Checkout')
          AND checkin >= ${lmStart}::date
          AND checkin <= ${cmEnd}::date
        GROUP BY property_id, ota_booking_source_desc
      ` as { prop_id: string; ota: string; cm: number; lm: number }[];
      populate(rows);
    }

    // Master ID rollup: for each property with a master_id, add master's RNs into the child
    const masterRows = await sql`
      SELECT property_id, master_id FROM inventory
      WHERE master_id IS NOT NULL AND master_id <> ''
    ` as { property_id: string; master_id: string }[];

    for (const { property_id, master_id } of masterRows) {
      const masterData = propRns[master_id];
      if (!masterData) continue;
      propRns[property_id] ??= {};
      for (const [ota, vals] of Object.entries(masterData)) {
        propRns[property_id][ota] ??= { cm: 0, lm: 0 };
        propRns[property_id][ota].cm += vals.cm;
        propRns[property_id][ota].lm += vals.lm;
      }
    }

    const properties = Object.entries(propRns).map(([id, otas]) => ({ id, otas }));

    return Response.json({
      month:      `${MN[cmMonth]}-${String(cmYear).slice(-2)}`,
      lmMonth:    `${MN[lmMonth]}-${String(lmYear).slice(-2)}`,
      properties,
    });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
