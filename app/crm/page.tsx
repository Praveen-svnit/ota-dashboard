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

function InternSheetView() {
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

// ─────────────────────────────────────────────────────────────────────────────
// TL / ADMIN CRM VIEW  (existing list view, unchanged)
// ─────────────────────────────────────────────────────────────────────────────

function TlCrmView() {
  const [rows,    setRows]    = useState<Row[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);

  const [search,          setSearch]          = useState("");
  const [otaFilter,       setOtaFilter]       = useState("all");
  const [statusFilter,    setStatusFilter]    = useState("all");
  const [subStatusFilter, setSubStatusFilter] = useState("all");
  const [fhStatusFilter,  setFhStatusFilter]  = useState<string[]>(["Live", "SoldOut"]);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [fhDateFrom,   setFhDateFrom]   = useState("");
  const [fhDateTo,     setFhDateTo]     = useState("");
  const [otaDateFrom,  setOtaDateFrom]  = useState("");
  const [otaDateTo,    setOtaDateTo]    = useState("");

  const [summary,       setSummary]       = useState<Summary | null>(null);
  const [showActivity,  setShowActivity]  = useState(false);
  const [statusView,    setStatusView]    = useState<"status" | "subStatus">("status");
  const [breakdownOtas,    setBreakdownOtas]    = useState<string[]>([]);
  const [breakdownData,    setBreakdownData]    = useState<{ statusCounts: { subStatus: string; cnt: number }[]; statusTopCounts: { status: string; cnt: number }[] } | null>(null);
  const [breakdownExpanded, setBreakdownExpanded] = useState(false);
  const [statsOpen,    setStatsOpen]    = useState(true);
  const [hoveredRow,   setHoveredRow]   = useState<number | null>(null);
  const otaDropRef = useRef<HTMLDivElement>(null);
  const [otaDropOpen, setOtaDropOpen] = useState(false);
  const [sortBy,  setSortBy]  = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { fetch("/api/crm/summary").then(r => r.json()).then(setSummary); }, []);

  useEffect(() => {
    const q = breakdownOtas.length > 0 ? `?otas=${encodeURIComponent(breakdownOtas.join(","))}` : "";
    fetch(`/api/crm/breakdown${q}`).then(r => r.json()).then(setBreakdownData);
    setBreakdownExpanded(false);
  }, [breakdownOtas]);

  useEffect(() => { setBreakdownExpanded(false); }, [statusView]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (otaDropRef.current && !otaDropRef.current.contains(e.target as Node)) setOtaDropOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const buildParams = useCallback((extra?: Record<string, string>) => {
    const q: Record<string, string> = { search: debouncedSearch, ota: otaFilter, status: statusFilter, subStatus: subStatusFilter, fhStatus: fhStatusFilter.join(","), sortBy, sortDir };
    if (fhDateFrom)  q.fhFrom  = fhDateFrom;
    if (fhDateTo)    q.fhTo    = fhDateTo;
    if (otaDateFrom) q.otaFrom = otaDateFrom;
    if (otaDateTo)   q.otaTo   = otaDateTo;
    return new URLSearchParams({ ...q, ...extra });
  }, [debouncedSearch, otaFilter, statusFilter, subStatusFilter, fhDateFrom, fhDateTo, otaDateFrom, otaDateTo, sortBy, sortDir]);

  function handleSort(col: string) {
    if (sortBy === col) { setSortDir(d => d === "asc" ? "desc" : "asc"); }
    else { setSortBy(col); setSortDir("asc"); }
    setPage(1);
  }

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/crm/properties?${buildParams({ page: String(page) })}`)
      .then(r => r.json())
      .then(d => { setRows(d.rows ?? []); setTotal(d.total ?? 0); })
      .finally(() => setLoading(false));
  }, [buildParams, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedSearch, otaFilter, statusFilter, subStatusFilter, fhStatusFilter, fhDateFrom, fhDateTo, otaDateFrom, otaDateTo]);

  const [csvLoading, setCsvLoading] = useState(false);
  const downloadCsv = () => {
    setCsvLoading(true);
    fetch(`/api/crm/properties?${buildParams({ export: "1" })}`)
      .then(r => r.json())
      .then(d => {
        const rows: typeof d.rows = d.rows ?? [];
        const headers = ["Property ID","Property Name","City","FH Status","FH Live Date","OTA","Status","Sub-Status","OTA Live Date","Assigned To","Note"];
        const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const csv = [headers.join(","), ...rows.map((r: typeof rows[0]) =>
          [r.propertyId, r.name, r.city, r.fhStatus, r.fhLiveDate, r.ota, r.status, r.subStatus, r.liveDate, r.assignedName, r.crmNote].map(escape).join(",")
        )].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url;
        a.download = `listings_${new Date().toISOString().slice(0,10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
      }).finally(() => setCsvLoading(false));
  };

  const totalPages = Math.ceil(total / 50);
  const totalListings = summary?.statusCounts.reduce((a, b) => a + b.cnt, 0) ?? 0;
  const liveCount     = summary?.statusCounts.find(s => s.subStatus === "live")?.cnt ?? 0;
  const availableOtas = summary?.userOta
    ? [summary.userOta]
    : (summary?.otaBreakdown ?? []).map(o => o.ota).filter(Boolean);

  const activeFilterCount = [
    otaFilter !== "all", statusFilter !== "all", subStatusFilter !== "all",
    !(fhStatusFilter.length === 2 && fhStatusFilter.includes("Live") && fhStatusFilter.includes("SoldOut")),
    !!fhDateFrom || !!fhDateTo, !!otaDateFrom || !!otaDateTo,
  ].filter(Boolean).length;

  function clearFilters() {
    setOtaFilter("all"); setStatusFilter("all"); setSubStatusFilter("all"); setFhStatusFilter(["Live", "SoldOut"]);
    setFhDateFrom(""); setFhDateTo(""); setOtaDateFrom(""); setOtaDateTo(""); setSearch("");
  }

  const statusOptions    = [...new Set((summary?.statusTopCounts ?? []).map(s => s.status))].filter(Boolean);
  const subStatusOptions = [...new Set((summary?.statusCounts ?? []).map(s => s.subStatus))].filter(Boolean);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#F0F4F8", overflow: "hidden" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #E2E8F0", padding: "0 20px",
        display: "flex", alignItems: "center", gap: 12, height: 52, flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", whiteSpace: "nowrap" }}>OTA Listings</div>
        <div style={{ width: 1, height: 22, background: "#E2E8F0" }} />
        <div style={{ flex: 1, position: "relative", maxWidth: 380, marginLeft: "auto" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", fontSize: 13, pointerEvents: "none" }}>⌕</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search property, ID, city…"
            style={{ width: "100%", padding: "7px 10px 7px 30px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12, outline: "none", background: "#F8FAFC", boxSizing: "border-box" }} />
        </div>
        <button onClick={() => setShowActivity(a => !a)}
          style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid", borderColor: showActivity ? "#7C3AED" : "#E2E8F0",
            background: showActivity ? "#F5F3FF" : "#fff", color: showActivity ? "#7C3AED" : "#64748B", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
          ◷ Activity
        </button>
        <button onClick={downloadCsv} disabled={csvLoading}
          style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid #E2E8F0", background: "#fff", color: "#374151", fontSize: 11, fontWeight: 600, cursor: csvLoading ? "not-allowed" : "pointer", whiteSpace: "nowrap", opacity: csvLoading ? 0.6 : 1 }}>
          ↓ Export
        </button>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>

          {/* Stats bar */}
          <div style={{ background: "#fff", borderBottom: "1px solid #E2E8F0", padding: "0 20px" }}>
            <button onClick={() => setStatsOpen(o => !o)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: 0.5 }}>Overview</span>
              <span style={{ fontSize: 10, color: "#9CA3AF" }}>{statsOpen ? "▲" : "▼"}</span>
            </button>
            {statsOpen && (
              <div style={{ paddingBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" }}>Breakdown</span>
                  <div style={{ display: "flex", background: "#F1F5F9", borderRadius: 6, padding: 2, gap: 1 }}>
                    {(["status","subStatus"] as const).map(v => (
                      <button key={v} onClick={() => setStatusView(v)}
                        style={{ padding: "3px 10px", borderRadius: 5, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 600,
                          background: statusView === v ? "#fff" : "transparent", color: statusView === v ? "#0F172A" : "#64748B",
                          boxShadow: statusView === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
                        {v === "status" ? "Status" : "Sub-Status"}
                      </button>
                    ))}
                  </div>
                  <div ref={otaDropRef} style={{ position: "relative" }}>
                    <button onClick={() => setOtaDropOpen(o => !o)}
                      style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid", borderColor: breakdownOtas.length > 0 ? "#6366F1" : "#E2E8F0",
                        background: breakdownOtas.length > 0 ? "#EEF2FF" : "#fff", color: breakdownOtas.length > 0 ? "#4F46E5" : "#64748B", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                      {breakdownOtas.length === 0 ? "All OTAs ▾" : `${breakdownOtas.length} OTA${breakdownOtas.length > 1 ? "s" : ""} ▾`}
                    </button>
                    {otaDropOpen && (
                      <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 100, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.10)", padding: "6px 0", minWidth: 160 }}>
                        <div onClick={() => setBreakdownOtas([])}
                          style={{ padding: "5px 12px", fontSize: 11, cursor: "pointer", color: breakdownOtas.length === 0 ? "#4F46E5" : "#374151", fontWeight: breakdownOtas.length === 0 ? 700 : 400, background: breakdownOtas.length === 0 ? "#EEF2FF" : "transparent" }}>
                          All Listings
                        </div>
                        <div style={{ height: 1, background: "#F1F5F9", margin: "3px 0" }} />
                        {availableOtas.map(ota => {
                          const checked = breakdownOtas.includes(ota);
                          return (
                            <div key={ota} onClick={() => setBreakdownOtas(prev => checked ? prev.filter(o => o !== ota) : [...prev, ota])}
                              style={{ padding: "5px 12px", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 7,
                                background: checked ? "#EEF2FF" : "transparent", color: checked ? "#4F46E5" : "#374151", fontWeight: checked ? 600 : 400 }}>
                              <span style={{ width: 13, height: 13, borderRadius: 3, border: `2px solid ${checked ? "#6366F1" : "#D1D5DB"}`,
                                background: checked ? "#6366F1" : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center",
                                fontSize: 8, color: "#fff", flexShrink: 0 }}>{checked ? "✓" : ""}</span>
                              {ota}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
                {(() => {
                  const data = breakdownData ?? { statusCounts: summary?.statusCounts ?? [], statusTopCounts: summary?.statusTopCounts ?? [] };
                  const items = statusView === "status"
                    ? data.statusTopCounts.map(s => ({ label: s.status, cnt: s.cnt }))
                    : data.statusCounts.map(s => ({ label: s.subStatus, cnt: s.cnt }));
                  const VISIBLE = 7;
                  const visible = breakdownExpanded ? items : items.slice(0, VISIBLE);
                  return (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {visible.map(item => {
                        const s = STATUS_COLORS[item.label?.toLowerCase()] ?? { bg: "#F1F5F9", color: "#475569", dot: "#9CA3AF" };
                        const isActive = statusView === "status" ? statusFilter === item.label : subStatusFilter === item.label;
                        return (
                          <div key={item.label} onClick={() => {
                              if (statusView === "status") { setStatusFilter(f => f === item.label ? "all" : item.label); setSubStatusFilter("all"); }
                              else { setSubStatusFilter(f => f === item.label ? "all" : item.label); setStatusFilter("all"); }
                              setPage(1);
                            }}
                            style={{ background: isActive ? s.dot : s.bg, border: `2px solid ${isActive ? s.dot : s.dot + "40"}`,
                              borderRadius: 7, padding: "6px 10px", minWidth: 80, cursor: "pointer", transition: "all 0.12s",
                              boxShadow: isActive ? `0 0 0 3px ${s.dot}30` : "none" }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color: isActive ? "#fff" : s.color, lineHeight: 1 }}>{item.cnt}</div>
                            <div style={{ fontSize: 9, fontWeight: 600, color: isActive ? "#fff" : s.color, opacity: isActive ? 1 : 0.8, marginTop: 2, textTransform: "capitalize" }}>{item.label || "—"}</div>
                          </div>
                        );
                      })}
                      {!breakdownExpanded && items.length > VISIBLE && (
                        <button onClick={() => setBreakdownExpanded(true)} style={{ padding: "6px 10px", borderRadius: 7, border: "1px dashed #CBD5E1", background: "#F8FAFC", color: "#64748B", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>+{items.length - VISIBLE} more</button>
                      )}
                      {breakdownExpanded && items.length > VISIBLE && (
                        <button onClick={() => setBreakdownExpanded(false)} style={{ padding: "6px 10px", borderRadius: 7, border: "1px dashed #CBD5E1", background: "#F8FAFC", color: "#64748B", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>Show less ↑</button>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {showActivity && (
            <div style={{ background: "#fff", borderBottom: "1px solid #DDD6FE", padding: "14px 20px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#6D28D9", marginBottom: 10 }}>Recent Activity</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {(summary?.recentLogs ?? []).map((log, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 10px", borderRadius: 7, background: "#FAFAFA", border: "1px solid #F1F5F9" }}>
                    <Avatar name={log.userName ?? "?"} size={26} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: "#1E293B" }}>
                        <span style={{ fontWeight: 600 }}>{log.userName ?? "System"}</span>{" "}
                        {log.action === "status_change"
                          ? <>{log.field}: <span style={{ color: "#DC2626" }}>{log.oldValue}</span> → <span style={{ color: "#059669" }}>{log.newValue}</span></>
                          : <span style={{ color: "#64748B" }}>{log.note || log.action}</span>}
                      </div>
                      <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 1 }}>
                        <Link href={`/crm/${log.propId}`} style={{ color: "#6366F1", textDecoration: "none" }}>{log.propName}</Link>
                        {" · "}{timeAgo(log.createdAt)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filter bar */}
          <div style={{ background: "#fff", borderBottom: "1px solid #E2E8F0", padding: "8px 16px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <select value={otaFilter} onChange={e => setOtaFilter(e.target.value)} disabled={!!summary?.userOta}
              style={{ padding: "5px 8px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 11, background: otaFilter !== "all" ? "#EEF2FF" : "#F8FAFC", color: otaFilter !== "all" ? "#4F46E5" : "#374151", outline: "none", cursor: "pointer" }}>
              <option value="all">All OTAs</option>
              {(summary?.userOta ? [summary.userOta] : OTA_LIST).map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 8px", border: "1px solid #E2E8F0", borderRadius: 6, background: "#F8FAFC" }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", marginRight: 2 }}>FH:</span>
              {["Live", "SoldOut", "Churned"].map(s => {
                const checked = fhStatusFilter.includes(s);
                return (
                  <label key={s} style={{ display: "flex", alignItems: "center", gap: 3, cursor: "pointer", fontSize: 11 }}>
                    <input type="checkbox" checked={checked} onChange={() => setFhStatusFilter(prev => checked ? prev.filter(x => x !== s) : [...prev, s])} style={{ accentColor: "#4F46E5", width: 11, height: 11 }} />
                    <span style={{ color: checked ? "#4F46E5" : "#475569", fontWeight: checked ? 600 : 400 }}>{s}</span>
                  </label>
                );
              })}
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              style={{ padding: "5px 8px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 11, background: statusFilter !== "all" ? "#EEF2FF" : "#F8FAFC", color: statusFilter !== "all" ? "#4F46E5" : "#374151", outline: "none", cursor: "pointer" }}>
              <option value="all">All Statuses</option>
              {statusOptions.map(s => <option key={s} value={s} style={{ textTransform: "capitalize" }}>{s}</option>)}
            </select>
            <select value={subStatusFilter} onChange={e => setSubStatusFilter(e.target.value)}
              style={{ padding: "5px 8px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 11, background: subStatusFilter !== "all" ? "#EEF2FF" : "#F8FAFC", color: subStatusFilter !== "all" ? "#4F46E5" : "#374151", outline: "none", cursor: "pointer" }}>
              <option value="all">All Sub-Statuses</option>
              {subStatusOptions.map(s => <option key={s} value={s} style={{ textTransform: "capitalize" }}>{s}</option>)}
            </select>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF" }}>FH Date:</span>
              <input type="date" value={fhDateFrom} onChange={e => setFhDateFrom(e.target.value)} style={{ padding: "4px 6px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 11, outline: "none", background: fhDateFrom ? "#EEF2FF" : "#F8FAFC", color: fhDateFrom ? "#4F46E5" : "#374151" }} />
              <span style={{ fontSize: 10, color: "#9CA3AF" }}>–</span>
              <input type="date" value={fhDateTo} onChange={e => setFhDateTo(e.target.value)} style={{ padding: "4px 6px", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 11, outline: "none", background: fhDateTo ? "#EEF2FF" : "#F8FAFC", color: fhDateTo ? "#4F46E5" : "#374151" }} />
            </div>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #FECACA", background: "#FEF2F2", color: "#DC2626", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>✕ Clear</button>
            )}
          </div>

          <div style={{ padding: "10px 20px", display: "flex", alignItems: "center", gap: 10, background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>
              {loading ? "Loading…" : `${total.toLocaleString()} propert${total !== 1 ? "ies" : "y"}`}
            </span>
            {activeFilterCount > 0 && (
              <span style={{ fontSize: 10, color: "#4F46E5", background: "#EEF2FF", padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>
                {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active
              </span>
            )}
          </div>

          <div style={{ flex: 1 }}>
            {(() => {
              const SORT_COLS: Record<string, string> = { "Property Name": "name", "City": "city", "FH Live Date": "fhLiveDate", "FH Status": "fhStatus", "Task Due": "taskDue" };
              const arrow = (col: string) => {
                if (sortBy !== SORT_COLS[col]) return <span style={{ color: "#D1D5DB", marginLeft: 3 }}>↕</span>;
                return <span style={{ color: "#5D87FF", marginLeft: 3 }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
              };
              return (
                <div style={{ display: "grid", gridTemplateColumns: "55px minmax(120px,2fr) 90px 95px 80px 90px 100px 90px 110px 85px 60px", padding: "7px 20px", background: "#F1F5F9", borderBottom: "1px solid #E2E8F0", gap: 8 }}>
                  {["ID", "Property Name", "City", "FH Live Date", "FH Status", "OTA Status", "Sub-Status", "OTA Live Date", "OTA ID", "Task Due", ""].map(h => {
                    const sortKey = SORT_COLS[h];
                    return (
                      <div key={h} onClick={sortKey ? () => handleSort(sortKey) : undefined}
                        style={{ fontSize: 10, fontWeight: 700, color: sortBy === sortKey ? "#5D87FF" : "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.4, cursor: sortKey ? "pointer" : "default", userSelect: "none", display: "flex", alignItems: "center" }}>
                        {h}{sortKey && arrow(h)}
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {loading ? (
              <div style={{ padding: 60, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Loading…</div>
            ) : rows.length === 0 ? (
              <div style={{ padding: 60, textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>No listings found</div>
                <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 4 }}>Try adjusting your filters</div>
              </div>
            ) : rows.map((row, i) => {
              const isHovered = hoveredRow === i;
              const isOverdue = row.taskDueDate && new Date(row.taskDueDate) < new Date(new Date().toDateString());
              const singleOta = otaFilter !== "all"
                ? (row.otas ?? []).find(o => o.ota === otaFilter) ?? null
                : (row.otas ?? []).length === 1 ? (row.otas ?? [])[0] : null;
              return (
                <div key={i} onMouseEnter={() => setHoveredRow(i)} onMouseLeave={() => setHoveredRow(null)}
                  style={{ display: "grid", gridTemplateColumns: "55px minmax(120px,2fr) 90px 95px 80px 90px 100px 90px 110px 85px 60px",
                    padding: "10px 20px", gap: 8, alignItems: "center", borderBottom: "1px solid #F1F5F9",
                    background: isHovered ? "#F8FAFC" : "#fff", transition: "background 0.1s" }}>
                  <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>{row.id}</div>
                  <div style={{ minWidth: 0 }}>
                    <Link href={`/crm/${row.id}`} style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.name}>
                      {row.name || <span style={{ color: "#CBD5E1" }}>—</span>}
                    </Link>
                  </div>
                  <div style={{ fontSize: 11, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.city || <span style={{ color: "#CBD5E1" }}>—</span>}</div>
                  <div style={{ fontSize: 11, color: "#475569" }}>{fmtDate(row.fhLiveDate)}</div>
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: row.fhStatus === "Live" ? "#DCFCE7" : "#F1F5F9", color: row.fhStatus === "Live" ? "#15803D" : "#64748B", border: `1px solid ${row.fhStatus === "Live" ? "#BBF7D0" : "#E2E8F0"}` }}>
                      {row.fhStatus || "—"}
                    </span>
                  </div>
                  <div>{singleOta ? <StatusDot status={singleOta.status} /> : <span style={{ fontSize: 11, color: "#CBD5E1" }}>—</span>}</div>
                  <div style={{ fontSize: 11, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{singleOta?.subStatus || <span style={{ color: "#CBD5E1" }}>—</span>}</div>
                  <div style={{ fontSize: 11, color: "#475569" }}>{singleOta?.liveDate ? fmtDate(singleOta.liveDate) : <span style={{ color: "#CBD5E1" }}>—</span>}</div>
                  <div style={{ fontSize: 11, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{singleOta?.otaId ? <span style={{ fontWeight: 600 }}>{singleOta.otaId}</span> : <span style={{ color: "#CBD5E1" }}>—</span>}</div>
                  <div>
                    {row.taskDueDate ? (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, background: isOverdue ? "#FEF2F2" : "#FEFCE8", color: isOverdue ? "#DC2626" : "#854D0E", border: `1px solid ${isOverdue ? "#FECACA" : "#FDE68A"}`, whiteSpace: "nowrap" }}>
                        {fmtDate(row.taskDueDate)}
                      </span>
                    ) : <span style={{ fontSize: 11, color: "#CBD5E1" }}>—</span>}
                  </div>
                  <div style={{ opacity: isHovered ? 1 : 0, transition: "opacity 0.15s" }}>
                    <Link href={`/crm/${row.id}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, fontWeight: 600, color: "#fff", background: "#4F46E5", borderRadius: 6, padding: "4px 10px", textDecoration: "none", whiteSpace: "nowrap" }}>Open →</Link>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", background: "#fff", borderTop: "1px solid #E2E8F0", flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: "#64748B" }}>Page {page} of {totalPages} · {total.toLocaleString()} total</span>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => setPage(1)} disabled={page === 1} style={{ padding: "5px 9px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#fff", fontSize: 11, cursor: "pointer", opacity: page === 1 ? 0.4 : 1 }}>«</button>
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#fff", fontSize: 11, cursor: "pointer", opacity: page === 1 ? 0.4 : 1 }}>‹ Prev</button>
                {[...Array(Math.min(5, totalPages))].map((_, idx) => {
                  const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + idx;
                  if (p > totalPages) return null;
                  return <button key={p} onClick={() => setPage(p)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid", borderColor: page === p ? "#4F46E5" : "#E2E8F0", background: page === p ? "#4F46E5" : "#fff", color: page === p ? "#fff" : "#374151", fontSize: 11, fontWeight: page === p ? 700 : 400, cursor: "pointer" }}>{p}</button>;
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#fff", fontSize: 11, cursor: "pointer", opacity: page === totalPages ? 0.4 : 1 }}>Next ›</button>
                <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={{ padding: "5px 9px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#fff", fontSize: 11, cursor: "pointer", opacity: page === totalPages ? 0.4 : 1 }}>»</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT EXPORT — role-aware router
// ─────────────────────────────────────────────────────────────────────────────

export default function CrmPage() {
  return <InternSheetView />;
}
