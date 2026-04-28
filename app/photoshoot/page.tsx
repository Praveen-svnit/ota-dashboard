"use client";

import { useState, useEffect, useMemo, useCallback } from "react";

const OTA_FIELDS: { key: string; label: string }[] = [
  { key: "ota_gommt",      label: "GoMMT"       },
  { key: "ota_booking",    label: "Booking.com"  },
  { key: "ota_agoda",      label: "Agoda"        },
  { key: "ota_expedia",    label: "Expedia"      },
  { key: "ota_cleartrip",  label: "Cleartrip"   },
  { key: "ota_yatra",      label: "Yatra"        },
  { key: "ota_ixigo",      label: "Ixigo"        },
  { key: "ota_akbar",      label: "Akbar"        },
  { key: "ota_easemytrip", label: "EaseMyTrip"  },
  { key: "ota_indigo",     label: "Indigo"       },
  { key: "ota_gmb",        label: "GMB"          },
];

const AI_FIELDS: { key: string; label: string }[] = [
  { key: "ai_gommt",      label: "GoMMT"       },
  { key: "ai_booking",    label: "Booking.com"  },
  { key: "ai_agoda",      label: "Agoda"        },
  { key: "ai_expedia",    label: "Expedia"      },
  { key: "ai_cleartrip",  label: "Cleartrip"   },
  { key: "ai_yatra",      label: "Yatra"        },
  { key: "ai_ixigo",      label: "Ixigo"        },
  { key: "ai_akbar",      label: "Akbar"        },
  { key: "ai_easemytrip", label: "EaseMyTrip"  },
  { key: "ai_indigo",     label: "Indigo"       },
  { key: "ai_gmb",        label: "GMB"          },
];

type OtaKey = typeof OTA_FIELDS[number]["key"];
type AiKey  = typeof AI_FIELDS[number]["key"];

interface PhotoRow {
  property_id:       string;
  property_name:     string;
  city:              string;
  fh_status:         string;
  fh_live_date:      string | null;
  photoshoot_status: string;
  shoot_date:        string | null;
  remarks:           string | null;
  shoot_link:        string | null;
  shoot_source:      string | null;
  ai_editing_done:   string;
  updated_by:        string | null;
  updated_at:        string | null;
  [k: string]: string | null;
}

const STATUSES = ["Shoot Done", "Shoot Pending"];

const STATUS_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  "Shoot Done":    { bg: "#DCFCE7", text: "#16A34A", border: "#86EFAC" },
  "Shoot Pending": { bg: "#FEF3C7", text: "#D97706", border: "#FDE68A" },
};

const FH_STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  "Live":    { bg: "#DCFCE7", text: "#16A34A" },
  "SoldOut": { bg: "#FEE2E2", text: "#DC2626" },
};

const UPDATED_STYLE = { bg: "#DCFCE7", text: "#16A34A", border: "#86EFAC" };
const PENDING_STYLE  = { bg: "#F1F5F9", text: "#64748B", border: "#E2E8F0" };
const YES_STYLE      = { bg: "#DCFCE7", text: "#16A34A", border: "#86EFAC" };
const NO_STYLE       = { bg: "#F1F5F9", text: "#64748B", border: "#E2E8F0" };

const TH: React.CSSProperties = {
  padding: "8px 10px",
  textAlign: "left",
  fontSize: 10,
  fontWeight: 700,
  color: "#64748B",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  whiteSpace: "nowrap",
  borderRight: "1px solid #E2E8F0",
};

const GROUP_TH: React.CSSProperties = {
  padding: "6px 10px",
  textAlign: "center",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.05em",
  whiteSpace: "nowrap",
  borderRight: "2px solid #C7D2FE",
  borderBottom: "1px solid #E2E8F0",
};

