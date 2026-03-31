"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { OTA_COLORS } from "@/lib/constants";

const OTA_LIST = ["GoMMT","Booking.com","Agoda","Expedia","Cleartrip","Yatra","Ixigo","Akbar Travels","EaseMyTrip","Indigo"];

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  live:                  { bg: "#D1FAE5", color: "#059669" },
  "not live":            { bg: "#FEE2E2", color: "#DC2626" },
  "ready to go live":    { bg: "#FEF9C3", color: "#854D0E" },
  "content in progress": { bg: "#EEF2FF", color: "#4F46E5" },
  "listing in progress": { bg: "#EEF2FF", color: "#4F46E5" },
  pending:               { bg: "#FEF3C7", color: "#D97706" },
  soldout:               { bg: "#F3F4F6", color: "#6B7280" },
  new:                   { bg: "#F0F9FF", color: "#0369A1" },
};

function statusPill(status: string) {
  const s = STATUS_COLORS[status?.toLowerCase()] ?? { bg: "#F1F5F9", color: "#64748B" };
  return (
    <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
      background: s.bg, color: s.color, whiteSpace: "nowrap" }}>
      {status || "—"}
    </span>
  );
}


interface Row {
  id: string; name: string; city: string; fhStatus: string; fhLiveDate: string;
  ota: string; status: string; subStatus: string; liveDate: string;
  tat: number; tatError: number; assignedTo: string; crmNote: string;
  assignedName: string; taskDueDate: string | null;
}

