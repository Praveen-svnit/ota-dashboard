"use client";

import React, { useEffect, useMemo, useState } from "react";

const OTA_LIST = [
  "GoMMT", "Booking.com", "Agoda", "Expedia",
  "Cleartrip", "EaseMyTrip", "Yatra", "Ixigo", "Akbar Travels",
];

const OTA_SHORT: Record<string, string> = {
  "GoMMT": "GoMMT", "Booking.com": "BDC", "Agoda": "Agoda",
  "Expedia": "Exp", "Cleartrip": "CT", "Yatra": "Yatra",
  "Ixigo": "Ixigo", "Akbar Travels": "AKT", "EaseMyTrip": "EMT",
};

const OTA_COLORS: Record<string, string> = {
  "GoMMT": "#E83F6F", "Booking.com": "#2563EB", "Agoda": "#7C3AED",
  "Expedia": "#0EA5E9", "Cleartrip": "#F97316", "Yatra": "#F43F5E",
  "Ixigo": "#FB923C", "Akbar Travels": "#38BDF8", "EaseMyTrip": "#06B6D4",
};

const SS_COLOR: Record<string, { color: string; bg: string }> = {
  "live":      { color: "#16A34A", bg: "#DCFCE7" },
  "not live":  { color: "#DC2626", bg: "#FEE2E2" },
  "notlive":   { color: "#DC2626", bg: "#FEE2E2" },
  "exception": { color: "#D97706", bg: "#FEF3C7" },
  "pending":   { color: "#2563EB", bg: "#DBEAFE" },
  "duplicate": { color: "#7C3AED", bg: "#EDE9FE" },
};

function ssColor(raw: string | null) {
  if (!raw) return { color: "#9CA3AF", bg: "#F3F4F6" };
  return SS_COLOR[raw.toLowerCase().trim()] ?? { color: "#9CA3AF", bg: "#F3F4F6" };
}

function getBucket(cm: number) {
  if (cm === 0)  return { label: "0 RNs",    color: "#DC2626" };
  if (cm < 10)   return { label: "Very Low", color: "#EA580C" };
  if (cm < 30)   return { label: "Low",      color: "#D97706" };
  if (cm < 60)   return { label: "Moderate", color: "#16A34A" };
  return               { label: "Strong",    color: "#4338CA" };
}

function fmtPct(v: number) {
  return `${v >= 0 ? "+" : ""}${v.toFixed(0)}%`;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
}

function daysBetween(a: string | null, b: string | null): number {
  if (!a) return 0;
  const da = new Date(a);
  const db = b ? new Date(b) : new Date();
  return Math.max(0, Math.round((db.getTime() - da.getTime()) / 86400000));
}

/* ── Types ── */
interface OtaListing {
  status: string | null; subStatus: string | null;
  liveDate: string | null; otaId: string | null;
}
interface ListingProp {
  fhId: string; name: string; city: string; fhLiveDate: string | null;
  otas: Record<string, OtaListing>;
}
interface RnsProp {
  name: string;
  otas: Record<string, { cm: number; lm: number }>;
}

interface MergedRow {
  fhId: string; name: string; city: string; ota: string;
  fhLiveDate: string | null; subStatus: string | null; status: string | null;
  liveDate: string | null; otaId: string | null;
  cm: number; lm: number; tat: number;
}

type Tab = "all" | "strong" | "noProd" | "drops";

interface Props { ota?: string }

const PAGE_SIZE = 100;

