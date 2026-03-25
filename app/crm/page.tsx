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

interface Row {
  id: string; name: string; city: string; fhStatus: string;
  ota: string; status: string; subStatus: string; liveDate: string;
  tat: number; tatError: number; assignedTo: string; crmNote: string;
  assignedName: string; logCount: number;
  gmbStatus: string; gmbSubStatus: string; listingType: string;
  gmbRating: string; gmbReviewCount: string;
}

export default function CrmPage() {
  const [rows,    setRows]    = useState<Row[]>([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);

  const [search,    setSearch]    = useState("");
  const [otaFilter, setOtaFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

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

  return (
    <div style={{ padding: "20px 24px", background: "#F8FAFC", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>CRM</div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
            {total} listings • click a property to view details & logs
          </div>
        </div>
        <Link href="/crm/users" style={{
          fontSize: 12, fontWeight: 600, color: "#6366F1",
          background: "#EEF2FF", border: "1px solid #C7D2FE",
          borderRadius: 8, padding: "7px 14px", textDecoration: "none",
        }}>
          Manage Users
        </Link>
      </div>

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
