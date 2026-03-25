'use strict';

const { getDb } = require('./db');

const RNS_SHEET_ID = '1xI0TjmZkmKwD27nNIhah7iaQtbpAmX5tfJYckbw2Jio';

// ── Sheet fetch ─────────────────────────────────────────────────────────────
function sheetUrl(tab) {
  return `https://docs.google.com/spreadsheets/d/${RNS_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
}

async function fetchSheet(tab) {
  const res = await fetch(sheetUrl(tab));
  if (!res.ok) throw new Error(`Failed to fetch "${tab}": HTTP ${res.status}`);
  return res.text();
}

// ── CSV parser ──────────────────────────────────────────────────────────────
function parseCSV(text) {
  const parseLine = (line) => {
    const result = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) {
        result.push(cur.trim()); cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const lines = text.split('\n');
  const cols  = parseLine(lines[0]);
  const rows  = lines.slice(1).map(parseLine).filter(r => r.some(v => v));
  return { cols, rows };
}

// ── Date parsing ────────────────────────────────────────────────────────────
function parseDate(v) {
  if (!v?.trim() || ['—', '#n/a', '#ref!', ''].includes(v.trim().toLowerCase())) return null;
  const s = v.trim();

  // Excel serial number (5 digits, range 2000–2100)
  if (/^\d{5}$/.test(s)) {
    const n = parseInt(s, 10);
    if (n > 36526 && n < 73050) {
      return new Date(Date.UTC(1899, 11, 30) + n * 86400000).toISOString().slice(0, 10);
    }
    return null;
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

// ── Number parsing ──────────────────────────────────────────────────────────
function parseNum(v) {
  if (!v?.trim()) return 0;
  const n = parseFloat(v.replace(/,/g, '').trim());
  return isNaN(n) ? 0 : n;
}

// ── Main sync ───────────────────────────────────────────────────────────────
async function sync() {
  const db  = getDb();
  const now = new Date().toISOString();

  console.log('Fetching Raw_data...');
  const { rows } = parseCSV(await fetchSheet('Raw_data'));
  console.log(`  → ${rows.length} rows fetched`);

  // Column indices (fixed positions, 0-based)
  // Sold:  A=0  B=1  C=2   D=3
  // Stay:  H=7  I=8  J=9   K=10  L=11
  const SOLD = { date: 0, ota: 1, rns: 2, revenue: 3 };
  const STAY = { date: 7, ota: 8, guest_status: 9, rns: 10, revenue: 11 };

  const upsertSold = db.prepare(`
    INSERT INTO RnsSold (sold_date, ota, rns, revenue, syncedAt)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(sold_date, ota) DO UPDATE SET
      rns=excluded.rns, revenue=excluded.revenue, syncedAt=excluded.syncedAt
  `);

  const upsertStay = db.prepare(`
    INSERT INTO RnsStay (stay_date, ota, guest_status, rns, revenue, syncedAt)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(stay_date, ota, guest_status) DO UPDATE SET
      rns=excluded.rns, revenue=excluded.revenue, syncedAt=excluded.syncedAt
  `);

  let soldCount = 0;
  let stayCount = 0;

  db.transaction(() => {
    for (const row of rows) {
      // ── RnsSold (cols A–D) ──────────────────────────────────────
      const soldDate = parseDate(row[SOLD.date]);
      const soldOta  = row[SOLD.ota]?.trim();
      if (soldDate && soldOta) {
        upsertSold.run(
          soldDate,
          soldOta,
          Math.round(parseNum(row[SOLD.rns])),
          parseNum(row[SOLD.revenue]),
          now
        );
        soldCount++;
      }

      // ── RnsStay (cols H–L) ──────────────────────────────────────
      const stayDate    = parseDate(row[STAY.date]);
      const stayOta     = row[STAY.ota]?.trim();
      const guestStatus = row[STAY.guest_status]?.trim() || null;
      if (stayDate && stayOta) {
        upsertStay.run(
          stayDate,
          stayOta,
          guestStatus,
          Math.round(parseNum(row[STAY.rns])),
          parseNum(row[STAY.revenue]),
          now
        );
        stayCount++;
      }
    }
  })();

  // ── Summary ─────────────────────────────────────────────────────────────
  const totalSold = db.prepare('SELECT COUNT(*) as n FROM RnsSold').get().n;
  const totalStay = db.prepare('SELECT COUNT(*) as n FROM RnsStay').get().n;
  console.log(`\nDone — ${soldCount} sold rows, ${stayCount} stay rows upserted`);
  console.log(`DB totals — RnsSold: ${totalSold}, RnsStay: ${totalStay}  [${now}]`);
}

sync().catch(err => { console.error('\nSync failed:', err.message); process.exit(1); });