export default function PhotoshootPage() {
  const [rows,         setRows]         = useState<PhotoRow[]>([]);
  const [cities,       setCities]       = useState<string[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [syncing,      setSyncing]      = useState(false);
  const [syncResult,   setSyncResult]   = useState<{ shootDone: number; shootPending: number; synced: number } | null>(null);
  const [syncError,    setSyncError]    = useState("");
  const [search,       setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cityFilter,   setCityFilter]   = useState("all");
  const [saving,       setSaving]       = useState<Record<string, boolean>>({});
  const [editCell,     setEditCell]     = useState<{ id: string; field: string } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/photoshoot")
      .then(r => r.json())
      .then(d => { setRows(d.rows ?? []); setCities(d.cities ?? []); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function syncFromSheets() {
    setSyncing(true);
    setSyncResult(null);
    setSyncError("");
    try {
      const res  = await fetch("/api/photoshoot/sync", { method: "POST" });
      const data = await res.json();
      if (data.error) { setSyncError(data.error); return; }
      setSyncResult(data);
      load();
    } catch (e) {
      setSyncError((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  async function saveField(propertyId: string, field: string, value: string) {
    setSaving(s => ({ ...s, [`${propertyId}:${field}`]: true }));
    await fetch("/api/photoshoot/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ property_id: propertyId, field, value }),
    });
    setSaving(s => ({ ...s, [`${propertyId}:${field}`]: false }));
    setRows(prev => prev.map(r =>
      r.property_id === propertyId ? { ...r, [field]: value || null } : r
    ));
  }

  const isSaving = (id: string, field: string) => !!saving[`${id}:${field}`];

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return rows.filter(r => {
      if (statusFilter !== "all" && r.photoshoot_status !== statusFilter) return false;
      if (cityFilter   !== "all" && r.city !== cityFilter)                return false;
      if (s && !r.property_id.toLowerCase().includes(s) &&
               !r.property_name.toLowerCase().includes(s) &&
               !(r.city ?? "").toLowerCase().includes(s))                return false;
      return true;
    });
  }, [rows, statusFilter, cityFilter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { total: rows.length };
    for (const s of STATUSES) c[s] = rows.filter(r => r.photoshoot_status === s).length;
    return c;
  }, [rows]);

  function OtaDropdown({ row, field, opts }: { row: PhotoRow; field: string; opts: ["Pending","Updated"] | ["No","Yes"] }) {
    const val     = (row[field] as string) ?? opts[0];
    const style   = (opts[0] === "Pending")
      ? (val === "Updated" ? UPDATED_STYLE : PENDING_STYLE)
      : (val === "Yes"     ? YES_STYLE     : NO_STYLE);
    const saving_ = isSaving(row.property_id, field);
    return (
      <select
        value={val}
        onChange={e => saveField(row.property_id, field, e.target.value)}
        disabled={saving_}
        style={{
          padding: "3px 6px", borderRadius: 6,
          border: `1.5px solid ${style.border}`,
          background: style.bg, color: style.text,
          fontSize: 10, fontWeight: 700,
          cursor: saving_ ? "not-allowed" : "pointer",
          outline: "none", opacity: saving_ ? 0.5 : 1,
        }}
      >
        {opts.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  const totalCols = 9 + 11 + 1 + 11 + 1; // fixed + ota + ai_editing + ai + updated_by

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "'Segoe UI', Arial, sans-serif" }}>

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2E8F0", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>Photoshoot Update</div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>Track photoshoot & OTA image upload status · synced from Google Sheets</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {syncError && <span style={{ fontSize: 11, color: "#DC2626" }}>⚠ {syncError}</span>}
          {syncResult && !syncing && (
            <span style={{ fontSize: 11, color: "#16A34A" }}>
              ✓ {syncResult.synced} synced — Done: {syncResult.shootDone} · Pending: {syncResult.shootPending}
            </span>
          )}
          <button onClick={syncFromSheets} disabled={syncing || loading}
            style={{
              padding: "8px 18px", borderRadius: 8, border: "none", cursor: syncing ? "not-allowed" : "pointer",
              background: syncing ? "#CBD5E1" : "linear-gradient(135deg,#7C3AED,#4F46E5)",
              color: "#fff", fontSize: 12, fontWeight: 700,
              boxShadow: syncing ? "none" : "0 2px 8px #7C3AED40",
            }}>
            {syncing ? "Syncing…" : "↻ Sync from Sheets"}
          </button>
        </div>
      </div>

      <div style={{ padding: "20px 28px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Summary tiles */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { key: "all",           label: "Total",         val: counts.total,                   bg: "#F1F5F9", text: "#374151", border: "#E2E8F0" },
            { key: "Shoot Done",    label: "Shoot Done",    val: counts["Shoot Done"]    ?? 0, ...STATUS_STYLE["Shoot Done"]    },
            { key: "Shoot Pending", label: "Shoot Pending", val: counts["Shoot Pending"] ?? 0, ...STATUS_STYLE["Shoot Pending"] },
          ].map(tile => (
            <div key={tile.key} onClick={() => setStatusFilter(tile.key === statusFilter ? "all" : tile.key)}
              style={{
                background: tile.bg, border: `2px solid ${statusFilter === tile.key ? tile.text : (tile.border ?? tile.text + "40")}`,
                borderRadius: 10, padding: "12px 18px", cursor: "pointer", minWidth: 100,
                boxShadow: statusFilter === tile.key ? `0 0 0 3px ${tile.text}20` : "none",
                transition: "box-shadow 0.15s, border-color 0.15s",
              }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: tile.text }}>{tile.val}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: tile.text, marginTop: 2 }}>{tile.label}</div>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search property ID, name, city…"
            style={{ padding: "7px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12, outline: "none", width: 260 }} />
          <select value={cityFilter} onChange={e => setCityFilter(e.target.value)}
            style={{ padding: "7px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12, outline: "none", background: "#fff", color: "#374151" }}>
            <option value="all">All Cities</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: "7px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12, outline: "none", background: "#fff", color: "#374151" }}>
            <option value="all">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {(search || statusFilter !== "all" || cityFilter !== "all") && (
            <button onClick={() => { setSearch(""); setStatusFilter("all"); setCityFilter("all"); }}
              style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontSize: 12, cursor: "pointer" }}>
              Clear filters
            </button>
          )}
          <div style={{ marginLeft: "auto", fontSize: 11, color: "#94A3B8" }}>
            {loading ? "Loading…" : `${filtered.length} of ${rows.length} properties`}
          </div>
        </div>

        {/* Table */}
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                {/* Group header row */}
                <tr style={{ background: "#EEF2FF", borderBottom: "1px solid #C7D2FE" }}>
                  <th colSpan={9} style={{ ...GROUP_TH, textAlign: "left", color: "#374151" }}>Property Info</th>
                  <th colSpan={11} style={{ ...GROUP_TH, color: "#4F46E5", background: "#EDE9FE" }}>📷 Photoshoot OTA Update</th>
                  <th colSpan={1}  style={{ ...GROUP_TH, color: "#0891B2", background: "#E0F2FE", borderRight: "2px solid #BAE6FD" }}>AI Editing</th>
                  <th colSpan={11} style={{ ...GROUP_TH, color: "#059669", background: "#D1FAE5", borderRight: "2px solid #6EE7B7" }}>🤖 AI Image OTA Update</th>
                  <th colSpan={1}  style={{ ...TH, background: "#EEF2FF", color: "#64748B", borderRight: "none" }}>Meta</th>
                </tr>
                {/* Column header row */}
                <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
                  {/* Fixed cols */}
                  <th style={TH}>Property ID</th>
                  <th style={TH}>Property Name</th>
                  <th style={TH}>City</th>
                  <th style={TH}>FH Status</th>
                  <th style={TH}>FH Live Date</th>
                  <th style={TH}>Shoot Status</th>
                  <th style={TH}>Shoot Link</th>
                  <th style={TH}>Shoot Date</th>
                  <th style={{ ...TH, borderRight: "2px solid #C7D2FE" }}>Remarks</th>
                  {/* OTA photoshoot cols */}
                  {OTA_FIELDS.map((f, i) => (
                    <th key={f.key} style={{ ...TH, background: "#F5F3FF", color: "#6D28D9", borderRight: i === OTA_FIELDS.length - 1 ? "2px solid #C7D2FE" : "1px solid #EDE9FE" }}>{f.label}</th>
                  ))}
                  {/* AI Editing Done */}
                  <th style={{ ...TH, background: "#F0F9FF", color: "#0369A1", borderRight: "2px solid #BAE6FD" }}>Done?</th>
                  {/* AI image cols */}
                  {AI_FIELDS.map((f, i) => (
                    <th key={f.key} style={{ ...TH, background: "#F0FDF4", color: "#15803D", borderRight: i === AI_FIELDS.length - 1 ? "2px solid #6EE7B7" : "1px solid #BBF7D0" }}>{f.label}</th>
                  ))}
                  {/* Updated By */}
                  <th style={{ ...TH, borderRight: "none" }}>Updated By</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={totalCols} style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={totalCols} style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>No properties found</td></tr>
                ) : filtered.map((row, i) => {
                  const ss = STATUS_STYLE[row.photoshoot_status] ?? STATUS_STYLE["Shoot Pending"];
                  const fs = FH_STATUS_STYLE[row.fh_status] ?? { bg: "#F1F5F9", text: "#64748B" };
                  const rowBg = i % 2 === 0 ? "#fff" : "#FAFAFA";
                  const TD: React.CSSProperties = { padding: "6px 10px", background: rowBg, borderRight: "1px solid #F1F5F9", borderBottom: "1px solid #F1F5F9" };

                  return (
                    <tr key={row.property_id}>
                      {/* Property ID */}
                      <td style={{ ...TD, fontWeight: 700, color: "#374151", whiteSpace: "nowrap" }}>{row.property_id}</td>

                      {/* Property Name */}
                      <td style={{ ...TD, color: "#475569", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        title={row.property_name}>{row.property_name}</td>

                      {/* City */}
                      <td style={{ ...TD, color: "#475569", whiteSpace: "nowrap" }}>{row.city}</td>

                      {/* FH Status */}
                      <td style={TD}>
                        <span style={{ fontSize: 10, fontWeight: 700, background: fs.bg, color: fs.text, borderRadius: 6, padding: "2px 7px", whiteSpace: "nowrap" }}>{row.fh_status}</span>
                      </td>

                      {/* FH Live Date */}
                      <td style={{ ...TD, color: "#64748B", whiteSpace: "nowrap" }}>
                        {row.fh_live_date ? new Date(row.fh_live_date).toLocaleDateString("en-IN") : "—"}
                      </td>

                      {/* Photoshoot Status */}
                      <td style={TD}>
                        <select value={row.photoshoot_status}
                          onChange={e => saveField(row.property_id, "photoshoot_status", e.target.value)}
                          disabled={isSaving(row.property_id, "photoshoot_status")}
                          style={{
                            padding: "3px 7px", borderRadius: 6, border: `1.5px solid ${ss.border}`,
                            background: ss.bg, color: ss.text, fontSize: 10, fontWeight: 700,
                            cursor: "pointer", outline: "none",
                            opacity: isSaving(row.property_id, "photoshoot_status") ? 0.5 : 1,
                          }}>
                          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>

                      {/* Shoot Link */}
                      <td style={{ ...TD, whiteSpace: "nowrap" }}>
                        {row.shoot_link ? (
                          <a href={row.shoot_link} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 10, fontWeight: 600, color: "#4F46E5", textDecoration: "none",
                              background: "#EEF2FF", borderRadius: 6, padding: "2px 7px", display: "inline-block" }}>
                            🔗 View
                          </a>
                        ) : (
                          <span style={{ color: "#CBD5E1", fontSize: 10 }}>—</span>
                        )}
                      </td>

                      {/* Shoot Date */}
                      <td style={TD}>
                        {editCell?.id === row.property_id && editCell.field === "shoot_date" ? (
                          <input type="date" defaultValue={(row.shoot_date ?? "").slice(0, 10)}
                            autoFocus
                            onBlur={e => { setEditCell(null); saveField(row.property_id, "shoot_date", e.target.value); }}
                            style={{ padding: "2px 5px", border: "1.5px solid #A5B4FC", borderRadius: 6, fontSize: 10, outline: "none" }} />
                        ) : (
                          <div onClick={() => setEditCell({ id: row.property_id, field: "shoot_date" })}
                            style={{ padding: "2px 6px", borderRadius: 6, cursor: "pointer", color: row.shoot_date ? "#374151" : "#CBD5E1", whiteSpace: "nowrap", minWidth: 70 }}
                            title="Click to edit">
                            {row.shoot_date ? new Date(row.shoot_date).toLocaleDateString("en-IN") : "—"}
                          </div>
                        )}
                      </td>

                      {/* Remarks */}
                      <td style={{ ...TD, borderRight: "2px solid #C7D2FE", minWidth: 130 }}>
                        {editCell?.id === row.property_id && editCell.field === "remarks" ? (
                          <input type="text" defaultValue={row.remarks ?? ""}
                            autoFocus
                            onBlur={e => { setEditCell(null); saveField(row.property_id, "remarks", e.target.value); }}
                            style={{ padding: "2px 6px", border: "1.5px solid #A5B4FC", borderRadius: 6, fontSize: 10, outline: "none", width: 120 }} />
                        ) : (
                          <div onClick={() => setEditCell({ id: row.property_id, field: "remarks" })}
                            style={{ padding: "2px 6px", borderRadius: 6, cursor: "pointer", color: row.remarks ? "#374151" : "#CBD5E1",
                              maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            title={row.remarks ?? "Click to edit"}>
                            {row.remarks || "—"}
                          </div>
                        )}
                      </td>

                      {/* OTA Photoshoot dropdowns */}
                      {OTA_FIELDS.map((f, idx) => (
                        <td key={f.key} style={{ ...TD, background: i % 2 === 0 ? "#FDFCFF" : "#FAF9FF", borderRight: idx === OTA_FIELDS.length - 1 ? "2px solid #C7D2FE" : "1px solid #EDE9FE" }}>
                          <OtaDropdown row={row} field={f.key as OtaKey} opts={["Pending","Updated"]} />
                        </td>
                      ))}

                      {/* AI Editing Done */}
                      <td style={{ ...TD, background: i % 2 === 0 ? "#F0F9FF" : "#E8F5FE", borderRight: "2px solid #BAE6FD" }}>
                        <OtaDropdown row={row} field="ai_editing_done" opts={["No","Yes"]} />
                      </td>

                      {/* AI Image dropdowns */}
                      {AI_FIELDS.map((f, idx) => (
                        <td key={f.key} style={{ ...TD, background: i % 2 === 0 ? "#F9FFFE" : "#F2FDF9", borderRight: idx === AI_FIELDS.length - 1 ? "2px solid #6EE7B7" : "1px solid #BBF7D0" }}>
                          <OtaDropdown row={row} field={f.key as AiKey} opts={["Pending","Updated"]} />
                        </td>
                      ))}

                      {/* Updated By */}
                      <td style={{ ...TD, color: "#94A3B8", fontSize: 10, whiteSpace: "nowrap", borderRight: "none" }}>
                        {row.updated_by ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!loading && filtered.length > 0 && (
            <div style={{ padding: "8px 14px", background: "#F8FAFC", borderTop: "1px solid #E2E8F0", fontSize: 10, color: "#94A3B8" }}>
              {filtered.length} properties · All dropdowns auto-save · Click shoot date / remarks to edit · Scroll right for OTA & AI columns
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
