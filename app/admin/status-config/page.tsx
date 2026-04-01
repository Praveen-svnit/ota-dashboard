"use client";

import { useEffect, useState, useRef } from "react";
import { OTA_COLORS, OTAS } from "@/lib/constants";

type OtaConfig = {
  ota: string;
  statuses: string[];
  subStatuses: string[];
  updatedAt: string | null;
  updatedBy: string | null;
  isDefault: boolean;
};

type Tab = "active" | "edit";

// ── colour helpers ────────────────────────────────────────────────────────────
function otaColor(ota: string) { return OTA_COLORS[ota] ?? "#64748B"; }

function hex2rgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ── small chip component ──────────────────────────────────────────────────────
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

// ── editable list ─────────────────────────────────────────────────────────────
function EditableList({
  label, items, accent, onChange,
}: {
  label: string; items: string[]; accent: string; onChange: (v: string[]) => void;
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
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
        {label} <span style={{ fontWeight: 400, color: "#CBD5E1" }}>({items.length})</span>
      </div>

      <div style={{ border: "1px solid #E8ECF0", borderRadius: 8, overflow: "hidden", background: "#FAFBFC" }}>
        {items.length === 0 && (
          <div style={{ padding: "12px 14px", fontSize: 12, color: "#CBD5E1", fontStyle: "italic" }}>
            No items — add one below
          </div>
        )}
        {items.map((item, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "7px 10px",
            borderBottom: i < items.length - 1 ? "1px solid #F1F5F9" : "none",
            background: "#fff",
          }}>
            <span style={{
              flex: 1, fontSize: 12, color: "#1E293B",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{item}</span>
            <button onClick={() => move(i, -1)} disabled={i === 0}
              style={{ background: "none", border: "none", cursor: i === 0 ? "default" : "pointer", color: i === 0 ? "#E2E8F0" : "#94A3B8", fontSize: 12, padding: "0 2px", lineHeight: 1 }}>↑</button>
            <button onClick={() => move(i, 1)} disabled={i === items.length - 1}
              style={{ background: "none", border: "none", cursor: i === items.length - 1 ? "default" : "pointer", color: i === items.length - 1 ? "#E2E8F0" : "#94A3B8", fontSize: 12, padding: "0 2px", lineHeight: 1 }}>↓</button>
            <button onClick={() => remove(i)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#FDA4AF", fontSize: 13, padding: "0 2px", lineHeight: 1, fontWeight: 600 }}>×</button>
          </div>
        ))}

        {/* Add row */}
        <div style={{ display: "flex", gap: 0, borderTop: items.length > 0 ? "1px solid #E8ECF0" : "none" }}>
          <input
            ref={inputRef}
            value={newVal}
            onChange={e => setNewVal(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") add(); }}
            placeholder="Add new…"
            style={{
              flex: 1, padding: "7px 12px", border: "none", background: "transparent",
              fontSize: 12, color: "#1E293B", outline: "none",
            }}
          />
          <button onClick={add}
            style={{
              padding: "6px 14px", background: accent, color: "#fff",
              border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600,
              borderRadius: 0,
            }}>+ Add</button>
        </div>
      </div>
    </div>
  );
}

// ── main page ─────────────────────────────────────────────────────────────────
export default function StatusConfigPage() {
  const [tab, setTab]         = useState<Tab>("active");
  const [configs, setConfigs] = useState<OtaConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selOta, setSelOta]   = useState(OTAS[0]);
  const [edit, setEdit]       = useState<{ statuses: string[]; subStatuses: string[] } | null>(null);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  useEffect(() => {
    fetch("/api/admin/status-config")
      .then(r => r.json())
      .then(d => { setConfigs(d.configs ?? []); setLoading(false); });
  }, []);

  // Sync edit state whenever selectedOta or configs change
  useEffect(() => {
    const cfg = configs.find(c => c.ota === selOta);
    if (cfg) setEdit({ statuses: [...cfg.statuses], subStatuses: [...cfg.subStatuses] });
    setSaved(false);
  }, [selOta, configs]);

  async function handleSave() {
    if (!edit) return;
    setSaving(true);
    await fetch("/api/admin/status-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ota: selOta, statuses: edit.statuses, subStatuses: edit.subStatuses }),
    });
    // Refresh
    const d = await fetch("/api/admin/status-config").then(r => r.json());
    setConfigs(d.configs ?? []);
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
    const d = await fetch("/api/admin/status-config").then(r => r.json());
    setConfigs(d.configs ?? []);
  }

  const currentCfg = configs.find(c => c.ota === selOta);
  const accent      = otaColor(selOta);

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100, margin: "0 auto" }}>

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#1E293B" }}>Status &amp; Sub-Status Logic</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94A3B8" }}>
          Define which status and sub-status options are available per OTA in the CRM dropdown.
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

      {/* ── Active Logic ───────────────────────────────────────────────────── */}
      {tab === "active" && (
        loading
          ? <div style={{ color: "#94A3B8", fontSize: 13 }}>Loading…</div>
          : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
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
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>{cfg.ota}</span>
                      </div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        {cfg.isDefault && (
                          <span style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", background: "#F1F5F9", padding: "2px 6px", borderRadius: 4, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                            Default
                          </span>
                        )}
                        <button onClick={() => { setSelOta(cfg.ota); setTab("edit"); }}
                          style={{ fontSize: 10, padding: "3px 8px", background: "none", border: `1px solid ${hex2rgba(color, 0.35)}`, borderRadius: 5, color, cursor: "pointer", fontWeight: 600 }}>
                          Edit
                        </button>
                      </div>
                    </div>

                    {/* Statuses */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#B0BAC9", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>
                        Statuses ({cfg.statuses.length})
                      </div>
                      <div>{cfg.statuses.map(s => <Chip key={s} label={s} color={color} />)}</div>
                    </div>

                    {/* Sub-statuses */}
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#B0BAC9", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 5 }}>
                        Sub-Statuses ({cfg.subStatuses.length})
                      </div>
                      <div>{cfg.subStatuses.map(s => <Chip key={s} label={s} color="#64748B" />)}</div>
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

      {/* ── Edit Logic ─────────────────────────────────────────────────────── */}
      {tab === "edit" && (
        <div>
          {/* OTA selector strip */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24 }}>
            {OTAS.map(ota => {
              const c     = otaColor(ota);
              const sel   = ota === selOta;
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
                    <span style={{
                      position: "absolute", top: -4, right: -4, width: 8, height: 8,
                      borderRadius: "50%", background: c, border: "1.5px solid #fff",
                    }} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Editor panel */}
          {edit && (
            <div style={{ background: "#fff", border: "1px solid #E8ECF0", borderRadius: 12, padding: "24px 28px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              {/* Panel header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: accent }} />
                  <span style={{ fontSize: 16, fontWeight: 800, color: "#1E293B" }}>{selOta}</span>
                  {currentCfg?.isDefault && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", background: "#F1F5F9", padding: "2px 7px", borderRadius: 4 }}>
                      Default
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {currentCfg?.updatedAt && (
                    <span style={{ fontSize: 11, color: "#94A3B8" }}>
                      Saved {new Date(currentCfg.updatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                      {currentCfg.updatedBy ? ` by ${currentCfg.updatedBy}` : ""}
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

              {/* Two-column editor */}
              <div style={{ display: "flex", gap: 24 }}>
                <EditableList
                  label="Statuses"
                  items={edit.statuses}
                  accent={accent}
                  onChange={v => setEdit(e => e ? { ...e, statuses: v } : e)}
                />
                <EditableList
                  label="Sub-Statuses"
                  items={edit.subStatuses}
                  accent={accent}
                  onChange={v => setEdit(e => e ? { ...e, subStatuses: v } : e)}
                />
              </div>

              {/* Preview */}
              <div style={{ marginTop: 24, padding: "14px 16px", background: "#F8FAFC", borderRadius: 8, border: "1px solid #F1F5F9" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#B0BAC9", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                  Preview — Dropdown will show these options
                </div>
                <div style={{ display: "flex", gap: 24 }}>
                  <div>
                    <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 4 }}>Status</div>
                    <select style={{ fontSize: 12, padding: "5px 10px", border: "1px solid #E2E8F0", borderRadius: 6, color: "#1E293B", background: "#fff" }}>
                      {edit.statuses.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "#94A3B8", marginBottom: 4 }}>Sub-Status</div>
                    <select style={{ fontSize: 12, padding: "5px 10px", border: "1px solid #E2E8F0", borderRadius: 6, color: "#1E293B", background: "#fff" }}>
                      {edit.subStatuses.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
