"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { OTA_COLORS } from "@/lib/constants";

const OTA_LIST = ["GoMMT","Booking.com","Agoda","Expedia","Cleartrip","Yatra","Ixigo","Akbar Travels","EaseMyTrip","Indigo"];

const STATUS_OPTIONS = [
  "New","Shell Created","Live","Not Live","Ready to Go Live",
  "Content in Progress","Listing in Progress","Pending","Soldout","Closed",
];

const SUB_STATUS_OPTIONS = [
  "Live","Not Live","OTA Team","Pending at GoMMT","Pending at Booking.com",
  "Pending at EaseMyTrip","Pending at OTA","Supply/Operations","Revenue",
  "Exception","Duplicate - Listing Closed","Duplicate - Pending Invoice","Blank",
];

const STATUS_COLORS: Record<string, { bg: string; color: string; dot: string }> = {
  "live":                  { bg: "#D1FAE5", color: "#059669", dot: "#10B981" },
  "not live":              { bg: "#FEE2E2", color: "#DC2626", dot: "#EF4444" },
  "ready to go live":      { bg: "#FEF9C3", color: "#854D0E", dot: "#F59E0B" },
  "content in progress":   { bg: "#EEF2FF", color: "#4F46E5", dot: "#6366F1" },
  "listing in progress":   { bg: "#EEF2FF", color: "#4F46E5", dot: "#6366F1" },
  "pending":               { bg: "#FEF3C7", color: "#D97706", dot: "#F59E0B" },
  "soldout":               { bg: "#F3F4F6", color: "#6B7280", dot: "#9CA3AF" },
  "new":                   { bg: "#F0F9FF", color: "#0369A1", dot: "#38BDF8" },
  "shell created":         { bg: "#F5F3FF", color: "#7C3AED", dot: "#8B5CF6" },
  "closed":                { bg: "#F1F5F9", color: "#475569", dot: "#94A3B8" },
};

const SS_COLORS: Record<string, { bg: string; color: string }> = {
  "live":                        { bg: "#DCFCE7", color: "#16A34A" },
  "not live":                    { bg: "#FEE2E2", color: "#DC2626" },
  "ota team":                    { bg: "#FEF3C7", color: "#B45309" },
  "supply/operations":           { bg: "#EDE9FE", color: "#6D28D9" },
  "revenue":                     { bg: "#FFEDD5", color: "#C2410C" },
  "exception":                   { bg: "#FEF3C7", color: "#92400E" },
  "duplicate - listing closed":  { bg: "#F1F5F9", color: "#475569" },
  "duplicate - pending invoice": { bg: "#F1F5F9", color: "#475569" },
  "blank":                       { bg: "#F1F5F9", color: "#64748B" },
};
function getSsColor(s: string) {
  const key = s?.toLowerCase().trim();
  if (SS_COLORS[key]) return SS_COLORS[key];
  if (key?.startsWith("pending at")) return { bg: "#DBEAFE", color: "#1D4ED8" };
  return { bg: "#F1F5F9", color: "#64748B" };
}

interface OtaChip { ota: string; otaId: string | null; status: string; subStatus: string; liveDate: string | null; }
interface Row { id: string; name: string; city: string; fhStatus: string; fhLiveDate: string; otas: OtaChip[]; taskDueDate: string | null; }
interface Summary {
  statusCounts: { subStatus: string; cnt: number }[];
  statusTopCounts: { status: string; cnt: number }[];
  otaBreakdown: { ota: string; total: number; live: number; notLive: number; inProgress: number }[];
  tasksOpen: number; tasksHigh: number; tasksOverdue: number; tasksDone: number;
  fhPipeline: number[];
  recentLogs: { action: string; field: string; oldValue: string; newValue: string; note: string; createdAt: string; userName: string; propName: string; propId: string }[];
  userOta: string | null;
}

interface SheetRow {
  otaListingId: number;
  propertyId: string;
  name: string;
  city: string;
  fhStatus: string;
  fhLiveDate: string | null;
  ota: string;
  status: string;
  subStatus: string;
  liveDate: string | null;
  crmNote: string | null;
  crmUpdatedAt: string | null;
  assignedName: string | null;
}

