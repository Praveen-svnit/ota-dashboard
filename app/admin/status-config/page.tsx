"use client";

import { useEffect, useState, useRef } from "react";
import { OTA_COLORS, OTAS } from "@/lib/constants";

type OtaConfig = {
  ota: string;
  subStatuses: string[];
  statusMap: Record<string, string[]>;  // { [subStatus]: statuses[] }
  updatedAt: string | null;
  updatedBy: string | null;
  isDefault: boolean;
};

function otaColor(ota: string) { return OTA_COLORS[ota] ?? "#64748B"; }
function hex2rgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

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
        style={{ padding: "3px 8px", border: "none", outline: "none", fontSize: 11, color: "#374151", background: "transparent", width: 130 }} />
      <button onClick={submit}
        style={{ padding: "3px 8px", background: accent, color: "#fff", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>+</button>
    </div>
  );
}

export default function StatusConfigPage() {
  const [configs,  setConfigs]  = useState<OtaConfig[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [selOta,   setSelOta]   = useState(OTAS[0]);
  const [tab,      setTab]      = useState<"active" | "edit">("active");

  const [subStatuses, setSubStatuses] = useState<string[]>([]);
  const [statusMap,   setStatusMap]   = useState<Record<string, string[]>>({});
  const [renaming,    setRenaming]    = useState<{ from: string; to: string } | null>(null);

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
    setSubStatuses([...cfg.subStatuses]);
    setStatusMap(JSON.parse(JSON.stringify(cfg.statusMap)));
    setRenaming(null);
    setSaved(false);
  }, [selOta, configs]);

  // ── sub-status list mutations ──────────────────────────────────────────────
  function addSubStatus(name: string) {
    if (!name || subStatuses.includes(name)) return;
    setSubStatuses(prev => [...prev, name]);
    setStatusMap(prev => ({ ...prev, [name]: [] }));
  }

  function removeSubStatus(ss: string) {
    setSubStatuses(prev => prev.filter(x => x !== ss));
    setStatusMap(prev => { const n = { ...prev }; delete n[ss]; return n; });
  }

  function moveSubStatus(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= subStatuses.length) return;
    const next = [...subStatuses];
    [next[i], next[j]] = [next[j], next[i]];
    setSubStatuses(next);
  }

  function commitRename() {
    if (!renaming) return;
    const { from, to: rawTo } = renaming;
    const to = rawTo.trim();
    if (!to || to === from) { setRenaming(null); return; }
    if (subStatuses.includes(to)) { setRenaming(null); return; }
    setSubStatuses(prev => prev.map(x => x === from ? to : x));
    setStatusMap(prev => {
      const n: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(prev)) n[k === from ? to : k] = v;
      return n;
    });
    setRenaming(null);
  }

  // ── mapped status mutations ────────────────────────────────────────────────
  function addStatus(subStatus: string, status: string) {
    if (!status) return;
    setStatusMap(prev => ({
      ...prev,
      [subStatus]: (prev[subStatus] ?? []).includes(status)
        ? prev[subStatus]
        : [...(prev[subStatus] ?? []), status],
    }));
  }

  function removeStatus(subStatus: string, status: string) {
    setStatusMap(prev => ({ ...prev, [subStatus]: (prev[subStatus] ?? []).filter(x => x !== status) }));
  }

  // ── save / reset ───────────────────────────────────────────────────────────
  async function handleSave() {
    setSaving(true);
    await fetch("/api/admin/status-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ota: selOta, subStatuses, statusMap }),
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

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#1E293B" }}>Status &amp; Sub-Status Logic</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94A3B8" }}>
          Define sub-statuses per OTA and map the statuses they belong to.
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
                    {cfg.subStatuses.map(ss => (
                      <div key={ss} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                        {/* Sub-status */}
                        <span style={{
                          flexShrink: 0, fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 20,
                          background: "#F1F5F9", color: "#475569", border: "1px solid #E2E8F0",
                          minWidth: 90, textAlign: "center",
                        }}>{ss}</span>
                        {(cfg.statusMap[ss] ?? []).length > 0 && (
                          <>
                            <span style={{ fontSize: 10, color: "#CBD5E1", paddingTop: 3 }}>→</span>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 4px", paddingTop: 2 }}>
                              {(cfg.statusMap[ss] ?? []).map(s => (
                                <span key={s} style={{
                                  fontSize: 10, padding: "1px 7px", borderRadius: 10,
                                  background: hex2rgba(c, 0.1), color: c, border: `1px solid ${hex2rgba(c, 0.2)}`,
                                }}>{s}</span>
                              ))}
                            </div>
                          </>
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

            {/* Top bar */}
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
            <div style={{ display: "grid", gridTemplateColumns: "40px 220px 1fr 48px", padding: "8px 20px", background: "#F8FAFC", borderBottom: "1px solid #F1F5F9" }}>
              <div />
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em" }}>Sub-Status</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em" }}>Mapped Statuses</div>
              <div />
            </div>

            {/* Rows */}
            <div>
              {subStatuses.map((ss, i) => (
                <div key={ss} style={{
                  display: "grid", gridTemplateColumns: "40px 220px 1fr 48px",
                  alignItems: "flex-start", padding: "10px 20px",
                  borderBottom: "1px solid #F9FAFB", background: "#fff",
                }}>

                  {/* Reorder */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 5 }}>
                    <button onClick={() => moveSubStatus(i, -1)} disabled={i === 0}
                      style={{ background: "none", border: "none", cursor: i === 0 ? "default" : "pointer", color: i === 0 ? "#E2E8F0" : "#94A3B8", fontSize: 11, padding: 0, lineHeight: 1 }}>↑</button>
                    <button onClick={() => moveSubStatus(i, 1)} disabled={i === subStatuses.length - 1}
                      style={{ background: "none", border: "none", cursor: i === subStatuses.length - 1 ? "default" : "pointer", color: i === subStatuses.length - 1 ? "#E2E8F0" : "#94A3B8", fontSize: 11, padding: 0, lineHeight: 1 }}>↓</button>
                  </div>

                  {/* Sub-status name — click to rename */}
                  <div style={{ paddingRight: 14, paddingTop: 2 }}>
                    {renaming?.from === ss ? (
                      <input autoFocus value={renaming.to}
                        onChange={e => setRenaming({ from: ss, to: e.target.value })}
                        onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(null); }}
                        onBlur={commitRename}
                        style={{ width: "100%", padding: "4px 8px", fontSize: 12, fontWeight: 600, border: `1.5px solid ${accent}`, borderRadius: 6, outline: "none", color: "#1E293B" }}
                      />
                    ) : (
                      <button onClick={() => setRenaming({ from: ss, to: ss })} title="Click to rename"
                        style={{
                          display: "block", width: "100%", textAlign: "left",
                          padding: "4px 10px", fontSize: 12, fontWeight: 600,
                          background: "#F1F5F9", color: "#475569",
                          border: "1px solid #E2E8F0", borderRadius: 6, cursor: "text",
                        }}>
                        {ss}
                      </button>
                    )}
                  </div>

                  {/* Mapped statuses (OTA-coloured chips) */}
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 6px", paddingTop: 4 }}>
                    {(statusMap[ss] ?? []).map(s => (
                      <span key={s} style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "2px 6px 2px 9px", borderRadius: 20, fontSize: 11,
                        background: hex2rgba(accent, 0.1), color: accent, border: `1px solid ${hex2rgba(accent, 0.22)}`,
                      }}>
                        {s}
                        <button onClick={() => removeStatus(ss, s)}
                          style={{ background: "none", border: "none", cursor: "pointer", color: hex2rgba(accent, 0.5), fontSize: 13, padding: 0, lineHeight: 1, fontWeight: 700 }}>×</button>
                      </span>
                    ))}
                    <AddInput
                      placeholder="Map a status…"
                      accent={accent}
                      onAdd={s => addStatus(ss, s)}
                    />
                  </div>

                  {/* Delete row */}
                  <div style={{ display: "flex", justifyContent: "center", paddingTop: 5 }}>
                    <button onClick={() => removeSubStatus(ss)} title="Remove"
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#FDA4AF", fontSize: 15, padding: "2px 6px", fontWeight: 700 }}>×</button>
                  </div>
                </div>
              ))}

              {/* Add new sub-status */}
              <div style={{ display: "grid", gridTemplateColumns: "40px 220px 1fr 48px", padding: "10px 20px", background: "#FAFBFC", borderTop: "1px solid #F1F5F9" }}>
                <div />
                <div>
                  <AddInput placeholder="New sub-status…" accent={accent} onAdd={addSubStatus} />
                </div>
                <div style={{ paddingTop: 5, paddingLeft: 4, fontSize: 11, color: "#CBD5E1" }}>
                  Add a sub-status, then map statuses to it
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
