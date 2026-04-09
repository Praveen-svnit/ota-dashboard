import { NextRequest } from "next/server";

// Delegates to the unified OTA listings sync for GMB.
export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const base = `${url.protocol}//${url.host}`;
  const propertyId = url.searchParams.get("propertyId");
  const target = `${base}/api/sync-ota-listings?ota=GMB${propertyId ? `&propertyId=${propertyId}` : ""}`;
  const res  = await fetch(target, { method: "POST", headers: req.headers });
  const json = await res.json();
  return Response.json({ ...json, log: json.message ?? "GMB sync complete", synced: json.results?.GMB ?? 0 });
}
