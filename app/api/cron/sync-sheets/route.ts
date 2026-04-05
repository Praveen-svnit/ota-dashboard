import { NextRequest } from "next/server";

// Called by Vercel Cron at 11am, 3pm, 6pm IST (5:30, 9:30, 12:30 UTC)
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const base = new URL(req.url).origin;
  const res  = await fetch(`${base}/api/sync-ota-listings`, { method: "POST" });
  const json = await res.json();

  return Response.json({ ok: true, ...json });
}
