"use client";

import { useEffect, useState, useRef } from "react";
import { OTA_COLORS, OTAS } from "@/lib/constants";

// ── Types ──────────────────────────────────────────────────────────────────

type Combo = { subStatus: string; statuses: string[]; sortOrder: number };
type OtaConfig = {
  ota: string; subStatuses: string[]; statusMap: Record<string, string[]>;
  updatedAt: string | null; updatedBy: string | null; isDefault: boolean;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function otaColor(ota: string) { return OTA_COLORS[ota] ?? "#64748B"; }
function hex2rgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}
function timeSince(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  return d === 0 ? "today" : d === 1 ? "yesterday" : `${d}d ago`;
}

// Small chip component
function Chip({ label, onRemove, accent }: { label: string; onRemove?: () => void; accent?: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "2px 8px", borderRadius: 20, fontSize: 10, fontWeight: 600,
      background: accent ? hex2rgba(accent, 0.12) : "#EEF2FF",
      color: accent ?? "#4F46E5",
    }}>
      {label}
      {onRemove && (
        <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer",
          color: "inherit", padding: 0, lineHeight: 1, opacity: 0.7, fontSize: 10 }}>×</button>
      )}
    </span>
  );
}

// Inline tag input for adding statuses to a combo
function StatusTagInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [input, setInput] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  function add() {
    const v = input.trim();
    if (!v || value.includes(v)) { setInput(""); return; }
    onChange([...value, v]);
    setInput("");
    ref.current?.focus();
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center",
      padding: "5px 8px", border: "1px solid #CBD5E1", borderRadius: 7, minHeight: 34,
      background: "#F8FAFC" }}>
      {value.map(s => (
        <Chip key={s} label={s} onRemove={() => onChange(value.filter(x => x !== s))} />
      ))}
      <input ref={ref} value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }}
        placeholder={value.length ? "Add status…" : "Type a status, press Enter…"}
        style={{ border: "none", outline: "none", fontSize: 11, background: "transparent",
          color: "#374151", minWidth: 120, flex: 1 }} />
      {input.trim() && (
        <button onClick={add}
          style={{ padding: "2px 8px", background: "#4F46E5", color: "#fff", border: "none",
            borderRadius: 4, cursor: "pointer", fontSize: 10, fontWeight: 700 }}>+ Add</button>
      )}
    </div>
  );
}

// ── Tab strip ──────────────────────────────────────────────────────────────

