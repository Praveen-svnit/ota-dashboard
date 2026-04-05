"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { OTA_COLORS } from "@/lib/constants";

const OTA_LIST = ["GoMMT","Booking.com","Agoda","Expedia","Cleartrip","Yatra","Ixigo","Akbar Travels","EaseMyTrip","Indigo"];

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

interface OtaChip {
  ota: string; status: string; subStatus: string; liveDate: string | null;
}

interface Row {
  id: string; name: string; city: string; fhStatus: string; fhLiveDate: string;
  otas: OtaChip[]; taskDueDate: string | null;
}

interface Summary {
  statusCounts: { subStatus: string; cnt: number }[];
  statusTopCounts: { status: string; cnt: number }[];
  otaBreakdown: { ota: string; total: number; live: number; notLive: number; inProgress: number }[];
  tasksOpen: number; tasksHigh: number; tasksOverdue: number; tasksDone: number;
  fhPipeline: number[];
  recentLogs: { action: string; field: string; oldValue: string; newValue: string; note: string; createdAt: string; userName: string; propName: string; propId: string }[];
  userOta: string | null;
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtDate(d: string) {
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

// ── Filter sidebar section ─────────────────────────────────────────────────

function FilterSection({ label, count, children }: { label: string; count?: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ borderBottom: "1px solid #F1F5F9" }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          width: "100%", padding: "10px 14px", background: "none", border: "none",
          cursor: "pointer", fontSize: 11, fontWeight: 700, color: "#374151", textAlign: "left" }}>
        <span>{label}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {count ? <span style={{ background: "#4F46E5", color: "#fff", borderRadius: 10,
            fontSize: 9, fontWeight: 700, padding: "1px 6px" }}>{count}</span> : null}
          <span style={{ color: "#9CA3AF", fontSize: 10 }}>{open ? "▲" : "▼"}</span>
        </div>
      </button>
      {open && <div style={{ padding: "0 14px 10px" }}>{children}</div>}
    </div>
  );
}

// ── KPI tile ──────────────────────────────────────────────────────────────

