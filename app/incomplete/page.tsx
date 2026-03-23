"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const OTA_COLORS: Record<string, string> = {
  "GoMMT":         "#E83F6F", "Booking.com":   "#2563EB",
  "Agoda":         "#7C3AED", "Expedia":       "#0EA5E9",
  "Cleartrip":     "#F97316", "Yatra":         "#F43F5E",
  "Ixigo":         "#FB923C", "Akbar Travels": "#38BDF8",
  "EaseMyTrip":    "#06B6D4",
};

const OTA_SHORT: Record<string, string> = {
  "GoMMT": "GoMMT", "Booking.com": "BDC",   "Agoda": "Agoda",
  "Expedia": "Exp",  "Cleartrip": "CT",      "Yatra": "Yatra",
  "Ixigo": "Ixigo",  "Akbar Travels": "AKT", "EaseMyTrip": "EMT",
};

const OTA_LIST = Object.keys(OTA_COLORS);

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  "live":      { color: "#16A34A", bg: "#DCFCE7", border: "#BBF7D0" },
  "not live":  { color: "#DC2626", bg: "#FEE2E2", border: "#FECACA" },
  "notlive":   { color: "#DC2626", bg: "#FEE2E2", border: "#FECACA" },
  "exception": { color: "#D97706", bg: "#FEF3C7", border: "#FDE68A" },
  "pending":   { color: "#2563EB", bg: "#DBEAFE", border: "#BFDBFE" },
  "duplicate": { color: "#7C3AED", bg: "#EDE9FE", border: "#DDD6FE" },
};

function statusStyle(raw: string | null) {
  if (!raw) return { color: "#9CA3AF", bg: "#F3F4F6", border: "#E5E7EB" };
  return STATUS_STYLE[raw.toLowerCase().trim()] ?? { color: "#9CA3AF", bg: "#F3F4F6", border: "#E5E7EB" };
}

function fmtDate(raw: string | null): string {
  if (!raw?.trim()) return "";
  const d = new Date(raw.trim());
  return isNaN(d.getTime()) ? raw.trim() : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
}

interface IncompleteRow {
  fhId: string; name: string; city: string; ota: string;
  otaId: string | null; status: string | null; subStatus: string | null; liveDate: string | null;
  tatError: number;
  missing: string[];
}

const MISSING_FILTERS = ["Any", "OTA ID", "Status", "Sub Status", "Live Date", "Neg. TAT"] as const;
type MissingFilter = typeof MISSING_FILTERS[number];

const PAGE_SIZE = 75;

