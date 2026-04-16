import { getSql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const ota = searchParams.get("ota");
  if (!ota) return Response.json({ error: "Missing ota param" }, { status: 400 });

  const sql = getSql();
  const rows = await sql.query(
    `SELECT DISTINCT status FROM ota_listing
     WHERE ota = $1 AND status IS NOT NULL AND status <> ''
     ORDER BY status`,
    [ota]
  ) as { status: string }[];

  return Response.json({ statuses: rows.map(r => r.status) });
}
