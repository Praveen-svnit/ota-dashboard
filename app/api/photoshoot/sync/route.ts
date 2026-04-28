import { getSql } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { parseCSV } from "@/lib/sheets";

const SHEET_ID = "1OlT0XA3Nk_RFpgbehysSCGcd955-Dyg7biWu9sbbPpQ";

async function fetchTab(tab: string): Promise<{ cols: string[]; rows: string[][] }> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch tab "${tab}": ${res.status}`);
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

  // Ensure columns exist
  await sql`ALTER TABLE photoshoot_tracker ADD COLUMN IF NOT EXISTS shoot_link   TEXT`;
  await sql`ALTER TABLE photoshoot_tracker ADD COLUMN IF NOT EXISTS shoot_source TEXT`;

  // ── Fetch Form Responses 1 ──────────────────────────────────────────────────
  // Col C (idx 2) = Property ID, Col D (idx 3) = Drive Link
  // One property can have multiple rows — keep last (most recent)
  const form1 = await fetchTab("Form Responses 1");
  const formMap = new Map<string, string | null>(); // property_id → drive_link
  for (const row of form1.rows) {
    const pid  = clean(row[2]);
    if (!pid) continue;
    const link = clean(row[3]);
    const httpLink = link?.startsWith("http") ? link : null;
    formMap.set(pid, httpLink);          // last occurrence wins
  }

  // ── Fetch Vendor Edited link ────────────────────────────────────────────────
  // Col A (idx 0) = ID, Col D (idx 3) = Edited Link
  const vendor = await fetchTab("Vendor Edited link");
  const vendorMap = new Map<string, string | null>(); // property_id → edited_link
  for (const row of vendor.rows) {
    const pid  = clean(row[0]);
    if (!pid) continue;
    const link = clean(row[3]);
    const httpLink = link?.startsWith("http") ? link : null;
    vendorMap.set(pid, httpLink);
  }

  // ── Get all inventory property_ids ─────────────────────────────────────────
  const inventory = await sql`SELECT property_id FROM inventory`;
  const now = new Date().toISOString();

  let shootDone = 0, vendorEdited = 0, shootPending = 0;

  // ── Upsert in batches of 50 ─────────────────────────────────────────────────
  const BATCH = 50;
  const allProps = inventory.map(r => String(r.property_id));

  for (let i = 0; i < allProps.length; i += BATCH) {
    const chunk = allProps.slice(i, i + BATCH);
    for (const pid of chunk) {
      let status: string;
      let link: string | null;
      let source: string;

      if (formMap.has(pid)) {
        status = "Shoot Done";
        link   = formMap.get(pid) ?? null;
        source = "Form Responses 1";
        shootDone++;
      } else if (vendorMap.has(pid)) {
        status = "Vendor Edited";
        link   = vendorMap.get(pid) ?? null;
        source = "Vendor Edited link";
        vendorEdited++;
      } else {
        status = "Shoot Pending";
        link   = null;
        source = "none";
        shootPending++;
      }

      await sql`
        INSERT INTO photoshoot_tracker
          (property_id, photoshoot_status, shoot_link, shoot_source, updated_by, updated_at)
        VALUES
          (${pid}, ${status}, ${link}, ${source}, ${"sync"}, ${now})
        ON CONFLICT (property_id) DO UPDATE SET
          photoshoot_status = EXCLUDED.photoshoot_status,
          shoot_link        = EXCLUDED.shoot_link,
          shoot_source      = EXCLUDED.shoot_source,
          updated_by        = EXCLUDED.updated_by,
          updated_at        = EXCLUDED.updated_at
      `;
    }
  }

  return Response.json({
    ok: true,
    synced: allProps.length,
    shootDone,
    vendorEdited,
    shootPending,
  });
}
