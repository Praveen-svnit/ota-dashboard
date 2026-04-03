"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

const OTA_LIST = [
  { name: "GoMMT",          color: "#E83F6F", bg: "#FFF0F5", tab: "GoMMT" },
  { name: "Agoda",          color: "#7C3AED", bg: "#F5F0FF", tab: "Agoda" },
  { name: "Expedia",        color: "#0EA5E9", bg: "#F0FAFF", tab: "Expedia" },
  { name: "Yatra",          color: "#F43F5E", bg: "#FFF0F2", tab: "Yatra" },
  { name: "Ixigo",          color: "#FB923C", bg: "#FFF7F0", tab: "Ixigo" },
  { name: "Akbar Travels",  color: "#38BDF8", bg: "#F0F9FF", tab: "Akbar Travels" },
  { name: "Booking.com",    color: "#2563EB", bg: "#EFF6FF", tab: "BDC" },
  { name: "Cleartrip",      color: "#F97316", bg: "#FFF7ED", tab: "Clear Trip" },
  { name: "EaseMyTrip",     color: "#06B6D4", bg: "#F0FFFE", tab: "EMT" },
  { name: "Indigo",         color: "#6B2FA0", bg: "#F5F0FF", noSheet: true },
];

// OTAs without a Google Sheet yet — only bootstrap available, no sync
const NO_SHEET_OTAS = new Set(["Indigo"]);

type SyncState = {
  syncing: boolean;
  result: { upserted: number; error?: string } | null;
};

type BootstrapState = {
  running: boolean;
  result: { created: number; error?: string } | null;
};

type OtaRow = {
  ota: string;
  status: string | null;
  sub_status: string | null;
  live_date: string | null;
  ota_id: string | null;
  pre_post: string | null;
  synced_at: string | null;
};

type PropertyResult = {
  id: string;
  name: string;
  city: string;
  fhStatus: string;
};

