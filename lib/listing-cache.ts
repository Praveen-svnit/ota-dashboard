import { fetchSheet, parseCSV } from "@/lib/sheets";

interface ListingCache {
  trackerCols: string[];
  trackerRows: string[][];
  invCols:     string[];
  invRows:     string[][];
  fetchedAt:   Date;
}

let cache: ListingCache | null = null;

function needsRefresh(now: Date): boolean {
  if (!cache) return true;
  const eleven = new Date(now);
  eleven.setHours(11, 0, 0, 0);
  return now >= eleven && cache.fetchedAt < eleven;
}

export async function getListingData(force = false): Promise<ListingCache> {
  const now = new Date();
  if (!force && !needsRefresh(now) && cache) return cache;

  const [trackerCsv, invResult] = await Promise.all([
    fetchSheet("Listing Tracker"),
    fetchSheet("Inv").catch(() => null),
  ]);

  const { cols: trackerCols, rows: trackerRows } = parseCSV(trackerCsv);
  const { cols: invCols, rows: invRows } = invResult ? parseCSV(invResult) : { cols: [], rows: [] };

  cache = { trackerCols, trackerRows, invCols, invRows, fetchedAt: now };
  return cache;
}

export function clearListingCache() {
  cache = null;
}