function timeAgo(ts: string) {
  if (!ts) return "—";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
}
function initials(name: string) {
  return name?.split(" ").slice(0,2).map(w => w[0]).join("").toUpperCase() || "?";
}
function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const colors = ["#4F46E5","#059669","#DC2626","#D97706","#7C3AED","#0369A1","#C2410C"];
  const idx = name?.charCodeAt(0) % colors.length || 0;
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: colors[idx],
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.4, fontWeight: 700, color: "#fff", flexShrink: 0, letterSpacing: -0.5 }}>
      {initials(name)}
    </div>
  );
}
function StatusDot({ status }: { status: string }) {
  const s = STATUS_COLORS[status?.toLowerCase()] ?? { dot: "#94A3B8", color: "#64748B", bg: "#F1F5F9" };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontWeight: 600, color: s.color }}>{status || "—"}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERN SHEET VIEW
// ─────────────────────────────────────────────────────────────────────────────

export function InternSheetView() {
  const [rows,    setRows]    = useState<SheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState("");
  const [ssFilter,setSSFilter]= useState("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Dirty: { [otaListingId]: { status?, subStatus?, note? } }
  const [dirty,   setDirty]   = useState<Record<number, Record<string, string>>>({});
  // Which cell is in edit mode
  const [editCell,setEditCell]= useState<{ id: number; field: string } | null>(null);
  // Selected rows (by otaListingId)
  const [selected, setSelected] = useState<Set<number>>(new Set());
  // Bulk action values
  const [bulkStatus,    setBulkStatus]    = useState("");
  const [bulkSubStatus, setBulkSubStatus] = useState("");
  const [bulkNote,      setBulkNote]      = useState("");
  // Save state
  const [saving,      setSaving]      = useState(false);
  const [saveOk,      setSaveOk]      = useState<Set<number>>(new Set());
  const [saveErr,     setSaveErr]     = useState<Set<number>>(new Set());

  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Close edit on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (tableRef.current && !tableRef.current.contains(e.target as Node)) {
        setEditCell(null);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Warn on unsaved changes
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (Object.keys(dirty).length > 0) { e.preventDefault(); e.returnValue = ""; }
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function load() {
    setLoading(true);
    fetch("/api/crm/properties?export=1&fhStatus=Live,SoldOut")
      .then(r => r.json())
      .then(d => setRows((d.rows ?? []) as SheetRow[]))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  // Display value: dirty takes precedence over server value
  function val(row: SheetRow, field: string): string {
    return dirty[row.otaListingId]?.[field] ?? (row as unknown as Record<string, string>)[field] ?? "";
  }
  function isDirty(id: number, field: string) {
    return dirty[id]?.[field] !== undefined;
  }
  function setField(id: number, field: string, value: string) {
    setDirty(prev => ({ ...prev, [id]: { ...(prev[id] ?? {}), [field]: value } }));
  }

  // Filtered rows
  const filtered = rows.filter(r => {
    const search = debouncedSearch.toLowerCase();
    const matchSearch = !search ||
      r.name?.toLowerCase().includes(search) ||
      r.propertyId?.toLowerCase().includes(search) ||
      r.city?.toLowerCase().includes(search);
    const displaySS = val(r, "subStatus");
    const matchSS = ssFilter === "all" || displaySS.toLowerCase() === ssFilter.toLowerCase();
    return matchSearch && matchSS;
  });

  const dirtyCount = Object.keys(dirty).length;
  const allSelected = filtered.length > 0 && filtered.every(r => selected.has(r.otaListingId));
  const someSelected = selected.size > 0;

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(prev => { const n = new Set(prev); filtered.forEach(r => n.delete(r.otaListingId)); return n; });
    } else {
      setSelected(prev => { const n = new Set(prev); filtered.forEach(r => n.add(r.otaListingId)); return n; });
    }
  }
  function toggleRow(id: number) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function applyBulk() {
    if (!someSelected) return;
    setDirty(prev => {
      const next = { ...prev };
      for (const id of selected) {
        next[id] = { ...(next[id] ?? {}) };
        if (bulkStatus)    next[id].status    = bulkStatus;
        if (bulkSubStatus) next[id].subStatus = bulkSubStatus;
        if (bulkNote)      next[id].note      = bulkNote;
      }
      return next;
    });
    setBulkStatus(""); setBulkSubStatus(""); setBulkNote("");
    setSelected(new Set());
  }

  async function saveAll() {
    if (dirtyCount === 0 || saving) return;
    setSaving(true);
    setSaveOk(new Set()); setSaveErr(new Set());

    const tasks: Promise<{ id: number; ok: boolean }>[] = [];

    for (const [idStr, fields] of Object.entries(dirty)) {
      const id = Number(idStr);
      const row = rows.find(r => r.otaListingId === id);
      if (!row) continue;
      for (const [field, value] of Object.entries(fields)) {
        const apiField = field === "note" ? "note" : field; // note→crm_note handled by API
        tasks.push(
          fetch("/api/crm/update-status", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ otaListingId: id, propertyId: row.propertyId, field: apiField, value }),
          })
          .then(r => ({ id, ok: r.ok }))
          .catch(() => ({ id, ok: false }))
        );
      }
    }

    const results = await Promise.all(tasks);

    const okIds = new Set<number>();
    const errIds = new Set<number>();
    for (const r of results) {
      if (r.ok) okIds.add(r.id); else errIds.add(r.id);
    }

    // Merge dirty values into rows for saved ones
    setRows(prev => prev.map(r => {
      if (!okIds.has(r.otaListingId)) return r;
      const d = dirty[r.otaListingId] ?? {};
      return {
        ...r,
        status:    d.status    !== undefined ? d.status    : r.status,
        subStatus: d.subStatus !== undefined ? d.subStatus : r.subStatus,
        crmNote:   d.note      !== undefined ? d.note      : r.crmNote,
        crmUpdatedAt: new Date().toISOString(),
      };
    }));

    // Clear dirty only for saved rows
    setDirty(prev => {
      const next = { ...prev };
      for (const id of okIds) delete next[id];
      return next;
    });

    setSaveOk(okIds); setSaveErr(errIds);
    setSaving(false);

    // Clear flash after 2s
    setTimeout(() => { setSaveOk(new Set()); setSaveErr(new Set()); }, 2000);
  }

  const OTA_COLOR = (ota: string) => (OTA_COLORS as Record<string, string>)[ota] ?? "#6366F1";

  // Unique sub-statuses for filter dropdown
  const allSubStatuses = [...new Set(rows.map(r => r.subStatus).filter(Boolean))].sort();

  const COLS = "32px 32px minmax(180px,2.5fr) 90px 70px 100px 140px 180px 220px 110px 60px";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#F0F4F8", overflow: "hidden", fontFamily: "system-ui, -apple-system, sans-serif" }}>

      {/* ── Top bar ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2E8F0", padding: "0 16px",
        display: "flex", alignItems: "center", gap: 10, height: 50, flexShrink: 0 }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: "#0F172A", whiteSpace: "nowrap" }}>Intern Sheet</span>
        <div style={{ width: 1, height: 20, background: "#E2E8F0" }} />

        {/* Search */}
        <div style={{ position: "relative", width: 260 }}>
          <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", fontSize: 12, pointerEvents: "none" }}>⌕</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search property, ID, city…"
            style={{ width: "100%", padding: "6px 8px 6px 26px", border: "1px solid #E2E8F0", borderRadius: 7, fontSize: 12, outline: "none", background: "#F8FAFC", boxSizing: "border-box" }} />
        </div>

        {/* Sub-status filter */}
        <select value={ssFilter} onChange={e => setSSFilter(e.target.value)}
          style={{ padding: "5px 8px", border: "1px solid #E2E8F0", borderRadius: 7, fontSize: 11,
            background: ssFilter !== "all" ? "#EEF2FF" : "#F8FAFC",
            color: ssFilter !== "all" ? "#4F46E5" : "#374151", outline: "none", cursor: "pointer" }}>
          <option value="all">All Sub-statuses</option>
          {allSubStatuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <div style={{ flex: 1 }} />

        {/* Dirty count badge */}
        {dirtyCount > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, background: "#FEF9C3", color: "#854D0E",
            border: "1px solid #FDE68A", borderRadius: 20, padding: "3px 10px" }}>
            {dirtyCount} unsaved
          </span>
        )}

        {/* Save All */}
        <button onClick={saveAll} disabled={dirtyCount === 0 || saving}
          style={{ padding: "7px 18px", borderRadius: 7, border: "none",
            background: dirtyCount > 0 ? "#4F46E5" : "#E2E8F0",
            color: dirtyCount > 0 ? "#fff" : "#9CA3AF",
            fontSize: 12, fontWeight: 700, cursor: dirtyCount > 0 ? "pointer" : "not-allowed",
            opacity: saving ? 0.7 : 1, transition: "all 0.15s" }}>
          {saving ? "Saving…" : `Save All${dirtyCount > 0 ? ` (${dirtyCount})` : ""}`}
        </button>

        <Link href="/listings" style={{ fontSize: 11, color: "#9CA3AF", textDecoration: "none", padding: "5px 8px", border: "1px solid #E2E8F0", borderRadius: 6 }}>
          List View →
        </Link>
      </div>

      {/* ── Row count bar ── */}
      <div style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", padding: "6px 16px",
        display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: "#64748B" }}>
          {loading ? "Loading…" : `${filtered.length.toLocaleString()} rows`}
          {filtered.length !== rows.length && <span style={{ color: "#9CA3AF" }}> (of {rows.length})</span>}
        </span>
        {someSelected && (
          <span style={{ fontSize: 11, fontWeight: 700, color: "#4F46E5", background: "#EEF2FF",
            padding: "2px 10px", borderRadius: 10 }}>
            {selected.size} selected
          </span>
        )}
        {saveErr.size > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", background: "#FEE2E2",
            padding: "2px 10px", borderRadius: 10 }}>
            {saveErr.size} failed to save
          </span>
        )}
      </div>

      {/* ── Bulk action bar (appears when rows selected) ── */}
      {someSelected && (
        <div style={{ background: "#1E1B4B", padding: "8px 16px", display: "flex", alignItems: "center",
          gap: 10, flexShrink: 0, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#C7D2FE" }}>
            Bulk edit {selected.size} row{selected.size > 1 ? "s" : ""}
          </span>
          <div style={{ width: 1, height: 16, background: "#4338CA" }} />
          <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value)}
            style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #4338CA",
              background: "#312E81", color: bulkStatus ? "#fff" : "#818CF8",
              fontSize: 11, outline: "none", cursor: "pointer" }}>
            <option value="">Set Status…</option>
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={bulkSubStatus} onChange={e => setBulkSubStatus(e.target.value)}
            style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #4338CA",
              background: "#312E81", color: bulkSubStatus ? "#fff" : "#818CF8",
              fontSize: 11, outline: "none", cursor: "pointer" }}>
            <option value="">Set Sub-status…</option>
            {SUB_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input value={bulkNote} onChange={e => setBulkNote(e.target.value)}
            placeholder="Add note for all…"
            style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #4338CA",
              background: "#312E81", color: "#fff", fontSize: 11, outline: "none", width: 200 }} />
          <button onClick={applyBulk}
            disabled={!bulkStatus && !bulkSubStatus && !bulkNote}
            style={{ padding: "6px 16px", borderRadius: 6, border: "none",
              background: "#6366F1", color: "#fff", fontSize: 11, fontWeight: 700,
              cursor: "pointer", opacity: (!bulkStatus && !bulkSubStatus && !bulkNote) ? 0.5 : 1 }}>
            Apply →
          </button>
          <button onClick={() => setSelected(new Set())}
            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #4338CA",
              background: "transparent", color: "#818CF8", fontSize: 11, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      )}

      {/* ── Sheet table ── */}
      <div ref={tableRef} style={{ flex: 1, overflowY: "auto", overflowX: "auto" }}>
        <div style={{ minWidth: 1100 }}>

          {/* Column headers */}
          <div style={{ display: "grid", gridTemplateColumns: COLS,
            padding: "0 8px", background: "#F1F5F9", borderBottom: "2px solid #E2E8F0",
            position: "sticky", top: 0, zIndex: 10, gap: 0 }}>
            {/* Select all */}
            <div style={{ padding: "8px 4px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <input type="checkbox" checked={allSelected} onChange={toggleSelectAll}
                style={{ accentColor: "#4F46E5", width: 13, height: 13, cursor: "pointer" }} />
            </div>
            <div style={{ padding: "8px 4px", fontSize: 9, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.4, display: "flex", alignItems: "center" }}>#</div>
            {["Property Name","City","FH St.","OTA","Status","Sub-status","Note","Last Updated",""].map(h => (
              <div key={h} style={{ padding: "8px 6px", fontSize: 9, fontWeight: 700, color: "#9CA3AF",
                textTransform: "uppercase", letterSpacing: 0.4, display: "flex", alignItems: "center",
                borderLeft: "1px solid #E2E8F0" }}>
                {h}
              </div>
            ))}
          </div>

          {/* Rows */}
          {loading ? (
            <div style={{ padding: 60, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Loading…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 60, textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "#9CA3AF" }}>No rows found</div>
            </div>
          ) : filtered.map((row, i) => {
            const isSelected = selected.has(row.otaListingId);
            const rowDirty   = dirty[row.otaListingId];
            const anyDirty   = !!rowDirty && Object.keys(rowDirty).length > 0;
            const isSaveOk   = saveOk.has(row.otaListingId);
            const isSaveErr  = saveErr.has(row.otaListingId);

            const rowBg = isSaveOk  ? "#F0FDF4"
                        : isSaveErr ? "#FEF2F2"
                        : isSelected ? "#EEF2FF"
                        : anyDirty ? "#FEFCE8"
                        : i % 2 === 0 ? "#FFFFFF" : "#FAFAFA";

            const statusVal    = val(row, "status");
            const subStatusVal = val(row, "subStatus");
            const noteVal      = val(row, "note") || row.crmNote || "";
            const otaColor     = OTA_COLOR(row.ota);
            const sc = STATUS_COLORS[statusVal?.toLowerCase()] ?? { bg: "#F1F5F9", color: "#475569", dot: "#9CA3AF" };
            const ssc = getSsColor(subStatusVal);

            const cellStyle = (field: string): React.CSSProperties => ({
              padding: "6px 6px",
              borderLeft: "1px solid #E8EDF2",
              background: isDirty(row.otaListingId, field) ? "#FEF9C3" : "transparent",
              position: "relative",
            });

            return (
              <div key={row.otaListingId}
                style={{ display: "grid", gridTemplateColumns: COLS,
                  padding: "0 8px", background: rowBg, borderBottom: "1px solid #F1F5F9",
                  alignItems: "center", gap: 0,
                  outline: isSelected ? "2px solid #6366F1" : "none",
                  outlineOffset: -1,
                  transition: "background 0.1s" }}>

                {/* Checkbox */}
                <div style={{ padding: "6px 4px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <input type="checkbox" checked={isSelected} onChange={() => toggleRow(row.otaListingId)}
                    style={{ accentColor: "#4F46E5", width: 13, height: 13, cursor: "pointer" }} />
                </div>

                {/* Row number */}
                <div style={{ padding: "6px 4px", fontSize: 10, color: "#CBD5E1", textAlign: "right" }}>
                  {i + 1}
                </div>

                {/* Property Name */}
                <div style={{ padding: "6px 6px", borderLeft: "1px solid #E8EDF2", minWidth: 0 }}>
                  <Link href={`/crm/${row.propertyId}`} target="_blank"
                    style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", textDecoration: "none",
                      display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    title={row.name}>
                    {row.name || <span style={{ color: "#CBD5E1" }}>—</span>}
                  </Link>
                  <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 1 }}>{row.propertyId}</div>
                </div>

                {/* City */}
                <div style={{ padding: "6px 6px", borderLeft: "1px solid #E8EDF2",
                  fontSize: 11, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.city || "—"}
                </div>

                {/* FH Status */}
                <div style={{ padding: "6px 6px", borderLeft: "1px solid #E8EDF2" }}>
                  <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 10,
                    background: row.fhStatus === "Live" ? "#DCFCE7" : "#F1F5F9",
                    color: row.fhStatus === "Live" ? "#15803D" : "#64748B" }}>
                    {row.fhStatus || "—"}
                  </span>
                </div>

                {/* OTA */}
                <div style={{ padding: "6px 6px", borderLeft: "1px solid #E8EDF2" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: otaColor,
                    background: otaColor + "18", padding: "2px 8px", borderRadius: 6,
                    border: `1px solid ${otaColor}30` }}>
                    {row.ota}
                  </span>
                </div>

                {/* Status — editable */}
                <div style={cellStyle("status")}
                  onClick={() => setEditCell({ id: row.otaListingId, field: "status" })}>
                  {editCell?.id === row.otaListingId && editCell.field === "status" ? (
                    <select autoFocus value={statusVal}
                      onChange={e => { setField(row.otaListingId, "status", e.target.value); setEditCell(null); }}
                      onBlur={() => setEditCell(null)}
                      style={{ width: "100%", padding: "3px 4px", border: "2px solid #6366F1",
                        borderRadius: 5, fontSize: 11, outline: "none", background: "#fff", cursor: "pointer" }}>
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.dot, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: sc.color }}>{statusVal || "—"}</span>
                      <span style={{ marginLeft: "auto", fontSize: 9, color: "#CBD5E1" }}>▾</span>
                    </div>
                  )}
                </div>

                {/* Sub-status — editable */}
                <div style={cellStyle("subStatus")}
                  onClick={() => setEditCell({ id: row.otaListingId, field: "subStatus" })}>
                  {editCell?.id === row.otaListingId && editCell.field === "subStatus" ? (
                    <select autoFocus value={subStatusVal}
                      onChange={e => { setField(row.otaListingId, "subStatus", e.target.value); setEditCell(null); }}
                      onBlur={() => setEditCell(null)}
                      style={{ width: "100%", padding: "3px 4px", border: "2px solid #6366F1",
                        borderRadius: 5, fontSize: 11, outline: "none", background: "#fff", cursor: "pointer" }}>
                      {SUB_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: ssc.color,
                        background: ssc.bg, padding: "1px 8px", borderRadius: 10 }}>
                        {subStatusVal || "—"}
                      </span>
                      <span style={{ marginLeft: "auto", fontSize: 9, color: "#CBD5E1" }}>▾</span>
                    </div>
                  )}
                </div>

                {/* Note — editable */}
                <div style={cellStyle("note")}
                  onClick={() => setEditCell({ id: row.otaListingId, field: "note" })}>
                  {editCell?.id === row.otaListingId && editCell.field === "note" ? (
                    <input autoFocus value={noteVal}
                      onChange={e => setField(row.otaListingId, "note", e.target.value)}
                      onBlur={() => setEditCell(null)}
                      onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") setEditCell(null); }}
                      style={{ width: "100%", padding: "3px 6px", border: "2px solid #6366F1",
                        borderRadius: 5, fontSize: 11, outline: "none", background: "#fff", boxSizing: "border-box" }} />
                  ) : (
                    <div style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: 11, color: noteVal ? "#374151" : "#CBD5E1",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                        {noteVal || "Add note…"}
                      </span>
                      <span style={{ fontSize: 9, color: "#CBD5E1", flexShrink: 0 }}>✎</span>
                    </div>
                  )}
                </div>

                {/* Last Updated */}
                <div style={{ padding: "6px 6px", borderLeft: "1px solid #E8EDF2" }}>
                  <div style={{ fontSize: 10, color: "#94A3B8" }}>{timeAgo(row.crmUpdatedAt ?? "")}</div>
                  {row.assignedName && (
                    <div style={{ fontSize: 10, color: "#CBD5E1", marginTop: 1 }}>{row.assignedName}</div>
                  )}
                </div>

                {/* Save status flash / open link */}
                <div style={{ padding: "6px 4px", borderLeft: "1px solid #E8EDF2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {isSaveOk ? (
                    <span style={{ fontSize: 13, color: "#16A34A" }}>✓</span>
                  ) : isSaveErr ? (
                    <span style={{ fontSize: 13, color: "#DC2626" }} title="Save failed">✕</span>
                  ) : (
                    <Link href={`/crm/${row.propertyId}`} target="_blank"
                      title="Open property detail"
                      style={{ fontSize: 11, color: "#CBD5E1", textDecoration: "none" }}>↗</Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
