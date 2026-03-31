import { getSql } from "@/lib/db";

export async function GET() {
  try {
    const sql = getSql();

    const count = Number((await sql`SELECT COUNT(*) AS n FROM gmb_tracker`)[0].n);
    if (count === 0) {
      return Response.json({ empty: true, rows: [], stats: { total: 0, gmbLive: 0, gmbNotLive: 0, fhLive: 0, preset: 0, postset: 0, avgRating: null } });
    }

    const rows = await sql`
      SELECT
        property_id         AS "propertyId",
        property_name       AS "propertyName",
        city,
        created_at          AS "createdAt",
        fh_status           AS "fhStatus",
        pre_post            AS "prePost",
        gmb_status          AS "gmbStatus",
        gmb_sub_status      AS "gmbSubStatus",
        listing_type        AS "listingType",
        number,
        review_link_tracker AS "reviewLinkTracker",
        gmb_rating          AS "gmbRating",
        gmb_review_count    AS "gmbReviewCount"
      FROM gmb_tracker
      ORDER BY property_name ASC
    `;

    const statsRow = await sql`
      SELECT
        COUNT(*)                                                          AS total,
        SUM(CASE WHEN LOWER(gmb_status) = 'live'     THEN 1 ELSE 0 END) AS "gmbLive",
        SUM(CASE WHEN LOWER(gmb_status) != 'live'    THEN 1 ELSE 0 END) AS "gmbNotLive",
        SUM(CASE WHEN LOWER(fh_status)  = 'live'     THEN 1 ELSE 0 END) AS "fhLive",
        SUM(CASE WHEN LOWER(pre_post)   = 'preset'   THEN 1 ELSE 0 END) AS preset,
        SUM(CASE WHEN LOWER(pre_post)   = 'postset'  THEN 1 ELSE 0 END) AS postset,
        ROUND(AVG(gmb_rating::NUMERIC) FILTER (WHERE gmb_rating ~ '^[0-9.]+$'), 2) AS "avgRating"
      FROM gmb_tracker
    `;

    const s = statsRow[0];
    const stats = {
      total:      Number(s.total),
      gmbLive:    Number(s.gmbLive),
      gmbNotLive: Number(s.gmbNotLive),
      fhLive:     Number(s.fhLive),
      preset:     Number(s.preset),
      postset:    Number(s.postset),
      avgRating:  s.avgRating != null ? Number(s.avgRating) : null,
    };

    return Response.json({ rows, stats });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