function TabStrip({ tabs, active, onChange }: {
  tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 0, borderBottom: "2px solid #E2E8F0", marginBottom: 20 }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)}
          style={{
            padding: "8px 20px", background: "none", border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: active === t.key ? 700 : 500,
            color: active === t.key ? "#4F46E5" : "#64748B",
            borderBottom: active === t.key ? "2px solid #4F46E5" : "2px solid transparent",
            marginBottom: -2,
          }}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function StatusConfigPage() {
  const [tab,       setTab]       = useState<"combos" | "assignment" | "active">("combos");
  const [combos,    setCombos]    = useState<Combo[]>([]);
  const [configs,   setConfigs]   = useState<OtaConfig[]>([]);
  const [loading,   setLoading]   = useState(true);

  // Combo manager state
  const [editingCombo, setEditingCombo] = useState<string | null>(null); // subStatus key
  const [editStatuses, setEditStatuses] = useState<string[]>([]);
  const [showAddForm,  setShowAddForm]  = useState(false);
  const [newSubStatus, setNewSubStatus] = useState("");
  const [newStatuses,  setNewStatuses]  = useState<string[]>([]);
  const [savingCombo,  setSavingCombo]  = useState(false);

  // OTA assignment state
  const [selOta,    setSelOta]    = useState(OTAS[0]);
  const [pending,   setPending]   = useState<Record<string, string[]>>({}); // ota → enabled subStatuses
  const [savingOta, setSavingOta] = useState<string | null>(null);
  const [savedOta,  setSavedOta]  = useState<string | null>(null);

  async function fetchAll() {
    setLoading(true);
    const [masterRes, configRes] = await Promise.all([
      fetch("/api/admin/status-config/master").then(r => r.json()),
      fetch("/api/admin/status-config").then(r => r.json()),
    ]);
    setCombos(masterRes.combos ?? []);
    setConfigs(configRes.configs ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchAll(); }, []);

  // When configs load, initialise pending selections
  useEffect(() => {
    const init: Record<string, string[]> = {};
    for (const cfg of configs) init[cfg.ota] = [...cfg.subStatuses];
    setPending(init);
  }, [configs]);

  // ── Combo manager actions ────────────────────────────────────────────────

  async function saveCombo(subStatus: string, statuses: string[]) {
    setSavingCombo(true);
    await fetch("/api/admin/status-config/master", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subStatus, statuses }),
    });
    setSavingCombo(false);
    setEditingCombo(null);
    setShowAddForm(false);
    setNewSubStatus("");
    setNewStatuses([]);
    fetchAll();
  }

  async function deleteCombo(subStatus: string) {
    if (!confirm(`Delete combo "${subStatus}"? It will be removed from all OTA configs.`)) return;
    await fetch("/api/admin/status-config/master", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subStatus }),
    });
    fetchAll();
  }

  // ── OTA assignment actions ───────────────────────────────────────────────

  function toggleCombo(ota: string, subStatus: string) {
    setPending(prev => {
      const cur = prev[ota] ?? [];
      const next = cur.includes(subStatus) ? cur.filter(s => s !== subStatus) : [...cur, subStatus];
      return { ...prev, [ota]: next };
    });
  }

  async function saveOtaAssignment(ota: string) {
    setSavingOta(ota);
    await fetch("/api/admin/status-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ota, subStatuses: pending[ota] ?? [] }),
    });
    setSavingOta(null);
    setSavedOta(ota);
    setTimeout(() => setSavedOta(null), 2000);
    fetchAll();
  }

  async function resetOta(ota: string) {
    if (!confirm(`Reset "${ota}" to defaults?`)) return;
    await fetch("/api/admin/status-config", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ota }),
    });
    fetchAll();
  }

  // ── Derived ──────────────────────────────────────────────────────────────

  // For each sub_status in master, which OTAs currently use it?
  const usedBy: Record<string, string[]> = {};
  for (const combo of combos) usedBy[combo.subStatus] = [];
  for (const cfg of configs) {
    for (const ss of cfg.subStatuses) {
      if (usedBy[ss]) usedBy[ss].push(cfg.ota);
    }
  }

  const selConfig = configs.find(c => c.ota === selOta);
  const pendingForOta = pending[selOta] ?? [];
  const isDirty = JSON.stringify([...(pendingForOta)].sort()) !==
    JSON.stringify([...(selConfig?.subStatuses ?? [])].sort());

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 14 }}>Loading…</div>
  );

  const TABS = [
    { key: "combos",     label: "Combo Manager" },
    { key: "assignment", label: "OTA Assignment" },
    { key: "active",     label: "Active Logic" },
  ];

  return (
    <div style={{ padding: "20px 24px", background: "#F8FAFC", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>Status & Sub-Status Logic</div>
          <div style={{ fontSize: 12, color: "#94A3B8", marginTop: 3 }}>
            Define canonical sub-status → status combos, then assign them per OTA.
          </div>
        </div>

        <TabStrip tabs={TABS} active={tab} onChange={k => setTab(k as typeof tab)} />

        {/* ── TAB 1: Combo Manager ── */}
        {tab === "combos" && (
          <div>
            <div style={{ fontSize: 12, color: "#64748B", marginBottom: 14 }}>
              Master list of all sub-status → status mappings. OTAs pick from these combos — no free-form entries allowed per OTA.
            </div>

            <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden" }}>
              {/* Table header */}
              <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 160px 80px",
                padding: "10px 16px", background: "#F8FAFC",
                borderBottom: "1px solid #E2E8F0", gap: 12 }}>
                {["Sub-Status", "Maps to Statuses", "Used by OTAs", "Actions"].map(h => (
                  <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase" }}>{h}</div>
                ))}
              </div>

              {combos.map((combo, idx) => {
                const isEditing = editingCombo === combo.subStatus;
                return (
                  <div key={combo.subStatus} style={{
                    display: "grid", gridTemplateColumns: "200px 1fr 160px 80px",
                    padding: "10px 16px", gap: 12, alignItems: "start",
                    borderBottom: idx < combos.length - 1 ? "1px solid #F1F5F9" : "none",
                    background: isEditing ? "#F8FAFF" : "transparent",
                  }}>
                    {/* Sub-status name */}
                    <div style={{ fontWeight: 600, fontSize: 12, color: "#1E293B", paddingTop: 4 }}>
                      {combo.subStatus}
                    </div>

                    {/* Statuses — edit mode or display */}
                    <div>
                      {isEditing ? (
                        <StatusTagInput value={editStatuses} onChange={setEditStatuses} />
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, paddingTop: 2 }}>
                          {combo.statuses.map(s => <Chip key={s} label={s} />)}
                        </div>
                      )}
                    </div>

                    {/* Used by */}
                    <div style={{ paddingTop: 4 }}>
                      {(usedBy[combo.subStatus] ?? []).length === 0 ? (
                        <span style={{ fontSize: 10, color: "#CBD5E1" }}>None</span>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                          {(usedBy[combo.subStatus] ?? []).map(ota => (
                            <span key={ota} style={{ fontSize: 9, fontWeight: 700,
                              padding: "2px 6px", borderRadius: 10,
                              background: hex2rgba(otaColor(ota), 0.12),
                              color: otaColor(ota) }}>{ota}</span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 6, paddingTop: 2 }}>
                      {isEditing ? (
                        <>
                          <button onClick={() => saveCombo(combo.subStatus, editStatuses)} disabled={savingCombo}
                            style={{ padding: "3px 10px", background: "#4F46E5", color: "#fff", border: "none",
                              borderRadius: 5, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                            {savingCombo ? "…" : "Save"}
                          </button>
                          <button onClick={() => setEditingCombo(null)}
                            style={{ padding: "3px 8px", background: "#F1F5F9", color: "#64748B",
                              border: "none", borderRadius: 5, cursor: "pointer", fontSize: 11 }}>
                            ✕
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditingCombo(combo.subStatus); setEditStatuses([...combo.statuses]); }}
                            style={{ padding: "3px 8px", background: "none", border: "1px solid #E2E8F0",
                              borderRadius: 5, cursor: "pointer", fontSize: 11, color: "#475569" }}>
                            ✎
                          </button>
                          <button onClick={() => deleteCombo(combo.subStatus)}
                            style={{ padding: "3px 8px", background: "none", border: "1px solid #FCA5A5",
                              borderRadius: 5, cursor: "pointer", fontSize: 11, color: "#DC2626" }}>
                            ✕
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Add new combo row */}
              {showAddForm ? (
                <div style={{ padding: "12px 16px", borderTop: "1px dashed #E2E8F0",
                  display: "grid", gridTemplateColumns: "200px 1fr auto", gap: 12, alignItems: "start",
                  background: "#FAFBFF" }}>
                  <input
                    autoFocus
                    value={newSubStatus}
                    onChange={e => setNewSubStatus(e.target.value)}
                    placeholder="Sub-status name…"
                    style={{ padding: "6px 10px", border: "1px solid #CBD5E1", borderRadius: 7,
                      fontSize: 12, outline: "none", color: "#1E293B" }}
                  />
                  <StatusTagInput value={newStatuses} onChange={setNewStatuses} />
                  <div style={{ display: "flex", gap: 6, paddingTop: 2 }}>
                    <button
                      onClick={() => { if (newSubStatus.trim()) saveCombo(newSubStatus.trim(), newStatuses); }}
                      disabled={!newSubStatus.trim() || savingCombo}
                      style={{ padding: "6px 14px", background: "#4F46E5", color: "#fff",
                        border: "none", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 700,
                        opacity: !newSubStatus.trim() ? 0.5 : 1 }}>
                      {savingCombo ? "Saving…" : "Add"}
                    </button>
                    <button onClick={() => { setShowAddForm(false); setNewSubStatus(""); setNewStatuses([]); }}
                      style={{ padding: "6px 10px", background: "#F1F5F9", color: "#64748B",
                        border: "none", borderRadius: 7, cursor: "pointer", fontSize: 12 }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ padding: "10px 16px", borderTop: "1px dashed #E2E8F0" }}>
                  <button onClick={() => setShowAddForm(true)}
                    style={{ padding: "6px 14px", background: "none", border: "1px dashed #4F46E5",
                      borderRadius: 7, cursor: "pointer", fontSize: 12, color: "#4F46E5", fontWeight: 600 }}>
                    + New Combo
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 2: OTA Assignment ── */}
        {tab === "assignment" && (
          <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 16 }}>

            {/* OTA nav */}
            <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden", alignSelf: "start" }}>
              {OTAS.map(ota => {
                const cfg = configs.find(c => c.ota === ota);
                const col = otaColor(ota);
                return (
                  <button key={ota} onClick={() => setSelOta(ota)}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      padding: "10px 14px", background: selOta === ota ? hex2rgba(col, 0.08) : "transparent",
                      border: "none", borderLeft: selOta === ota ? `3px solid ${col}` : "3px solid transparent",
                      cursor: "pointer", transition: "all 0.15s",
                    }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: selOta === ota ? col : "#374151" }}>{ota}</div>
                    <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>
                      {cfg?.isDefault ? "Default" : `${cfg?.subStatuses.length ?? 0} combos`}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Combo checklist for selected OTA */}
            <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden" }}>
              {/* Header */}
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #E2E8F0",
                display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: otaColor(selOta) }}>{selOta}</div>
                  <div style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>
                    {pendingForOta.length} of {combos.length} combos active
                    {selConfig?.isDefault && <span style={{ marginLeft: 8, padding: "1px 6px",
                      background: "#FEF9C3", color: "#854D0E", borderRadius: 4, fontSize: 9, fontWeight: 700 }}>DEFAULT</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {!selConfig?.isDefault && (
                    <button onClick={() => resetOta(selOta)}
                      style={{ padding: "6px 12px", background: "none", border: "1px solid #E2E8F0",
                        borderRadius: 7, cursor: "pointer", fontSize: 11, color: "#94A3B8" }}>
                      Reset to default
                    </button>
                  )}
                  <button onClick={() => saveOtaAssignment(selOta)} disabled={!isDirty || savingOta === selOta}
                    style={{ padding: "6px 16px", borderRadius: 7, border: "none",
                      background: savedOta === selOta ? "#10B981" : isDirty ? otaColor(selOta) : "#E2E8F0",
                      color: isDirty ? "#fff" : "#94A3B8",
                      cursor: isDirty ? "pointer" : "not-allowed", fontSize: 12, fontWeight: 700 }}>
                    {savingOta === selOta ? "Saving…" : savedOta === selOta ? "✓ Saved" : "Save Changes"}
                  </button>
                </div>
              </div>

              {/* Select all / none */}
              <div style={{ padding: "8px 18px", borderBottom: "1px solid #F1F5F9",
                display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "#94A3B8" }}>Quick select:</span>
                <button onClick={() => setPending(p => ({ ...p, [selOta]: combos.map(c => c.subStatus) }))}
                  style={{ fontSize: 10, color: "#4F46E5", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  All
                </button>
                <button onClick={() => setPending(p => ({ ...p, [selOta]: [] }))}
                  style={{ fontSize: 10, color: "#64748B", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  None
                </button>
              </div>

              {/* Combo list */}
              <div style={{ padding: "8px 0" }}>
                {combos.map(combo => {
                  const active = pendingForOta.includes(combo.subStatus);
                  return (
                    <label key={combo.subStatus}
                      style={{ display: "flex", alignItems: "center", gap: 12,
                        padding: "8px 18px", cursor: "pointer",
                        background: active ? hex2rgba(otaColor(selOta), 0.04) : "transparent",
                        borderLeft: active ? `2px solid ${otaColor(selOta)}` : "2px solid transparent",
                        transition: "all 0.1s" }}>
                      <input type="checkbox" checked={active}
                        onChange={() => toggleCombo(selOta, combo.subStatus)}
                        style={{ accentColor: otaColor(selOta), width: 14, height: 14 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: active ? "#1E293B" : "#475569" }}>
                          {combo.subStatus}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 3 }}>
                          {combo.statuses.map(s => (
                            <span key={s} style={{ fontSize: 9, fontWeight: 500, color: "#64748B",
                              background: "#F1F5F9", padding: "1px 6px", borderRadius: 4 }}>
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 3: Active Logic ── */}
        {tab === "active" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
            {configs.map(cfg => {
              const col = otaColor(cfg.ota);
              return (
                <div key={cfg.ota} style={{ background: "#fff", border: "1px solid #E2E8F0",
                  borderRadius: 10, overflow: "hidden" }}>
                  {/* Card header */}
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid #F1F5F9",
                    background: hex2rgba(col, 0.05), display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: col }}>{cfg.ota}</div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {cfg.isDefault && (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px",
                          background: "#FEF9C3", color: "#854D0E", borderRadius: 10 }}>DEFAULT</span>
                      )}
                      <span style={{ fontSize: 10, color: "#94A3B8" }}>
                        {cfg.subStatuses.length} sub-statuses
                      </span>
                    </div>
                  </div>

                  {/* Combo rows */}
                  <div style={{ padding: "8px 0" }}>
                    {cfg.subStatuses.map(ss => {
                      const mapped = cfg.statusMap[ss] ?? [];
                      return (
                        <div key={ss} style={{ padding: "6px 16px", display: "flex",
                          alignItems: "center", gap: 10,
                          borderBottom: "1px solid #F8FAFC" }}>
                          <div style={{ fontSize: 11, fontWeight: 600, color: "#374151",
                            minWidth: 130, flexShrink: 0 }}>{ss}</div>
                          <div style={{ fontSize: 9, color: "#94A3B8", flexShrink: 0 }}>→</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                            {mapped.length > 0 ? mapped.map(s => (
                              <span key={s} style={{ fontSize: 9, padding: "1px 6px",
                                background: hex2rgba(col, 0.1), color: col,
                                borderRadius: 4, fontWeight: 600 }}>{s}</span>
                            )) : (
                              <span style={{ fontSize: 9, color: "#CBD5E1" }}>—</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {cfg.subStatuses.length === 0 && (
                      <div style={{ padding: "12px 16px", fontSize: 11, color: "#CBD5E1" }}>No combos assigned</div>
                    )}
                  </div>

                  {/* Footer */}
                  {!cfg.isDefault && cfg.updatedBy && (
                    <div style={{ padding: "8px 16px", borderTop: "1px solid #F1F5F9",
                      fontSize: 10, color: "#94A3B8" }}>
                      Updated by {cfg.updatedBy}{cfg.updatedAt ? ` · ${timeSince(cfg.updatedAt)}` : ""}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
