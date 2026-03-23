"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

/* ─── OTA config ─────────────────────────────────────────────── */
const OTA_COLORS: Record<string, string> = {
  "GoMMT":         "#E83F6F",
  "Booking.com":   "#2563EB",
  "Agoda":         "#7C3AED",
  "Expedia":       "#0EA5E9",
  "Cleartrip":     "#F97316",
  "Yatra":         "#F43F5E",
  "Ixigo":         "#FB923C",
  "Akbar Travels": "#38BDF8",
  "EaseMyTrip":    "#06B6D4",
};

const OTA_SHORT: Record<string, string> = {
  "GoMMT":         "GoMMT",  "Booking.com":   "BDC",
  "Agoda":         "Agoda",  "Expedia":       "Expedia",
  "Cleartrip":     "CT",     "Yatra":         "Yatra",
  "Ixigo":         "Ixigo",  "Akbar Travels": "AKT",
  "EaseMyTrip":    "EMT",
};

const OTA_LIST = Object.keys(OTA_COLORS);

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  "live":      { color: "#16A34A", bg: "#DCFCE7", border: "#BBF7D0" },
  "not live":  { color: "#DC2626", bg: "#FEE2E2", border: "#FECACA" },
  "notlive":   { color: "#DC2626", bg: "#FEE2E2", border: "#FECACA" },
  "exception": { color: "#D97706", bg: "#FEF3C7", border: "#FDE68A" },
  "pending":   { color: "#2563EB", bg: "#DBEAFE", border: "#BFDBFE" },
  "duplicate": { color: "#7C3AED", bg: "#EDE9FE", border: "#DDD6FE" },
  "blank":     { color: "#9CA3AF", bg: "#F3F4F6", border: "#E5E7EB" },
};

function statusStyle(raw: string | null) {
  if (!raw) return STATUS_STYLE["blank"];
  return STATUS_STYLE[raw.toLowerCase().trim()] ?? { color: "#9CA3AF", bg: "#F3F4F6", border: "#E5E7EB" };
}

function fmtDate(raw: string | null): string {
  if (!raw?.trim()) return "";
  const d = new Date(raw.trim());
  return isNaN(d.getTime()) ? raw.trim() : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
}

/* ─── Types ──────────────────────────────────────────────────── */
interface OtaEntry {
  liveDate:  string | null;
  otaId:     string | null;
  status:    string | null;
  subStatus: string | null;
}

interface Property {
  fhId: string;
  name: string;
  city: string;
  otas: Record<string, OtaEntry>;
}

interface IncompleteRow {
  fhId:     string;
  name:     string;
  city:     string;
  ota:      string;
  otaId:    string | null;
  status:   string | null;
  liveDate: string | null;
  missing:  string[];
}

/* ─── Build incomplete rows from DB properties ───────────────── */
function buildIncompleteRows(properties: Property[]): IncompleteRow[] {
  const out: IncompleteRow[] = [];
  for (const prop of properties) {
    for (const ota of OTA_LIST) {
      const entry    = prop.otas[ota];
      const liveDate = entry?.liveDate ?? null;
      const otaId    = entry?.otaId    ?? null;
      const status   = entry?.status   ?? null;

      const hasAny = !!(otaId || status || liveDate);
      const hasAll = !!(otaId && status && liveDate);
      if (!hasAny || hasAll) continue;

      const missing: string[] = [];
      if (!otaId)    missing.push("OTA ID");
      if (!status)   missing.push("Status");
      if (!liveDate) missing.push("Live Date");
      out.push({ fhId: prop.fhId, name: prop.name, city: prop.city, ota, otaId, status, liveDate, missing });
    }
  }
  return out;
}

const MISSING_FILTERS = ["Any", "OTA ID", "Status", "Live Date"] as const;
type MissingFilter = typeof MISSING_FILTERS[number];

