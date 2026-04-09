import { getSql } from "@/lib/db-postgres";
import { headers } from "next/headers";

// Internal endpoint — only callable from middleware (x-internal header)
export async function POST(req: Request) {
  const hdrs = await headers();
  if (hdrs.get("x-internal") !== "1") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { hash } = await req.json() as { hash: string };
  if (!hash) return Response.json({ valid: false });

  const sql = getSql();
  const rows = await sql`
    SELECT id FROM api_keys
    WHERE key_hash = ${hash} AND revoked = FALSE
    LIMIT 1
  `;

  if (rows.length > 0) {
    // Update last_used async (don't await — keep response fast)
    sql`UPDATE api_keys SET last_used = NOW() WHERE key_hash = ${hash}`.catch(() => {});
    return Response.json({ valid: true });
  }

  return Response.json({ valid: false });
}
