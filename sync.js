'use strict';

const { getDb } = require('./db');

// ─── Sheet IDs ─────────────────────────────────────────────────────────────
const INV_SHEET_ID = '1VkFA4keBAT3tG5NkZwmSNRbLZJgx2neOhZ7Zuj2z_98';
const RNS_SHEET_ID = '1xI0TjmZkmKwD27nNIhah7iaQtbpAmX5tfJYckbw2Jio';

// ─── Helpers ───────────────────────────────────────────────────────────────
function sheetUrl(sheetId, tab) {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
}

async function fetchSheet(sheetId, tab) {
  const res = await fetch(sheetUrl(sheetId, tab));
  if (!res.ok) throw new Error(`Failed to fetch "${tab}": HTTP ${res.status}`);
  return res.text();
}

function parseCSV(text) {
  const parseLine = (line) => {
    const result = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    result.push(cur.trim());
    return result;
  };
  const lines = text.split('\n');
  const cols  = parseLine(lines[0]);
  const rows  = lines.slice(1).map(parseLine).filter(r => r.some(v => v));
  return { cols, rows };
}

function ci(cols, name) { return cols.findIndex(c => c.trim().toLowerCase() === name.toLowerCase()); }
function ciRx(cols, rx) { return cols.findIndex(c => rx.test(c.trim())); }
function col(row, i)    { return i >= 0 ? (row[i] ?? '').trim() : ''; }

function parseDate(v) {
  if (!v?.trim() || ['—', '#n/a', '#ref!', ''].includes(v.trim().toLowerCase())) return null;
  const s = v.trim();
  if (/^\d{5}$/.test(s)) {
    const n = parseInt(s, 10);
    if (n > 36526 && n < 73050)
      return new Date(Date.UTC(1899, 11, 30) + n * 86400000).toISOString().slice(0, 10);
    return null;
  }
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  const yr = d.getUTCFullYear();
  if (yr < 1990 || yr > 2100) return null;
  return d.toISOString().slice(0, 10);
}

function parseNum(v) {
  if (!v?.trim()) return 0;
  const n = parseFloat(v.replace(/,/g, '').trim());
  return isNaN(n) ? 0 : n;
}

function calcTAT(fhLiveDate, otaLiveDate) {
  if (!fhLiveDate) return { tat: 0, tatError: 0 };
  const fh = new Date(fhLiveDate);
  if (isNaN(fh.getTime())) return { tat: 0, tatError: 0 };
  const ota = otaLiveDate ? new Date(otaLiveDate) : new Date();
  if (isNaN(ota.getTime())) return { tat: 0, tatError: 0 };
  const days = Math.round((ota - fh) / 86400000);
  if (days < 0) return { tat: 0, tatError: 1 };
  if (days === 0 && otaLiveDate) return { tat: 0, tatError: 3 };
  return { tat: days, tatError: 0 };
}

function currentMonthPrefix() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── 1. Property — clear + full add ───────────────────────────────────────
async function syncProperty(db, now) {
  console.log('\n[1/6] Property — clear + add');
  const { cols, rows } = parseCSV(await fetchSheet(INV_SHEET_ID, 'inv'));

  const idx = {
    id:     Math.max(0, ci(cols, 'property_id')),
    name:   ci(cols, 'property_name'),
    city:   ci(cols, 'property_city'),
    date:   ci(cols, 'created_at'),
    status: ciRx(cols, /^(fh.?)?status$/i),
  };

  const propMap = new Map();
  const upsert  = db.prepare(`
    INSERT INTO Property (id, name, city, fhLiveDate, fhStatus, syncedAt)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, city=excluded.city,
      fhLiveDate=excluded.fhLiveDate, fhStatus=excluded.fhStatus,
      syncedAt=excluded.syncedAt
  `);

  db.pragma('foreign_keys = OFF');
  db.exec('DELETE FROM Property');
  db.pragma('foreign_keys = ON');

  const n = db.transaction(() => {
    let count = 0;
    for (const row of rows) {
      const id = row[idx.id]?.trim();
      if (!id) continue;
      const name       = idx.name   >= 0 ? (row[idx.name]?.trim()   || '—')  : '—';
      const city       = idx.city   >= 0 ? (row[idx.city]?.trim()   || null) : null;
      const fhLiveDate = idx.date   >= 0 ? parseDate(row[idx.date])           : null;
      const fhStatus   = idx.status >= 0 ? (row[idx.status]?.trim() || null) : null;
      upsert.run(id, name, city, fhLiveDate, fhStatus, now);
      propMap.set(id, fhLiveDate);
      count++;
    }
    return count;
  })();

  console.log(`  → ${n} properties`);
  return propMap;
}