/* ─── Page ───────────────────────────────────────────────────── */
export default function IncompletePage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error,   setError]         = useState<string | null>(null);

  const [nameSearch,    setNameSearch]    = useState("");
  const [otaFilter,     setOtaFilter]     = useState("");
  const [missingFilter, setMissingFilter] = useState<MissingFilter>("Any");
  const [page, setPage]                   = useState(1);
  const tableRef = useRef<HTMLDivElement>(null);

  const PAGE_SIZE = 50;

  function scrollToTable() {
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    fetch("/api/listing-data")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setProperties(d.properties);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { setPage(1); }, [nameSearch, otaFilter, missingFilter]);

  const allRows = useMemo(() => buildIncompleteRows(properties), [properties]);

  const filtered = useMemo(() => {
    let r = allRows;
    if (otaFilter) r = r.filter((x) => x.ota === otaFilter);
    if (missingFilter !== "Any") r = r.filter((x) => x.missing.includes(missingFilter));
    if (nameSearch.trim()) {
      const q = nameSearch.trim().toLowerCase();
      r = r.filter((x) => x.name.toLowerCase().includes(q) || x.fhId.toLowerCase().includes(q));
    }
    return r;
  }, [allRows, otaFilter, missingFilter, nameSearch]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const noId     = allRows.filter((r) => !r.otaId).length;
  const noStatus = allRows.filter((r) => !r.status).length;
  const noDate   = allRows.filter((r) => !r.liveDate).length;

  const inputStyle: React.CSSProperties = {
    padding: "7px 10px 7px 28px", fontSize: 11,
    border: "1px solid #D1D5DB", borderRadius: 6,
    background: "#FFFFFF", color: "#111827",
    outline: "none", boxSizing: "border-box",
  };

  const selStyle: React.CSSProperties = {
    padding: "7px 10px", fontSize: 11,
    border: "1px solid #D1D5DB", borderRadius: 6,
    background: "#FFFFFF", color: "#374151",
    cursor: "pointer", outline: "none",
  };

  return (
    <div style={{ padding: "20px 24px", background: "#F9FAFB", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/listings" style={{ fontSize: 11, color: "#6B7280", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
            ← Listing Status
          </Link>
          <span style={{ color: "#D1D5DB" }}>/</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Incomplete OTA Data</span>
          {!loading && (
            <span style={{ fontSize: 11, fontWeight: 600, color: "#374151", background: "#F3F4F6", border: "1px solid #E5E7EB", borderRadius: 5, padding: "2px 10px" }}>
              {allRows.length.toLocaleString()} records
            </span>
          )}
        </div>
      </div>

      {/* KPI chips */}
      {!loading && (
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          {[
            { label: "Missing OTA ID",    value: noId,     color: "#DC2626", bg: "#FEE2E2", border: "#FECACA", mf: "OTA ID"    },
            { label: "Missing Status",    value: noStatus, color: "#D97706", bg: "#FEF3C7", border: "#FDE68A", mf: "Status"    },
            { label: "Missing Live Date", value: noDate,   color: "#2563EB", bg: "#DBEAFE", border: "#BFDBFE", mf: "Live Date" },
          ].map(({ label, value, color, bg, border, mf }) => (
            <div
              key={label}
              onClick={() => { setMissingFilter((prev) => prev === mf ? "Any" : mf as MissingFilter); scrollToTable(); }}
              style={{
                flex: "1 1 140px", background: bg, border: `1px solid ${border}`,
                borderRadius: 10, padding: "10px 16px", cursor: "pointer",
                outline: missingFilter === mf ? `2px solid ${color}` : "none",
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 800, color }}>{value.toLocaleString()}</div>
              <div style={{ fontSize: 10, fontWeight: 600, color, opacity: 0.7, marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 200px", maxWidth: 280 }}>
          <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#9CA3AF", pointerEvents: "none" }}>⌕</span>
          <input
            type="text" placeholder="Search property name or FH ID…"
            value={nameSearch} onChange={(e) => setNameSearch(e.target.value)}
            style={{ ...inputStyle, width: "100%", paddingRight: nameSearch ? 28 : 10 }}
          />
          {nameSearch && (
            <button onClick={() => setNameSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 14, padding: 0 }}>×</button>
          )}
        </div>

        <select value={otaFilter} onChange={(e) => setOtaFilter(e.target.value)} style={selStyle}>
          <option value="">All OTAs</option>
          {OTA_LIST.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>

        <div style={{ display: "flex", gap: 4 }}>
          {MISSING_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setMissingFilter(f)}
              style={{
                padding: "6px 12px", fontSize: 11, fontWeight: 600,
                borderRadius: 6, cursor: "pointer", border: "1px solid",
                background: missingFilter === f ? "#111827" : "#FFFFFF",
                color:      missingFilter === f ? "#FFFFFF" : "#6B7280",
                borderColor: missingFilter === f ? "#111827" : "#D1D5DB",
              }}
            >
              {f}
            </button>
          ))}
        </div>

        <span style={{ marginLeft: "auto", fontSize: 11, color: "#9CA3AF" }}>
          {filtered.length.toLocaleString()} results
        </span>
      </div>

      {error && (
        <div style={{ padding: "8px 12px", background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, color: "#DC2626", marginBottom: 14 }}>
          {error}
        </div>
      )}

      {/* Table */}
      <div ref={tableRef} style={{ background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Loading…</div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["FH ID", "Property Name", "City", "OTA", "OTA ID", "Status", "Live Date", "Missing"].map((h) => (
                      <th key={h} style={{
                        padding: "9px 14px", fontSize: 10, fontWeight: 700,
                        color: "#9CA3AF", background: "#F9FAFB",
                        borderBottom: "1px solid #E5E7EB",
                        textAlign: "left", whiteSpace: "nowrap",
                        position: "sticky", top: 0,
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 48, textAlign: "center", color: "#9CA3AF" }}>
                        No incomplete records match your filters
                      </td>
                    </tr>
                  ) : pageRows.map((row, i) => {
                    const ss = statusStyle(row.status);
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid #F3F4F6", background: i % 2 === 0 ? "#FFFFFF" : "#FAFAFA" }}>
                        <td style={{ padding: "8px 14px", color: "#2563EB", fontWeight: 700, whiteSpace: "nowrap" }}>
                          {row.fhId}
                        </td>
                        <td style={{ padding: "8px 14px", color: "#111827", whiteSpace: "nowrap", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {row.name}
                        </td>
                        <td style={{ padding: "8px 14px", color: "#6B7280", whiteSpace: "nowrap" }}>
                          {row.city || "—"}
                        </td>
                        <td style={{ padding: "8px 14px", whiteSpace: "nowrap" }}>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5,
                            background: OTA_COLORS[row.ota] + "15",
                            color: OTA_COLORS[row.ota],
                            border: `1px solid ${OTA_COLORS[row.ota]}30`,
                          }}>
                            {OTA_SHORT[row.ota]}
                          </span>
                        </td>
                        <td style={{ padding: "8px 14px", whiteSpace: "nowrap" }}>
                          {row.otaId
                            ? <span style={{ color: "#374151", fontFamily: "monospace" }}>{row.otaId}</span>
                            : <span style={{ fontSize: 10, color: "#DC2626", fontWeight: 700, background: "#FEE2E2", padding: "1px 6px", borderRadius: 4 }}>Missing</span>
                          }
                        </td>
                        <td style={{ padding: "8px 14px", whiteSpace: "nowrap" }}>
                          {row.status ? (
                            <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 5, textTransform: "capitalize", background: ss.bg, color: ss.color, border: `1px solid ${ss.border}` }}>
                              {row.status}
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, color: "#DC2626", fontWeight: 700, background: "#FEE2E2", padding: "1px 6px", borderRadius: 4 }}>Missing</span>
                          )}
                        </td>
                        <td style={{ padding: "8px 14px", whiteSpace: "nowrap" }}>
                          {row.liveDate
                            ? <span style={{ color: "#16A34A" }}>{fmtDate(row.liveDate)}</span>
                            : <span style={{ fontSize: 10, color: "#DC2626", fontWeight: 700, background: "#FEE2E2", padding: "1px 6px", borderRadius: 4 }}>Missing</span>
                          }
                        </td>
                        <td style={{ padding: "8px 14px", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", gap: 4 }}>
                            {row.missing.map((m) => (
                              <span key={m} style={{
                                fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                                background: "#FEE2E2", color: "#DC2626", border: "1px solid #FECACA",
                              }}>
                                {m}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: "1px solid #E5E7EB", background: "#F9FAFB" }}>
              <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length.toLocaleString()}
              </span>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {[
                  { label: "«", fn: () => setPage(1),                                    dis: page === 1 },
                  { label: "‹", fn: () => setPage((p) => Math.max(1, p - 1)),            dis: page === 1 },
                  { label: "›", fn: () => setPage((p) => Math.min(totalPages, p + 1)),   dis: page === totalPages },
                  { label: "»", fn: () => setPage(totalPages),                            dis: page === totalPages },
                ].map(({ label, fn, dis }) => (
                  <button key={label} onClick={fn} disabled={dis} style={{
                    padding: "4px 9px", fontSize: 12, fontWeight: 700,
                    color: dis ? "#D1D5DB" : "#374151",
                    background: "#FFFFFF",
                    border: `1px solid ${dis ? "#F3F4F6" : "#D1D5DB"}`,
                    borderRadius: 6, cursor: dis ? "not-allowed" : "pointer",
                  }}>
                    {label}
                  </button>
                ))}
                <span style={{ fontSize: 11, color: "#9CA3AF", padding: "4px 8px" }}>
                  {page} / {totalPages}
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
