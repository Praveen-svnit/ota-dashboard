"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";

// ── Constants ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 100;

const OTA_FIELDS: { key: string; label: string }[] = [
  { key: "ota_gommt",      label: "GoMMT"      },
  { key: "ota_booking",    label: "Booking.com" },
  { key: "ota_agoda",      label: "Agoda"       },
  { key: "ota_expedia",    label: "Expedia"     },
  { key: "ota_cleartrip",  label: "Cleartrip"  },
  { key: "ota_yatra",      label: "Yatra"       },
  { key: "ota_ixigo",      label: "Ixigo"       },
  { key: "ota_akbar",      label: "Akbar"       },
  { key: "ota_easemytrip", label: "EaseMyTrip" },
  { key: "ota_indigo",     label: "Indigo"      },
  { key: "ota_gmb",        label: "GMB"         },
];

const AI_FIELDS: { key: string; label: string }[] = [
  { key: "ai_gommt",      label: "GoMMT"      },
  { key: "ai_booking",    label: "Booking.com" },
  { key: "ai_agoda",      label: "Agoda"       },
  { key: "ai_expedia",    label: "Expedia"     },
  { key: "ai_cleartrip",  label: "Cleartrip"  },
  { key: "ai_yatra",      label: "Yatra"       },
  { key: "ai_ixigo",      label: "Ixigo"       },
  { key: "ai_akbar",      label: "Akbar"       },
  { key: "ai_easemytrip", label: "EaseMyTrip" },
  { key: "ai_indigo",     label: "Indigo"      },
  { key: "ai_gmb",        label: "GMB"         },
];

const BULK_FIELD_OPTS: { key: string; label: string; group: string; opts: string[] | null }[] = [
  { key: "photoshoot_status", label: "Photoshoot Status", group: "General",         opts: ["Shoot Done","Shoot Pending"] },
  { key: "remarks",           label: "Remarks",           group: "General",         opts: null },
  ...OTA_FIELDS.map(f => ({ key: f.key, label: f.label, group: "Photoshoot OTA", opts: ["Pending","Updated"] })),
  { key: "ai_editing_done",   label: "AI Editing Done",   group: "AI Editing",      opts: ["No","Yes"] },
  ...AI_FIELDS.map(f  => ({ key: f.key, label: f.label, group: "AI Image OTA",   opts: ["Pending","Updated"] })),
];

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

const TH_BASE: React.CSSProperties = {
  padding: "8px 10px", textAlign: "left", fontSize: 10, fontWeight: 700,
  color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em",
  whiteSpace: "nowrap", borderRight: "1px solid #E2E8F0",
};

// ── Interfaces ─────────────────────────────────────────────────────────────────

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
  [k: string]: string | null;
}

// ── OtaDropdown — OUTSIDE component so React never remounts it ─────────────────

interface DropdownProps {
  propertyId: string;
  field:      string;
  value:      string;
  opts:       string[];
  saving:     boolean;
  onSave:     (id: string, field: string, val: string) => void;
}