function KpiTile({ label, value, color, bg, border }: { label: string; value: number; color: string; bg: string; border: string }) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: "10px 14px", flex: 1, minWidth: 100 }}>
      <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{value.toLocaleString()}</div>
      <div style={{ fontSize: 10, fontWeight: 600, color, opacity: 0.8, marginTop: 3 }}>{label}</div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function CrmPage() {
  const [rows,    setRows]    = useState<Row[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);

  const [search,          setSearch]          = useState("");
  const [otaFilter,       setOtaFilter]       = useState("all");
  const [statusFilter,    setStatusFilter]    = useState("all");
  const [subStatusFilter, setSubStatusFilter] = useState("all");
  const [fhStatusFilter,  setFhStatusFilter]  = useState<string[]>([]);
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
    const q: Record<string, string> = { search: debouncedSearch, ota: otaFilter, status: statusFilter, subStatus: subStatusFilter, fhStatus: fhStatusFilter.join(",") };
    if (fhDateFrom)  q.fhFrom  = fhDateFrom;
    if (fhDateTo)    q.fhTo    = fhDateTo;
    if (otaDateFrom) q.otaFrom = otaDateFrom;
    if (otaDateTo)   q.otaTo   = otaDateTo;
    return new URLSearchParams({ ...q, ...extra });
  }, [debouncedSearch, otaFilter, statusFilter, subStatusFilter, fhDateFrom, fhDateTo, otaDateFrom, otaDateTo]);

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
        const headers = ["Property ID","Property Name","City","FH Status","FH Live Date","OTA","Status","Sub-Status","OTA Live Date","Assigned To","Note","Task Due Date"];
        const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const csv = [headers.join(","), ...rows.map((r: typeof rows[0]) =>
          [r.id, r.name, r.city, r.fhStatus, r.fhLiveDate, r.ota, r.status, r.subStatus, r.liveDate, r.assignedName, r.crmNote, r.taskDueDate].map(escape).join(",")
        )].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url;
        a.download = `listings_${new Date().toISOString().slice(0,10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
      }).finally(() => setCsvLoading(false));
  };

  const totalPages = Math.ceil(total / 50);

  const liveCount     = summary?.statusCounts.find(s => s.subStatus === "live")?.cnt ?? 0;
  const notLiveCount  = totalListings - (summary?.statusCounts.find(s => s.subStatus === "live")?.cnt ?? 0);
  const totalListings = summary?.statusCounts.reduce((a, b) => a + b.cnt, 0) ?? 0;
  const readyCount    = summary?.statusTopCounts.find(s => s.status === "ready to go live")?.cnt ?? 0;

  const availableOtas = summary?.userOta
    ? [summary.userOta]
    : (summary?.otaBreakdown ?? []).map(o => o.ota).filter(Boolean);

  const activeFilterCount = [
    otaFilter !== "all", statusFilter !== "all", subStatusFilter !== "all", fhStatusFilter.length > 0,
    !!fhDateFrom || !!fhDateTo, !!otaDateFrom || !!otaDateTo,
  ].filter(Boolean).length;

  function clearFilters() {
    setOtaFilter("all"); setStatusFilter("all"); setSubStatusFilter("all"); setFhStatusFilter([]);
    setFhDateFrom(""); setFhDateTo(""); setOtaDateFrom(""); setOtaDateTo("");
    setSearch("");
  }

  // Status options derived from summary data
  const statusOptions = [...new Set([
    ...((summary?.statusTopCounts ?? []).map(s => s.status)),
  ])].filter(Boolean);

  const subStatusOptions = [...new Set([
    ...((summary?.statusCounts ?? []).map(s => s.subStatus)),
  ])].filter(Boolean);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#F0F4F8", overflow: "hidden" }}>

      {/* ── Top bar ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2E8F0", padding: "0 20px",
        display: "flex", alignItems: "center", gap: 12, height: 52, flexShrink: 0 }}>

        {/* Title */}
        <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A", whiteSpace: "nowrap" }}>
          OTA Listings
        </div>
        <div style={{ width: 1, height: 22, background: "#E2E8F0" }} />

        {/* Nav tabs */}
        <div style={{ display: "flex", gap: 1 }}>
          {([
            ["CRM",           "/crm",                  true],
            ["Tasks",         "/tasks",                 false],
            ["Performance",   "/performance",           false],
            ["Status Config", "/admin/status-config",   false],
          ] as [string, string, boolean][]).map(([label, href, active]) => (
            <Link key={label} href={href} style={{
              padding: "6px 14px", borderRadius: 6, fontSize: 12, fontWeight: 600,
              textDecoration: "none", whiteSpace: "nowrap",
              background: active ? "#EEF2FF" : "transparent",
              color: active ? "#4F46E5" : "#64748B",
            }}>{label}</Link>
          ))}
        </div>

        {/* Search bar */}
        <div style={{ flex: 1, position: "relative", maxWidth: 380, marginLeft: "auto" }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
            color: "#9CA3AF", fontSize: 13, pointerEvents: "none" }}>⌕</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search property, ID, city…"
            style={{ width: "100%", padding: "7px 10px 7px 30px", border: "1px solid #E2E8F0",
              borderRadius: 8, fontSize: 12, outline: "none", background: "#F8FAFC",
              boxSizing: "border-box" }} />
        </div>

        {/* Actions */}
        <button onClick={() => setShowActivity(a => !a)}
          style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid",
            borderColor: showActivity ? "#7C3AED" : "#E2E8F0",
            background: showActivity ? "#F5F3FF" : "#fff",
            color: showActivity ? "#7C3AED" : "#64748B",
            fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
          ◷ Activity
        </button>
        <button onClick={downloadCsv} disabled={csvLoading}
          style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid #E2E8F0",
            background: "#fff", color: "#374151", fontSize: 11, fontWeight: 600,
            cursor: csvLoading ? "not-allowed" : "pointer", whiteSpace: "nowrap",
            opacity: csvLoading ? 0.6 : 1 }}>
          ↓ Export
        </button>
      </div>

      {/* ── Body: sidebar + main ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* ── Left filter sidebar ── */}
        <div style={{ width: 230, background: "#fff", borderRight: "1px solid #E2E8F0",
          overflowY: "auto", flexShrink: 0, display: "flex", flexDirection: "column" }}>

          {/* Sidebar header */}
          <div style={{ padding: "12px 14px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Filters
              {activeFilterCount > 0 && (
                <span style={{ marginLeft: 6, background: "#4F46E5", color: "#fff",
                  borderRadius: 10, fontSize: 9, padding: "1px 6px" }}>
                  {activeFilterCount}
                </span>
              )}
            </span>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters}
                style={{ fontSize: 10, color: "#4F46E5", background: "none", border: "none",
                  cursor: "pointer", padding: 0, fontWeight: 600 }}>
                Clear all
              </button>
            )}
          </div>

          {/* Quick views */}
          <div style={{ padding: "0 14px 10px", borderBottom: "1px solid #F1F5F9" }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", marginBottom: 6, textTransform: "uppercase" }}>
              Quick View
            </div>
            {[
              { label: "All Listings",    val: "all",               count: totalListings },
              { label: "Live",            val: "live_ss",            count: liveCount },
              { label: "Not Live",        val: "not live_ss",        count: notLiveCount },
              { label: "Ready to Go Live",val: "ready to go live",   count: readyCount },
            ].map(qv => {
              const isActive = qv.val === "all"
                ? statusFilter === "all" && subStatusFilter === "all"
                : qv.val.endsWith("_ss")
                  ? subStatusFilter === qv.val.replace("_ss","")
                  : statusFilter === qv.val;
              return (
                <button key={qv.label} onClick={() => {
                  if (qv.val === "all") { setStatusFilter("all"); setSubStatusFilter("all"); }
                  else if (qv.val.endsWith("_ss")) { setSubStatusFilter(qv.val.replace("_ss","")); setStatusFilter("all"); }
                  else { setStatusFilter(qv.val); setSubStatusFilter("all"); }
                }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                    width: "100%", padding: "5px 8px", borderRadius: 6, border: "none",
                    background: isActive ? "#EEF2FF" : "none", cursor: "pointer",
                    fontSize: 11, fontWeight: isActive ? 700 : 500,
                    color: isActive ? "#4F46E5" : "#475569", marginBottom: 1, textAlign: "left" }}>
                  <span>{qv.label}</span>
                  <span style={{ fontSize: 10, color: isActive ? "#4F46E5" : "#9CA3AF", fontWeight: 600 }}>
                    {qv.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* OTA filter */}
          <FilterSection label="OTA" count={otaFilter !== "all" ? 1 : 0}>
            <select value={otaFilter} onChange={e => setOtaFilter(e.target.value)}
              disabled={!!summary?.userOta}
              style={{ width: "100%", padding: "6px 8px", border: "1px solid #E2E8F0",
                borderRadius: 6, fontSize: 11, background: "#F8FAFC", color: "#374151",
                outline: "none" }}>
              <option value="all">All OTAs</option>
              {(summary?.userOta ? [summary.userOta] : OTA_LIST).map(o => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </FilterSection>

          {/* FH Status filter */}
          <FilterSection label="FH Status" count={fhStatusFilter.length}>
            {["Live", "SoldOut", "Churned"].map(s => {
              const checked = fhStatusFilter.includes(s);
              return (
                <label key={s} style={{ display: "flex", alignItems: "center", gap: 7,
                  padding: "3px 0", cursor: "pointer", fontSize: 11 }}>
                  <input type="checkbox" checked={checked}
                    onChange={() => setFhStatusFilter(prev => checked ? prev.filter(x => x !== s) : [...prev, s])}
                    style={{ accentColor: "#4F46E5" }} />
                  <span style={{ color: checked ? "#4F46E5" : "#475569", fontWeight: checked ? 600 : 400 }}>
                    {s}
                  </span>
                </label>
              );
            })}
          </FilterSection>

          {/* Status filter */}
          <FilterSection label="OTA Status" count={statusFilter !== "all" ? 1 : 0}>
            {["all", ...statusOptions].map(s => (
              <label key={s} style={{ display: "flex", alignItems: "center", gap: 7,
                padding: "3px 0", cursor: "pointer", fontSize: 11 }}>
                <input type="radio" name="status" checked={statusFilter === s}
                  onChange={() => setStatusFilter(s)}
                  style={{ accentColor: "#4F46E5" }} />
                <span style={{ color: statusFilter === s ? "#4F46E5" : "#475569",
                  fontWeight: statusFilter === s ? 600 : 400, textTransform: "capitalize" }}>
                  {s === "all" ? "All Statuses" : s}
                </span>
              </label>
            ))}
          </FilterSection>

          {/* Sub-status filter */}
          <FilterSection label="Sub-Status" count={subStatusFilter !== "all" ? 1 : 0}>
            {["all", ...subStatusOptions].map(s => (
              <label key={s} style={{ display: "flex", alignItems: "center", gap: 7,
                padding: "3px 0", cursor: "pointer", fontSize: 11 }}>
                <input type="radio" name="subStatus" checked={subStatusFilter === s}
                  onChange={() => setSubStatusFilter(s)}
                  style={{ accentColor: "#4F46E5" }} />
                <span style={{ color: subStatusFilter === s ? "#4F46E5" : "#475569",
                  fontWeight: subStatusFilter === s ? 600 : 400, textTransform: "capitalize" }}>
                  {s === "all" ? "All Sub-Statuses" : s}
                </span>
              </label>
            ))}
          </FilterSection>

          {/* FH Date range */}
          <FilterSection label="FH Live Date" count={(fhDateFrom || fhDateTo) ? 1 : 0}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <div>
                <div style={{ fontSize: 9, color: "#9CA3AF", marginBottom: 3 }}>FROM</div>
                <input type="date" value={fhDateFrom} onChange={e => setFhDateFrom(e.target.value)}
                  style={{ width: "100%", padding: "5px 8px", border: "1px solid #E2E8F0",
                    borderRadius: 6, fontSize: 11, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <div style={{ fontSize: 9, color: "#9CA3AF", marginBottom: 3 }}>TO</div>
                <input type="date" value={fhDateTo} onChange={e => setFhDateTo(e.target.value)}
                  style={{ width: "100%", padding: "5px 8px", border: "1px solid #E2E8F0",
                    borderRadius: 6, fontSize: 11, outline: "none", boxSizing: "border-box" }} />
              </div>
              {(fhDateFrom || fhDateTo) && (
                <button onClick={() => { setFhDateFrom(""); setFhDateTo(""); }}
                  style={{ fontSize: 10, color: "#DC2626", background: "none", border: "none",
                    cursor: "pointer", padding: 0, textAlign: "left", fontWeight: 600 }}>
                  ✕ Clear dates
                </button>
              )}
            </div>
          </FilterSection>

          {/* OTA Date range */}
          <FilterSection label="OTA Live Date" count={(otaDateFrom || otaDateTo) ? 1 : 0}>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <div>
                <div style={{ fontSize: 9, color: "#9CA3AF", marginBottom: 3 }}>FROM</div>
                <input type="date" value={otaDateFrom} onChange={e => setOtaDateFrom(e.target.value)}
                  style={{ width: "100%", padding: "5px 8px", border: "1px solid #E2E8F0",
                    borderRadius: 6, fontSize: 11, outline: "none", boxSizing: "border-box" }} />
              </div>
              <div>
                <div style={{ fontSize: 9, color: "#9CA3AF", marginBottom: 3 }}>TO</div>
                <input type="date" value={otaDateTo} onChange={e => setOtaDateTo(e.target.value)}
                  style={{ width: "100%", padding: "5px 8px", border: "1px solid #E2E8F0",
                    borderRadius: 6, fontSize: 11, outline: "none", boxSizing: "border-box" }} />
              </div>
              {(otaDateFrom || otaDateTo) && (
                <button onClick={() => { setOtaDateFrom(""); setOtaDateTo(""); }}
                  style={{ fontSize: 10, color: "#DC2626", background: "none", border: "none",
                    cursor: "pointer", padding: 0, textAlign: "left", fontWeight: 600 }}>
                  ✕ Clear dates
                </button>
              )}
            </div>
          </FilterSection>
        </div>

        {/* ── Main content ── */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>

          {/* Stats bar */}
          <div style={{ background: "#fff", borderBottom: "1px solid #E2E8F0", padding: "0 20px" }}>
            <button onClick={() => setStatsOpen(o => !o)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0",
                background: "none", border: "none", cursor: "pointer", width: "100%", textAlign: "left" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Overview
              </span>
              <span style={{ fontSize: 10, color: "#9CA3AF" }}>{statsOpen ? "▲" : "▼"}</span>
            </button>

            {statsOpen && (
              <div style={{ paddingBottom: 14 }}>
                {/* KPI row */}
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <KpiTile label="Total" value={totalListings} color="#0F172A" bg="#F8FAFC" border="#E2E8F0" />
                  <KpiTile label="Live" value={liveCount} color="#059669" bg="#F0FDF4" border="#BBF7D0" />
                  <KpiTile label="Not Live" value={notLiveCount} color="#DC2626" bg="#FEF2F2" border="#FECACA" />
                  <KpiTile label="Ready" value={readyCount} color="#854D0E" bg="#FEFCE8" border="#FDE68A" />
                  <div style={{ width: 1, background: "#E2E8F0", margin: "0 4px" }} />
                  <KpiTile label="Open Tasks" value={summary?.tasksOpen ?? 0} color="#2563EB" bg="#EFF6FF" border="#BFDBFE" />
                  <KpiTile label="High Priority" value={summary?.tasksHigh ?? 0} color="#DC2626" bg="#FEF2F2" border="#FECACA" />
                  <KpiTile label="Overdue" value={summary?.tasksOverdue ?? 0}
                    color={(summary?.tasksOverdue ?? 0) > 0 ? "#C2410C" : "#059669"}
                    bg={(summary?.tasksOverdue ?? 0) > 0 ? "#FFF7ED" : "#F0FDF4"}
                    border={(summary?.tasksOverdue ?? 0) > 0 ? "#FED7AA" : "#BBF7D0"} />
                </div>

                {/* Listing Breakdown */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase" }}>
                    Breakdown
                  </span>
                  <div style={{ display: "flex", background: "#F1F5F9", borderRadius: 6, padding: 2, gap: 1 }}>
                    {(["status","subStatus"] as const).map(v => (
                      <button key={v} onClick={() => setStatusView(v)}
                        style={{ padding: "3px 10px", borderRadius: 5, border: "none", cursor: "pointer",
                          fontSize: 10, fontWeight: 600,
                          background: statusView === v ? "#fff" : "transparent",
                          color: statusView === v ? "#0F172A" : "#64748B",
                          boxShadow: statusView === v ? "0 1px 3px rgba(0,0,0,0.08)" : "none" }}>
                        {v === "status" ? "Status" : "Sub-Status"}
                      </button>
                    ))}
                  </div>

                  {/* OTA multi-select */}
                  <div ref={otaDropRef} style={{ position: "relative" }}>
                    <button onClick={() => setOtaDropOpen(o => !o)}
                      style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid",
                        borderColor: breakdownOtas.length > 0 ? "#6366F1" : "#E2E8F0",
                        background: breakdownOtas.length > 0 ? "#EEF2FF" : "#fff",
                        color: breakdownOtas.length > 0 ? "#4F46E5" : "#64748B",
                        fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                      {breakdownOtas.length === 0 ? "All OTAs ▾" : `${breakdownOtas.length} OTA${breakdownOtas.length > 1 ? "s" : ""} ▾`}
                    </button>
                    {otaDropOpen && (
                      <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 100,
                        background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8,
                        boxShadow: "0 4px 16px rgba(0,0,0,0.10)", padding: "6px 0", minWidth: 160 }}>
                        <div onClick={() => setBreakdownOtas([])}
                          style={{ padding: "5px 12px", fontSize: 11, cursor: "pointer",
                            color: breakdownOtas.length === 0 ? "#4F46E5" : "#374151",
                            fontWeight: breakdownOtas.length === 0 ? 700 : 400,
                            background: breakdownOtas.length === 0 ? "#EEF2FF" : "transparent" }}>
                          All Listings
                        </div>
                        <div style={{ height: 1, background: "#F1F5F9", margin: "3px 0" }} />
                        {availableOtas.map(ota => {
                          const checked = breakdownOtas.includes(ota);
                          return (
                            <div key={ota} onClick={() => setBreakdownOtas(prev => checked ? prev.filter(o => o !== ota) : [...prev, ota])}
                              style={{ padding: "5px 12px", fontSize: 11, cursor: "pointer",
                                display: "flex", alignItems: "center", gap: 7,
                                background: checked ? "#EEF2FF" : "transparent",
                                color: checked ? "#4F46E5" : "#374151", fontWeight: checked ? 600 : 400 }}>
                              <span style={{ width: 13, height: 13, borderRadius: 3,
                                border: `2px solid ${checked ? "#6366F1" : "#D1D5DB"}`,
                                background: checked ? "#6366F1" : "transparent",
                                display: "inline-flex", alignItems: "center", justifyContent: "center",
                                fontSize: 8, color: "#fff", flexShrink: 0 }}>{checked ? "✓" : ""}</span>
                              {ota}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Breakdown tiles */}
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
                        return (
                          <div key={item.label} style={{ background: s.bg, border: `1px solid ${s.dot}30`,
                            borderRadius: 7, padding: "6px 10px", minWidth: 80 }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color: s.color, lineHeight: 1 }}>{item.cnt}</div>
                            <div style={{ fontSize: 9, fontWeight: 600, color: s.color, opacity: 0.8, marginTop: 2, textTransform: "capitalize" }}>
                              {item.label || "—"}
                            </div>
                          </div>
                        );
                      })}
                      {!breakdownExpanded && items.length > VISIBLE && (
                        <button onClick={() => setBreakdownExpanded(true)}
                          style={{ padding: "6px 10px", borderRadius: 7, border: "1px dashed #CBD5E1",
                            background: "#F8FAFC", color: "#64748B", fontSize: 10, fontWeight: 600,
                            cursor: "pointer" }}>+{items.length - VISIBLE} more</button>
                      )}
                      {breakdownExpanded && items.length > VISIBLE && (
                        <button onClick={() => setBreakdownExpanded(false)}
                          style={{ padding: "6px 10px", borderRadius: 7, border: "1px dashed #CBD5E1",
                            background: "#F8FAFC", color: "#64748B", fontSize: 10, fontWeight: 600,
                            cursor: "pointer" }}>Show less ↑</button>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Activity panel */}
          {showActivity && (
            <div style={{ background: "#fff", borderBottom: "1px solid #DDD6FE", padding: "14px 20px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#6D28D9", marginBottom: 10 }}>Recent Activity</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {(summary?.recentLogs ?? []).map((log, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10,
                    padding: "7px 10px", borderRadius: 7, background: "#FAFAFA", border: "1px solid #F1F5F9" }}>
                    <Avatar name={log.userName ?? "?"} size={26} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: "#1E293B" }}>
                        <span style={{ fontWeight: 600 }}>{log.userName ?? "System"}</span>
                        {" "}
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

          {/* List header */}
          <div style={{ padding: "10px 20px", display: "flex", alignItems: "center", gap: 10,
            background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>
              {loading ? "Loading…" : `${total.toLocaleString()} propert${total !== 1 ? "ies" : "y"}`}
            </span>
            {activeFilterCount > 0 && (
              <span style={{ fontSize: 10, color: "#4F46E5", background: "#EEF2FF",
                padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>
                {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} active
              </span>
            )}
          </div>

          {/* ── Property list ── */}
          <div style={{ flex: 1 }}>
            {/* Column headers */}
            <div style={{ display: "grid",
              gridTemplateColumns: "60px 2fr 100px 110px 90px 100px 110px 90px 70px",
              padding: "7px 20px", background: "#F1F5F9", borderBottom: "1px solid #E2E8F0",
              gap: 8 }}>
              {["ID", "Property Name", "City", "FH Live Date", "FH Status", "OTA Status", "Sub-Status", "Task Due", ""].map(h => (
                <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF",
                  textTransform: "uppercase", letterSpacing: 0.4 }}>{h}</div>
              ))}
            </div>

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
              // Show OTA status/sub-status only when a single OTA is selected
              const singleOta = otaFilter !== "all" ? (row.otas ?? []).find(o => o.ota === otaFilter) ?? null : null;
              return (
                <div key={i}
                  onMouseEnter={() => setHoveredRow(i)}
                  onMouseLeave={() => setHoveredRow(null)}
                  style={{ display: "grid",
                    gridTemplateColumns: "60px 2fr 100px 110px 90px 100px 110px 90px 70px",
                    padding: "10px 20px", gap: 8, alignItems: "center",
                    borderBottom: "1px solid #F1F5F9",
                    background: isHovered ? "#F8FAFC" : "#fff",
                    transition: "background 0.1s" }}>

                  {/* ID */}
                  <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>#{row.id}</div>

                  {/* Property Name */}
                  <div style={{ minWidth: 0 }}>
                    <Link href={`/crm/${row.id}`}
                      style={{ fontSize: 13, fontWeight: 700, color: "#0F172A",
                        textDecoration: "none", display: "block",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                      title={row.name}>
                      {row.name}
                    </Link>
                  </div>

                  {/* City */}
                  <div style={{ fontSize: 11, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {row.city || <span style={{ color: "#CBD5E1" }}>—</span>}
                  </div>

                  {/* FH Live Date */}
                  <div style={{ fontSize: 11, color: "#475569" }}>{fmtDate(row.fhLiveDate)}</div>

                  {/* FH Status */}
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10,
                      background: row.fhStatus === "Live" ? "#DCFCE7" : "#F1F5F9",
                      color: row.fhStatus === "Live" ? "#15803D" : "#64748B",
                      border: `1px solid ${row.fhStatus === "Live" ? "#BBF7D0" : "#E2E8F0"}` }}>
                      {row.fhStatus || "—"}
                    </span>
                  </div>

                  {/* OTA Status */}
                  <div>
                    {singleOta
                      ? <StatusDot status={singleOta.status} />
                      : <span style={{ fontSize: 11, color: "#CBD5E1" }}>—</span>}
                  </div>

                  {/* Sub-Status */}
                  <div style={{ fontSize: 11, color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {singleOta?.subStatus || <span style={{ color: "#CBD5E1" }}>—</span>}
                  </div>

                  {/* Task due */}
                  <div>
                    {row.taskDueDate ? (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10,
                        background: isOverdue ? "#FEF2F2" : "#FEFCE8",
                        color: isOverdue ? "#DC2626" : "#854D0E",
                        border: `1px solid ${isOverdue ? "#FECACA" : "#FDE68A"}`,
                        whiteSpace: "nowrap" }}>
                        {fmtDate(row.taskDueDate)}
                      </span>
                    ) : <span style={{ fontSize: 11, color: "#CBD5E1" }}>—</span>}
                  </div>

                  {/* Action */}
                  <div style={{ opacity: isHovered ? 1 : 0, transition: "opacity 0.15s" }}>
                    <Link href={`/crm/${row.id}`} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 11, fontWeight: 600, color: "#fff",
                        background: "#4F46E5", borderRadius: 6, padding: "4px 10px",
                        textDecoration: "none", whiteSpace: "nowrap" }}>
                      Open →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 20px", background: "#fff", borderTop: "1px solid #E2E8F0", flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: "#64748B" }}>
                Page {page} of {totalPages} · {total.toLocaleString()} total
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => setPage(1)} disabled={page === 1}
                  style={{ padding: "5px 9px", borderRadius: 6, border: "1px solid #E2E8F0",
                    background: "#fff", fontSize: 11, cursor: "pointer", opacity: page === 1 ? 0.4 : 1 }}>«</button>
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
                  style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #E2E8F0",
                    background: "#fff", fontSize: 11, cursor: "pointer", opacity: page === 1 ? 0.4 : 1 }}>‹ Prev</button>
                {[...Array(Math.min(5, totalPages))].map((_, idx) => {
                  const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + idx;
                  if (p > totalPages) return null;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid",
                        borderColor: page === p ? "#4F46E5" : "#E2E8F0",
                        background: page === p ? "#4F46E5" : "#fff",
                        color: page === p ? "#fff" : "#374151",
                        fontSize: 11, fontWeight: page === p ? 700 : 400, cursor: "pointer" }}>
                      {p}
                    </button>
                  );
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages}
                  style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #E2E8F0",
                    background: "#fff", fontSize: 11, cursor: "pointer", opacity: page === totalPages ? 0.4 : 1 }}>Next ›</button>
                <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
                  style={{ padding: "5px 9px", borderRadius: 6, border: "1px solid #E2E8F0",
                    background: "#fff", fontSize: 11, cursor: "pointer", opacity: page === totalPages ? 0.4 : 1 }}>»</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
