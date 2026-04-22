/**
 * auto-sync.js — hourly inventory + OTA listings sync
 * Managed by pm2 as a separate process alongside the Next.js server.
 * Calls the same API endpoints the Migration page uses.
 */

const BASE = process.env.APP_URL || "http://localhost:3000";
const INTERVAL_MS = 60 * 60 * 1000; // 1 hour

async function syncInventory() {
  try {
    const res = await fetch(`${BASE}/api/sync-inventory`, { method: "POST" });
    const json = await res.json();
    if (!res.ok || json.error) {
      console.error(`[auto-sync] inventory error: ${json.error ?? res.status}`);
    } else {
      console.log(`[auto-sync] inventory: ${json.message ?? "done"}`);
    }
  } catch (e) {
    console.error(`[auto-sync] inventory fetch failed: ${e.message}`);
  }
}

async function syncOtaListings() {
  try {
    const res = await fetch(`${BASE}/api/sync-ota-listings`, { method: "POST" });
    const json = await res.json();
    if (!res.ok || json.error) {
      console.error(`[auto-sync] OTA listings error: ${json.error ?? res.status}`);
    } else {
      const totals = Object.entries(json.results ?? {})
        .map(([ota, n]) => `${ota}:${n}`)
        .join(" ");
      console.log(`[auto-sync] OTA listings: ${totals || "done"}`);
    }
  } catch (e) {
    console.error(`[auto-sync] OTA listings fetch failed: ${e.message}`);
  }
}

async function runAll() {
  const ts = new Date().toISOString();
  console.log(`[auto-sync] ${ts} — starting hourly sync`);
  await syncInventory();
  await syncOtaListings();
  console.log(`[auto-sync] ${ts} — done`);
}

// Wait for the app to be ready on first boot, then sync every hour
const INITIAL_DELAY_MS = 30 * 1000; // 30 seconds after pm2 starts

setTimeout(() => {
  runAll();
  setInterval(runAll, INTERVAL_MS);
}, INITIAL_DELAY_MS);

console.log(`[auto-sync] scheduled — first run in 30s, then every hour (${BASE})`);
