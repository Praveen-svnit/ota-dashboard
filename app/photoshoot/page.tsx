"use client";

import { useState, useEffect, useMemo, useCallback } from "react";

interface PhotoRow {
  property_id:       string;
  property_name:     string;
  city:              string;
  fh_status:         string;
  fh_live_date:      string | null;
  photoshoot_status: string;
  shoot_date:        string | null;
  photographer:      string | null;
  remarks:           string | null;
  shoot_link:        string | null;
  shoot_source:      string | null;
  updated_by:        string | null;
  updated_at:        string | null;
}

const STATUSES = ["Shoot Done", "Vendor Edited", "Shoot Pending", "Not Required", "Scheduled"];

const STATUS_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  "Shoot Done":    { bg: "#DCFCE7", text: "#16A34A", border: "#86EFAC" },
  "Vendor Edited": { bg: "#EDE9FE", text: "#7C3AED", border: "#C4B5FD" },
  "Shoot Pending": { bg: "#FEF3C7", text: "#D97706", border: "#FDE68A" },
  "Not Required":  { bg: "#F1F5F9", text: "#64748B", border: "#CBD5E1" },
  "Scheduled":     { bg: "#EEF2FF", text: "#4F46E5", border: "#A5B4FC" },
};

const FH_STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  "Live":    { bg: "#DCFCE7", text: "#16A34A" },
  "SoldOut": { bg: "#FEE2E2", text: "#DC2626" },
};