// ─── 2. OtaListing — append-only log on status / subStatus change ──────────
async function syncOtaListing(db, now, propMap) {
  // If table is empty, seed mode: insert every row regardless of change
  const isEmpty = db.prepare('SELECT COUNT(*) as n FROM OtaListing').get().n === 0;
  console.log(`\n[2/6] OtaListing — ${isEmpty ? 'SEED (full insert)' : 'append on status change'}`);

  const getLatest = db.prepare(`
    SELECT status, subStatus FROM OtaListing
    WHERE propertyId = ? AND ota = ?
    ORDER BY id DESC LIMIT 1
  `);
  const insert = db.prepare(`
    INSERT INTO OtaListing
      (propertyId, ota, otaId, status, subStatus, liveDate, fhLiveDate, tat, tatError, syncedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const OTA_TABS = [
    { tab: 'GoMMT',         ota: 'GoMMT',         propIdRx: /^listing.?property.?id$/i, idCol: 'go-mmt id',       statusCol: 'mmt shell status', subStCol: 'sub status', liveDateCol: 'property live date on go-mmt' },
    { tab: 'BDC',           ota: 'Booking.com',   propIdRx: /^property.?id$/i,          idCol: 'bdc id',          statusCol: 'bdc status',       subStCol: 'sub status', liveDateCol: 'bdc listing date' },
    { tab: 'Agoda',         ota: 'Agoda',         propIdRx: /^property.?id$/i,          idCol: 'agoda id',        statusCol: 'agoda status',     subStCol: 'sub status', liveDateCol: 'agoda live date' },
    { tab: 'EMT',           ota: 'EaseMyTrip',    propIdRx: /^fh.?id$/i,                idCol: 'emt shl id',      statusCol: 'emt status',       subStCol: 'sub status', liveDateCol: 'emt live date' },
    { tab: 'Clear Trip',    ota: 'Cleartrip',     propIdRx: /^(fh.?id|property.?id)$/i, idCol: 'ct hid',          statusCol: 'ct status',        subStCol: 'sub status', liveDateCol: 'ct live date' },
    { tab: 'Expedia',       ota: 'Expedia',       propIdRx: /^fh.?id$/i,                idCol: 'expedia id',      statusRx: /^expedia\s+status/i, subStCol: 'sub status', liveDateRx: /^expedia\s+live\s+date/i },
    { tab: 'Yatra',         ota: 'Yatra',         propIdRx: /^property.?id$/i,          idCol: 'vid',             statusCol: 'yatra status',     subStCol: 'sub status', liveDateCol: 'live date' },
    { tab: 'Akbar Travels', ota: 'Akbar Travels', propIdRx: /^property.?id$/i,          idCol: 'akt_id',          statusCol: 'akt status',       subStCol: 'sub status', liveDateCol: 'akt live date' },
    { tab: 'Ixigo',         ota: 'Ixigo',         propIdRx: /^property.?id$/i,          idCol: 'ixigo id',        statusCol: 'ixigo status',     subStCol: 'sub status', liveDateCol: 'live date' },
  ];

  let totalInserted = 0, totalSkipped = 0;

  for (const cfg of OTA_TABS) {
    console.log(`  Fetching ${cfg.tab}...`);
    const { cols, rows } = parseCSV(await fetchSheet(INV_SHEET_ID, cfg.tab));

    const pIdx  = ciRx(cols, cfg.propIdRx);
    const oiIdx = ci(cols, cfg.idCol);
    const stIdx = cfg.statusRx  ? ciRx(cols, cfg.statusRx)  : ci(cols, cfg.statusCol);
    const ssIdx = ci(cols, cfg.subStCol);
    const ldIdx = cfg.liveDateRx ? ciRx(cols, cfg.liveDateRx) : ci(cols, cfg.liveDateCol);

    if (pIdx < 0) { console.warn(`    ! No property ID column — skipping`); continue; }

    const { inserted, skipped } = db.transaction(() => {
      let ins = 0, skip = 0;
      for (const row of rows) {
        const propId    = row[pIdx]?.trim();
        if (!propId) continue;
        const otaId     = col(row, oiIdx) || null;
        const status    = col(row, stIdx) || null;
        const subStatus = col(row, ssIdx) || null;
        const liveDate  = ldIdx >= 0 ? parseDate(row[ldIdx]) : null;

        if (!otaId && !status && !subStatus && !liveDate) continue;

        // Only log a new entry when status or subStatus changed (skip in seed mode)
        if (!isEmpty) {
          const prev = getLatest.get(propId, cfg.ota);
          if (prev && prev.status === status && prev.subStatus === subStatus) {
            skip++;
            continue;
          }
        }

        const fhLiveDate = propMap.get(propId) || null;
        let { tat, tatError } = calcTAT(fhLiveDate, liveDate);
        if (subStatus?.trim().toLowerCase() !== 'live') tatError = 2;

        insert.run(propId, cfg.ota, otaId, status, subStatus, liveDate, fhLiveDate, tat, tatError, now);
        ins++;
      }
      return { inserted: ins, skipped: skip };
    })();

    console.log(`    → ${inserted} new log entries, ${skipped} unchanged`);
    totalInserted += inserted;
    totalSkipped  += skipped;
  }

  console.log(`  Total: ${totalInserted} inserted, ${totalSkipped} unchanged`);
}

// ─── 3+4. RnsStay / RnsSold — keep history, clear CM + re-add ─────────────
async function syncRns(db, now) {
  console.log('\n[3/6] RnsStay + [4/6] RnsSold — keep history, clear current month + re-add');

  const cmPrefix = currentMonthPrefix();
  console.log(`  Current month: ${cmPrefix}`);

  const { rows } = parseCSV(await fetchSheet(RNS_SHEET_ID, 'Raw_data'));
  console.log(`  → ${rows.length} rows fetched`);

  // Delete only the current month so historical data is preserved
  db.transaction(() => {
    db.prepare(`DELETE FROM RnsStay WHERE stay_date LIKE ?`).run(`${cmPrefix}%`);
    db.prepare(`DELETE FROM RnsSold WHERE sold_date LIKE ?`).run(`${cmPrefix}%`);
  })();

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

  let soldCount = 0, stayCount = 0;
  db.transaction(() => {
    for (const row of rows) {
      const soldDate = parseDate(row[SOLD.date]);
      const soldOta  = row[SOLD.ota]?.trim();
      if (soldDate && soldOta) {
        upsertSold.run(soldDate, soldOta, Math.round(parseNum(row[SOLD.rns])), parseNum(row[SOLD.revenue]), now);
        soldCount++;
      }
      const stayDate    = parseDate(row[STAY.date]);
      const stayOta     = row[STAY.ota]?.trim();
      const guestStatus = row[STAY.guest_status]?.trim() || null;
      if (stayDate && stayOta) {
        upsertStay.run(stayDate, stayOta, guestStatus, Math.round(parseNum(row[STAY.rns])), parseNum(row[STAY.revenue]), now);
        stayCount++;
      }
    }
  })();

  console.log(`  → ${soldCount} sold rows, ${stayCount} stay rows`);
}

// ─── 5. GeniusData — append-only on genius_status change ──────────────────
async function syncGeniusData(db, now) {
  console.log('\n[5/6] GeniusData — append on genius_status change');

  const { cols, rows } = parseCSV(await fetchSheet(INV_SHEET_ID, 'BDC Genious'));

  const iId     = ci(cols, 'prop id');
  const iName   = ci(cols, 'prop name');
  const iCity   = ci(cols, 'city');
  const iFhSt   = ci(cols, 'fh status');
  const iBdcId  = ci(cols, 'bdc id');
  const iBdcSt  = ci(cols, 'bdc status');
  const iStatus = ci(cols, 'genius status');
  const iDate   = ci(cols, 'last checked');
  const iRemark = ci(cols, 'remarks');

  const insert    = db.prepare(`
    INSERT INTO GeniusData
      (prop_id, bdc_id, prop_name, city, fh_status, bdc_status, genius_status, last_checked, remark, syncedAt)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `);
  const updateProp = db.prepare(`
    UPDATE Property SET bdc_id=?, genius_status=?, genius_last_checked=? WHERE id=?
  `);

  let inserted = 0;
  db.transaction(() => {
    for (const row of rows) {
      const bdcId = col(row, iBdcId);
      if (!bdcId || bdcId.toLowerCase() === 'nan') continue;
      const geniusStatus = col(row, iStatus);
      const lastChecked  = col(row, iDate);
      insert.run(col(row, iId), bdcId, col(row, iName), col(row, iCity),
        col(row, iFhSt), col(row, iBdcSt), geniusStatus, lastChecked, col(row, iRemark), now);
      inserted++;
      const propId = col(row, iId);
      if (propId) updateProp.run(bdcId, geniusStatus, lastChecked, propId);
    }
  })();

  console.log(`  → ${inserted} new entries`);
}

// ─── 6. HygieneData — always insert new log row ───────────────────────────
async function syncHygieneData(db, now) {
  console.log('\n[6/6] HygieneData — always insert new log row');

  const { cols, rows } = parseCSV(await fetchSheet(INV_SHEET_ID, 'BDC Hygiene'));

  const iId      = ci(cols, 'prop id');
  const iName    = ci(cols, 'prop name');
  const iCity    = ci(cols, 'city');
  const iBdcId   = ci(cols, 'bdc id');
  const iScrap   = ci(cols, 'scrap status');
  const iScore   = ci(cols, 'review score');
  const iCount   = ci(cols, 'review count');
  const iGElig   = ci(cols, 'genius_eligibility');
  const iGStat   = ci(cols, 'genius_status');
  const iGLevel  = ci(cols, 'genius level');
  const iPStat   = ci(cols, 'preferred_status');
  const iPElig   = ci(cols, 'preferred_eligibility');
  const iPerfSc  = ci(cols, 'performance_score');
  const iPromo   = ci(cols, 'top promotion');
  const iComm    = ci(cols, 'commission %');
  const iSrViews = ci(cols, 'search result views');
  const iViews   = ci(cols, 'property page views');
  const iConv    = ci(cols, 'conversion %');
  const iPage    = ci(cols, 'property page score');
  const iDate    = ci(cols, 'last checked');

  const insert = db.prepare(`
    INSERT INTO HygieneData
      (prop_id, bdc_id, prop_name, city, scrap_status,
       review_score, review_count, genius_eligibility, genius_status, genius_level,
       preferred_status, preferred_eligibility, perf_score, top_promotion,
       commission_pct, search_result_views, views, conversion_pct, page_score,
       last_checked, syncedAt)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);

  let inserted = 0;
  db.transaction(() => {
    for (const row of rows) {
      const bdcId = col(row, iBdcId);
      if (!bdcId || bdcId.toLowerCase() === 'nan') continue;

      const reviewScore    = col(row, iScore);
      const reviewCount    = col(row, iCount);
      const geniusElig     = col(row, iGElig);
      const geniusStat     = col(row, iGStat);
      const geniusLevel    = col(row, iGLevel);
      const preferredStat  = col(row, iPStat);
      const preferredElig  = col(row, iPElig);
      const perfScore      = col(row, iPerfSc);
      const topPromo       = col(row, iPromo);
      const commPct        = col(row, iComm);
      const srViews        = col(row, iSrViews);
      const views          = col(row, iViews);
      const convPct        = col(row, iConv);
      const pageScore      = col(row, iPage);
      const lastChecked    = col(row, iDate);
      const scrapStatus    = col(row, iScrap);

      insert.run(
        col(row, iId), bdcId, col(row, iName), col(row, iCity), scrapStatus,
        reviewScore, reviewCount, geniusElig, geniusStat, geniusLevel,
        preferredStat, preferredElig, perfScore, topPromo,
        commPct, srViews, views, convPct, pageScore,
        lastChecked, now
      );
      inserted++;
    }
  })();

  console.log(`  → ${inserted} new entries`);
}