export default function PropertyRnsView({ ota }: Props) {
  const [listingProps, setListingProps] = useState<ListingProp[]>([]);
  const [rnsMap, setRnsMap]             = useState<Map<string, Record<string, { cm: number; lm: number }>>>(new Map());
  const [month, setMonth]               = useState("");
  const [lmMonth, setLmMonth]           = useState("");
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  const [search,      setSearch]      = useState("");
  const [otaFilter,   setOtaFilter]   = useState(ota ?? "");
  const [statusFilter,setStatusFilter]= useState<"" | "live" | "soldout">("");
  const [rnsMin,      setRnsMin]      = useState("");
  const [rnsMax,      setRnsMax]      = useState("");
  const [tab,         setTab]         = useState<Tab>("all");
  const [page,        setPage]        = useState(1);
  const [sortCol,     setSortCol]     = useState<"lm" | "cm" | "delta" | null>(null);
  const [sortDir,     setSortDir]     = useState<"asc" | "desc">("desc");
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => { setOtaFilter(ota ?? ""); }, [ota]);
  useEffect(() => { setPage(1); }, [search, otaFilter, statusFilter, rnsMin, rnsMax, tab, sortCol, sortDir]);

  function toggleSort(col: "lm" | "cm" | "delta") {
    if (sortCol === col) {
      setSortDir(d => d === "desc" ? "asc" : "desc");
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  }

  useEffect(() => {
    setLoading(true); setError(null);
    Promise.all([
      fetch("/api/listing-data").then(r => r.json()),
      fetch("/api/rns-property-list").then(r => r.json()),
    ]).then(([listingRes, rnsRes]) => {
      if (listingRes.error) throw new Error(listingRes.error);
      setListingProps(listingRes.properties ?? []);

      // Build map: lowercase(name) → otaRns
      const map = new Map<string, Record<string, { cm: number; lm: number }>>();
      for (const p of (rnsRes.properties ?? []) as RnsProp[]) {
        map.set(p.name.toLowerCase().trim(), p.otas);
      }
      setRnsMap(map);
      setMonth(rnsRes.month ?? "");
      setLmMonth(rnsRes.lmMonth ?? "");
    }).catch(e => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  /* Merge listing + RNS into flat rows (only live entries) */
  const allRows = useMemo<MergedRow[]>(() => {
    const rows: MergedRow[] = [];
    const otas = ota ? [ota] : OTA_LIST;
    for (const prop of listingProps) {
      const rnsOtas = rnsMap.get(prop.name.toLowerCase().trim()) ?? {};
      for (const o of otas) {
        const listing = prop.otas[o];
        if (!listing) continue;
        const ss = listing.subStatus?.toLowerCase().trim() ?? "";
        // Only include entries that have some listing data or RNS data
        if (!listing.status && !listing.subStatus && !rnsOtas[o]) continue;
        const rns = rnsOtas[o] ?? { cm: 0, lm: 0 };
        rows.push({
          fhId: prop.fhId, name: prop.name, city: prop.city, ota: o,
          fhLiveDate: prop.fhLiveDate,
          subStatus: listing.subStatus, status: listing.status,
          liveDate: listing.liveDate, otaId: listing.otaId,
          cm: rns.cm, lm: rns.lm,
          tat: daysBetween(prop.fhLiveDate, listing.liveDate),
        });
      }
    }
    return rows;
  }, [listingProps, rnsMap, ota]);

  const liveRows = useMemo(() =>
    allRows.filter(r => r.subStatus?.toLowerCase().trim() === "live"),
  [allRows]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const otaF = otaFilter;
    const minRns = rnsMin !== "" ? parseInt(rnsMin) : null;
    const maxRns = rnsMax !== "" ? parseInt(rnsMax) : null;

    // For "all" tab use allRows (live first), for others use liveRows
    const base = tab === "all" ? allRows : liveRows;
    let rows = base;
    if (q)    rows = rows.filter(r => r.name.toLowerCase().includes(q) || r.fhId.toLowerCase().includes(q));
    if (otaF) rows = rows.filter(r => r.ota === otaF);
    if (statusFilter === "live")    rows = rows.filter(r => r.subStatus?.toLowerCase().trim() === "live");
    if (statusFilter === "soldout") rows = rows.filter(r => r.subStatus?.toLowerCase().trim() === "sold out" || r.subStatus?.toLowerCase().trim() === "soldout");
    if (minRns !== null && !isNaN(minRns)) rows = rows.filter(r => r.cm >= minRns);
    if (maxRns !== null && !isNaN(maxRns)) rows = rows.filter(r => r.cm <= maxRns);

    let result: MergedRow[];
    if (tab === "strong")  result = [...rows].filter(r => r.cm >= 60).sort((a, b) => b.cm - a.cm);
    else if (tab === "noProd")  result = [...rows].filter(r => r.cm === 0).sort((a, b) => a.name.localeCompare(b.name));
    else if (tab === "drops")   result = [...rows].filter(r => r.lm > 0 && r.cm < r.lm * 0.5)
                                           .sort((a, b) => (a.cm / a.lm) - (b.cm / b.lm));
    else result = [...rows].sort((a, b) => {
      const aLive = a.subStatus?.toLowerCase().trim() === "live" ? 0 : 1;
      const bLive = b.subStatus?.toLowerCase().trim() === "live" ? 0 : 1;
      if (aLive !== bLive) return aLive - bLive;
      return b.cm - a.cm;
    });

    // Override sort if user clicked a column header
    if (sortCol) {
      const dir = sortDir === "desc" ? -1 : 1;
      result.sort((a, b) => {
        if (sortCol === "lm")    return (a.lm - b.lm) * dir;
        if (sortCol === "cm")    return (a.cm - b.cm) * dir;
        // delta: nulls go to bottom regardless of direction
        const da = a.lm > 0 ? (a.cm - a.lm) / a.lm : null;
        const db = b.lm > 0 ? (b.cm - b.lm) / b.lm : null;
        if (da === null && db === null) return 0;
        if (da === null) return 1;
        if (db === null) return -1;
        return (da - db) * dir;
      });
    }
    return result;
  }, [allRows, liveRows, search, otaFilter, tab, sortCol, sortDir]);

  const counts = useMemo(() => {
    const q = search.toLowerCase().trim();
    const otaF = otaFilter;
    const minRns = rnsMin !== "" ? parseInt(rnsMin) : null;
    const maxRns = rnsMax !== "" ? parseInt(rnsMax) : null;
    let base = allRows;
    if (q)    base = base.filter(r => r.name.toLowerCase().includes(q) || r.fhId.toLowerCase().includes(q));
    if (otaF) base = base.filter(r => r.ota === otaF);
    if (statusFilter === "live")    base = base.filter(r => r.subStatus?.toLowerCase().trim() === "live");
    if (statusFilter === "soldout") base = base.filter(r => r.subStatus?.toLowerCase().trim() === "sold out" || r.subStatus?.toLowerCase().trim() === "soldout");
    if (minRns !== null && !isNaN(minRns)) base = base.filter(r => r.cm >= minRns);
    if (maxRns !== null && !isNaN(maxRns)) base = base.filter(r => r.cm <= maxRns);
    const live = base.filter(r => r.subStatus?.toLowerCase().trim() === "live");
    return {
      all:    base.length,
      strong: live.filter(r => r.cm >= 60).length,
      noProd: live.filter(r => r.cm === 0).length,
      drops:  live.filter(r => r.lm > 0 && r.cm < r.lm * 0.5).length,
    };
  }, [allRows, search, otaFilter, statusFilter, rnsMin, rnsMax]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const TABS: { id: Tab; label: string; color?: string }[] = [
    { id: "all",    label: "All" },
    { id: "strong", label: "Strong",     color: "#4338CA" },
    { id: "noProd", label: "No Prod",    color: "#DC2626" },
    { id: "drops",  label: "Drops",      color: "#D97706" },
  ];

  const TH = (align: "left" | "center" = "center", minWidth?: number): React.CSSProperties => ({
    padding: "8px 12px", textAlign: align, fontSize: 10, fontWeight: 700,
    color: "#9CA3AF", whiteSpace: "nowrap", background: "#F9FAFB",
    borderBottom: "1px solid #E5E7EB", minWidth,
  });

  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>

      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>Property Production</span>
        {month && (
          <span style={{ fontSize: 11, color: "#6B7280", background: "#F3F4F6", padding: "2px 8px", borderRadius: 99 }}>
            {month} vs {lmMonth}
          </span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setShowDetails(v => !v)}
            style={{
              padding: "4px 10px", fontSize: 11, fontWeight: 600,
              border: "1px solid #E5E7EB", borderRadius: 6, cursor: "pointer",
              background: showDetails ? "#111827" : "#F9FAFB",
              color:      showDetails ? "#FFFFFF"  : "#6B7280",
              fontFamily: "inherit",
            }}
          >
            {showDetails ? "▲ Less" : "▼ Details"}
          </button>
          <span style={{ fontSize: 11, color: "#9CA3AF" }}>
            {loading ? "Loading…" : `${filtered.length.toLocaleString()} listings`}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {/* Search */}
        <div style={{ position: "relative", flex: "1 1 180px", maxWidth: 260 }}>
          <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#9CA3AF", pointerEvents: "none" }}>⌕</span>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name or FH ID…"
            style={{ width: "100%", paddingLeft: 26, paddingRight: 8, paddingTop: 6, paddingBottom: 6, fontSize: 11, border: "1px solid #E5E7EB", borderRadius: 6, outline: "none", color: "#111827", background: "#FFFFFF", boxSizing: "border-box" }}
          />
        </div>

        {/* OTA filter — only show when not locked to single OTA */}
        {!ota && (
          <select value={otaFilter} onChange={e => setOtaFilter(e.target.value)}
            style={{ padding: "6px 10px", fontSize: 11, border: "1px solid #E5E7EB", borderRadius: 6, background: "#FFFFFF", color: "#374151", cursor: "pointer", outline: "none" }}>
            <option value="">All OTAs</option>
            {OTA_LIST.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )}

        {/* Status filter */}
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
          style={{ padding: "6px 10px", fontSize: 11, border: "1px solid #E5E7EB", borderRadius: 6, background: "#FFFFFF", color: "#374151", cursor: "pointer", outline: "none" }}>
          <option value="">All Status</option>
          <option value="live">Live</option>
          <option value="soldout">Sold Out</option>
        </select>

        {/* RNs range filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 10, color: "#9CA3AF", fontWeight: 600 }}>CM RNs</span>
          <input
            value={rnsMin} onChange={e => setRnsMin(e.target.value)}
            placeholder="Min" type="number" min={0}
            style={{ width: 52, padding: "5px 7px", fontSize: 11, border: "1px solid #E5E7EB", borderRadius: 6, outline: "none", color: "#374151" }}
          />
          <span style={{ fontSize: 10, color: "#9CA3AF" }}>–</span>
          <input
            value={rnsMax} onChange={e => setRnsMax(e.target.value)}
            placeholder="Max" type="number" min={0}
            style={{ width: 52, padding: "5px 7px", fontSize: 11, border: "1px solid #E5E7EB", borderRadius: 6, outline: "none", color: "#374151" }}
          />
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderRadius: 7, border: "1px solid #E5E7EB", overflow: "hidden", marginLeft: !ota ? 0 : "auto" }}>
          {TABS.map(({ id, label }) => (
            <button key={id} onClick={() => setTab(id)} style={{
              padding: "5px 12px", border: "none", cursor: "pointer", fontFamily: "inherit",
              fontSize: 11, fontWeight: 600, display: "flex", alignItems: "center", gap: 4,
              background: tab === id ? "#111827" : "#FFFFFF",
              color:      tab === id ? "#FFFFFF" : "#6B7280",
            }}>
              {label}
              <span style={{ fontSize: 9, background: tab === id ? "rgba(255,255,255,0.2)" : "#F3F4F6", color: tab === id ? "#fff" : "#6B7280", padding: "1px 5px", borderRadius: 99 }}>
                {counts[id]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding: 60, textAlign: "center", fontSize: 12, color: "#9CA3AF" }}>Loading…</div>
      ) : error ? (
        <div style={{ padding: "12px 16px", background: "#FEF2F2", fontSize: 11, color: "#DC2626" }}>Error: {error}</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 60, textAlign: "center", fontSize: 12, color: "#9CA3AF" }}>No properties match your filters.</div>
      ) : (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%" }}>
              <thead>
                <tr>
                  <th style={TH("left", 60)}>FH ID</th>
                  <th style={TH("left", 190)}>Property Name</th>
                  <th style={TH("left", 85)}>City</th>
                  {!ota && <th style={TH("center", 80)}>OTA</th>}
                  {showDetails && <th style={TH("center", 95)}>FH Live Date</th>}
                  {showDetails && <th style={TH("center", 95)}>OTA Live Date</th>}
                  {showDetails && <th style={TH("center", 80)}>OTA ID</th>}
                  {showDetails && <th style={TH("center", 90)}>Sub Status</th>}
                  {showDetails && <th style={TH("center", 70)}>Status</th>}
                  {(["lm", "cm", "delta"] as const).map(col => {
                    const label = col === "lm" ? "LM RNs" : col === "cm" ? "CM RNs" : "Delta";
                    const active = sortCol === col;
                    const arrow  = active ? (sortDir === "desc" ? " ▼" : " ▲") : " ⇅";
                    return (
                      <th key={col} onClick={() => toggleSort(col)} style={{
                        ...TH("center", 65), cursor: "pointer", userSelect: "none",
                        color: active ? "#2563EB" : "#9CA3AF",
                        background: active ? "#EFF6FF" : "#F9FAFB",
                      }}>
                        {label}<span style={{ fontSize: 9, opacity: active ? 1 : 0.4 }}>{arrow}</span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, i) => {
                  const delta      = row.lm > 0 ? Math.round(((row.cm - row.lm) / row.lm) * 100) : null;
                  const deltaColor = delta === null ? "#9CA3AF" : delta >= 0 ? "#16A34A" : "#DC2626";
                  const otaColor   = OTA_COLORS[row.ota] ?? "#64748B";
                  const ssc        = ssColor(row.subStatus);
                  const cmColor    = row.cm === 0 ? "#DC2626" : row.cm < 10 ? "#EA580C" : row.cm < 30 ? "#D97706" : row.cm < 60 ? "#16A34A" : "#4338CA";
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid #F3F4F6", background: i % 2 === 0 ? "#FFFFFF" : "#FAFAFA" }}>
                      <td style={{ padding: "6px 12px", color: "#2563EB", fontWeight: 700, whiteSpace: "nowrap", fontSize: 10 }}>{row.fhId}</td>
                      <td style={{ padding: "6px 14px", color: "#111827", fontWeight: 500, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name}</td>
                      <td style={{ padding: "6px 12px", color: "#6B7280", whiteSpace: "nowrap", fontSize: 11 }}>{row.city || "—"}</td>
                      {!ota && (
                        <td style={{ padding: "6px 12px", textAlign: "center", whiteSpace: "nowrap" }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: otaColor + "15", color: otaColor, border: `1px solid ${otaColor}30` }}>
                            {OTA_SHORT[row.ota] ?? row.ota}
                          </span>
                        </td>
                      )}
                      {showDetails && <td style={{ padding: "6px 12px", textAlign: "center", color: "#475569", fontSize: 10, whiteSpace: "nowrap" }}>{fmtDate(row.fhLiveDate)}</td>}
                      {showDetails && <td style={{ padding: "6px 12px", textAlign: "center", color: "#475569", fontSize: 10, whiteSpace: "nowrap" }}>{fmtDate(row.liveDate)}</td>}
                      {showDetails && (
                        <td style={{ padding: "6px 12px", textAlign: "center", color: "#6B7280", fontFamily: "monospace", fontSize: 10 }}>
                          {row.otaId ?? <span style={{ color: "#D1D5DB" }}>—</span>}
                        </td>
                      )}
                      {showDetails && (
                        <td style={{ padding: "6px 12px", textAlign: "center", whiteSpace: "nowrap" }}>
                          <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 4, background: ssc.bg, color: ssc.color, textTransform: "capitalize" }}>
                            {row.subStatus ?? "—"}
                          </span>
                        </td>
                      )}
                      {showDetails && (
                        <td style={{ padding: "6px 12px", textAlign: "center", whiteSpace: "nowrap" }}>
                          <span style={{ fontSize: 10, color: "#475569" }}>{row.status ?? "—"}</span>
                        </td>
                      )}
                      <td style={{ padding: "6px 12px", textAlign: "center", color: "#9CA3AF", fontSize: 11 }}>
                        {row.lm || <span style={{ color: "#D1D5DB" }}>—</span>}
                      </td>
                      <td style={{ padding: "6px 12px", textAlign: "center" }}>
                        <span style={{ fontWeight: 700, fontSize: 12, color: cmColor }}>
                          {row.cm > 0 ? row.cm : <span style={{ color: "#D1D5DB", fontWeight: 400 }}>0</span>}
                        </span>
                      </td>
                      <td style={{ padding: "6px 12px", textAlign: "center" }}>
                        {delta === null
                          ? <span style={{ color: "#D1D5DB" }}>—</span>
                          : <span style={{ fontSize: 11, fontWeight: 600, color: deltaColor }}>{fmtPct(delta)}</span>}
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
                { label: "‹", fn: () => setPage(p => Math.max(1, p - 1)),            dis: page === 1 },
                { label: "›", fn: () => setPage(p => Math.min(totalPages, p + 1)),   dis: page === totalPages },
                { label: "»", fn: () => setPage(totalPages),                          dis: page === totalPages },
              ] as const).map(({ label, fn, dis }) => (
                <button key={label} onClick={fn} disabled={dis} style={{
                  padding: "4px 9px", fontSize: 12, fontWeight: 700,
                  color: dis ? "#D1D5DB" : "#374151", background: "#FFFFFF",
                  border: `1px solid ${dis ? "#F3F4F6" : "#D1D5DB"}`,
                  borderRadius: 6, cursor: dis ? "not-allowed" : "pointer",
                }}>{label}</button>
              ))}
              <span style={{ fontSize: 11, color: "#9CA3AF", padding: "4px 8px" }}>{page} / {totalPages}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
