"use client";

import { useEffect, useState, useRef } from "react";
import { OTA_COLORS, OTAS } from "@/lib/constants";

type OtaConfig = {
  ota: string;
  statuses: string[];
  subStatuses: Record<string, string[]>;
  updatedAt: string | null;
  updatedBy: string | null;
  isDefault: boolean;
};

function otaColor(ota: string) { return OTA_COLORS[ota] ?? "#64748B"; }
function hex2rgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

// ── inline add-input with enter-to-submit ────────────────────────────────────
function AddInput({ placeholder, accent, onAdd }: { placeholder: string; accent: string; onAdd: (v: string) => void }) {
  const [val, setVal] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  function submit() {
    const v = val.trim();
    if (!v) return;
    onAdd(v);
    setVal("");
    ref.current?.focus();
  }
  return (
    <div style={{ display: "inline-flex", alignItems: "center", border: `1px dashed ${accent}`, borderRadius: 6, overflow: "hidden", verticalAlign: "middle" }}>
      <input ref={ref} value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter") submit(); }}
        placeholder={placeholder}
        style={{ padding: "3px 8px", border: "none", outline: "none", fontSize: 11, color: "#374151", background: "transparent", width: 120 }} />
      <button onClick={submit}
        style={{ padding: "3px 8px", background: accent, color: "#fff", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>+</button>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────
export default function StatusConfigPage() {
  const [configs,  setConfigs]  = useState<OtaConfig[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [selOta,   setSelOta]   = useState(OTAS[0]);
  const [tab,      setTab]      = useState<"active" | "edit">("active");

  // Working copy for the selected OTA
  const [statuses,    setStatuses]    = useState<string[]>([]);
  const [subStatuses, setSubStatuses] = useState<Record<string, string[]>>({});
  // Which status name is being renamed right now
  const [renaming, setRenaming] = useState<{ from: string; to: string } | null>(null);

  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  async function fetchConfigs() {
    const d = await fetch("/api/admin/status-config").then(r => r.json());
    setConfigs(d.configs ?? []);
    setLoading(false);
  }
  useEffect(() => { fetchConfigs(); }, []);

  useEffect(() => {
    const cfg = configs.find(c => c.ota === selOta);
    if (!cfg) return;
    setStatuses([...cfg.statuses]);
    setSubStatuses(JSON.parse(JSON.stringify(cfg.subStatuses)));
    setRenaming(null);
    setSaved(false);
  }, [selOta, configs]);

  // ── status mutations ───────────────────────────────────────────────────────
  function addStatus(name: string) {
    if (!name || statuses.includes(name)) return;
    setStatuses(prev => [...prev, name]);
    setSubStatuses(prev => ({ ...prev, [name]: [] }));
  }

  function removeStatus(s: string) {
    setStatuses(prev => prev.filter(x => x !== s));
    setSubStatuses(prev => { const n = { ...prev }; delete n[s]; return n; });
  }

  function commitRename() {
    if (!renaming) return;
    const { from, to: rawTo } = renaming;
    const to = rawTo.trim();
    if (!to || to === from) { setRenaming(null); return; }
    if (statuses.includes(to)) { setRenaming(null); return; }
    const newStatuses = statuses.map(s => s === from ? to : s);
    const newSub: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(subStatuses)) newSub[k === from ? to : k] = v;
    setStatuses(newStatuses);
    setSubStatuses(newSub);
    setRenaming(null);
  }

  function moveStatus(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= statuses.length) return;
    const next = [...statuses];
    [next[i], next[j]] = [next[j], next[i]];
    setStatuses(next);
  }

  // ── sub-status mutations ────────────────────────────────────────────────────
  function addSubStatus(status: string, ss: string) {
    if (!ss) return;
    setSubStatuses(prev => ({
      ...prev,
      [status]: prev[status]?.includes(ss) ? prev[status] : [...(prev[status] ?? []), ss],
    }));
  }

  function removeSubStatus(status: string, ss: string) {
    setSubStatuses(prev => ({ ...prev, [status]: (prev[status] ?? []).filter(x => x !== ss) }));
  }

  // ── save ───────────────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    await fetch("/api/admin/status-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ota: selOta, statuses, subStatuses }),
    });
    await fetchConfigs();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleReset() {
    if (!confirm(`Reset ${selOta} to defaults?`)) return;
    await fetch("/api/admin/status-config", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ota: selOta }),
    });
    await fetchConfigs();
  }

  const accent     = otaColor(selOta);
  const currentCfg = configs.find(c => c.ota === selOta);

  return (
    <div style={{ padding: "28px 32px", maxWidth: 960, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#1E293B" }}>Status &amp; Sub-Status Logic</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94A3B8" }}>
          Define statuses per OTA and map sub-statuses to each.
        </p>
      </div>

      {/* Tab strip */}
      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid #E8ECF0", marginBottom: 28 }}>
        {(["active", "edit"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "9px 20px", border: "none", background: "none", cursor: "pointer",
            fontSize: 13, fontWeight: tab === t ? 700 : 400,
            color: tab === t ? "#2563EB" : "#64748B",
            borderBottom: tab === t ? "2px solid #2563EB" : "2px solid transparent",
            marginBottom: -1,
          }}>
            {t === "active" ? "Active Logic" : "Edit Logic"}
          </button>
        ))}
      </div>

      {/* ── ACTIVE ────────────────────────────────────────────────────────── */}
      {tab === "active" && (
        loading ? <div style={{ color: "#94A3B8", fontSize: 13 }}>Loading…</div> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
            {configs.map(cfg => {
              const c = otaColor(cfg.ota);
              return (
                <div key={cfg.ota} style={{ background: "#fff", border: "1px solid #E8ECF0", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <div style={{ width: 9, height: 9, borderRadius: "50%", background: c }} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>{cfg.ota}</span>
                      {cfg.isDefault && <span style={{ fontSize: 9, color: "#94A3B8", background: "#F1F5F9", padding: "1px 5px", borderRadius: 3, textTransform: "uppercase", letterSpacing: "0.07em" }}>Default</span>}
                    </div>
                    <button onClick={() => { setSelOta(cfg.ota); setTab("edit"); }}
                      style={{ fontSize: 10, padding: "3px 8px", border: `1px solid ${hex2rgba(c, 0.35)}`, borderRadius: 5, background: "none", color: c, cursor: "pointer", fontWeight: 600 }}>
                      Edit
                    </button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {cfg.statuses.map(s => (
                      <div key={s} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                        <span style={{
                          flexShrink: 0, fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20,
                          background: hex2rgba(c, 0.1), color: c, border: `1px solid ${hex2rgba(c, 0.2)}`,
                          minWidth: 80, textAlign: "center",
                        }}>{s}</span>
                        {(cfg.subStatuses[s] ?? []).length > 0 && (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 4px", paddingTop: 2 }}>
                            {(cfg.subStatuses[s] ?? []).map(ss => (
                              <span key={ss} style={{
                                fontSize: 10, padding: "1px 6px", borderRadius: 10,
                                background: "#F1F5F9", color: "#64748B", border: "1px solid #E2E8F0",
                              }}>{ss}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  {cfg.updatedAt && (
                    <div style={{ marginTop: 8, fontSize: 10, color: "#CBD5E1", borderTop: "1px solid #F1F5F9", paddingTop: 6 }}>
                      Updated {new Date(cfg.updatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      {cfg.updatedBy ? ` · ${cfg.updatedBy}` : ""}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ── EDIT ──────────────────────────────────────────────────────────── */}
      {tab === "edit" && (
        <div>
          {/* OTA selector */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
            {OTAS.map(ota => {
              const c = otaColor(ota), sel = ota === selOta;
              const customised = !(configs.find(x => x.ota === ota)?.isDefault ?? true);
              return (
                <button key={ota} onClick={() => setSelOta(ota)} style={{
                  padding: "5px 14px", borderRadius: 20, cursor: "pointer", fontSize: 12,
                  fontWeight: sel ? 700 : 500,
                  border: `1.5px solid ${sel ? c : "#E2E8F0"}`,
                  background: sel ? hex2rgba(c, 0.1) : "#fff",
                  color: sel ? c : "#64748B",
                  position: "relative",
                }}>
                  {ota}
                  {customised && <span style={{ position: "absolute", top: -3, right: -3, width: 7, height: 7, borderRadius: "50%", background: c, border: "1.5px solid #fff" }} />}
                </button>
              );
            })}
          </div>

          {/* Editor card */}
          <div style={{ background: "#fff", border: "1px solid #E8ECF0", borderRadius: 12, overflow: "hidden" }}>

            {/* Card top bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid #F1F5F9" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 11, height: 11, borderRadius: "50%", background: accent }} />
                <span style={{ fontSize: 15, fontWeight: 800, color: "#1E293B" }}>{selOta}</span>
                {currentCfg?.isDefault && <span style={{ fontSize: 10, color: "#94A3B8", background: "#F1F5F9", padding: "2px 7px", borderRadius: 4 }}>Default</span>}
                {currentCfg?.updatedAt && (
                  <span style={{ fontSize: 11, color: "#94A3B8" }}>
                    · saved {new Date(currentCfg.updatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    {currentCfg.updatedBy ? ` by ${currentCfg.updatedBy}` : ""}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleReset}
                  style={{ fontSize: 11, padding: "5px 12px", border: "1px solid #E2E8F0", borderRadius: 6, background: "#fff", color: "#94A3B8", cursor: "pointer" }}>
                  Reset to Default
                </button>
                <button onClick={handleSave} disabled={saving} style={{
                  fontSize: 12, fontWeight: 700, padding: "6px 20px", borderRadius: 7, border: "none",
                  cursor: saving ? "default" : "pointer",
                  background: saved ? "#10B981" : accent, color: "#fff",
                  opacity: saving ? 0.7 : 1, transition: "background 0.3s",
                }}>
                  {saving ? "Saving…" : saved ? "✓ Saved" : "Save Changes"}
                </button>
              </div>
            </div>

            {/* Column headers */}
            <div style={{ display: "grid", gridTemplateColumns: "40px 200px 1fr 60px", padding: "8px 20px", background: "#F8FAFC", borderBottom: "1px solid #F1F5F9" }}>
              <div />
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em" }}>Status</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em" }}>Sub-Statuses</div>
              <div />
            </div>

            {/* Status rows */}
            <div>
              {statuses.map((s, i) => (
                <div key={s} style={{
                  display: "grid", gridTemplateColumns: "40px 200px 1fr 60px",
                  alignItems: "flex-start", padding: "10px 20px",
                  borderBottom: "1px solid #F9FAFB",
                  background: "#fff",
                }}>

                  {/* Reorder */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 4 }}>
                    <button onClick={() => moveStatus(i, -1)} disabled={i === 0}
                      style={{ background: "none", border: "none", cursor: i === 0 ? "default" : "pointer", color: i === 0 ? "#E2E8F0" : "#94A3B8", fontSize: 11, padding: 0, lineHeight: 1 }}>↑</button>
                    <button onClick={() => moveStatus(i, 1)} disabled={i === statuses.length - 1}
                      style={{ background: "none", border: "none", cursor: i === statuses.length - 1 ? "default" : "pointer", color: i === statuses.length - 1 ? "#E2E8F0" : "#94A3B8", fontSize: 11, padding: 0, lineHeight: 1 }}>↓</button>
                  </div>

                  {/* Status name — click to rename */}
                  <div style={{ paddingRight: 12, paddingTop: 3 }}>
                    {renaming?.from === s ? (
                      <input
                        autoFocus
                        value={renaming.to}
                        onChange={e => setRenaming({ from: s, to: e.target.value })}
                        onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(null); }}
                        onBlur={commitRename}
                        style={{
                          width: "100%", padding: "4px 8px", fontSize: 12, fontWeight: 600,
                          border: `1.5px solid ${accent}`, borderRadius: 6, outline: "none", color: "#1E293B",
                        }}
                      />
                    ) : (
                      <button
                        onClick={() => setRenaming({ from: s, to: s })}
                        title="Click to rename"
                        style={{
                          display: "block", width: "100%", textAlign: "left",
                          padding: "4px 10px", fontSize: 12, fontWeight: 600,
                          background: hex2rgba(accent, 0.08), color: accent,
                          border: `1px solid ${hex2rgba(accent, 0.2)}`, borderRadius: 6,
                          cursor: "text",
                        }}>
                        {s}
                      </button>
                    )}
                  </div>

                  {/* Sub-statuses */}
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 6px", paddingTop: 4 }}>
                    {(subStatuses[s] ?? []).map(ss => (
                      <span key={ss} style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "2px 6px 2px 8px", borderRadius: 20, fontSize: 11,
                        background: "#F1F5F9", color: "#475569", border: "1px solid #E2E8F0",
                      }}>
                        {ss}
                        <button onClick={() => removeSubStatus(s, ss)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: 13, padding: 0, lineHeight: 1, fontWeight: 700 }}>×</button>
                      </span>
                    ))}
                    <AddInput
                      placeholder="Add sub-status"
                      accent={accent}
                      onAdd={ss => addSubStatus(s, ss)}
                    />
                  </div>

                  {/* Delete status */}
                  <div style={{ display: "flex", justifyContent: "center", paddingTop: 6 }}>
                    <button onClick={() => removeStatus(s)}
                      title="Remove status"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#FDA4AF", fontSize: 15, padding: "2px 6px", fontWeight: 700 }}>
                      ×
                    </button>
                  </div>
                </div>
              ))}

              {/* Add new status row */}
              <div style={{ display: "grid", gridTemplateColumns: "40px 200px 1fr 60px", padding: "10px 20px", background: "#FAFBFC", borderTop: "1px solid #F1F5F9" }}>
                <div />
                <div>
                  <AddInput
                    placeholder="New status…"
                    accent={accent}
                    onAdd={addStatus}
                  />
                </div>
                <div style={{ paddingTop: 5, paddingLeft: 4, fontSize: 11, color: "#CBD5E1" }}>
                  Add a status first, then map sub-statuses to it
                </div>
                <div />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