function downloadCSV(rows: IncompleteRow[]) {
  const headers = ["FH ID", "Property Name", "City", "OTA", "OTA ID", "Status", "Sub Status", "OTA Live Date", "TAT Error", "Missing Fields"];
  const escape  = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const lines   = [
    headers.join(","),
    ...rows.map((r) => [
      escape(r.fhId), escape(r.name), escape(r.city), escape(r.ota),
      escape(r.otaId ?? ""), escape(r.status ?? ""), escape(r.subStatus ?? ""),
      escape(r.liveDate ?? ""), escape(r.tatError === 1 ? "Negative TAT" : ""),
      escape(r.missing.join("; ")),
    ].join(",")),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = `incomplete-data-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

export default function IncompletePage() {
  const [rows,    setRows]    = useState<IncompleteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const [nameSearch,    setNameSearch]    = useState("");
  const [otaFilter,     setOtaFilter]     = useState("");
  const [missingFilter, setMissingFilter] = useState<MissingFilter>("Any");
  const [page,          setPage]          = useState(1);
  const tableRef = useRef<HTMLDivElement>(null);

  function scrollToTable() {
    tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    fetch("/api/incomplete-data")
      .then((r) => r.json())
      .then((d) => { if (d.error) { setError(d.error); return; } setRows(d.rows ?? []); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { setPage(1); }, [nameSearch, otaFilter, missingFilter]);

  const filtered = useMemo(() => {
    let r = rows;
    if (otaFilter) r = r.filter((x) => x.ota === otaFilter);
    if (missingFilter !== "Any") r = r.filter((x) => x.missing.includes(missingFilter));
    if (nameSearch.trim()) {
      const q = nameSearch.trim().toLowerCase();
      r = r.filter((x) => x.name.toLowerCase().includes(q) || x.fhId.toLowerCase().includes(q));
    }
    return r;
  }, [rows, otaFilter, missingFilter, nameSearch]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const inp: React.CSSProperties = {
    padding: "7px 10px 7px 28px", fontSize: 11,
    border: "1px solid #D1D5DB", borderRadius: 6,
    background: "#FFFFFF", color: "#111827",
    outline: "none", width: "100%", boxSizing: "border-box",
  };

  return (
    <div style={{ padding: "20px 24px", background: "#F9FAFB", minHeight: "100vh", fontFamily: "system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>Incomplete OTA Data</span>
        {!loading && (
          <span style={{ fontSize: 11, fontWeight: 600, color: "#374151", background: "#F3F4F6", border: "1px solid #E5E7EB", borderRadius: 5, padding: "2px 10px" }}>
            {rows.length.toLocaleString()} records
          </span>
        )}
        {loading && <span style={{ fontSize: 11, color: "#9CA3AF" }}>Loading…</span>}
        {error   && <span style={{ fontSize: 11, color: "#DC2626" }}>{error}</span>}
      </div>

      {/* Summary table */}
      {!loading && rows.length > 0 && (() => {
        const summary = OTA_LIST.map((ota) => {
          const otaRows = rows.filter((r) => r.ota === ota);
          return {
            ota,
            total:    otaRows.length,
            noId:     otaRows.filter((r) => r.missing.includes("OTA ID")).length,
            noStatus: otaRows.filter((r) => r.missing.includes("Status")).length,
            noSubSt:  otaRows.filter((r) => r.missing.includes("Sub Status")).length,
            noDate:   otaRows.filter((r) => r.missing.includes("Live Date")).length,
            negTat:   otaRows.filter((r) => r.tatError === 1).length,
          };
        }).filter((s) => s.total > 0).sort((a, b) => b.total - a.total);

        return (
          <div style={{ background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#111827" }}>Summary by OTA</span>
              <span style={{ fontSize: 10, color: "#9CA3AF" }}>incomplete records</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11 }}>
                <thead>
                  <tr style={{ background: "#F9FAFB" }}>
                    <th style={{ padding: "8px 14px", fontWeight: 700, color: "#9CA3AF", borderBottom: "1px solid #E5E7EB", borderRight: "1px solid #E5E7EB", textAlign: "left", whiteSpace: "nowrap", minWidth: 120 }} />
                    {summary.map(({ ota }) => (
                      <th key={ota} onClick={() => setOtaFilter((p) => p === ota ? "" : ota)}
                        style={{ padding: "8px 12px", fontWeight: 700, borderBottom: "1px solid #E5E7EB", borderRight: "1px solid #F3F4F6", textAlign: "center", whiteSpace: "nowrap", cursor: "pointer", background: otaFilter === ota ? "#EFF6FF" : "#F9FAFB" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: OTA_COLORS[ota] + "15", color: OTA_COLORS[ota], border: `1px solid ${OTA_COLORS[ota]}30` }}>
                          {OTA_SHORT[ota]}
                        </span>
                      </th>
                    ))}
                    <th style={{ padding: "8px 12px", fontWeight: 800, color: "#2563EB", background: "#F9FAFB", borderBottom: "1px solid #E5E7EB", textAlign: "center", whiteSpace: "nowrap" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    { label: "Missing OTA ID",     color: "#DC2626", key: "noId"     as const },
                    { label: "Missing Status",      color: "#D97706", key: "noStatus" as const },
                    { label: "Missing Sub Status",  color: "#7C3AED", key: "noSubSt"  as const },
                    { label: "Missing Live Date",   color: "#2563EB", key: "noDate"   as const },
                    { label: "Negative TAT",        color: "#EA580C", key: "negTat"   as const },
                    { label: "Total",               color: "#374151", key: "total"    as const },
                  ]).map(({ label, color, key }, mi) => {
                    const missingLabel = key === "noId" ? "OTA ID" : key === "noStatus" ? "Status" : key === "noSubSt" ? "Sub Status" : key === "noDate" ? "Live Date" : "Neg. TAT";
                    const totVal = key === "total"
                      ? rows.length
                      : key === "negTat"
                        ? rows.filter((r) => r.tatError === 1).length
                        : rows.filter((r) => r.missing.includes(missingLabel)).length;
                    return (
                      <tr key={key} style={{ borderBottom: "1px solid #F3F4F6", background: mi % 2 === 0 ? "#FFFFFF" : "#F9FAFB" }}>
                        <td style={{ padding: "9px 14px", borderRight: "1px solid #E5E7EB", background: "#F9FAFB", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                            <span style={{ width: 7, height: 7, borderRadius: 2, background: color, flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, color: "#374151" }}>{label}</span>
                          </div>
                        </td>
                        {summary.map(({ ota, total, noId, noStatus, noSubSt, noDate, negTat }) => {
                          const v = key === "total" ? total : key === "noId" ? noId : key === "noStatus" ? noStatus : key === "noSubSt" ? noSubSt : key === "noDate" ? noDate : negTat;
                          return (
                            <td key={ota} style={{ padding: "9px 12px", textAlign: "center", borderRight: "1px solid #F3F4F6" }}>
                              {v > 0
                                ? <span
                                    onClick={() => { setOtaFilter(ota); if (key !== "total") setMissingFilter(missingLabel as MissingFilter); else setMissingFilter("Any"); scrollToTable(); }}
                                    style={{ fontWeight: 700, color, background: color + "12", border: `1px solid ${color}25`, borderRadius: 5, padding: "2px 10px", cursor: "pointer" }}
                                  >{v.toLocaleString()}</span>
                                : <span style={{ color: "#D1D5DB" }}>—</span>}
                            </td>
                          );
                        })}
                        <td style={{ padding: "9px 12px", textAlign: "center", background: "#F9FAFB" }}>
                          <span
                            onClick={() => { setOtaFilter(""); if (key !== "total") setMissingFilter(missingLabel as MissingFilter); else setMissingFilter("Any"); scrollToTable(); }}
                            style={{ fontWeight: 700, color, background: color + "12", border: `1px solid ${color}25`, borderRadius: 5, padding: "2px 10px", cursor: "pointer" }}
                          >{totVal.toLocaleString()}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 200px", maxWidth: 280 }}>
          <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#9CA3AF", pointerEvents: "none" }}>⌕</span>
          <input type="text" placeholder="Search name or FH ID…" value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)} style={inp} />
          {nameSearch && (
            <button onClick={() => setNameSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9CA3AF", fontSize: 14, padding: 0 }}>×</button>
          )}
        </div>

        <select value={otaFilter} onChange={(e) => setOtaFilter(e.target.value)} style={{ padding: "7px 10px", fontSize: 11, border: "1px solid #D1D5DB", borderRadius: 6, background: "#FFFFFF", color: "#374151", cursor: "pointer", outline: "none" }}>
          <option value="">All OTAs</option>
          {OTA_LIST.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>

        <div style={{ display: "flex", gap: 4 }}>
          {MISSING_FILTERS.map((f) => (
            <button key={f} onClick={() => setMissingFilter(f)} style={{
              padding: "6px 12px", fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: "pointer", border: "1px solid",
              background: missingFilter === f ? "#111827" : "#FFFFFF",
              color:      missingFilter === f ? "#FFFFFF" : "#6B7280",
              borderColor: missingFilter === f ? "#111827" : "#D1D5DB",
            }}>{f}</button>
          ))}
        </div>

        <span style={{ fontSize: 11, color: "#9CA3AF" }}>
          {filtered.length.toLocaleString()} results
        </span>
        <button
          onClick={() => downloadCSV(filtered)}
          style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", fontSize: 11, fontWeight: 600, borderRadius: 6, cursor: "pointer", border: "1px solid #D1D5DB", background: "#FFFFFF", color: "#374151" }}
        >
          ↓ Download CSV
        </button>
      </div>

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
                    {["FH ID", "Property Name", "City", "OTA", "OTA ID", "Status", "Sub Status", "OTA Live Date", "TAT Error", "Missing"].map((h) => (
                      <th key={h} style={{ padding: "9px 14px", fontSize: 10, fontWeight: 700, color: "#9CA3AF", background: "#F9FAFB", borderBottom: "1px solid #E5E7EB", textAlign: "left", whiteSpace: "nowrap" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr><td colSpan={10} style={{ padding: 48, textAlign: "center", color: "#9CA3AF" }}>No records match your filters</td></tr>
                  ) : pageRows.map((row, i) => {
                    const ss = statusStyle(row.status);
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid #F3F4F6", background: i % 2 === 0 ? "#FFFFFF" : "#FAFAFA" }}>
                        <td style={{ padding: "8px 14px", color: "#2563EB", fontWeight: 700, whiteSpace: "nowrap" }}>{row.fhId}</td>
                        <td style={{ padding: "8px 14px", color: "#111827", whiteSpace: "nowrap", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{row.name}</td>
                        <td style={{ padding: "8px 14px", color: "#6B7280", whiteSpace: "nowrap" }}>{row.city || "—"}</td>
                        <td style={{ padding: "8px 14px", whiteSpace: "nowrap" }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: OTA_COLORS[row.ota] + "15", color: OTA_COLORS[row.ota], border: `1px solid ${OTA_COLORS[row.ota]}30` }}>
                            {OTA_SHORT[row.ota]}
                          </span>
                        </td>
                        <td style={{ padding: "8px 14px", whiteSpace: "nowrap" }}>
                          {row.otaId
                            ? <span style={{ color: "#374151", fontFamily: "monospace" }}>{row.otaId}</span>
                            : <span style={{ fontSize: 10, color: "#DC2626", fontWeight: 700, background: "#FEE2E2", padding: "1px 6px", borderRadius: 4 }}>Missing</span>}
                        </td>
                        <td style={{ padding: "8px 14px", whiteSpace: "nowrap" }}>
                          {row.status
                            ? <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 5, textTransform: "capitalize", background: ss.bg, color: ss.color, border: `1px solid ${ss.border}` }}>{row.status}</span>
                            : <span style={{ fontSize: 10, color: "#DC2626", fontWeight: 700, background: "#FEE2E2", padding: "1px 6px", borderRadius: 4 }}>Missing</span>}
                        </td>
                        <td style={{ padding: "8px 14px", whiteSpace: "nowrap" }}>
                          {row.subStatus
                            ? <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 5, textTransform: "capitalize", background: statusStyle(row.subStatus).bg, color: statusStyle(row.subStatus).color, border: `1px solid ${statusStyle(row.subStatus).border}` }}>{row.subStatus}</span>
                            : <span style={{ fontSize: 10, color: "#DC2626", fontWeight: 700, background: "#FEE2E2", padding: "1px 6px", borderRadius: 4 }}>Missing</span>}
                        </td>
                        <td style={{ padding: "8px 14px", whiteSpace: "nowrap" }}>
                          {row.liveDate
                            ? <span style={{ color: "#16A34A" }}>{fmtDate(row.liveDate)}</span>
                            : <span style={{ fontSize: 10, color: "#DC2626", fontWeight: 700, background: "#FEE2E2", padding: "1px 6px", borderRadius: 4 }}>Missing</span>}
                        </td>
                        <td style={{ padding: "8px 14px", whiteSpace: "nowrap" }}>
                          {row.tatError === 1
                            ? <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 5, background: "#FEF3C7", color: "#D97706", border: "1px solid #FDE68A" }}>Neg. TAT</span>
                            : <span style={{ color: "#D1D5DB" }}>—</span>}
                        </td>
                        <td style={{ padding: "8px 14px", whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", gap: 4 }}>
                            {row.missing.filter((m) => m !== "Neg. TAT").map((m) => (
                              <span key={m} style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "#FEE2E2", color: "#DC2626", border: "1px solid #FECACA" }}>{m}</span>
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
                {([
                  { label: "«", fn: () => setPage(1),                                  dis: page === 1 },
                  { label: "‹", fn: () => setPage((p) => Math.max(1, p - 1)),          dis: page === 1 },
                  { label: "›", fn: () => setPage((p) => Math.min(totalPages, p + 1)), dis: page === totalPages },
                  { label: "»", fn: () => setPage(totalPages),                          dis: page === totalPages },
                ] as const).map(({ label, fn, dis }) => (
                  <button key={label} onClick={fn} disabled={dis} style={{ padding: "4px 9px", fontSize: 12, fontWeight: 700, color: dis ? "#D1D5DB" : "#374151", background: "#FFFFFF", border: `1px solid ${dis ? "#F3F4F6" : "#D1D5DB"}`, borderRadius: 6, cursor: dis ? "not-allowed" : "pointer" }}>
                    {label}
                  </button>
                ))}
                <span style={{ fontSize: 11, color: "#9CA3AF", padding: "4px 8px" }}>{page} / {totalPages}</span>
              </div>
            </div>
          </>
        )}
      </div>

    </div>
  );
}