const OtaDropdown = React.memo(function OtaDropdown({ propertyId, field, value, opts, saving, onSave }: DropdownProps) {
  const isPendingOpts = opts[0] === "Pending";
  const isNoOpts      = opts[0] === "No";
  const style = isPendingOpts
    ? (value === "Updated" ? UPDATED_STYLE : PENDING_STYLE)
    : isNoOpts
    ? (value === "Yes"     ? YES_STYLE     : NO_STYLE)
    : PENDING_STYLE;

  return (
    <select
      value={value}
      onChange={e => onSave(propertyId, field, e.target.value)}
      disabled={saving}
      style={{
        padding: "3px 6px", borderRadius: 6,
        border: `1.5px solid ${style.border}`,
        background: style.bg, color: style.text,
        fontSize: 10, fontWeight: 700,
        cursor: saving ? "not-allowed" : "pointer",
        outline: "none", opacity: saving ? 0.5 : 1,
      }}
    >
      {opts.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
});

// ── TableRow — OUTSIDE component for stable identity ──────────────────────────

interface RowProps {
  row:         PhotoRow;
  rowIndex:    number;
  editCell:    { id: string; field: string } | null;
  setEditCell: (v: { id: string; field: string } | null) => void;
  savingKeys:  Record<string, boolean>;
  onSave:      (id: string, field: string, val: string) => void;
}

const TableRow = React.memo(function TableRow({ row, rowIndex, editCell, setEditCell, savingKeys, onSave }: RowProps) {
  const ss = STATUS_STYLE[row.photoshoot_status] ?? STATUS_STYLE["Shoot Pending"];
  const fs = FH_STATUS_STYLE[row.fh_status] ?? { bg: "#F1F5F9", text: "#64748B" };
  const even = rowIndex % 2 === 0;
  const base = even ? "#fff" : "#FAFAFA";

  const td: React.CSSProperties = { padding: "6px 10px", background: base, borderRight: "1px solid #F1F5F9", borderBottom: "1px solid #F1F5F9" };
  const sv = (field: string) => !!savingKeys[`${row.property_id}:${field}`];

  return (
    <tr>
      <td style={{ ...td, fontWeight: 700, color: "#374151", whiteSpace: "nowrap" }}>{row.property_id}</td>
      <td style={{ ...td, color: "#475569", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.property_name}>{row.property_name}</td>
      <td style={{ ...td, color: "#475569", whiteSpace: "nowrap" }}>{row.city}</td>
      <td style={td}>
        <span style={{ fontSize: 10, fontWeight: 700, background: fs.bg, color: fs.text, borderRadius: 6, padding: "2px 7px", whiteSpace: "nowrap" }}>{row.fh_status}</span>
      </td>
      <td style={{ ...td, color: "#64748B", whiteSpace: "nowrap" }}>
        {row.fh_live_date ? new Date(row.fh_live_date).toLocaleDateString("en-IN") : "—"}
      </td>

      {/* Photoshoot Status */}
      <td style={td}>
        <select value={row.photoshoot_status}
          onChange={e => onSave(row.property_id, "photoshoot_status", e.target.value)}
          disabled={sv("photoshoot_status")}
          style={{ padding: "3px 7px", borderRadius: 6, border: `1.5px solid ${ss.border}`, background: ss.bg, color: ss.text, fontSize: 10, fontWeight: 700, cursor: "pointer", outline: "none", opacity: sv("photoshoot_status") ? 0.5 : 1 }}>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>

      {/* Shoot Link */}
      <td style={{ ...td, whiteSpace: "nowrap" }}>
        {row.shoot_link
          ? <a href={row.shoot_link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, fontWeight: 600, color: "#4F46E5", textDecoration: "none", background: "#EEF2FF", borderRadius: 6, padding: "2px 7px", display: "inline-block" }}>🔗 View</a>
          : <span style={{ color: "#CBD5E1", fontSize: 10 }}>—</span>}
      </td>

      {/* Shoot Date */}
      <td style={td}>
        {editCell?.id === row.property_id && editCell.field === "shoot_date" ? (
          <input type="date" defaultValue={(row.shoot_date ?? "").slice(0, 10)} autoFocus
            onBlur={e => { setEditCell(null); onSave(row.property_id, "shoot_date", e.target.value); }}
            style={{ padding: "2px 5px", border: "1.5px solid #A5B4FC", borderRadius: 6, fontSize: 10, outline: "none" }} />
        ) : (
          <div onClick={() => setEditCell({ id: row.property_id, field: "shoot_date" })}
            style={{ padding: "2px 6px", borderRadius: 6, cursor: "pointer", color: row.shoot_date ? "#374151" : "#CBD5E1", whiteSpace: "nowrap", minWidth: 70 }}>
            {row.shoot_date ? new Date(row.shoot_date).toLocaleDateString("en-IN") : "—"}
          </div>
        )}
      </td>

      {/* Remarks */}
      <td style={{ ...td, borderRight: "2px solid #C7D2FE", minWidth: 130 }}>
        {editCell?.id === row.property_id && editCell.field === "remarks" ? (
          <input type="text" defaultValue={row.remarks ?? ""} autoFocus
            onBlur={e => { setEditCell(null); onSave(row.property_id, "remarks", e.target.value); }}
            style={{ padding: "2px 6px", border: "1.5px solid #A5B4FC", borderRadius: 6, fontSize: 10, outline: "none", width: 120 }} />
        ) : (
          <div onClick={() => setEditCell({ id: row.property_id, field: "remarks" })}
            style={{ padding: "2px 6px", borderRadius: 6, cursor: "pointer", color: row.remarks ? "#374151" : "#CBD5E1", maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            title={row.remarks ?? "Click to edit"}>
            {row.remarks || "—"}
          </div>
        )}
      </td>

      {/* OTA Photoshoot dropdowns */}
      {OTA_FIELDS.map((f, idx) => (
        <td key={f.key} style={{ ...td, background: even ? "#FDFCFF" : "#FAF9FF", borderRight: idx === OTA_FIELDS.length - 1 ? "2px solid #C7D2FE" : "1px solid #EDE9FE" }}>
          <OtaDropdown propertyId={row.property_id} field={f.key} value={(row[f.key] as string) ?? "Pending"} opts={["Pending","Updated"]} saving={sv(f.key)} onSave={onSave} />
        </td>
      ))}

      {/* AI Editing Done */}
      <td style={{ ...td, background: even ? "#F0F9FF" : "#E8F5FE", borderRight: "2px solid #BAE6FD" }}>
        <OtaDropdown propertyId={row.property_id} field="ai_editing_done" value={(row.ai_editing_done as string) ?? "No"} opts={["No","Yes"]} saving={sv("ai_editing_done")} onSave={onSave} />
      </td>

      {/* AI Image dropdowns */}
      {AI_FIELDS.map((f, idx) => (
        <td key={f.key} style={{ ...td, background: even ? "#F9FFFE" : "#F2FDF9", borderRight: idx === AI_FIELDS.length - 1 ? "2px solid #6EE7B7" : "1px solid #BBF7D0" }}>
          <OtaDropdown propertyId={row.property_id} field={f.key} value={(row[f.key] as string) ?? "Pending"} opts={["Pending","Updated"]} saving={sv(f.key)} onSave={onSave} />
        </td>
      ))}

      {/* Updated By */}
      <td style={{ ...td, color: "#94A3B8", fontSize: 10, whiteSpace: "nowrap", borderRight: "none" }}>
        {row.updated_by ?? "—"}
      </td>
    </tr>
  );
});

// ── Main page ──────────────────────────────────────────────────────────────────

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
  const [savingKeys,   setSavingKeys]   = useState<Record<string, boolean>>({});
  const [editCell,     setEditCell]     = useState<{ id: string; field: string } | null>(null);
  const [page,         setPage]         = useState(0);
  const [bulkOpen,     setBulkOpen]     = useState(false);
  const [bulkIds,      setBulkIds]      = useState("");
  const [bulkField,    setBulkField]    = useState("photoshoot_status");
  const [bulkValue,    setBulkValue]    = useState("Shoot Done");
  const [bulkApplying, setBulkApplying] = useState(false);
  const [bulkResult,   setBulkResult]   = useState<{ updated: number } | null>(null);
  const [bulkError,    setBulkError]    = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/photoshoot")
      .then(r => r.json())
      .then(d => { setRows(d.rows ?? []); setCities(d.cities ?? []); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function syncFromSheets() {
    setSyncing(true); setSyncResult(null); setSyncError("");
    try {
      const res  = await fetch("/api/photoshoot/sync", { method: "POST" });
      const data = await res.json();
      if (data.error) { setSyncError(data.error); return; }
      setSyncResult(data);
      load();
    } catch (e) { setSyncError((e as Error).message); }
    finally { setSyncing(false); }
  }

  const saveField = useCallback(async (propertyId: string, field: string, value: string) => {
    setSavingKeys(s => ({ ...s, [`${propertyId}:${field}`]: true }));
    await fetch("/api/photoshoot/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ property_id: propertyId, field, value }),
    });
    setSavingKeys(s => ({ ...s, [`${propertyId}:${field}`]: false }));
    setRows(prev => prev.map(r => r.property_id === propertyId ? { ...r, [field]: value || null } : r));
  }, []);

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

  const totalPages  = Math.ceil(filtered.length / PAGE_SIZE);
  const visibleRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Reset page when filter changes
  useEffect(() => { setPage(0); }, [statusFilter, cityFilter, search]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { total: rows.length };
    for (const s of STATUSES) c[s] = rows.filter(r => r.photoshoot_status === s).length;
    return c;
  }, [rows]);

  const bulkParsedIds = useMemo(() => [...new Set(bulkIds.trim().split(/\s+/).filter(Boolean))], [bulkIds]);
  const bulkFieldCfg  = BULK_FIELD_OPTS.find(f => f.key === bulkField)!;

  function onBulkFieldChange(key: string) {
    const cfg = BULK_FIELD_OPTS.find(f => f.key === key)!;
    setBulkField(key);
    setBulkValue(cfg.opts ? cfg.opts[0] : "");
    setBulkResult(null); setBulkError("");
  }

  async function applyBulk() {
    if (!bulkParsedIds.length) return;
    setBulkApplying(true); setBulkResult(null); setBulkError("");
    try {
      const res  = await fetch("/api/photoshoot/bulk-update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property_ids: bulkParsedIds, field: bulkField, value: bulkValue }),
      });
      const data = await res.json();
      if (!data.ok) { setBulkError(data.error ?? "Failed"); return; }
      setBulkResult(data); load();
    } catch (e) { setBulkError((e as Error).message); }
    finally { setBulkApplying(false); }
  }

  const totalCols = 9 + 11 + 1 + 11 + 1;

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
            <span style={{ fontSize: 11, color: "#16A34A" }}>✓ {syncResult.synced} synced — Done: {syncResult.shootDone} · Pending: {syncResult.shootPending}</span>
          )}
          <button onClick={() => { setBulkOpen(o => !o); setBulkResult(null); setBulkError(""); }}
            style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #E2E8F0", background: bulkOpen ? "#EEF2FF" : "#fff", color: bulkOpen ? "#4F46E5" : "#374151", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            ✏ Bulk Update
          </button>
          <button onClick={syncFromSheets} disabled={syncing || loading}
            style={{ padding: "8px 18px", borderRadius: 8, border: "none", cursor: syncing ? "not-allowed" : "pointer", background: syncing ? "#CBD5E1" : "linear-gradient(135deg,#7C3AED,#4F46E5)", color: "#fff", fontSize: 12, fontWeight: 700, boxShadow: syncing ? "none" : "0 2px 8px #7C3AED40" }}>
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
              style={{ background: tile.bg, border: `2px solid ${statusFilter === tile.key ? tile.text : (tile.border ?? tile.text + "40")}`, borderRadius: 10, padding: "12px 18px", cursor: "pointer", minWidth: 100, boxShadow: statusFilter === tile.key ? `0 0 0 3px ${tile.text}20` : "none", transition: "box-shadow 0.15s, border-color 0.15s" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: tile.text }}>{tile.val}</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: tile.text, marginTop: 2 }}>{tile.label}</div>
            </div>
          ))}
        </div>

        {/* Filter bar */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search property ID, name, city…"
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
            {loading ? "Loading…" : `${filtered.length} properties`}
          </div>
        </div>

        {/* Bulk Update Panel */}
        {bulkOpen && (
          <div style={{ background: "#fff", borderRadius: 12, border: "2px solid #C7D2FE", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#4F46E5" }}>✏ Bulk Update</div>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div style={{ flex: "1 1 280px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#64748B", marginBottom: 5, textTransform: "uppercase" }}>FH Property IDs (space-separated)</div>
                <textarea value={bulkIds} onChange={e => { setBulkIds(e.target.value); setBulkResult(null); }}
                  placeholder="e.g. FH12345 FH67890 FH11111" rows={3}
                  style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #E2E8F0", borderRadius: 8, fontSize: 12, outline: "none", resize: "vertical", fontFamily: "monospace", boxSizing: "border-box" }} />
                {bulkParsedIds.length > 0 && (
                  <div style={{ fontSize: 10, color: "#64748B", marginTop: 4 }}>{bulkParsedIds.length} unique ID{bulkParsedIds.length !== 1 ? "s" : ""} entered</div>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: "0 0 auto" }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#64748B", marginBottom: 5, textTransform: "uppercase" }}>Field</div>
                  <select value={bulkField} onChange={e => onBulkFieldChange(e.target.value)}
                    style={{ padding: "7px 12px", border: "1.5px solid #E2E8F0", borderRadius: 8, fontSize: 12, outline: "none", background: "#fff", color: "#374151", minWidth: 200 }}>
                    {["General","Photoshoot OTA","AI Editing","AI Image OTA"].map(grp => (
                      <optgroup key={grp} label={grp}>
                        {BULK_FIELD_OPTS.filter(f => f.group === grp).map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#64748B", marginBottom: 5, textTransform: "uppercase" }}>Set Value To</div>
                  {bulkFieldCfg.opts ? (
                    <select value={bulkValue} onChange={e => setBulkValue(e.target.value)}
                      style={{ padding: "7px 12px", border: "1.5px solid #E2E8F0", borderRadius: 8, fontSize: 12, outline: "none", background: "#fff", color: "#374151", minWidth: 200 }}>
                      {bulkFieldCfg.opts.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input type="text" value={bulkValue} onChange={e => setBulkValue(e.target.value)} placeholder="Enter value…"
                      style={{ padding: "7px 12px", border: "1.5px solid #E2E8F0", borderRadius: 8, fontSize: 12, outline: "none", width: 200 }} />
                  )}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 8, flex: "0 0 auto", paddingTop: 24 }}>
                <button onClick={applyBulk} disabled={bulkApplying || bulkParsedIds.length === 0}
                  style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: bulkParsedIds.length === 0 ? "#CBD5E1" : "linear-gradient(135deg,#4F46E5,#7C3AED)", color: "#fff", fontSize: 12, fontWeight: 800, cursor: bulkParsedIds.length === 0 || bulkApplying ? "not-allowed" : "pointer", boxShadow: bulkParsedIds.length > 0 ? "0 2px 8px #4F46E540" : "none" }}>
                  {bulkApplying ? "Applying…" : `Apply to ${bulkParsedIds.length || 0} IDs`}
                </button>
                {bulkResult && <div style={{ fontSize: 11, color: "#16A34A", fontWeight: 700 }}>✓ Updated {bulkResult.updated} propert{bulkResult.updated !== 1 ? "ies" : "y"}</div>}
                {bulkError  && <div style={{ fontSize: 11, color: "#DC2626" }}>⚠ {bulkError}</div>}
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#EEF2FF", borderBottom: "1px solid #C7D2FE" }}>
                  <th colSpan={9} style={{ padding: "6px 10px", textAlign: "left",   fontSize: 10, fontWeight: 800, color: "#374151",  letterSpacing: "0.05em", whiteSpace: "nowrap", borderRight: "2px solid #C7D2FE" }}>Property Info</th>
                  <th colSpan={11} style={{ padding: "6px 10px", textAlign: "center", fontSize: 10, fontWeight: 800, color: "#4F46E5",  letterSpacing: "0.05em", whiteSpace: "nowrap", borderRight: "2px solid #C7D2FE", background: "#EDE9FE" }}>📷 Photoshoot OTA Update</th>
                  <th colSpan={1}  style={{ padding: "6px 10px", textAlign: "center", fontSize: 10, fontWeight: 800, color: "#0891B2",  letterSpacing: "0.05em", whiteSpace: "nowrap", borderRight: "2px solid #BAE6FD", background: "#E0F2FE" }}>AI Editing</th>
                  <th colSpan={11} style={{ padding: "6px 10px", textAlign: "center", fontSize: 10, fontWeight: 800, color: "#059669",  letterSpacing: "0.05em", whiteSpace: "nowrap", borderRight: "2px solid #6EE7B7", background: "#D1FAE5" }}>🤖 AI Image OTA Update</th>
                  <th colSpan={1}  style={{ ...TH_BASE, background: "#EEF2FF", color: "#64748B", borderRight: "none" }}>Meta</th>
                </tr>
                <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
                  <th style={TH_BASE}>Property ID</th>
                  <th style={TH_BASE}>Property Name</th>
                  <th style={TH_BASE}>City</th>
                  <th style={TH_BASE}>FH Status</th>
                  <th style={TH_BASE}>FH Live Date</th>
                  <th style={TH_BASE}>Shoot Status</th>
                  <th style={TH_BASE}>Shoot Link</th>
                  <th style={TH_BASE}>Shoot Date</th>
                  <th style={{ ...TH_BASE, borderRight: "2px solid #C7D2FE" }}>Remarks</th>
                  {OTA_FIELDS.map((f, i) => (
                    <th key={f.key} style={{ ...TH_BASE, background: "#F5F3FF", color: "#6D28D9", borderRight: i === OTA_FIELDS.length - 1 ? "2px solid #C7D2FE" : "1px solid #EDE9FE" }}>{f.label}</th>
                  ))}
                  <th style={{ ...TH_BASE, background: "#F0F9FF", color: "#0369A1", borderRight: "2px solid #BAE6FD" }}>Done?</th>
                  {AI_FIELDS.map((f, i) => (
                    <th key={f.key} style={{ ...TH_BASE, background: "#F0FDF4", color: "#15803D", borderRight: i === AI_FIELDS.length - 1 ? "2px solid #6EE7B7" : "1px solid #BBF7D0" }}>{f.label}</th>
                  ))}
                  <th style={{ ...TH_BASE, borderRight: "none" }}>Updated By</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={totalCols} style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={totalCols} style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>No properties found</td></tr>
                ) : visibleRows.map((row, i) => (
                  <TableRow
                    key={row.property_id}
                    row={row}
                    rowIndex={page * PAGE_SIZE + i}
                    editCell={editCell}
                    setEditCell={setEditCell}
                    savingKeys={savingKeys}
                    onSave={saveField}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer: pagination + hint */}
          {!loading && filtered.length > 0 && (
            <div style={{ padding: "10px 14px", background: "#F8FAFC", borderTop: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div style={{ fontSize: 10, color: "#94A3B8" }}>
                Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length} · Dropdowns auto-save · Click date/remarks to edit
              </div>
              {totalPages > 1 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                    style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #E2E8F0", background: page === 0 ? "#F8FAFC" : "#fff", color: page === 0 ? "#CBD5E1" : "#374151", fontSize: 11, cursor: page === 0 ? "default" : "pointer" }}>
                    ← Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i).filter(i => Math.abs(i - page) < 3 || i === 0 || i === totalPages - 1).map((i, idx, arr) => (
                    <React.Fragment key={i}>
                      {idx > 0 && arr[idx - 1] !== i - 1 && <span style={{ color: "#CBD5E1", fontSize: 11 }}>…</span>}
                      <button onClick={() => setPage(i)}
                        style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${i === page ? "#6366F1" : "#E2E8F0"}`, background: i === page ? "#EEF2FF" : "#fff", color: i === page ? "#4F46E5" : "#374151", fontSize: 11, fontWeight: i === page ? 700 : 400, cursor: "pointer" }}>
                        {i + 1}
                      </button>
                    </React.Fragment>
                  ))}
                  <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                    style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #E2E8F0", background: page === totalPages - 1 ? "#F8FAFC" : "#fff", color: page === totalPages - 1 ? "#CBD5E1" : "#374151", fontSize: 11, cursor: page === totalPages - 1 ? "default" : "pointer" }}>
                    Next →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