export default function PhotoshootPage() {
  const [rows,         setRows]         = useState<PhotoRow[]>([]);
  const [cities,       setCities]       = useState<string[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [syncing,      setSyncing]      = useState(false);
  const [syncResult,   setSyncResult]   = useState<{ shootDone: number; vendorEdited: number; shootPending: number; synced: number } | null>(null);
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
      load(); // reload table after sync
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

  function getVal(row: PhotoRow, field: keyof PhotoRow): string {
    return String(row[field] ?? "");
  }

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

  const isSaving = (id: string, field: string) => !!saving[`${id}:${field}`];

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "'Segoe UI', Arial, sans-serif" }}>

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2E8F0", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>Photoshoot Update</div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>Track photoshoot status across all properties · synced from Google Sheets</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {syncError && <span style={{ fontSize: 11, color: "#DC2626" }}>⚠ {syncError}</span>}
          {syncResult && !syncing && (
            <span style={{ fontSize: 11, color: "#16A34A" }}>
              ✓ {syncResult.synced} synced — Done: {syncResult.shootDone} · Vendor: {syncResult.vendorEdited} · Pending: {syncResult.shootPending}
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
            { key: "all",           label: "Total",         val: counts.total,                  bg: "#F1F5F9", text: "#374151", border: "#E2E8F0" },
            { key: "Shoot Done",    label: "Shoot Done",    val: counts["Shoot Done"]    ?? 0, ...STATUS_STYLE["Shoot Done"]    },
            { key: "Vendor Edited", label: "Vendor Edited", val: counts["Vendor Edited"] ?? 0, ...STATUS_STYLE["Vendor Edited"] },
            { key: "Shoot Pending", label: "Shoot Pending", val: counts["Shoot Pending"] ?? 0, ...STATUS_STYLE["Shoot Pending"] },
            { key: "Scheduled",     label: "Scheduled",     val: counts["Scheduled"]     ?? 0, ...STATUS_STYLE["Scheduled"]     },
            { key: "Not Required",  label: "Not Required",  val: counts["Not Required"]  ?? 0, ...STATUS_STYLE["Not Required"]  },
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
                <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
                  {["Property ID", "Property Name", "City", "FH Status", "FH Live Date", "Photoshoot Status", "Shoot Link", "Shoot Date", "Photographer", "Remarks", "Updated By"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={11} style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>Loading…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={11} style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>No properties found</td></tr>
                ) : filtered.map((row, i) => {
                  const ss = STATUS_STYLE[row.photoshoot_status] ?? STATUS_STYLE["Shoot Pending"];
                  const fs = FH_STATUS_STYLE[row.fh_status] ?? { bg: "#F1F5F9", text: "#64748B" };
                  return (
                    <tr key={row.property_id} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>

                      {/* Property ID */}
                      <td style={{ padding: "8px 14px", fontWeight: 700, color: "#374151", whiteSpace: "nowrap" }}>{row.property_id}</td>

                      {/* Property Name */}
                      <td style={{ padding: "8px 14px", color: "#475569", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        title={row.property_name}>{row.property_name}</td>

                      {/* City */}
                      <td style={{ padding: "8px 14px", color: "#475569", whiteSpace: "nowrap" }}>{row.city}</td>

                      {/* FH Status */}
                      <td style={{ padding: "8px 14px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, background: fs.bg, color: fs.text, borderRadius: 6, padding: "2px 8px", whiteSpace: "nowrap" }}>{row.fh_status}</span>
                      </td>

                      {/* FH Live Date */}
                      <td style={{ padding: "8px 14px", color: "#64748B", whiteSpace: "nowrap" }}>
                        {row.fh_live_date ? new Date(row.fh_live_date).toLocaleDateString("en-IN") : "—"}
                      </td>

                      {/* Photoshoot Status */}
                      <td style={{ padding: "6px 14px" }}>
                        <select value={row.photoshoot_status}
                          onChange={e => saveField(row.property_id, "photoshoot_status", e.target.value)}
                          disabled={isSaving(row.property_id, "photoshoot_status")}
                          style={{
                            padding: "4px 8px", borderRadius: 6, border: `1.5px solid ${ss.border}`,
                            background: ss.bg, color: ss.text, fontSize: 11, fontWeight: 700,
                            cursor: "pointer", outline: "none",
                            opacity: isSaving(row.property_id, "photoshoot_status") ? 0.5 : 1,
                          }}>
                          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>

                      {/* Shoot Link */}
                      <td style={{ padding: "8px 14px", whiteSpace: "nowrap" }}>
                        {row.shoot_link ? (
                          <a href={row.shoot_link} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: 11, fontWeight: 600, color: "#4F46E5", textDecoration: "none",
                              background: "#EEF2FF", borderRadius: 6, padding: "3px 8px", display: "inline-block" }}
                            title={row.shoot_link}>
                            🔗 View
                          </a>
                        ) : (
                          <span style={{ color: "#CBD5E1", fontSize: 11 }}>—</span>
                        )}
                      </td>

                      {/* Shoot Date */}
                      <td style={{ padding: "6px 14px" }}>
                        {editCell?.id === row.property_id && editCell.field === "shoot_date" ? (
                          <input type="date" defaultValue={getVal(row, "shoot_date").slice(0, 10)}
                            autoFocus
                            onBlur={e => { setEditCell(null); saveField(row.property_id, "shoot_date", e.target.value); }}
                            style={{ padding: "3px 6px", border: "1.5px solid #A5B4FC", borderRadius: 6, fontSize: 11, outline: "none" }} />
                        ) : (
                          <div onClick={() => setEditCell({ id: row.property_id, field: "shoot_date" })}
                            style={{ padding: "3px 8px", borderRadius: 6, cursor: "pointer", color: row.shoot_date ? "#374151" : "#CBD5E1", whiteSpace: "nowrap", minWidth: 80 }}
                            title="Click to edit">
                            {row.shoot_date ? new Date(row.shoot_date).toLocaleDateString("en-IN") : "—"}
                          </div>
                        )}
                      </td>

                      {/* Photographer */}
                      <td style={{ padding: "6px 14px", minWidth: 120 }}>
                        {editCell?.id === row.property_id && editCell.field === "photographer" ? (
                          <input type="text" defaultValue={getVal(row, "photographer")}
                            autoFocus
                            onBlur={e => { setEditCell(null); saveField(row.property_id, "photographer", e.target.value); }}
                            style={{ padding: "3px 8px", border: "1.5px solid #A5B4FC", borderRadius: 6, fontSize: 11, outline: "none", width: 110 }} />
                        ) : (
                          <div onClick={() => setEditCell({ id: row.property_id, field: "photographer" })}
                            style={{ padding: "3px 8px", borderRadius: 6, cursor: "pointer", color: row.photographer ? "#374151" : "#CBD5E1",
                              maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            title={row.photographer ?? "Click to edit"}>
                            {row.photographer || "—"}
                          </div>
                        )}
                      </td>

                      {/* Remarks */}
                      <td style={{ padding: "6px 14px", minWidth: 150 }}>
                        {editCell?.id === row.property_id && editCell.field === "remarks" ? (
                          <input type="text" defaultValue={getVal(row, "remarks")}
                            autoFocus
                            onBlur={e => { setEditCell(null); saveField(row.property_id, "remarks", e.target.value); }}
                            style={{ padding: "3px 8px", border: "1.5px solid #A5B4FC", borderRadius: 6, fontSize: 11, outline: "none", width: 140 }} />
                        ) : (
                          <div onClick={() => setEditCell({ id: row.property_id, field: "remarks" })}
                            style={{ padding: "3px 8px", borderRadius: 6, cursor: "pointer", color: row.remarks ? "#374151" : "#CBD5E1",
                              maxWidth: 170, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                            title={row.remarks ?? "Click to edit"}>
                            {row.remarks || "—"}
                          </div>
                        )}
                      </td>

                      {/* Updated By */}
                      <td style={{ padding: "8px 14px", color: "#94A3B8", fontSize: 11, whiteSpace: "nowrap" }}>
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
              {filtered.length} properties · Status dropdown auto-saves · Click date / photographer / remarks cells to edit · Links from Google Sheets
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
