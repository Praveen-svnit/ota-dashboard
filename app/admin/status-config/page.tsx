"use client";

import { useEffect, useState, useRef } from "react";
import { OTA_COLORS, OTAS } from "@/lib/constants";

type OtaConfig = {
  ota: string;
  statuses: string[];
  subStatuses: Record<string, string[]>;  // { [status]: string[] }
  updatedAt: string | null;
  updatedBy: string | null;
  isDefault: boolean;
};

type Tab = "active" | "edit";

// ── helpers ───────────────────────────────────────────────────────────────────
function otaColor(ota: string) { return OTA_COLORS[ota] ?? "#64748B"; }

function hex2rgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function Chip({ label, color = "#64748B" }: { label: string; color?: string }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 20,
      fontSize: 10, fontWeight: 500, lineHeight: "16px",
      background: hex2rgba(color, 0.1), color,
      border: `1px solid ${hex2rgba(color, 0.25)}`,
      margin: "2px 3px 2px 0",
    }}>{label}</span>
  );
}

// ── small inline list editor ──────────────────────────────────────────────────
function MiniList({
  items, accent, onChange,
}: {
  items: string[]; accent: string; onChange: (v: string[]) => void;
}) {
  const [newVal, setNewVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function move(i: number, dir: -1 | 1) {
    const next = [...items];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }
  function remove(i: number) { onChange(items.filter((_, idx) => idx !== i)); }
  function add() {
    const v = newVal.trim();
    if (!v || items.includes(v)) return;
    onChange([...items, v]);
    setNewVal("");
    inputRef.current?.focus();
  }

  return (
    <div style={{ border: "1px solid #E8ECF0", borderRadius: 8, overflow: "hidden", background: "#FAFBFC" }}>
      {items.length === 0 && (
        <div style={{ padding: "10px 12px", fontSize: 12, color: "#CBD5E1", fontStyle: "italic" }}>None</div>
      )}
      {items.map((item, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 4, padding: "6px 10px",
          borderBottom: i < items.length - 1 ? "1px solid #F1F5F9" : "none",
          background: "#fff",
        }}>
          <span style={{ flex: 1, fontSize: 12, color: "#1E293B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item}</span>
          <button onClick={() => move(i, -1)} disabled={i === 0}
            style={{ background: "none", border: "none", cursor: i === 0 ? "default" : "pointer", color: i === 0 ? "#E2E8F0" : "#94A3B8", fontSize: 11, padding: "0 2px" }}>↑</button>
          <button onClick={() => move(i, 1)} disabled={i === items.length - 1}
            style={{ background: "none", border: "none", cursor: i === items.length - 1 ? "default" : "pointer", color: i === items.length - 1 ? "#E2E8F0" : "#94A3B8", fontSize: 11, padding: "0 2px" }}>↓</button>
          <button onClick={() => remove(i)}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#FDA4AF", fontSize: 13, padding: "0 2px", fontWeight: 600 }}>×</button>
        </div>
      ))}
      <div style={{ display: "flex", borderTop: items.length > 0 ? "1px solid #E8ECF0" : "none" }}>
        <input ref={inputRef} value={newVal} onChange={e => setNewVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") add(); }}
          placeholder="Add…"
          style={{ flex: 1, padding: "6px 10px", border: "none", background: "transparent", fontSize: 12, color: "#1E293B", outline: "none" }} />
        <button onClick={add}
          style={{ padding: "5px 12px", background: accent, color: "#fff", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>+</button>
      </div>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────
export default function StatusConfigPage() {
  const [tab, setTab]         = useState<Tab>("active");
  const [configs, setConfigs] = useState<OtaConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selOta, setSelOta]   = useState(OTAS[0]);

  // Edit state
  const [editStatuses,    setEditStatuses]    = useState<string[]>([]);
  const [editSubStatuses, setEditSubStatuses] = useState<Record<string, string[]>>({});
  const [selStatus, setSelStatus] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const [newStatus, setNewStatus] = useState("");

  async function fetchConfigs() {
    const d = await fetch("/api/admin/status-config").then(r => r.json());
    setConfigs(d.configs ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchConfigs(); }, []);

  // Sync edit state when selOta or configs change
  useEffect(() => {
    const cfg = configs.find(c => c.ota === selOta);
    if (cfg) {
      setEditStatuses([...cfg.statuses]);
      setEditSubStatuses(JSON.parse(JSON.stringify(cfg.subStatuses)));
      setSelStatus(cfg.statuses[0] ?? null);
    }
    setSaved(false);
  }, [selOta, configs]);

  function moveStatus(i: number, dir: -1 | 1) {
    const next = [...editStatuses];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    setEditStatuses(next);
  }

  function removeStatus(s: string) {
    setEditStatuses(prev => prev.filter(x => x !== s));
    setEditSubStatuses(prev => { const n = { ...prev }; delete n[s]; return n; });
    if (selStatus === s) setSelStatus(editStatuses.find(x => x !== s) ?? null);
  }

  function addStatus() {
    const v = newStatus.trim();
    if (!v || editStatuses.includes(v)) return;
    setEditStatuses(prev => [...prev, v]);
    setEditSubStatuses(prev => ({ ...prev, [v]: [] }));
    setSelStatus(v);
    setNewStatus("");
  }

  async function handleSave() {
    setSaving(true);
    await fetch("/api/admin/status-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ota: selOta, statuses: editStatuses, subStatuses: editSubStatuses }),
    });
    await fetchConfigs();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  async function handleReset() {
    if (!confirm(`Reset ${selOta} to default values?`)) return;
    await fetch("/api/admin/status-config", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ota: selOta }),
    });
    await fetchConfigs();
  }

  const currentCfg = configs.find(c => c.ota === selOta);
  const accent      = otaColor(selOta);

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1200, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#1E293B" }}>Status &amp; Sub-Status Logic</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94A3B8" }}>
          Define per-OTA status options and their mapped sub-statuses.
        </p>
      </div>

      {/* Tab strip */}
      <div style={{ display: "flex", gap: 2, borderBottom: "1px solid #E8ECF0", marginBottom: 28 }}>
        {(["active", "edit"] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: "9px 20px", border: "none", background: "none",
              cursor: "pointer", fontSize: 13, fontWeight: tab === t ? 700 : 400,
              color: tab === t ? "#2563EB" : "#64748B",
              borderBottom: tab === t ? "2px solid #2563EB" : "2px solid transparent",
              marginBottom: -1,
            }}>
            {t === "active" ? "Active Logic" : "Edit Logic"}
          </button>
        ))}
      </div>

      {/* ── Active Logic ──────────────────────────────────────────────────── */}
      {tab === "active" && (
        loading
          ? <div style={{ color: "#94A3B8", fontSize: 13 }}>Loading…</div>
          : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
              {configs.map(cfg => {
                const color = otaColor(cfg.ota);
                return (
                  <div key={cfg.ota} style={{
                    background: "#fff", border: "1px solid #E8ECF0", borderRadius: 10,
                    padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  }}>
                    {/* Card header */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>{cfg.ota}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {cfg.isDefault && (
                          <span style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", background: "#F1F5F9", padding: "2px 6px", borderRadius: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Default</span>
                        )}
                        <button onClick={() => { setSelOta(cfg.ota); setTab("edit"); }}
                          style={{ fontSize: 10, padding: "3px 8px", background: "none", border: `1px solid ${hex2rgba(color, 0.35)}`, borderRadius: 5, color, cursor: "pointer", fontWeight: 600 }}>
                          Edit
                        </button>
                      </div>
                    </div>

                    {/* Per-status sub-status listing */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {cfg.statuses.map(s => (
                        <div key={s}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <Chip label={s} color={color} />
                            {(cfg.subStatuses[s] ?? []).length > 0 && (
                              <>
                                <span style={{ fontSize: 10, color: "#CBD5E1" }}>→</span>
                                {(cfg.subStatuses[s] ?? []).map(ss => (
                                  <Chip key={ss} label={ss} color="#64748B" />
                                ))}
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Last updated */}
                    {cfg.updatedAt && (
                      <div style={{ marginTop: 10, fontSize: 10, color: "#CBD5E1", borderTop: "1px solid #F1F5F9", paddingTop: 8 }}>
                        Updated {new Date(cfg.updatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        {cfg.updatedBy ? ` by ${cfg.updatedBy}` : ""}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
      )}

      {/* ── Edit Logic ────────────────────────────────────────────────────── */}
      {tab === "edit" && (
        <div>
          {/* OTA selector */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24 }}>
            {OTAS.map(ota => {
              const c   = otaColor(ota);
              const sel = ota === selOta;
              const isDef = configs.find(x => x.ota === ota)?.isDefault ?? true;
              return (
                <button key={ota} onClick={() => setSelOta(ota)}
                  style={{
                    padding: "6px 14px", borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: sel ? 700 : 500,
                    border: `1.5px solid ${sel ? c : "#E2E8F0"}`,
                    background: sel ? hex2rgba(c, 0.1) : "#fff",
                    color: sel ? c : "#64748B",
                    position: "relative",
                  }}>
                  {ota}
                  {!isDef && (
                    <span style={{ position: "absolute", top: -4, right: -4, width: 8, height: 8, borderRadius: "50%", background: c, border: "1.5px solid #fff" }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Three-column editor */}
          <div style={{ background: "#fff", border: "1px solid #E8ECF0", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>

            {/* Panel header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #F1F5F9" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", background: accent }} />
                <span style={{ fontSize: 15, fontWeight: 800, color: "#1E293B" }}>{selOta}</span>
                {currentCfg?.isDefault && (
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", background: "#F1F5F9", padding: "2px 7px", borderRadius: 4 }}>Default</span>
                )}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {currentCfg?.updatedAt && (
                  <span style={{ fontSize: 11, color: "#94A3B8" }}>
                    Saved {new Date(currentCfg.updatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                    {currentCfg.updatedBy ? ` · ${currentCfg.updatedBy}` : ""}
                  </span>
                )}
                <button onClick={handleReset}
                  style={{ fontSize: 11, padding: "5px 12px", border: "1px solid #E2E8F0", borderRadius: 6, background: "#fff", color: "#94A3B8", cursor: "pointer" }}>
                  Reset to Default
                </button>
                <button onClick={handleSave} disabled={saving}
                  style={{
                    fontSize: 12, fontWeight: 700, padding: "7px 20px", borderRadius: 7,
                    border: "none", cursor: saving ? "default" : "pointer",
                    background: saved ? "#10B981" : accent, color: "#fff",
                    opacity: saving ? 0.7 : 1, transition: "background 0.3s",
                  }}>
                  {saving ? "Saving…" : saved ? "✓ Saved" : "Save Changes"}
                </button>
              </div>
            </div>

            {/* Three columns */}
            <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 1fr", height: 480 }}>

              {/* Col 1: Status list */}
              <div style={{ borderRight: "1px solid #F1F5F9", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "12px 14px", borderBottom: "1px solid #F1F5F9" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    Statuses ({editStatuses.length})
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: "auto" }}>
                  {editStatuses.map((s, i) => {
                    const isSel  = s === selStatus;
                    const subCnt = (editSubStatuses[s] ?? []).length;
                    return (
                      <div key={s}
                        onClick={() => setSelStatus(s)}
                        style={{
                          display: "flex", alignItems: "center", gap: 6,
                          padding: "9px 14px", cursor: "pointer",
                          borderBottom: "1px solid #F9FAFB",
                          background: isSel ? hex2rgba(accent, 0.08) : "#fff",
                          borderLeft: isSel ? `3px solid ${accent}` : "3px solid transparent",
                        }}>
                        <span style={{ flex: 1, fontSize: 12, fontWeight: isSel ? 600 : 400, color: isSel ? accent : "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s}</span>
                        {subCnt > 0 && (
                          <span style={{ fontSize: 10, color: "#94A3B8", flexShrink: 0 }}>{subCnt}</span>
                        )}
                        <button onClick={e => { e.stopPropagation(); moveStatus(i, -1); }} disabled={i === 0}
                          style={{ background: "none", border: "none", cursor: i === 0 ? "default" : "pointer", color: i === 0 ? "#E2E8F0" : "#94A3B8", fontSize: 10, padding: "0 1px" }}>↑</button>
                        <button onClick={e => { e.stopPropagation(); moveStatus(i, 1); }} disabled={i === editStatuses.length - 1}
                          style={{ background: "none", border: "none", cursor: i === editStatuses.length - 1 ? "default" : "pointer", color: i === editStatuses.length - 1 ? "#E2E8F0" : "#94A3B8", fontSize: 10, padding: "0 1px" }}>↓</button>
                        <button onClick={e => { e.stopPropagation(); removeStatus(s); }}
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#FDA4AF", fontSize: 13, padding: "0 1px", fontWeight: 600 }}>×</button>
                      </div>
                    );
                  })}
                </div>
                {/* Add status */}
                <div style={{ borderTop: "1px solid #E8ECF0", display: "flex" }}>
                  <input value={newStatus} onChange={e => setNewStatus(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") addStatus(); }}
                    placeholder="Add status…"
                    style={{ flex: 1, padding: "8px 12px", border: "none", fontSize: 12, color: "#1E293B", outline: "none", background: "transparent" }} />
                  <button onClick={addStatus}
                    style={{ padding: "6px 12px", background: accent, color: "#fff", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>+</button>
                </div>
              </div>

              {/* Col 2: Sub-statuses for selected status */}
              <div style={{ borderRight: "1px solid #F1F5F9", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "12px 14px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.1em" }}>Sub-Statuses for</div>
                  {selStatus
                    ? <Chip label={selStatus} color={accent} />
                    : <span style={{ fontSize: 11, color: "#CBD5E1" }}>← select a status</span>}
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
                  {selStatus
                    ? (
                      <MiniList
                        items={editSubStatuses[selStatus] ?? []}
                        accent={accent}
                        onChange={v => setEditSubStatuses(prev => ({ ...prev, [selStatus]: v }))}
                      />
                    )
                    : (
                      <div style={{ fontSize: 12, color: "#CBD5E1", fontStyle: "italic", marginTop: 8 }}>
                        Select a status on the left to edit its sub-statuses.
                      </div>
                    )
                  }
                </div>
              </div>

              {/* Col 3: Preview */}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "12px 14px", borderBottom: "1px solid #F1F5F9" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.1em" }}>Preview</div>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 6 }}>Status dropdown</div>
                    <select style={{ fontSize: 12, padding: "6px 10px", border: "1px solid #E2E8F0", borderRadius: 6, color: "#1E293B", background: "#fff", width: "100%" }}>
                      {editStatuses.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  {selStatus && (
                    <div>
                      <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 6 }}>
                        Sub-Status dropdown <span style={{ color: accent }}>(when status = {selStatus})</span>
                      </div>
                      <select style={{ fontSize: 12, padding: "6px 10px", border: "1px solid #E2E8F0", borderRadius: 6, color: "#1E293B", background: "#fff", width: "100%" }}>
                        {(editSubStatuses[selStatus] ?? []).map(s => <option key={s}>{s}</option>)}
                      </select>
                      {(editSubStatuses[selStatus] ?? []).length === 0 && (
                        <div style={{ fontSize: 11, color: "#FDA4AF", marginTop: 6 }}>No sub-statuses defined for this status</div>
                      )}
                    </div>
                  )}

                  {/* Full mapping summary */}
                  <div style={{ marginTop: 20, padding: "12px", background: "#F8FAFC", borderRadius: 8, border: "1px solid #F1F5F9" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#B0BAC9", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Full Mapping</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {editStatuses.map(s => (
                        <div key={s} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <Chip label={s} color={accent} />
                          <span style={{ fontSize: 10, color: "#CBD5E1" }}>→</span>
                          {(editSubStatuses[s] ?? []).length > 0
                            ? (editSubStatuses[s] ?? []).map(ss => <Chip key={ss} label={ss} color="#64748B" />)
                            : <span style={{ fontSize: 10, color: "#E2E8F0" }}>none</span>
                          }
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