// ─── Master sync ───────────────────────────────────────────────────────────
async function sync() {
  const db  = getDb();
  const now = new Date().toISOString();
  console.log(`=== Full Sync  [${now}] ===`);

  const propMap = await syncProperty(db, now);
  await syncOtaListing(db, now, propMap);
  await syncRns(db, now);
  await syncGeniusData(db, now);
  await syncHygieneData(db, now);

  const counts = {
    Property:    db.prepare('SELECT COUNT(*) as n FROM Property').get().n,
    OtaListing:  db.prepare('SELECT COUNT(*) as n FROM OtaListing').get().n,
    RnsStay:     db.prepare('SELECT COUNT(*) as n FROM RnsStay').get().n,
    RnsSold:     db.prepare('SELECT COUNT(*) as n FROM RnsSold').get().n,
    GeniusData:  db.prepare('SELECT COUNT(*) as n FROM GeniusData').get().n,
    HygieneData: db.prepare('SELECT COUNT(*) as n FROM HygieneData').get().n,
  };

  console.log('\n=== DB Totals ===');
  for (const [table, n] of Object.entries(counts))
    console.log(`  ${table.padEnd(14)} ${n} rows`);
  console.log(`\nDone  [${new Date().toISOString()}]`);
}

sync().catch(err => { console.error('\nSync failed:', err.message); process.exit(1); });