interface Summary {
  statusCounts: { subStatus: string; cnt: number }[];
  statusTopCounts: { status: string; cnt: number }[];
  otaBreakdown: { ota: string; total: number; live: number; notLive: number; inProgress: number }[];
  tasksOpen: number; tasksHigh: number; tasksOverdue: number; tasksDone: number;
  fhPipeline: number[];
  recentLogs: { action: string; field: string; oldValue: string; newValue: string; note: string; createdAt: string; userName: string; propName: string; propId: string }[];
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

export default function CrmPage() {
  const [rows,    setRows]    = useState<Row[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);

  const [search,          setSearch]          = useState("");
  const [otaFilter,       setOtaFilter]       = useState("all");
  const [statusFilter,    setStatusFilter]    = useState("all");
  const [subStatusFilter, setSubStatusFilter] = useState("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [fhDateFrom,   setFhDateFrom]   = useState("");
  const [fhDateTo,     setFhDateTo]     = useState("");
  const [otaDateFrom,  setOtaDateFrom]  = useState("");
  const [otaDateTo,    setOtaDateTo]    = useState("");

  const [summary,        setSummary]        = useState<Summary | null>(null);
  const [showActivity,   setShowActivity]   = useState(false);
  const [statusView,     setStatusView]     = useState<"status" | "subStatus">("status");
  const [breakdownOtas,    setBreakdownOtas]    = useState<string[]>([]);
  const [breakdownData,    setBreakdownData]    = useState<{ statusCounts: { subStatus: string; cnt: number }[]; statusTopCounts: { status: string; cnt: number }[] } | null>(null);
  const [otaDropOpen,      setOtaDropOpen]      = useState(false);
  const [breakdownExpanded, setBreakdownExpanded] = useState(false);
  const [pipelineExpanded,  setPipelineExpanded]  = useState(false);
  const otaDropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Load summary
  useEffect(() => {
    fetch("/api/crm/summary").then(r => r.json()).then(setSummary);
  }, []);

  // Breakdown fetch (re-runs when OTA filter changes)
  useEffect(() => {
    const q = breakdownOtas.length > 0 ? `?otas=${encodeURIComponent(breakdownOtas.join(","))}` : "";
    fetch(`/api/crm/breakdown${q}`).then(r => r.json()).then(setBreakdownData);
    setBreakdownExpanded(false);
  }, [breakdownOtas]);

  useEffect(() => { setBreakdownExpanded(false); }, [statusView]);

  // Close OTA dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (otaDropRef.current && !otaDropRef.current.contains(e.target as Node)) {
        setOtaDropOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const buildParams = useCallback((extra?: Record<string, string>) => {
    const q: Record<string, string> = { search: debouncedSearch, ota: otaFilter, status: statusFilter, subStatus: subStatusFilter };
    if (fhDateFrom)  q.fhFrom  = fhDateFrom;
    if (fhDateTo)    q.fhTo    = fhDateTo;
    if (otaDateFrom) q.otaFrom = otaDateFrom;
    if (otaDateTo)   q.otaTo   = otaDateTo;
    return new URLSearchParams({ ...q, ...extra });
  }, [debouncedSearch, otaFilter, statusFilter, subStatusFilter, fhDateFrom, fhDateTo, otaDateFrom, otaDateTo]);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/crm/properties?${buildParams({ page: String(page) })}`)
      .then((r) => r.json())
      .then((d) => { setRows(d.rows ?? []); setTotal(d.total ?? 0); })
      .finally(() => setLoading(false));
  }, [buildParams, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedSearch, otaFilter, statusFilter, subStatusFilter, fhDateFrom, fhDateTo, otaDateFrom, otaDateTo]);

  const [csvLoading, setCsvLoading] = useState(false);
  const downloadCsv = () => {
    setCsvLoading(true);
    const q = buildParams({ export: "1" });
    fetch(`/api/crm/properties?${q}`)
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
        const a = document.createElement("a");
        a.href = url; a.download = `listings_${new Date().toISOString().slice(0,10)}.csv`;
        a.click(); URL.revokeObjectURL(url);
      })
      .finally(() => setCsvLoading(false));
  };

  const totalPages = Math.ceil(total / 50);

  // Derived counts from summary
  // sub_status field: live, not live, exception, etc.
  const liveCount      = summary?.statusCounts.find(s => s.subStatus === "live")?.cnt ?? 0;
  const notLiveCount   = summary?.statusCounts.find(s => s.subStatus === "not live")?.cnt ?? 0;
  const totalListings  = summary?.statusCounts.reduce((a, b) => a + b.cnt, 0) ?? 0;
  // status field: ready to go live
  const readyCount     = summary?.statusTopCounts.find(s => s.status === "ready to go live")?.cnt ?? 0;
  // sub_status 'ota team' = listings being actively processed (OTA team working on it)
  const cipCount       = summary?.statusCounts.find(s => s.subStatus === "ota team")?.cnt ?? 0;

  const crmTiles = [
    { label: "Total Listings",  value: totalListings, bg: "#F8FAFC", color: "#0F172A", border: "#E2E8F0" },
    { label: "Live",            value: liveCount,     bg: "#F0FDF4", color: "#059669", border: "#BBF7D0" },
    { label: "Ready to GoLive", value: readyCount,    bg: "#FEFCE8", color: "#854D0E", border: "#FDE68A" },
    { label: "OTA Team",        value: cipCount,      bg: "#EEF2FF", color: "#4F46E5", border: "#C7D2FE" },
  ];
  const taskTiles = [
    { label: "Open Tasks",    value: summary?.tasksOpen    ?? 0, bg: "#EFF6FF", color: "#2563EB", border: "#BFDBFE" },
    { label: "High Priority", value: summary?.tasksHigh    ?? 0, bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
    { label: "Overdue",       value: summary?.tasksOverdue ?? 0, bg: (summary?.tasksOverdue ?? 0) > 0 ? "#FFF7ED" : "#F0FDF4", color: (summary?.tasksOverdue ?? 0) > 0 ? "#C2410C" : "#059669", border: (summary?.tasksOverdue ?? 0) > 0 ? "#FED7AA" : "#BBF7D0" },
    { label: "Completed",     value: summary?.tasksDone    ?? 0, bg: "#F0FDF4", color: "#059669", border: "#BBF7D0" },
  ];

  return (
    <div style={{ padding: "20px 24px", background: "#F8FAFC", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>CRM Dashboard</div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>{total} listings</div>
        </div>
        {/* Tab strip */}
        <div style={{ display: "flex", background: "#F1F5F9", borderRadius: 10, padding: 4, gap: 2 }}>
          {([
            ["CRM",          "/crm",         true ],
            ["Task Manager", "/tasks",        false],
            ["Performance",  "/performance",  false],
          ] as [string, string, boolean][]).map(([label, href, active]) => (
            <Link key={label} href={href} style={{
              padding: "7px 22px", borderRadius: 7, fontSize: 12, fontWeight: 600,
              textDecoration: "none", whiteSpace: "nowrap",
              background: active ? "#0F172A" : "transparent",
              color: active ? "#FFFFFF" : "#64748B",
            }}>{label}</Link>
          ))}
        </div>
      </div>

      {/* KPI Tiles — CRM + Task */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 8, marginBottom: 8 }}>
        {[...crmTiles, ...taskTiles].map((t, i) => (
          <div key={t.label} style={{
            background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10,
            padding: "10px 12px",
            borderLeft: i === 4 ? "3px solid #CBD5E1" : undefined,
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: t.color, lineHeight: 1 }}>
              {t.value.toLocaleString()}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: t.color, marginTop: 3, opacity: 0.85, lineHeight: 1.3 }}>{t.label}</div>
          </div>
        ))}
      </div>

      {/* FH Live Date Tiles — Today through last 29 days (first 7 visible, rest expandable) */}
      {(() => {
        const pipeline = summary?.fhPipeline ?? Array(30).fill(0);
        const visible = pipelineExpanded ? pipeline : pipeline.slice(0, 7);
        return (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 6 }}>
              {visible.map((count, i) => {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const label = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
                const hasData = count > 0;
                return (
                  <div key={i} style={{
                    background: i === 0 ? "#F0FDF4" : hasData ? "#F0F9FF" : "#F8FAFC",
                    border: `1px solid ${i === 0 ? "#BBF7D0" : hasData ? "#BAE6FD" : "#E2E8F0"}`,
                    borderRadius: 10, padding: "8px 10px",
                  }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: i === 0 ? "#059669" : hasData ? "#0369A1" : "#94A3B8", lineHeight: 1 }}>
                      {count}
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: i === 0 ? "#059669" : hasData ? "#0369A1" : "#94A3B8", marginTop: 3, opacity: 0.85, lineHeight: 1.3 }}>
                      {label}{i === 0 ? " (Today)" : ""}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 500 }}>FH Live Date</span>
              <button onClick={() => setPipelineExpanded(p => !p)} style={{
                fontSize: 10, fontWeight: 600, color: "#0369A1", background: "none",
                border: "none", cursor: "pointer", padding: 0, textDecoration: "underline",
              }}>
                {pipelineExpanded ? "Show less ▲" : `Show more (${pipeline.length - 7} days) ▼`}
              </button>
            </div>
          </>
        );
      })()}

      {/* Status Breakdown Tiles */}
      {(() => {
        const data = breakdownData ?? { statusCounts: summary?.statusCounts ?? [], statusTopCounts: summary?.statusTopCounts ?? [] };
        const items = statusView === "status"
          ? data.statusTopCounts.map(s => ({ label: s.status, cnt: s.cnt }))
          : data.statusCounts.map(s => ({ label: s.subStatus, cnt: s.cnt }));
        const availableOtas = [...(summary?.otaBreakdown ?? []).map(o => o.ota).filter(Boolean), "GMB"];
        return (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Listing Breakdown
              </span>

              {/* Status / Sub-Status toggle */}
              <div style={{ display: "flex", background: "#F1F5F9", borderRadius: 8, padding: 3, gap: 2 }}>
                {(["status", "subStatus"] as const).map(v => (
                  <button key={v} onClick={() => setStatusView(v)} style={{
                    padding: "4px 12px", borderRadius: 6, border: "none", cursor: "pointer",
                    fontSize: 11, fontWeight: 600,
                    background: statusView === v ? "#0F172A" : "transparent",
                    color: statusView === v ? "#FFF" : "#64748B",
                  }}>
                    {v === "status" ? "Status" : "Sub-Status"}
                  </button>
                ))}
              </div>

              {/* OTA multi-select dropdown */}
              <div ref={otaDropRef} style={{ position: "relative" }}>
                <button
                  onClick={() => setOtaDropOpen(o => !o)}
                  style={{
                    padding: "4px 12px", borderRadius: 8, border: "1px solid",
                    borderColor: breakdownOtas.length > 0 ? "#6366F1" : "#E2E8F0",
                    background: breakdownOtas.length > 0 ? "#EEF2FF" : "#FFF",
                    color: breakdownOtas.length > 0 ? "#4F46E5" : "#64748B",
                    fontSize: 11, fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  {breakdownOtas.length === 0
                    ? "All Listings ▾"
                    : `${breakdownOtas.length} OTA${breakdownOtas.length > 1 ? "s" : ""} ▾`}
                </button>
                {otaDropOpen && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 100,
                    background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 10,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.10)", padding: "8px 0", minWidth: 180,
                  }}>
                    <div
                      onClick={() => setBreakdownOtas([])}
                      style={{
                        padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                        color: breakdownOtas.length === 0 ? "#4F46E5" : "#64748B",
                        background: breakdownOtas.length === 0 ? "#EEF2FF" : "transparent",
                      }}
                    >
                      All Listings
                    </div>
                    <div style={{ height: 1, background: "#F1F5F9", margin: "4px 0" }} />
                    {availableOtas.map(ota => {
                      const checked = breakdownOtas.includes(ota);
                      return (
                        <div
                          key={ota}
                          onClick={() => setBreakdownOtas(prev =>
                            checked ? prev.filter(o => o !== ota) : [...prev, ota]
                          )}
                          style={{
                            padding: "6px 14px", fontSize: 12, cursor: "pointer",
                            display: "flex", alignItems: "center", gap: 8,
                            background: checked ? "#EEF2FF" : "transparent",
                            color: checked ? "#4F46E5" : "#374151",
                            fontWeight: checked ? 600 : 400,
                          }}
                        >
                          <span style={{
                            width: 14, height: 14, borderRadius: 4, border: `2px solid ${checked ? "#6366F1" : "#D1D5DB"}`,
                            background: checked ? "#6366F1" : "transparent",
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                            fontSize: 9, color: "#FFF", flexShrink: 0,
                          }}>
                            {checked ? "✓" : ""}
                          </span>
                          {ota}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {(() => {
              const VISIBLE = 6;
              const visible = breakdownExpanded ? items : items.slice(0, VISIBLE);
              const hidden = items.length - VISIBLE;
              return (
                <>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {visible.map(item => {
                      const s = STATUS_COLORS[item.label?.toLowerCase()] ?? { bg: "#F1F5F9", color: "#475569" };
                      return (
                        <div key={item.label} style={{
                          background: s.bg, border: `1px solid ${s.color}22`, borderRadius: 10,
                          padding: "10px 14px", minWidth: 100,
                        }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: s.color, lineHeight: 1 }}>
                            {item.cnt.toLocaleString()}
                          </div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: s.color, marginTop: 3, opacity: 0.85, lineHeight: 1.3, textTransform: "capitalize" }}>
                            {item.label || "—"}
                          </div>
                        </div>
                      );
                    })}
                    {!breakdownExpanded && hidden > 0 && (
                      <button onClick={() => setBreakdownExpanded(true)} style={{
                        padding: "10px 14px", minWidth: 100, borderRadius: 10,
                        border: "1px dashed #CBD5E1", background: "#F8FAFC",
                        color: "#64748B", fontSize: 11, fontWeight: 600, cursor: "pointer",
                        lineHeight: 1.4,
                      }}>
                        +{hidden} more
                      </button>
                    )}
                    {breakdownExpanded && items.length > VISIBLE && (
                      <button onClick={() => setBreakdownExpanded(false)} style={{
                        padding: "10px 14px", minWidth: 100, borderRadius: 10,
                        border: "1px dashed #CBD5E1", background: "#F8FAFC",
                        color: "#64748B", fontSize: 11, fontWeight: 600, cursor: "pointer",
                        lineHeight: 1.4,
                      }}>
                        Show less ↑
                      </button>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        );
      })()}

      {/* Toggles row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => setShowActivity(a => !a)}
            style={{
              padding: "10px 20px", borderRadius: 10, border: "1px solid",
              borderColor: showActivity ? "#7C3AED" : "#E2E8F0",
              background: showActivity ? "#F5F3FF" : "#FFF",
              color: showActivity ? "#7C3AED" : "#64748B",
              fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "left",
            }}
          >
            ◷ Recent Activity
          </button>
      </div>

      {/* Activity Panel */}
      {showActivity && (
        <div style={{ background: "#FFF", border: "1px solid #DDD6FE", borderRadius: 12, padding: "16px", marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#6D28D9", marginBottom: 12 }}>Recent Activity</div>
          {summary?.recentLogs.length === 0 ? (
            <div style={{ fontSize: 12, color: "#94A3B8", textAlign: "center", padding: "20px 0" }}>No activity yet</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {summary?.recentLogs.map((log, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "flex-start", gap: 10,
                  padding: "8px 12px", borderRadius: 8, background: "#FAFAFA", border: "1px solid #F1F5F9",
                }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#EDE9FE",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 800, color: "#7C3AED", flexShrink: 0 }}>
                    {log.userName?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11, color: "#1E293B" }}>
                      <span style={{ fontWeight: 600 }}>{log.userName ?? "System"}</span>
                      {" "}
                      {log.action === "status_change"
                        ? <>{log.field}: <span style={{ color: "#DC2626" }}>{log.oldValue}</span> → <span style={{ color: "#059669" }}>{log.newValue}</span></>
                        : log.note
                          ? <span style={{ color: "#64748B" }}>{log.note}</span>
                          : <span style={{ color: "#64748B" }}>{log.action}</span>
                      }
                    </div>
                    <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 1 }}>
                      <Link href={`/crm/${log.propId}`} style={{ color: "#6366F1", textDecoration: "none" }}>{log.propName}</Link>
                      {" · "}{timeAgo(log.createdAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search property name, ID, city…"
          style={{
            flex: 1, minWidth: 200, padding: "8px 12px", borderRadius: 8,
            border: "1px solid #CBD5E1", fontSize: 12, outline: "none",
          }}
        />
        <select value={otaFilter} onChange={(e) => setOtaFilter(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12, background: "#FFF" }}>
          <option value="all">All Listings</option>
          {[...OTA_LIST, "GMB"].map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12, background: "#FFF" }}>
          <option value="all">All Statuses</option>
          <option value="live">Live</option>
          <option value="not live">Not Live</option>
          <option value="ready to go live">Ready to Go Live</option>
          <option value="content in progress">Content in Progress</option>
          <option value="listing in progress">Listing in Progress</option>
          <option value="pending">Pending</option>
        </select>
        <select value={subStatusFilter} onChange={(e) => setSubStatusFilter(e.target.value)}
          style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12, background: "#FFF",
            borderColor: subStatusFilter !== "all" ? "#818CF8" : "#CBD5E1",
            background: subStatusFilter !== "all" ? "#EEF2FF" : "#FFF",
          }}>
          <option value="all">All Sub-Statuses</option>
          <option value="live">Live</option>
          <option value="not live">Not Live</option>
          <option value="ready to go live">Ready to Go Live</option>
          <option value="content in progress">Content in Progress</option>
          <option value="listing in progress">Listing in Progress</option>
          <option value="pending">Pending</option>
          <option value="new">New</option>
          <option value="soldout">Soldout</option>
        </select>

        {/* FH Live Date range */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, border: "1px solid #CBD5E1", borderRadius: 8, padding: "4px 8px", background: fhDateFrom || fhDateTo ? "#FEFCE8" : "#FFF", borderColor: fhDateFrom || fhDateTo ? "#FDE68A" : "#CBD5E1" }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#854D0E", whiteSpace: "nowrap" }}>FH</span>
          <input type="date" value={fhDateFrom} onChange={e => setFhDateFrom(e.target.value)}
            style={{ border: "none", outline: "none", fontSize: 11, background: "transparent", color: "#374151", width: 110 }} />
          <span style={{ fontSize: 10, color: "#94A3B8" }}>–</span>
          <input type="date" value={fhDateTo} onChange={e => setFhDateTo(e.target.value)}
            style={{ border: "none", outline: "none", fontSize: 11, background: "transparent", color: "#374151", width: 110 }} />
          {(fhDateFrom || fhDateTo) && (
            <button onClick={() => { setFhDateFrom(""); setFhDateTo(""); }} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 12, color: "#94A3B8", padding: "0 2px", lineHeight: 1 }}>✕</button>
          )}
        </div>

        {/* OTA Live Date range */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, border: "1px solid #CBD5E1", borderRadius: 8, padding: "4px 8px", background: otaDateFrom || otaDateTo ? "#EFF6FF" : "#FFF", borderColor: otaDateFrom || otaDateTo ? "#BFDBFE" : "#CBD5E1" }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: "#1D4ED8", whiteSpace: "nowrap" }}>OTA</span>
          <input type="date" value={otaDateFrom} onChange={e => setOtaDateFrom(e.target.value)}
            style={{ border: "none", outline: "none", fontSize: 11, background: "transparent", color: "#374151", width: 110 }} />
          <span style={{ fontSize: 10, color: "#94A3B8" }}>–</span>
          <input type="date" value={otaDateTo} onChange={e => setOtaDateTo(e.target.value)}
            style={{ border: "none", outline: "none", fontSize: 11, background: "transparent", color: "#374151", width: 110 }} />
          {(otaDateFrom || otaDateTo) && (
            <button onClick={() => { setOtaDateFrom(""); setOtaDateTo(""); }} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 12, color: "#94A3B8", padding: "0 2px", lineHeight: 1 }}>✕</button>
          )}
        </div>
        <button
          onClick={downloadCsv}
          disabled={csvLoading}
          style={{
            padding: "8px 14px", borderRadius: 8, border: "1px solid #E2E8F0",
            background: csvLoading ? "#F1F5F9" : "#FFF", color: csvLoading ? "#94A3B8" : "#374151",
            fontSize: 12, fontWeight: 600, cursor: csvLoading ? "not-allowed" : "pointer",
            whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 5,
          }}
        >
          {csvLoading ? "Exporting…" : "↓ CSV"}
        </button>
      </div>

      {/* Table */}
      <div style={{ background: "#FFF", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                {["Property", "City", "FH Status", "FH Live Date", "OTA", "Status", "Sub-Status", "OTA Live Date", "Assigned To", "Note", "Task Due", ""].map((h) => (
                  <th key={h} style={{ padding: "9px 12px", fontSize: 10, fontWeight: 700, color: "#64748B",
                    textAlign: "left", whiteSpace: "nowrap", borderBottom: "1px solid #E2E8F0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={12} style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>No results</td></tr>
              ) : rows.map((row, i) => {
                const otaColor = OTA_COLORS[row.ota] ?? (row.ota === "GMB" ? "#34A853" : "#64748B");
                const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }) : "—";
                return (
                  <tr key={i} style={{ borderBottom: "1px solid #F1F5F9" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#F8FAFC")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                    <td style={{ padding: "8px 12px", fontSize: 12, fontWeight: 600, color: "#1E293B", maxWidth: 200 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</div>
                      <div style={{ fontSize: 10, color: "#94A3B8" }}>#{row.id}</div>
                    </td>
                    <td style={{ padding: "8px 12px", fontSize: 11, color: "#64748B", whiteSpace: "nowrap" }}>{row.city || "—"}</td>
                    <td style={{ padding: "8px 12px" }}>{statusPill(row.fhStatus)}</td>
                    <td style={{ padding: "8px 12px", fontSize: 11, color: "#475569", whiteSpace: "nowrap" }}>{fmtDate(row.fhLiveDate)}</td>
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                        background: otaColor + "18", color: otaColor, border: `1px solid ${otaColor}30` }}>
                        {row.ota}
                      </span>
                    </td>
                    <td style={{ padding: "8px 12px" }}>{statusPill(row.status)}</td>
                    <td style={{ padding: "8px 12px", fontSize: 11, color: "#475569" }}>{row.subStatus || "—"}</td>
                    <td style={{ padding: "8px 12px", fontSize: 11, color: "#475569", whiteSpace: "nowrap" }}>{fmtDate(row.liveDate)}</td>
                    <td style={{ padding: "8px 12px", fontSize: 11, color: "#475569" }}>{row.assignedName || "—"}</td>
                    <td style={{ padding: "8px 12px", fontSize: 11, color: "#64748B", maxWidth: 160 }}>
                      {row.crmNote ? (
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }} title={row.crmNote}>
                          {row.crmNote}
                        </span>
                      ) : "—"}
                    </td>
                    <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>
                      {row.taskDueDate ? (() => {
                        const overdue = new Date(row.taskDueDate) < new Date(new Date().toDateString());
                        return (
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                            background: overdue ? "#FEF2F2" : "#FEFCE8",
                            color: overdue ? "#DC2626" : "#854D0E",
                            border: `1px solid ${overdue ? "#FECACA" : "#FDE68A"}`,
                          }}>
                            {fmtDate(row.taskDueDate)}
                          </span>
                        );
                      })() : <span style={{ fontSize: 11, color: "#CBD5E1" }}>—</span>}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      <Link href={`/crm/${row.id}?ota=${encodeURIComponent(row.ota)}`}
                        style={{ fontSize: 11, fontWeight: 600, color: "#2563EB",
                          background: "#EFF6FF", border: "1px solid #BFDBFE",
                          borderRadius: 6, padding: "4px 10px", textDecoration: "none", whiteSpace: "nowrap" }}>
                        Open →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 16px", borderTop: "1px solid #F1F5F9" }}>
            <span style={{ fontSize: 11, color: "#64748B" }}>
              Page {page} of {totalPages} ({total} total)
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #E2E8F0",
                  background: "#FFF", fontSize: 12, cursor: "pointer", opacity: page === 1 ? 0.4 : 1 }}>
                ‹ Prev
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #E2E8F0",
                  background: "#FFF", fontSize: 12, cursor: "pointer", opacity: page === totalPages ? 0.4 : 1 }}>
                Next ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