export default function MigrationPage() {
  const router = useRouter();
  const [role,       setRole]       = useState<string | null>(null);
  const [otaStates,      setOtaStates]      = useState<Record<string, SyncState>>({});
  const [bootstrapStates, setBootstrapStates] = useState<Record<string, BootstrapState>>({});
  const [syncAllBusy, setSyncAllBusy] = useState(false);
  const [syncAllLog,  setSyncAllLog]  = useState<string[]>([]);

  // Global sync actions (moved from sidebar)
  const [refreshing,   setRefreshing]   = useState(false);
  const [syncingInv,   setSyncingInv]   = useState(false);
  const [globalLog,    setGlobalLog]    = useState<string | null>(null);
  const [globalErr,    setGlobalErr]    = useState(false);

  // Property search
  const [query,        setQuery]        = useState("");
  const [propResults,  setPropResults]  = useState<PropertyResult[]>([]);
  const [searching,    setSearching]    = useState(false);
  const [selectedProp, setSelectedProp] = useState<PropertyResult | null>(null);
  const [otaRows,      setOtaRows]      = useState<OtaRow[]>([]);
  const [loadingRows,  setLoadingRows]  = useState(false);
  const [propOtaStates, setPropOtaStates] = useState<Record<string, SyncState>>({});
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSearch   = useRef(false);

  // Auth check
  useEffect(() => {
    fetch("/api/auth/me").then(r => r.ok ? r.json() : null).then(d => {
      if (!d?.user || (d.user.role !== "admin" && d.user.role !== "head")) {
        router.replace("/login");
      } else {
        setRole(d.user.role);
      }
    });
  }, [router]);

  // ── Global utility actions ────────────────────────────────────────────────
  function runRefresh() {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 1500);
  }

  async function runSyncInventory() {
    setSyncingInv(true);
    setGlobalLog(null);
    setGlobalErr(false);
    try {
      const res  = await fetch("/api/sync-inventory", { method: "POST" });
      const json = await res.json();
      if (!res.ok || json.error) { setGlobalLog(json.error ?? "Unknown error"); setGlobalErr(true); }
      else { setGlobalLog(json.message ?? "Sync complete."); setGlobalErr(false); }
    } catch (e: unknown) {
      setGlobalLog(e instanceof Error ? e.message : "Network error"); setGlobalErr(true);
    } finally { setSyncingInv(false); }
  }

  // ── Bootstrap new OTA ─────────────────────────────────────────────────────
  async function bootstrapOta(ota: string) {
    setBootstrapStates(p => ({ ...p, [ota]: { running: true, result: null } }));
    try {
      const res  = await fetch(`/api/admin/bootstrap-ota?ota=${encodeURIComponent(ota)}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok || json.error) {
        setBootstrapStates(p => ({ ...p, [ota]: { running: false, result: { created: 0, error: json.error ?? "Unknown error" } } }));
      } else {
        setBootstrapStates(p => ({ ...p, [ota]: { running: false, result: { created: json.created } } }));
      }
    } catch (e) {
      setBootstrapStates(p => ({ ...p, [ota]: { running: false, result: { created: 0, error: String(e) } } }));
    }
  }

  // ── OTA-wise sync ──────────────────────────────────────────────────────────
  async function syncOta(ota: string) {
    setOtaStates(p => ({ ...p, [ota]: { syncing: true, result: null } }));
    try {
      const res  = await fetch(`/api/sync-ota-listings?ota=${encodeURIComponent(ota)}`, { method: "POST" });
      const json = await res.json();
      const upserted = json.results?.[ota] ?? 0;
      setOtaStates(p => ({ ...p, [ota]: { syncing: false, result: { upserted, error: json.errors?.[0] } } }));
    } catch (e) {
      setOtaStates(p => ({ ...p, [ota]: { syncing: false, result: { upserted: 0, error: String(e) } } }));
    }
  }

  async function syncAll() {
    setSyncAllBusy(true);
    setSyncAllLog([]);
    for (const { name } of OTA_LIST) {
      setSyncAllLog(p => [...p, `Syncing ${name}…`]);
      try {
        const res  = await fetch(`/api/sync-ota-listings?ota=${encodeURIComponent(name)}`, { method: "POST" });
        const json = await res.json();
        const n = json.results?.[name] ?? 0;
        setSyncAllLog(p => [...p.slice(0, -1), `✓ ${name}: ${n} rows`]);
        setOtaStates(prev => ({ ...prev, [name]: { syncing: false, result: { upserted: n } } }));
      } catch (e) {
        setSyncAllLog(p => [...p.slice(0, -1), `✗ ${name}: ${e}`]);
      }
    }
    setSyncAllBusy(false);
  }

  // ── Property search ────────────────────────────────────────────────────────
  useEffect(() => {
    if (skipSearch.current) { skipSearch.current = false; return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setPropResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res  = await fetch(`/api/crm/properties?search=${encodeURIComponent(query)}&limit=10&export=0`);
        const json = await res.json();
        // Deduplicate by property id (API returns one row per OTA)
        const seen = new Set<string>();
        const unique = (json.rows ?? []).reduce((acc: PropertyResult[], r: { id: string; name: string; city: string; fhStatus: string }) => {
          if (!seen.has(r.id)) { seen.add(r.id); acc.push({ id: r.id, name: r.name, city: r.city, fhStatus: r.fhStatus }); }
          return acc;
        }, []);
        setPropResults(unique);
      } finally {
        setSearching(false);
      }
    }, 350);
  }, [query]);

  async function selectProperty(prop: PropertyResult) {
    skipSearch.current = true;
    setSelectedProp(prop);
    setPropResults([]);
    setQuery(prop.name);
    setPropOtaStates({});
    setLoadingRows(true);
    try {
      const res  = await fetch(`/api/crm/properties?search=${encodeURIComponent(prop.id)}&export=1`);
      const json = await res.json();
      // Group rows by OTA
      const byOta: Record<string, OtaRow> = {};
      for (const r of (json.rows ?? [])) {
        byOta[r.ota] = { ota: r.ota, status: r.status, sub_status: r.subStatus, live_date: r.liveDate, ota_id: null, pre_post: null, synced_at: null };
      }
      setOtaRows(OTA_LIST.map(o => byOta[o.name] ?? { ota: o.name, status: null, sub_status: null, live_date: null, ota_id: null, pre_post: null, synced_at: null }));
    } finally {
      setLoadingRows(false);
    }
  }

  async function syncPropertyOta(ota: string) {
    if (!selectedProp) return;
    setPropOtaStates(p => ({ ...p, [ota]: { syncing: true, result: null } }));
    try {
      const res  = await fetch(`/api/sync-ota-listings?ota=${encodeURIComponent(ota)}&propertyId=${encodeURIComponent(selectedProp.id)}`, { method: "POST" });
      const json = await res.json();
      const upserted = json.results?.[ota] ?? 0;
      setPropOtaStates(p => ({ ...p, [ota]: { syncing: false, result: { upserted, error: json.errors?.[0] } } }));
      // Refresh OTA rows
      await selectProperty(selectedProp);
    } catch (e) {
      setPropOtaStates(p => ({ ...p, [ota]: { syncing: false, result: { upserted: 0, error: String(e) } } }));
    }
  }

  async function syncAllPropertyOtas() {
    if (!selectedProp) return;
    for (const { name } of OTA_LIST) {
      await syncPropertyOta(name);
    }
  }

  if (!role) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#94A3B8", fontSize: 14 }}>Loading…</div>;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px", fontFamily: "system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#0F172A" }}>OTA Migration Sync</div>
        <div style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>
          Sync OTA listing data from Google Sheets into the database. Existing CRM notes and assignments are preserved.
        </div>
      </div>

      {/* ── Utility actions ──────────────────────────────────────────────────── */}
      <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 12, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginRight: 4 }}>Quick Actions</span>

        {/* Sync App */}
        <button onClick={runRefresh} disabled={refreshing} style={{
          display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
          borderRadius: 7, border: "none", cursor: refreshing ? "default" : "pointer",
          background: refreshing ? "#F1F5F9" : "#F0FDF4", color: refreshing ? "#94A3B8" : "#16A34A",
          fontSize: 12, fontWeight: 600, opacity: refreshing ? 0.7 : 1,
        }}>
          <span style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }}>{refreshing ? "⟳" : "↻"}</span>
          {refreshing ? "Refreshing…" : "Sync App"}
        </button>

        {/* Sync Inventory to DB */}
        <button onClick={runSyncInventory} disabled={syncingInv} style={{
          display: "flex", alignItems: "center", gap: 6, padding: "7px 14px",
          borderRadius: 7, border: "none", cursor: syncingInv ? "default" : "pointer",
          background: syncingInv ? "#F1F5F9" : "#EFF6FF", color: syncingInv ? "#94A3B8" : "#2563EB",
          fontSize: 12, fontWeight: 600, opacity: syncingInv ? 0.7 : 1,
        }}>
          <span style={{ animation: syncingInv ? "spin 1s linear infinite" : "none" }}>{syncingInv ? "⟳" : "⇅"}</span>
          {syncingInv ? "Syncing…" : "Sync Inventory to DB"}
        </button>

        {globalLog && (
          <span style={{ fontSize: 11, color: globalErr ? "#DC2626" : "#059669", fontWeight: 500 }}>
            {globalErr ? `⚠ ${globalLog}` : `✓ ${globalLog}`}
          </span>
        )}
      </div>

      {/* ── Section A: OTA-wise sync ─────────────────────────────────────────── */}
      <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 12, padding: 24, marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Sync by OTA</div>
            <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>Fetches the latest data from each OTA&apos;s sheet tab and upserts into the DB</div>
          </div>
          <button
            onClick={syncAll}
            disabled={syncAllBusy}
            style={{
              padding: "8px 18px", borderRadius: 8, border: "none", cursor: syncAllBusy ? "default" : "pointer",
              background: syncAllBusy ? "#F1F5F9" : "#0F172A", color: syncAllBusy ? "#94A3B8" : "#FFF",
              fontSize: 13, fontWeight: 600,
            }}
          >
            {syncAllBusy ? "Syncing All…" : "⇅ Sync All OTAs"}
          </button>
        </div>

        {/* Sync all log */}
        {syncAllLog.length > 0 && (
          <div style={{ background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: "#475569", fontFamily: "monospace" }}>
            {syncAllLog.map((l, i) => <div key={i}>{l}</div>)}
          </div>
        )}

        {/* OTA cards grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {OTA_LIST.map(({ name, color, bg, tab, noSheet: _noSheet }) => {
            const state  = otaStates[name];
            const bState = bootstrapStates[name];
            const isNew  = NO_SHEET_OTAS.has(name);
            return (
              <div key={name} style={{ background: bg, border: `1px solid ${color}22`, borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 700, color }}>{name}</span>
                    {isNew && <span style={{ marginLeft: 6, fontSize: 9, fontWeight: 700, color: "#D97706", background: "#FEF3C7", padding: "1px 6px", borderRadius: 10 }}>NEW</span>}
                  </div>
                  {!isNew && (
                    <button
                      onClick={() => syncOta(name)}
                      disabled={state?.syncing}
                      style={{
                        padding: "4px 12px", borderRadius: 6, border: `1px solid ${color}44`,
                        background: state?.syncing ? "#F1F5F9" : "#FFF", color: state?.syncing ? "#94A3B8" : color,
                        fontSize: 11, fontWeight: 600, cursor: state?.syncing ? "default" : "pointer",
                      }}
                    >
                      {state?.syncing ? "Syncing…" : "Sync"}
                    </button>
                  )}
                </div>
                {/* Sheet tab label */}
                {!isNew && tab && (
                  <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 8 }}>
                    Sheet: <span style={{ fontWeight: 600, color: "#64748B" }}>{tab}</span>
                  </div>
                )}

                {isNew && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: "#64748B", marginBottom: 6 }}>No sheet yet. Bootstrap creates blank listings for all active properties.</div>
                    <button
                      onClick={() => bootstrapOta(name)}
                      disabled={bState?.running}
                      style={{
                        padding: "5px 14px", borderRadius: 6, border: "none",
                        background: bState?.running ? "#F1F5F9" : color, color: bState?.running ? "#94A3B8" : "#FFF",
                        fontSize: 11, fontWeight: 700, cursor: bState?.running ? "default" : "pointer", width: "100%",
                      }}
                    >
                      {bState?.running ? "Bootstrapping…" : "⊕ Bootstrap All Properties"}
                    </button>
                  </div>
                )}
                {!isNew && state?.result && (
                  <div style={{ fontSize: 11, color: state.result.error ? "#DC2626" : "#059669", fontWeight: 500 }}>
                    {state.result.error ? `✗ ${state.result.error}` : `✓ ${state.result.upserted} rows synced`}
                  </div>
                )}
                {isNew && bState?.result && (
                  <div style={{ fontSize: 11, color: bState.result.error ? "#DC2626" : "#059669", fontWeight: 500 }}>
                    {bState.result.error ? `✗ ${bState.result.error}` : `✓ ${bState.result.created} listings created`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Section B: Property-level sync ──────────────────────────────────── */}
      <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 12, padding: 24 }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>Sync by Property</div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>Search a property and sync its OTA data individually</div>
        </div>

        {/* Search box */}
        <div style={{ position: "relative", marginBottom: 20 }}>
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedProp(null); setOtaRows([]); }}
            placeholder="Search by property name or ID…"
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 8, border: "1px solid #CBD5E1",
              fontSize: 13, outline: "none", boxSizing: "border-box",
              background: "#F8FAFC",
            }}
          />
          {searching && <div style={{ position: "absolute", right: 12, top: 10, fontSize: 12, color: "#94A3B8" }}>Searching…</div>}

          {/* Dropdown results */}
          {propResults.length > 0 && (
            <div style={{
              position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
              background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 8,
              boxShadow: "0 8px 24px rgba(0,0,0,0.08)", maxHeight: 280, overflowY: "auto",
            }}>
              {propResults.map(p => (
                <div
                  key={p.id}
                  onClick={() => selectProperty(p)}
                  style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #F1F5F9", display: "flex", gap: 10, alignItems: "center" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#F8FAFC")}
                  onMouseLeave={e => (e.currentTarget.style.background = "#FFF")}
                >
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", minWidth: 48 }}>{p.id}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#0F172A", flex: 1 }}>{p.name}</span>
                  <span style={{ fontSize: 11, color: "#94A3B8" }}>{p.city}</span>
                  <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 12, background: p.fhStatus === "Live" ? "#DCFCE7" : "#F1F5F9", color: p.fhStatus === "Live" ? "#15803D" : "#64748B", fontWeight: 600 }}>{p.fhStatus}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Selected property OTA table */}
        {selectedProp && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{selectedProp.name}</span>
                <span style={{ fontSize: 12, color: "#64748B", marginLeft: 8 }}>#{selectedProp.id} · {selectedProp.city}</span>
              </div>
              <button
                onClick={syncAllPropertyOtas}
                disabled={Object.values(propOtaStates).some(s => s.syncing)}
                style={{
                  padding: "6px 14px", borderRadius: 7, border: "none", cursor: "pointer",
                  background: "#0F172A", color: "#FFF", fontSize: 12, fontWeight: 600,
                }}
              >
                Sync All OTAs for this Property
              </button>
            </div>

            {loadingRows ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "#94A3B8", fontSize: 13 }}>Loading OTA data…</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#F8FAFC" }}>
                    {["OTA", "Status", "Sub Status", "Live Date", "Action"].map(h => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#475569", fontSize: 11, borderBottom: "1px solid #E2E8F0" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {otaRows.map(row => {
                    const pState = propOtaStates[row.ota];
                    const otaDef = OTA_LIST.find(o => o.name === row.ota);
                    const hasData = row.status || row.sub_status;
                    return (
                      <tr key={row.ota} style={{ borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "9px 12px" }}>
                          <span style={{ fontWeight: 700, color: otaDef?.color ?? "#475569", fontSize: 12 }}>{row.ota}</span>
                        </td>
                        <td style={{ padding: "9px 12px", color: hasData ? "#0F172A" : "#CBD5E1" }}>{row.status || "—"}</td>
                        <td style={{ padding: "9px 12px", color: hasData ? "#0F172A" : "#CBD5E1" }}>{row.sub_status || "—"}</td>
                        <td style={{ padding: "9px 12px", color: "#64748B" }}>
                          {row.live_date ? new Date(row.live_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                        </td>
                        <td style={{ padding: "9px 12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <button
                              onClick={() => syncPropertyOta(row.ota)}
                              disabled={pState?.syncing}
                              style={{
                                padding: "3px 10px", borderRadius: 5, border: "1px solid #CBD5E1",
                                background: pState?.syncing ? "#F1F5F9" : "#FFF", color: pState?.syncing ? "#94A3B8" : "#2563EB",
                                fontSize: 11, fontWeight: 600, cursor: pState?.syncing ? "default" : "pointer",
                              }}
                            >
                              {pState?.syncing ? "Syncing…" : "Sync"}
                            </button>
                            {pState?.result && (
                              <span style={{ fontSize: 11, color: pState.result.error ? "#DC2626" : "#059669", fontWeight: 500 }}>
                                {pState.result.error ? `✗ ${pState.result.error}` : `✓ done`}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
