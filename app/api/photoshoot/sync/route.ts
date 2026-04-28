import { getSql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { parseCSV } from "@/lib/sheets";

const SHEET_ID = "1OlT0XA3Nk_RFpgbehysSCGcd955-Dyg7biWu9sbbPpQ";
const BATCH    = 500; // rows per upsert — stays well under pg's 65535 param limit

async function fetchTab(tab: string): Promise<{ cols: string[]; rows: string[][] }> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch "${tab}": ${res.status}`);
  return parseCSV(await res.text());
}

function clean(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  return t && t !== "#N/A" && t !== "#REF!" ? t : null;
}

export async function POST(req: Request) {
  void req;
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getSql();

  // Ensure columns exist + fetch all three sources in parallel
  const [form1, vendor, inventory] = await Promise.all([
    fetchTab("Form Responses 1"),
    fetchTab("Vendor Edited link"),
    sql`SELECT property_id FROM inventory`,
    sql`ALTER TABLE photoshoot_tracker ADD COLUMN IF NOT EXISTS shoot_link   TEXT`,
    sql`ALTER TABLE photoshoot_tracker ADD COLUMN IF NOT EXISTS shoot_source TEXT`,
  ]) as [{ cols: string[]; rows: string[][] }, { cols: string[]; rows: string[][] }, Record<string, unknown>[]];

  // ── Build lookup maps from sheet data ──────────────────────────────────────
  // Form Responses 1: col C (idx 2) = FH ID, col D (idx 3) = Drive Link
  const formMap = new Map<string, string | null>();
  for (const row of form1.rows) {
    const pid = clean(row[2]);
    if (!pid) continue;
    const link = clean(row[3]);
    formMap.set(pid, link?.startsWith("http") ? link : null); // last row wins (most recent)
  }

  // Vendor Edited link: col A (idx 0) = FH ID, col D (idx 3) = Edited Link
  const vendorMap = new Map<string, string | null>();
  for (const row of vendor.rows) {
    const pid = clean(row[0]);
    if (!pid) continue;
    const link = clean(row[3]);
    vendorMap.set(pid, link?.startsWith("http") ? link : null);
  }

  // ── Classify every inventory property ──────────────────────────────────────
  const now = new Date().toISOString();
  let shootDone = 0, vendorEdited = 0, shootPending = 0;

  type Row = { pid: string; status: string; link: string | null; source: string };
  const classified: Row[] = inventory.map(r => {
    const pid = String(r.property_id);
    if (formMap.has(pid)) {
      shootDone++;
      return { pid, status: "Shoot Done",    link: formMap.get(pid)!,   source: "Form Responses 1"  };
    }
    if (vendorMap.has(pid)) {
      vendorEdited++;
      return { pid, status: "Vendor Edited", link: vendorMap.get(pid)!, source: "Vendor Edited link" };
    }
    shootPending++;
    return   { pid, status: "Shoot Pending", link: null,                source: "none"               };
  });

  // ── Batch upsert — one multi-row query per 500 properties ──────────────────
  for (let i = 0; i < classified.length; i += BATCH) {
    const chunk = classified.slice(i, i + BATCH);
    const cols  = 6; // columns per row
    const placeholders = chunk
      .map((_, j) => `($${j * cols + 1},$${j * cols + 2},$${j * cols + 3},$${j * cols + 4},$${j * cols + 5},$${j * cols + 6})`)
      .join(",");
    const params = chunk.flatMap(({ pid, status, link, source }) =>
      [pid, status, link, source, "sync", now]
    );
    await sql.query(
      `INSERT INTO photoshoot_tracker
         (property_id, photoshoot_status, shoot_link, shoot_source, updated_by, updated_at)
       VALUES ${placeholders}
       ON CONFLICT (property_id) DO UPDATE SET
         photoshoot_status = EXCLUDED.photoshoot_status,
         shoot_link        = EXCLUDED.shoot_link,
         shoot_source      = EXCLUDED.shoot_source,
         updated_by        = EXCLUDED.updated_by,
         updated_at        = EXCLUDED.updated_at`,
      params
    );
  }

  return Response.json({ ok: true, synced: classified.length, shootDone, vendorEdited, shootPending });
}
