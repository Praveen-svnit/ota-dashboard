"use client";

import { useEffect, useState, useCallback } from "react";
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

function priorityDot(p: string) {
  const c = p === "high" ? "#EF4444" : p === "medium" ? "#F59E0B" : "#10B981";
  return <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: c, marginRight: 5 }} />;
}

interface Row {
  id: string; name: string; city: string; fhStatus: string;
  ota: string; status: string; subStatus: string; liveDate: string;
  tat: number; tatError: number; assignedTo: string; crmNote: string;
  assignedName: string; logCount: number;
  gmbStatus: string; gmbSubStatus: string; listingType: string;
  gmbRating: string; gmbReviewCount: string;
}

interface Summary {
  statusCounts: { subStatus: string; cnt: number }[];
  otaBreakdown: { ota: string; total: number; live: number; notLive: number; inProgress: number }[];
  tasksOpen: number;
  tasksDue: number;
  recentLogs: { action: string; field: string; oldValue: string; newValue: string; note: string; createdAt: string; userName: string; propName: string; propId: string }[];
  openTasks: { id: number; propertyId: string; title: string; priority: string; dueDate: string; assignedName: string; propName: string }[];
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

  const [search,       setSearch]       = useState("");
  const [otaFilter,    setOtaFilter]    = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [summary,      setSummary]      = useState<Summary | null>(null);
  const [showTasks,    setShowTasks]    = useState(false);
  const [showActivity, setShowActivity] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Load summary
  useEffect(() => {
    fetch("/api/crm/summary").then(r => r.json()).then(setSummary);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams({
      search: debouncedSearch, ota: otaFilter, status: statusFilter, page: String(page),
    });
    fetch(`/api/crm/properties?${q}`)
      .then((r) => r.json())
      .then((d) => { setRows(d.rows ?? []); setTotal(d.total ?? 0); })
      .finally(() => setLoading(false));
  }, [debouncedSearch, otaFilter, statusFilter, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedSearch, otaFilter, statusFilter]);

  const totalPages = Math.ceil(total / 50);

  // Derived counts from summary
  const liveCount      = summary?.statusCounts.find(s => s.subStatus === "live")?.cnt ?? 0;
  const notLiveCount   = summary?.statusCounts.find(s => s.subStatus === "not live")?.cnt ?? 0;
  const readyCount     = summary?.statusCounts.find(s => s.subStatus === "ready to go live")?.cnt ?? 0;
  const cipCount       = (summary?.statusCounts.find(s => s.subStatus === "content in progress")?.cnt ?? 0)
                       + (summary?.statusCounts.find(s => s.subStatus === "listing in progress")?.cnt ?? 0);
  const totalListings  = summary?.statusCounts.reduce((a, b) => a + b.cnt, 0) ?? 0;

  const tiles = [
    { label: "Total Listings", value: totalListings, bg: "#F8FAFC", color: "#0F172A", border: "#E2E8F0", sub: "across all OTAs" },
    { label: "Live",           value: liveCount,     bg: "#F0FDF4", color: "#059669", border: "#BBF7D0", sub: `${totalListings ? Math.round(liveCount/totalListings*100) : 0}% of total` },
    { label: "Not Live",       value: notLiveCount,  bg: "#FEF2F2", color: "#DC2626", border: "#FECACA", sub: "needs attention" },
    { label: "Ready to GoLive",value: readyCount,    bg: "#FEFCE8", color: "#854D0E", border: "#FDE68A", sub: "awaiting push" },
    { label: "In Progress",    value: cipCount,      bg: "#EEF2FF", color: "#4F46E5", border: "#C7D2FE", sub: "content + listing" },
    { label: "Open Tasks",     value: summary?.tasksOpen ?? 0, bg: summary?.tasksDue ? "#FFF7ED" : "#F0FDF4", color: summary?.tasksDue ? "#C2410C" : "#059669", border: summary?.tasksDue ? "#FED7AA" : "#BBF7D0", sub: summary?.tasksDue ? `${summary.tasksDue} overdue/due today` : "all on track" },
  ];

