import { getSql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { parseCSV } from "@/lib/sheets";

const SHEET_ID = "1OlT0XA3Nk_RFpgbehysSCGcd955-Dyg7biWu9sbbPpQ";
const BATCH    = 500;

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

// Parse "M/D/YYYY HH:MM:SS" → "YYYY-MM-DD"
function parseShootDate(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  if (!t) return null;
  // Format: 10/20/2021 16:50:04
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return null;
  return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

export async function POST(req: Request) {
  void req;
  const session = await getSession();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const sql = getSql();

  const [form1, vendor, inventory] = await Promise.all([
    fetchTab("Form Responses 1"),
    fetchTab("Vendor Edited link"),
    sql`SELECT property_id FROM inventory`,
    sql`ALTER TABLE photoshoot_tracker ADD COLUMN IF NOT EXISTS shoot_link   TEXT`,
    sql`ALTER TABLE photoshoot_tracker ADD COLUMN IF NOT EXISTS shoot_source TEXT`,
  ]) as [{ cols: string[]; rows: string[][] }, { cols: string[]; rows: string[][] }, Record<string, unknown>[]];

  // ── Form Responses 1: col A (idx 0) = Timestamp, col C (idx 2) = FH ID, col D (idx 3) = Drive Link
  const formMap = new Map<string, { link: string | null; shootDate: string | null }>();
  for (const row of form1.rows) {
    const pid = clean(row[2]);
    if (!pid) continue;
    const link      = clean(row[3]);
    const shootDate = parseShootDate(row[0]);
    formMap.set(pid, {
      link:      link?.startsWith("http") ? link : null,
      shootDate,
    }); // last row wins (most recent submission)
  }

  // ── Vendor Edited link: col A (idx 0) = FH ID, col D (idx 3) = Edited Link, col M (idx 12) = Date
  const vendorMap = new Map<string, { link: string | null; shootDate: string | null }>();
  for (const row of vendor.rows) {
    const pid  = clean(row[0]);
    if (!pid) continue;
    const link      = clean(row[3]);
    const shootDate = parseShootDate(row[12]);
    vendorMap.set(pid, { link: link?.startsWith("http") ? link : null, shootDate });
  }

  // ── Classify every inventory property ─────────────────────────────────────
  const now = new Date().toISOString();
  let shootDone = 0, vendorEdited = 0, shootPending = 0;

  type Row = { pid: string; status: string; link: string | null; source: string; shootDate: string | null };
  const classified: Row[] = inventory.map(r => {
    const pid = String(r.property_id);
    if (formMap.has(pid)) {
      const { link, shootDate } = formMap.get(pid)!;
      shootDone++;
      return { pid, status: "Shoot Done", link, source: "Form Responses 1", shootDate };
    }
    if (vendorMap.has(pid)) {
      const { link, shootDate } = vendorMap.get(pid)!;
      vendorEdited++;
      return { pid, status: "Shoot Done", link, source: "Vendor Edited link", shootDate };
    }
    shootPending++;
    return { pid, status: "Shoot Pending", link: null, source: "none", shootDate: null };
  });

  // ── Batch upsert — 7 columns per row ──────────────────────────────────────
  for (let i = 0; i < classified.length; i += BATCH) {
    const chunk = classified.slice(i, i + BATCH);
    const cols  = 7;
    const placeholders = chunk
      .map((_, j) => `($${j*cols+1},$${j*cols+2},$${j*cols+3},$${j*cols+4},$${j*cols+5},$${j*cols+6},$${j*cols+7})`)
      .join(",");
    const params = chunk.flatMap(({ pid, status, link, source, shootDate }) =>
      [pid, status, link, source, shootDate, "sync", now]
    );
    await sql.query(
      `INSERT INTO photoshoot_tracker
         (property_id, photoshoot_status, shoot_link, shoot_source, shoot_date, updated_by, updated_at)
       VALUES ${placeholders}
       ON CONFLICT (property_id) DO UPDATE SET
         photoshoot_status = EXCLUDED.photoshoot_status,
         shoot_link        = EXCLUDED.shoot_link,
         shoot_source      = EXCLUDED.shoot_source,
         shoot_date        = EXCLUDED.shoot_date,
         updated_by        = EXCLUDED.updated_by,
         updated_at        = EXCLUDED.updated_at`,
      params
    );
  }

  return Response.json({ ok: true, synced: classified.length, shootDone, vendorEdited, shootPending });
}