  return (
    <div style={{ padding: "20px 24px", background: "#F8FAFC", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>CRM Dashboard</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
            <span style={{ fontSize: 12, color: "#64748B" }}>{total} listings</span>
            <Link href="/crm" style={{ fontSize: 11, fontWeight: 600, color: "#2563EB", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 6, padding: "3px 10px", textDecoration: "none" }}>CRM</Link>
            <Link href="/tasks" style={{ fontSize: 11, fontWeight: 600, color: "#7C3AED", background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 6, padding: "3px 10px", textDecoration: "none" }}>Task Manager</Link>
            <Link href="/performance" style={{ fontSize: 11, fontWeight: 600, color: "#059669", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 6, padding: "3px 10px", textDecoration: "none" }}>Performance</Link>
          </div>
        </div>
      </div>

      {/* Status Tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 16 }}>
        {tiles.map((t) => (
          <div key={t.label} style={{
            background: t.bg, border: `1px solid ${t.border}`, borderRadius: 12,
            padding: "14px 16px", cursor: "default",
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: t.color, lineHeight: 1 }}>
              {t.value.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: t.color, marginTop: 4, opacity: 0.85 }}>{t.label}</div>
            <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>{t.sub}</div>
          </div>
        ))}
      </div>

      {/* Toggles row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button
            onClick={() => { setShowTasks(t => !t); setShowActivity(false); }}
            style={{
              padding: "10px 20px", borderRadius: 10, border: "1px solid",
              borderColor: showTasks ? "#2563EB" : "#E2E8F0",
              background: showTasks ? "#EFF6FF" : "#FFF",
              color: showTasks ? "#2563EB" : "#64748B",
              fontSize: 12, fontWeight: 600, cursor: "pointer", textAlign: "left", whiteSpace: "nowrap",
            }}
          >
            ◎ Tasks
            {(summary?.tasksOpen ?? 0) > 0 && (
              <span style={{
                marginLeft: 8, fontSize: 10, fontWeight: 800,
                background: summary?.tasksDue ? "#EF4444" : "#2563EB",
                color: "#FFF", borderRadius: 20, padding: "1px 7px",
              }}>
                {summary?.tasksOpen}
              </span>
            )}
          </button>
          <button
            onClick={() => { setShowActivity(a => !a); setShowTasks(false); }}
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

      {/* Tasks Preview Panel */}
      {showTasks && (
        <div style={{ background: "#FFF", border: "1px solid #BFDBFE", borderRadius: 12, padding: "16px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#1E40AF" }}>
              Open Tasks ({summary?.tasksOpen ?? 0})
            </div>
            <Link href="/tasks" style={{
              fontSize: 11, fontWeight: 700, color: "#2563EB",
              background: "#EFF6FF", border: "1px solid #BFDBFE",
              borderRadius: 7, padding: "5px 14px", textDecoration: "none",
            }}>
              Open Task Manager →
            </Link>
          </div>
          {summary?.openTasks.length === 0 ? (
            <div style={{ fontSize: 12, color: "#94A3B8", textAlign: "center", padding: "20px 0" }}>No open tasks</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {summary?.openTasks.slice(0, 5).map((task) => {
                const overdue = task.dueDate && task.dueDate < new Date().toISOString().split("T")[0];
                return (
                  <div key={task.id} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 12px", borderRadius: 8,
                    background: overdue ? "#FEF2F2" : "#F8FAFC",
                    border: `1px solid ${overdue ? "#FECACA" : "#F1F5F9"}`,
                  }}>
                    {priorityDot(task.priority)}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#1E293B",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {task.title}
                      </div>
                      <div style={{ fontSize: 10, color: "#94A3B8" }}>
                        {task.propName} {task.assignedName ? `· ${task.assignedName}` : ""}
                      </div>
                    </div>
                    {task.dueDate && (
                      <span style={{ fontSize: 10, color: overdue ? "#DC2626" : "#64748B",
                        fontWeight: overdue ? 700 : 400, whiteSpace: "nowrap" }}>
                        {overdue ? "⚠ " : ""}{task.dueDate}
                      </span>
                    )}
                  </div>
                );
              })}
              {(summary?.tasksOpen ?? 0) > 5 && (
                <Link href="/tasks" style={{
                  fontSize: 11, color: "#2563EB", textAlign: "center", paddingTop: 6,
                  display: "block", textDecoration: "none", fontWeight: 600,
                }}>
                  + {(summary?.tasksOpen ?? 0) - 5} more — view all in Task Manager →
                </Link>
              )}
            </div>
          )}
        </div>
      )}

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
      <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
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
          <option value="all">All OTAs</option>
          {OTA_LIST.map((o) => <option key={o} value={o}>{o}</option>)}
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
      </div>

      {/* Table */}
      <div style={{ background: "#FFF", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                {["Property", "City", "FH Status", "OTA", "Status", "Sub-Status", "GMB", "Assigned To", "Note", "Logs", ""].map((h) => (
                  <th key={h} style={{ padding: "9px 12px", fontSize: 10, fontWeight: 700, color: "#64748B",
                    textAlign: "left", whiteSpace: "nowrap", borderBottom: "1px solid #E2E8F0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>Loading…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={11} style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>No results</td></tr>
              ) : rows.map((row, i) => {
                const otaColor = OTA_COLORS[row.ota] ?? "#64748B";
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
                    <td style={{ padding: "8px 12px" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                        background: otaColor + "18", color: otaColor, border: `1px solid ${otaColor}30` }}>
                        {row.ota}
                      </span>
                    </td>
                    <td style={{ padding: "8px 12px" }}>{statusPill(row.status)}</td>
                    <td style={{ padding: "8px 12px", fontSize: 11, color: "#475569" }}>{row.subStatus || "—"}</td>
                    <td style={{ padding: "8px 12px" }}>
                      {row.gmbStatus ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {statusPill(row.gmbStatus)}
                          {row.gmbSubStatus && <span style={{ fontSize: 9, color: "#94A3B8" }}>{row.gmbSubStatus}</span>}
                          {row.listingType && <span style={{ fontSize: 9, color: "#64748B" }}>{row.listingType}</span>}
                        </div>
                      ) : <span style={{ fontSize: 11, color: "#CBD5E1" }}>—</span>}
                    </td>
                    <td style={{ padding: "8px 12px", fontSize: 11, color: "#475569" }}>{row.assignedName || "—"}</td>
                    <td style={{ padding: "8px 12px", fontSize: 11, color: "#64748B", maxWidth: 160 }}>
                      {row.crmNote ? (
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }} title={row.crmNote}>
                          {row.crmNote}
                        </span>
                      ) : "—"}
                    </td>
                    <td style={{ padding: "8px 12px" }}>
                      {row.logCount > 0 && (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                          background: "#EEF2FF", color: "#6366F1", border: "1px solid #C7D2FE" }}>
                          {row.logCount}
                        </span>
                      )}
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
