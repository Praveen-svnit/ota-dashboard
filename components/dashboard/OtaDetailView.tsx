"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

const MONTHS_IDX = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const T = {
  pageBg:   "#F8FAFC",
  cardBg:   "#FFFFFF",
  cardBdr:  "#E4E8F0",
  headerBg: "#F8FAFC",
  rowAlt:   "#FAFBFC",
  orange:   "#FF6B00",
  orangeL:  "#FFF0E6",
  orangeT:  "#FFE0C7",
  textPri:  "#0F172A",
  textSec:  "#475569",
  textMut:  "#94A3B8",
  live:     "#16A34A",
  liveL:    "#DCFCE7",
  notLive:  "#DC2626",
  notLiveL: "#FEE2E2",
};

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

const SS_COLOR: Record<string, { text: string; bg: string }> = {
  "Live":                        { text: "#16A34A", bg: "#DCFCE7" },
  "Not Live":                    { text: "#DC2626", bg: "#FEE2E2" },
  "OTA Team":                    { text: "#B45309", bg: "#FEF3C7" },
  "Pending at GoMMT":            { text: "#1D4ED8", bg: "#DBEAFE" },
  "Pending at Booking.com":      { text: "#1D4ED8", bg: "#DBEAFE" },
  "Pending at EaseMyTrip":       { text: "#1D4ED8", bg: "#DBEAFE" },
  "Pending at OTA":              { text: "#1D4ED8", bg: "#DBEAFE" },
  "Pending at Agoda":            { text: "#1D4ED8", bg: "#DBEAFE" },
  "Supply/Operations":           { text: "#6D28D9", bg: "#EDE9FE" },
  "Revenue":                     { text: "#C2410C", bg: "#FFEDD5" },
  "Exception":                   { text: "#92400E", bg: "#FEF3C7" },
  "Duplicate - Listing Closed":  { text: "#475569", bg: "#F1F5F9" },
  "Duplicate - Pending Invoice": { text: "#475569", bg: "#F1F5F9" },
  "Blank":                       { text: "#64748B", bg: "#F1F5F9" },
};

function getSSColor(col: string): { text: string; bg: string } {
  return SS_COLOR[col] ?? (col.startsWith("Pending at") ? { text: "#1D4ED8", bg: "#DBEAFE" } : { text: T.textSec, bg: "#F1F5F9" });
}

// Live TAT month table metrics
const LIVE_TAT_METRICS = [
  { key: "fhTotal",   label: "FH Properties", color: "#FF6B00", bg: "#FFF0E6" },
  { key: "liveCount", label: "↳ OTA Live",    color: "#16A34A", bg: "#DCFCE7" },
  { key: "d0_7",      label: "  0–7 days",    color: "#15803D", bg: "#DCFCE7" },
  { key: "d8_15",     label: "  8–15 days",   color: "#B45309", bg: "#FEF3C7" },
  { key: "d16_30",    label: "  16–30 days",  color: "#C2410C", bg: "#FFEDD5" },
  { key: "d31_60",    label: "  31–60 days",  color: "#DC2626", bg: "#FEE2E2" },
  { key: "d60p",      label: "  60+ days",    color: "#7F1D1D", bg: "#FEE2E2" },
  { key: "avgTat",    label: "  Avg TAT",     color: "#6366F1", bg: "#EEF2FF", fmt: (v: number) => `${v}d` },
] as const;

// Not-live pending metrics (wider buckets — pending tends to be longer)
const NL_TAT_METRICS = [
  { key: "fhTotal",    label: "FH Properties", color: "#FF6B00", bg: "#FFF0E6" },
  { key: "count",      label: "↳ Not Live",    color: "#DC2626", bg: "#FEE2E2" },
  { key: "d0_15",      label: "  0–15 days",   color: "#16A34A", bg: "#DCFCE7" },
  { key: "d16_30",     label: "  16–30 days",  color: "#B45309", bg: "#FEF3C7" },
  { key: "d31_60",     label: "  31–60 days",  color: "#C2410C", bg: "#FFEDD5" },
  { key: "d61_90",     label: "  61–90 days",   color: "#DC2626", bg: "#FEE2E2" },
  { key: "d90p",       label: "  90+ days",     color: "#7F1D1D", bg: "#FEE2E2" },
  { key: "avgPending", label: "  Avg Pending",  color: "#6366F1", bg: "#EEF2FF", fmt: (v: number) => `${v}d` },
] as const;

interface CatRow   { ota: string; live: number; exception: number; inProcess: number; tatExhausted: number; }
interface TatStat  { avgTat: number; d0_7: number; d8_15: number; d16_30: number; d31_60: number; d60p: number; }
interface DashData { pivot: Record<string, Record<string, number>>; columns: string[]; categories: CatRow[]; tatThreshold: number; tatBreakdown: Record<string, Record<string, number>>; tatSubStatusList: string[]; tatStats: Record<string, TatStat>; ssStatusPivot: Record<string, Record<string, Record<string, number>>>; }
interface NLRow    { propertyId: string; name: string; city: string; fhLiveDate: string|null; ota: string; status: string|null; subStatus: string|null; liveDate: string|null; tat: number; tatError?: number; }
type NLSortKey = "status" | "subStatus" | "liveDate" | "tat";
interface NLData   { rows: NLRow[]; total: number; page: number; pages: number; }
interface OvrRow   { fhId: string; fhLiveDate: string|null; ota: string; tat: number; }

function fmtDate(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
}

const card: React.CSSProperties = { background: T.cardBg, border: `1px solid ${T.cardBdr}`, borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" };
const cardHeader: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", borderBottom: `1px solid ${T.cardBdr}`, background: T.headerBg };

type RnsRow = { quarter: string; cmMTD: number; cmTotal: number; lmMTD: number; lmTotal: number };

// Month-wise TAT table — months as rows, metrics as columns
function MergedMonthTable({ title, rows, onMonthClick }: {
  title: string;
  rows: Array<Record<string, number | string>>;
  onMonthClick?: (month: string) => void;
}) {
  if (rows.length === 0) return null;

  const [showAllMonths, setShowAllMonths] = useState(false);
  const sorted = [...rows].reverse();
  const visibleRows = showAllMonths ? sorted : sorted.slice(0, 4);

  // Color scheme: indigo/blue for FH, red for Not Live
  const FH_COLOR  = "#2563EB";
  const FH_BG     = "#EFF6FF";
  const FH_BG2    = "#DBEAFE";

  const TH = (opts?: { color?: string; bg?: string }): React.CSSProperties => ({
    padding: "7px 10px", fontSize: 9, fontWeight: 700,
    color: opts?.color ?? T.textSec, background: opts?.bg ?? T.headerBg,
    borderBottom: `1px solid ${T.cardBdr}`, borderRight: `1px solid ${T.cardBdr}`,
    textAlign: "center", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.05em",
  });
  const TD = (opts?: { bg?: string; bold?: boolean; color?: string }): React.CSSProperties => ({
    padding: "6px 10px", textAlign: "center",
    borderRight: `1px solid ${T.cardBdr}`, borderBottom: `1px solid ${T.cardBdr}`,
    background: opts?.bg, fontWeight: opts?.bold ? 700 : 400, color: opts?.color,
  });
  const SL: React.CSSProperties = { padding: "7px 14px", whiteSpace: "nowrap", borderRight: `2px solid ${T.cardBdr}`, borderBottom: `1px solid ${T.cardBdr}`, fontWeight: 700, color: T.textPri, fontSize: 11, position: "sticky", left: 0, zIndex: 1, background: T.cardBg };

  function Num({ v, color, bg, suffix, onClick }: { v: number; color: string; bg: string; suffix?: string; onClick?: () => void }) {
    if (!v) return <span style={{ color: "#D1D5DB", fontSize: 10 }}>—</span>;
    return (
      <span
        onClick={onClick}
        style={{ fontWeight: 700, fontSize: 11, color, background: bg, border: `1px solid ${color}25`, borderRadius: 4, padding: "1px 7px", cursor: onClick ? "pointer" : "default", textDecoration: onClick ? "underline" : "none", textDecorationColor: `${color}66` }}
      >
        {v}{suffix ?? ""}
      </span>
    );
  }

  const sum  = (key: string) => sorted.reduce((s, r) => s + ((r[key] as number) || 0), 0);
  const wavg = (key: string, cnt: string) => { const t = sum(cnt); return t ? Math.round(sorted.reduce((s, r) => s + ((r[key] as number)||0) * ((r[cnt] as number)||0), 0) / t) : 0; };

  const NL_BKTS = [
    { key: "nl_d0_15",  label: "0–15d",  color: "#16A34A", bg: "#DCFCE7" },
    { key: "nl_d16_30", label: "16–30d", color: "#B45309", bg: "#FEF3C7" },
    { key: "nl_d31_60", label: "31–60d", color: "#C2410C", bg: "#FFEDD5" },
    { key: "nl_d61_90", label: "61–90d", color: "#DC2626", bg: "#FEE2E2" },
    { key: "nl_d90p",   label: "90+d",   color: "#7F1D1D", bg: "#FEE2E2" },
  ];

  return (
    <div style={card}>
      <div style={cardHeader}>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.textPri }}>{title}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {onMonthClick && <span style={{ fontSize: 10, color: FH_COLOR, background: FH_BG, padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>Click a row to filter properties</span>}
          <span style={{ fontSize: 10, color: T.textMut }}>Last 12 months · newest first</span>
          {sorted.length > 4 && (
            <button
              onClick={() => setShowAllMonths(v => !v)}
              style={{ padding: "4px 10px", borderRadius: 999, border: `1px solid ${T.cardBdr}`, background: "#FFF", color: T.textSec, fontSize: 10, fontWeight: 700, cursor: "pointer" }}
            >
              {showAllMonths ? "Show latest 4" : `Show older ${sorted.length - 4}`}
            </button>
          )}
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%" }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{ ...TH(), textAlign: "left", minWidth: 90, position: "sticky", left: 0, zIndex: 3, verticalAlign: "bottom" }}>Month</th>
              <th rowSpan={2} style={{ ...TH({ color: FH_COLOR, bg: FH_BG }), verticalAlign: "bottom", minWidth: 60 }}>FH Props</th>
              <th rowSpan={2} style={{ ...TH({ color: T.notLive, bg: T.notLiveL }), verticalAlign: "bottom", minWidth: 60 }}>Not Live</th>
              <th colSpan={5} style={TH({ color: T.textSec, bg: "#F1F5F9" })}>Pending Breakdown</th>
              <th rowSpan={2} style={{ ...TH({ color: "#6366F1", bg: "#EEF2FF" }), verticalAlign: "bottom", borderRight: "none" }}>Avg Pend</th>
            </tr>
            <tr>
              {NL_BKTS.map(b => <th key={b.key} style={TH({ color: b.color, bg: b.bg + "88" })}>{b.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r, i) => (
              <tr
                key={r.quarter as string}
                style={{ background: i % 2 === 0 ? T.cardBg : T.rowAlt, cursor: onMonthClick ? "pointer" : "default" }}
                onClick={onMonthClick ? () => onMonthClick(r.quarter as string) : undefined}
                title={onMonthClick ? `Filter properties for ${r.quarter as string}` : undefined}
              >
                <td style={{ ...SL, background: i % 2 === 0 ? T.cardBg : T.rowAlt, color: onMonthClick ? FH_COLOR : T.textPri }}>{r.quarter as string}</td>
                <td style={TD({ bg: FH_BG })}><Num v={(r.fhTotal as number)||0} color={FH_COLOR} bg={FH_BG2} /></td>
                <td style={TD({ bg: T.notLiveL })}><Num v={(r.nlCount as number)||0} color={T.notLive} bg="#FECACA" /></td>
                {NL_BKTS.map(b => <td key={b.key} style={TD()}><Num v={(r[b.key] as number)||0} color={b.color} bg={b.bg} /></td>)}
                <td style={{ ...TD({ bg: "#EEF2FF" }), borderRight: "none" }}><Num v={(r.avgPending as number)||0} color="#6366F1" bg="#E0E7FF" suffix="d" /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: FH_BG, borderTop: `2px solid ${FH_COLOR}33` }}>
              <td style={{ ...SL, background: FH_BG, color: FH_COLOR }}>Total</td>
              <td style={TD({ bg: FH_BG2, bold: true })}><span style={{ fontWeight: 900, color: FH_COLOR }}>{sum("fhTotal") || "—"}</span></td>
              <td style={TD({ bg: T.notLiveL })}><Num v={sum("nlCount")} color={T.notLive} bg="#FECACA" /></td>
              {NL_BKTS.map(b => <td key={b.key} style={TD({ bg: FH_BG })}><Num v={sum(b.key)} color={b.color} bg={b.bg} /></td>)}
              <td style={{ ...TD({ bg: "#EEF2FF" }), borderRight: "none" }}><Num v={wavg("avgPending","nlCount")} color="#6366F1" bg="#E0E7FF" suffix="d" /></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
function MonthTable({ title, subtitle, rows, metrics, emptyMsg }: {
  title: string;
  subtitle?: string;
  rows: Record<string, number | string>[];
  metrics: readonly { key: string; label: string; color: string; bg: string; fmt?: (v: number) => string }[];
  emptyMsg?: string;
}) {
  if (rows.length === 0) return emptyMsg ? <div style={{ fontSize: 11, color: T.textMut, padding: "14px 0" }}>{emptyMsg}</div> : null;

  const totals: Record<string, number> = {};
  for (const m of metrics) {
    totals[m.key] = rows.reduce((s, r) => s + ((r[m.key] as number) || 0), 0);
    if (m.key === "avgTat" || m.key === "avgPending") {
      const countKey = m.key === "avgTat" ? "liveCount" : "count";
      const totalCount = rows.reduce((s, r) => s + ((r[countKey] as number) || 0), 0);
      totals[m.key] = totalCount > 0 ? Math.round(rows.reduce((s, r) => s + ((r[m.key] as number) || 0) * ((r[countKey] as number) || 0), 0) / totalCount) : 0;
    }
  }

  return (
    <div style={card}>
      <div style={cardHeader}>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.textPri }}>{title}</span>
        {subtitle && <span style={{ fontSize: 10, color: T.textMut }}>{subtitle}</span>}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%" }}>
          <thead>
            <tr style={{ background: T.headerBg }}>
              <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: 700, color: T.textSec, borderBottom: `1px solid ${T.cardBdr}`, borderRight: `1px solid ${T.cardBdr}`, minWidth: 120, whiteSpace: "nowrap", fontSize: 10 }}>Metric</th>
              {(rows as Array<Record<string, unknown>>).map(r => (
                <th key={r.quarter as string} style={{ padding: "8px 14px", fontSize: 10, fontWeight: 700, color: T.textSec, background: T.headerBg, borderBottom: `1px solid ${T.cardBdr}`, borderRight: `1px solid ${T.cardBdr}`, textAlign: "center", whiteSpace: "nowrap" }}>
                  {r.quarter as string}
                </th>
              ))}
              <th style={{ padding: "8px 14px", fontSize: 10, fontWeight: 700, color: T.orange, background: T.orangeL, borderBottom: `1px solid ${T.cardBdr}`, textAlign: "center", whiteSpace: "nowrap" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((m, mi) => {
              const isFhTotal  = m.key === "fhTotal";
              const isSubFirst = mi > 0 && metrics[mi - 1].key === "fhTotal";
              return (
                <tr key={m.key} style={{
                  borderBottom: isFhTotal ? `2px solid ${T.orange}55` : `1px solid ${T.cardBdr}`,
                  borderTop: isSubFirst ? `2px solid ${T.orange}55` : undefined,
                  background: isFhTotal ? T.orangeL : mi % 2 === 0 ? T.cardBg : T.rowAlt,
                }}>
                  <td style={{ padding: isFhTotal ? "9px 14px" : "7px 14px 7px 22px", borderRight: `1px solid ${T.cardBdr}`, whiteSpace: "nowrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ width: isFhTotal ? 10 : 7, height: isFhTotal ? 10 : 7, borderRadius: isFhTotal ? 3 : 2, background: m.color, flexShrink: 0 }} />
                      <span style={{ fontSize: isFhTotal ? 12 : 11, fontWeight: isFhTotal ? 800 : 600, color: m.color }}>{m.label.trimStart()}</span>
                    </div>
                  </td>
                  {rows.map(r => {
                    const v = (r[m.key] as number) || 0;
                    const display = m.fmt ? m.fmt(v) : String(v);
                    return (
                      <td key={r.quarter as string} style={{ padding: isFhTotal ? "9px 14px" : "7px 14px", textAlign: "center", borderRight: `1px solid ${T.cardBdr}`, background: isFhTotal ? T.orangeL : undefined }}>
                        {v > 0
                          ? <span style={{ fontWeight: isFhTotal ? 900 : 700, fontSize: isFhTotal ? 13 : 11, color: m.color, background: m.bg, border: `1px solid ${m.color}30`, borderRadius: 5, padding: isFhTotal ? "3px 11px" : "2px 9px" }}>{display}</span>
                          : <span style={{ color: T.textMut }}>—</span>}
                      </td>
                    );
                  })}
                  <td style={{ padding: isFhTotal ? "9px 14px" : "7px 14px", textAlign: "center", background: isFhTotal ? T.orangeT : T.orangeL }}>
                    {(() => {
                      const v = totals[m.key] || 0;
                      const display = m.fmt ? m.fmt(v) : String(v);
                      return v > 0
                        ? <span style={{ fontWeight: isFhTotal ? 900 : 800, fontSize: isFhTotal ? 14 : 11, color: T.orange, background: T.orangeT, border: `1px solid ${T.orange}30`, borderRadius: 5, padding: isFhTotal ? "3px 11px" : "2px 9px" }}>{display}</span>
                        : <span style={{ color: T.textMut }}>—</span>;
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// CheckboxDropdown
function CheckboxDropdown({ label, options, selected, onChange }: {
  label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const active = selected.length > 0;
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(x => !x)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 9px", fontSize: 11, fontWeight: 600, cursor: "pointer", border: `1px solid ${active ? T.orange : T.cardBdr}`, borderRadius: 6, background: active ? T.orangeL : "#FFF", color: active ? T.orange : T.textSec }}>
        {label}
        {active && <span style={{ background: T.orange, color: "#FFF", fontSize: 9, fontWeight: 800, borderRadius: 99, padding: "1px 5px", lineHeight: 1.4 }}>{selected.length}</span>}
        <span style={{ fontSize: 9, color: active ? T.orange : T.textMut }}>▾</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 200, background: "#FFF", border: `1px solid ${T.cardBdr}`, borderRadius: 8, boxShadow: "0 6px 20px rgba(0,0,0,0.12)", minWidth: 190, padding: "6px 0", maxHeight: 280, overflowY: "auto" }}>
          {options.map(opt => {
            const checked = selected.includes(opt);
            return (
              <label key={opt} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", cursor: "pointer", fontSize: 11, userSelect: "none", color: checked ? T.orange : T.textPri, background: checked ? T.orangeL : "transparent" }}>
                <input type="checkbox" checked={checked} onChange={() => onChange(checked ? selected.filter(s => s !== opt) : [...selected, opt])} style={{ accentColor: T.orange, width: 13, height: 13, cursor: "pointer" }} />
                {opt}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main OtaDetailView Component ──────────────────────────────────────────────

export default function OtaDetailView({ otaName }: { otaName: string }) {
  const otaColor = OTA_COLORS[otaName] ?? T.orange;

  const [dashData,   setDashData]   = useState<DashData | null>(null);
  const [ovrLive,    setOvrLive]    = useState<OvrRow[]>([]);
  const [ovrNotLive, setOvrNotLive] = useState<OvrRow[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  const [rnsMonthly, setRnsMonthly] = useState<Record<string, { cmMTD: number; cmTotal: number; lmMTD: number; lmTotal: number }>>({});
  const [revMonthly, setRevMonthly] = useState<Record<string, { cmMTD: number; cmTotal: number; lmMTD: number; lmTotal: number }>>({});

  const [propTab,   setPropTab]   = useState<"notlive" | "live">("live");

  // OTA Metrics (quality KPIs)
  type MetricAgg = { value: string; count: number }[];
  type MetricProp = { propertyId: string; name: string; city: string; subStatus: string | null; liveDate: string | null; metrics: Record<string, string> };
  const [metricsAgg,   setMetricsAgg]   = useState<Record<string, MetricAgg>>({});
  const [metricsProps, setMetricsProps] = useState<MetricProp[]>([]);
  const [metricsTab,   setMetricsTab]   = useState<"agg" | "props">("agg");

  const [nlData,    setNlData]    = useState<NLData | null>(null);
  const [nlLoading, setNlLoading] = useState(true);
  const [nlSearch,  setNlSearch]  = useState("");
  const [nlCategory,setNlCat]     = useState("");
  const [nlSss,     setNlSss]     = useState<string[]>([]);
  const [nlFhMonth, setNlFhMonth] = useState("");
  const [nlSortBy,  setNlSortBy]  = useState<NLSortKey>("tat");
  const [nlSortDir, setNlSortDir] = useState<"asc" | "desc">("desc");
  const [ssActiveGroup, setSsActiveGroup] = useState<string | null>(null);
  const [nlPage,    setNlPage]    = useState(1);

  const [liveData,    setLiveData]    = useState<NLData | null>(null);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveSearch,  setLiveSearch]  = useState("");
  const [liveSortBy,  setLiveSortBy]  = useState<NLSortKey>("liveDate");
  const [liveSortDir, setLiveSortDir] = useState<"asc" | "desc">("desc");
  const [livePage,    setLivePage]    = useState(1);

  const nlSortedRows = useMemo(() => {
    if (!nlData?.rows) return [];
    return [...nlData.rows].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      if (nlSortBy === "status")    { av = (a.status    ?? "").toLowerCase(); bv = (b.status    ?? "").toLowerCase(); }
      else if (nlSortBy === "subStatus") { av = (a.subStatus ?? "").toLowerCase(); bv = (b.subStatus ?? "").toLowerCase(); }
      else if (nlSortBy === "liveDate")  { av = a.liveDate ? new Date(a.liveDate).getTime() : -1; bv = b.liveDate ? new Date(b.liveDate).getTime() : -1; }
      else { av = a.tat ?? -1; bv = b.tat ?? -1; }
      if (av < bv) return nlSortDir === "asc" ? -1 : 1;
      if (av > bv) return nlSortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [nlData?.rows, nlSortBy, nlSortDir]);

  function nlToggleSort(key: NLSortKey) {
    if (nlSortBy === key) { setNlSortDir(d => d === "asc" ? "desc" : "asc"); return; }
    setNlSortBy(key); setNlSortDir(key === "tat" ? "desc" : "asc");
  }

  const liveSortedRows = useMemo(() => {
    if (!liveData?.rows) return [];
    return [...liveData.rows].sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";
      if (liveSortBy === "status")    { av = (a.status ?? "").toLowerCase(); bv = (b.status ?? "").toLowerCase(); }
      else if (liveSortBy === "subStatus") { av = (a.subStatus ?? "").toLowerCase(); bv = (b.subStatus ?? "").toLowerCase(); }
      else if (liveSortBy === "liveDate")  { av = a.liveDate ? new Date(a.liveDate).getTime() : -1; bv = b.liveDate ? new Date(b.liveDate).getTime() : -1; }
      else { av = a.tat ?? -1; bv = b.tat ?? -1; }
      if (av < bv) return liveSortDir === "asc" ? -1 : 1;
      if (av > bv) return liveSortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [liveData?.rows, liveSortBy, liveSortDir]);

  function liveToggleSort(key: NLSortKey) {
    if (liveSortBy === key) { setLiveSortDir(d => d === "asc" ? "desc" : "asc"); return; }
    setLiveSortBy(key); setLiveSortDir(key === "tat" ? "desc" : "asc");
  }

  function loadLive(page = 1, search = liveSearch) {
    setLiveLoading(true);
    const p = new URLSearchParams({ otas: otaName, category: "live", page: String(page), size: "50" });
    if (search) p.set("search", search);
    fetch(`/api/listing-dashboard/not-live?${p}`)
      .then(r => r.json())
      .then(d => { setLiveData(d); setLivePage(page); })
      .catch(() => {})
      .finally(() => setLiveLoading(false));
  }

  function loadNl(page = 1, search = nlSearch, category = nlCategory, sss = nlSss, fhMonth = nlFhMonth) {
    setNlLoading(true);
    const p = new URLSearchParams({ otas: otaName, page: String(page), size: "50" });
    if (search)     p.set("search", search);
    if (category)   p.set("category", category);
    if (sss.length) p.set("sss", sss.join(","));
    if (fhMonth)    p.set("fhMonth", fhMonth);
    fetch(`/api/listing-dashboard/not-live?${p}`)
      .then(r => r.json())
      .then(d => { setNlData(d); setNlPage(page); })
      .catch(() => {})
      .finally(() => setNlLoading(false));
  }

  function load() {
    setLoading(true); setError(null);
    fetch("/api/listing-dashboard")
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setDashData(d); })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
    fetch("/api/overdue-listings")
      .then(r => r.json())
      .then(d => { setOvrLive(d.rows ?? []); setOvrNotLive(d.notLiveRows ?? []); })
      .catch(() => {});
    fetch("/api/dashboard-data")
      .then(r => r.json())
      .then(d => {
        const extract = (src: unknown) => {
          const map = (src ?? {}) as Record<string, Record<string, { cmMTD: number; cmTotal?: number; lmMTD?: number; lmTotal?: number }>>;
          const result: Record<string, { cmMTD: number; cmTotal: number; lmMTD: number; lmTotal: number }> = {};
          for (const [mk, otas] of Object.entries(map)) {
            const entry = otas[otaName];
            if (entry) result[mk] = { cmMTD: entry.cmMTD ?? 0, cmTotal: entry.cmTotal ?? entry.cmMTD ?? 0, lmMTD: entry.lmMTD ?? 0, lmTotal: entry.lmTotal ?? 0 };
          }
          return result;
        };
        setRnsMonthly(extract(d.rnsLiveMonthly));
        setRevMonthly(extract(d.revLiveMonthly));
      })
      .catch(() => {});
    loadNl(1, "", "", []);
    loadLive(1, "");
    fetch(`/api/ota-metrics-summary?ota=${encodeURIComponent(otaName)}`)
      .then(r => r.json())
      .then(d => { setMetricsAgg(d.agg ?? {}); setMetricsProps(d.properties ?? []); })
      .catch(() => {});
  }

  useEffect(() => {
    setDashData(null); setOvrLive([]); setOvrNotLive([]);
    setRnsMonthly({}); setRevMonthly({}); setNlData(null); setLiveData(null);
    setNlCat(""); setNlSearch(""); setNlSss([]); setNlFhMonth(""); setSsActiveGroup(null);
    setLiveSearch(""); setPropTab("live");
    setMetricsAgg({}); setMetricsProps([]);
    load();
  }, [otaName]); // eslint-disable-line react-hooks/exhaustive-deps

  function goToCategory(cat: string) {
    setNlCat(cat); setNlSearch(""); setNlSss([]); setNlFhMonth("");
    loadNl(1, "", cat, [], "");
    setTimeout(() => document.getElementById("prop-section")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  }

  function goToMonth(month: string) {
    setNlFhMonth(month); setNlSearch(""); setNlCat(""); setNlSss([]);
    loadNl(1, "", "", [], month);
    setTimeout(() => document.getElementById("prop-section")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  }

  function goToSss(subs: string[]) {
    setNlSss(subs); setNlSearch(""); setNlCat(""); setNlFhMonth("");
    loadNl(1, "", "", subs, "");
    setTimeout(() => document.getElementById("prop-section")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  }

  // Live TAT month-wise data
  const liveMonthData = useMemo(() => {
    const oneYearAgo = new Date(); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const cutoff = oneYearAgo.toISOString().slice(0, 10);
    const liveSubset = ovrLive.filter(r => r.ota === otaName);
    const nlSubset   = ovrNotLive.filter(r => r.ota === otaName);
    function getKey(d: string | null) { if (!d || d < cutoff) return null; const dt = new Date(d); return isNaN(dt.getTime()) ? null : `${MONTHS_IDX[dt.getMonth()]} ${dt.getFullYear()}`; }
    const liveByM: Record<string, { fhId: string; tat: number }[]> = {};
    for (const r of liveSubset) { const k = getKey(r.fhLiveDate); if (k) (liveByM[k] ??= []).push({ fhId: r.fhId, tat: r.tat }); }
    const nlByM: Record<string, { fhId: string; tat: number }[]> = {};
    for (const r of nlSubset) { const k = getKey(r.fhLiveDate); if (k) (nlByM[k] ??= []).push({ fhId: r.fhId, tat: r.tat }); }
    const months = new Set([...Object.keys(liveByM), ...Object.keys(nlByM)]);
    const rows: Record<string, number | string>[] = [];
    for (const month of months) {
      const propTat: Record<string, { sum: number; cnt: number }> = {};
      for (const r of liveByM[month] ?? []) { (propTat[r.fhId] ??= { sum: 0, cnt: 0 }); propTat[r.fhId].sum += r.tat; propTat[r.fhId].cnt++; }
      const liveSet = new Set(Object.keys(propTat));
      let d0_7 = 0, d8_15 = 0, d16_30 = 0, d31_60 = 0, d60p = 0, tatSum = 0;
      for (const s of Object.values(propTat)) { const avg = Math.round(s.sum / s.cnt); tatSum += avg; if (avg <= 7) d0_7++; else if (avg <= 15) d8_15++; else if (avg <= 30) d16_30++; else if (avg <= 60) d31_60++; else d60p++; }
      const liveCount = liveSet.size;
      const fhTotal = new Set([...(liveByM[month] ?? []).map(r => r.fhId), ...(nlByM[month] ?? []).map(r => r.fhId)]).size;
      rows.push({ quarter: month, fhTotal, liveCount, d0_7, d8_15, d16_30, d31_60, d60p, avgTat: liveCount > 0 ? Math.round(tatSum / liveCount) : 0 });
    }
    rows.sort((a, b) => { const [am, ay] = String(a.quarter).split(" "); const [bm, by] = String(b.quarter).split(" "); return Number(ay) !== Number(by) ? Number(ay) - Number(by) : MONTHS_IDX.indexOf(am ?? "") - MONTHS_IDX.indexOf(bm ?? ""); });
    return rows;
  }, [ovrLive, ovrNotLive, otaName]);

  // Not-live pending TAT month-wise data (fhLiveDate → today)
  const nlMonthData = useMemo(() => {
    const oneYearAgo = new Date(); oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const cutoff = oneYearAgo.toISOString().slice(0, 10);
    const subset   = ovrNotLive.filter(r => r.ota === otaName);
    const liveSet  = ovrLive.filter(r => r.ota === otaName);
    function getKey(d: string | null) { if (!d || d < cutoff) return null; const dt = new Date(d); return isNaN(dt.getTime()) ? null : `${MONTHS_IDX[dt.getMonth()]} ${dt.getFullYear()}`; }
    const byMonth: Record<string, Record<string, number>> = {};
    for (const r of subset) {
      const k = getKey(r.fhLiveDate); if (!k) continue;
      if (!byMonth[k]) byMonth[k] = {};
      byMonth[k][r.fhId] = Math.max(byMonth[k][r.fhId] ?? 0, r.tat);
    }
    const liveByM: Record<string, Set<string>> = {};
    for (const r of liveSet) { const k = getKey(r.fhLiveDate); if (k) (liveByM[k] ??= new Set()).add(r.fhId); }

    const rows: Record<string, number | string>[] = Object.entries(byMonth).map(([month, propMap]) => {
      const tats = Object.values(propMap);
      const count = tats.length;
      const d0_15  = tats.filter(t => t <= 15).length;
      const d16_30 = tats.filter(t => t > 15 && t <= 30).length;
      const d31_60 = tats.filter(t => t > 30 && t <= 60).length;
      const d61_90 = tats.filter(t => t > 60 && t <= 90).length;
      const d90p   = tats.filter(t => t > 90).length;
      const avgPending = count > 0 ? Math.round(tats.reduce((s, t) => s + t, 0) / count) : 0;
      const fhTotal = new Set([...Object.keys(propMap), ...(liveByM[month] ?? new Set())]).size;
      return { quarter: month, fhTotal, count, d0_15, d16_30, d31_60, d61_90, d90p, avgPending };
    });
    rows.sort((a, b) => { const [am, ay] = String(a.quarter).split(" "); const [bm, by] = String(b.quarter).split(" "); return Number(ay) !== Number(by) ? Number(ay) - Number(by) : MONTHS_IDX.indexOf(am ?? "") - MONTHS_IDX.indexOf(bm ?? ""); });
    return rows;
  }, [ovrNotLive, ovrLive, otaName]);

  // RNS / Revenue month rows — convert "Mar-26" → "Mar 2026"
  function toRows(map: Record<string, { cmMTD: number; cmTotal: number; lmMTD: number; lmTotal: number }>): RnsRow[] {
    return Object.entries(map).map(([mk, entry]) => {
      const [mon, yr] = mk.split("-");
      const quarter = `${mon ?? ""} ${2000 + parseInt(yr ?? "0")}`;
      return { quarter, cmMTD: entry.cmMTD, cmTotal: entry.cmTotal, lmMTD: entry.lmMTD, lmTotal: entry.lmTotal };
    }).sort((a, b) => {
      const [am, ay] = a.quarter.split(" "); const [bm, by] = b.quarter.split(" ");
      return Number(ay) !== Number(by) ? Number(ay) - Number(by) : MONTHS_IDX.indexOf(am ?? "") - MONTHS_IDX.indexOf(bm ?? "");
    });
  }
  const rnsRows = useMemo(() => toRows(rnsMonthly), [rnsMonthly]); // eslint-disable-line react-hooks/exhaustive-deps
  const revRows = useMemo(() => toRows(revMonthly), [revMonthly]); // eslint-disable-line react-hooks/exhaustive-deps

  // Merged month data (live + not-live combined by month)
  const mergedMonthData = useMemo(() => {
    return liveMonthData.map(r => {
      const month = String(r.quarter);
      const nl    = nlMonthData.find(n => String(n.quarter) === month);
      return {
        quarter:    month,
        fhTotal:    (r.fhTotal    as number) || 0,
        liveCount:  (r.liveCount  as number) || 0,
        l_d0_7:    (r.d0_7      as number) || 0,
        l_d8_15:   (r.d8_15     as number) || 0,
        l_d16_30:  (r.d16_30    as number) || 0,
        l_d31_60:  (r.d31_60    as number) || 0,
        l_d60p:    (r.d60p      as number) || 0,
        avgTat:    (r.avgTat     as number) || 0,
        nlCount:   (nl?.count    as number) || 0,
        nl_d0_15:  (nl?.d0_15   as number) || 0,
        nl_d16_30: (nl?.d16_30  as number) || 0,
        nl_d31_60: (nl?.d31_60  as number) || 0,
        nl_d61_90: (nl?.d61_90  as number) || 0,
        nl_d90p:   (nl?.d90p    as number) || 0,
        avgPending:(nl?.avgPending as number) || 0,
      };
    });
  }, [liveMonthData, nlMonthData]);

  const catRow       = dashData?.categories.find(r => r.ota === otaName);
  const live         = catRow?.live          ?? 0;
  const exception    = catRow?.exception     ?? 0;
  const inProcess    = catRow?.inProcess     ?? 0;
  const tatExhausted = catRow?.tatExhausted  ?? 0;
  const total        = live + exception + inProcess + tatExhausted;
  const livePct      = total > 0 ? ((live + exception) / total) * 100 : 0;
  const tatStat      = dashData?.tatStats[otaName];

  const KPI_TILES = [
    { label: "Total",         value: total,                     color: T.orange,  bg: T.orangeL,  cat: "all"          },
    { label: "Live %",        value: livePct.toFixed(1) + "%",  color: T.live,    bg: T.liveL,    cat: null           },
    { label: "Live",          value: live,                      color: T.live,    bg: T.liveL,    cat: "live"         },
    { label: "Exception",     value: exception,                 color: "#B45309", bg: "#FEF3C7",  cat: "exception"    },
    { label: "In Process",    value: inProcess,                 color: "#1D4ED8", bg: "#DBEAFE",  cat: "inProcess"    },
    { label: "TAT Exhausted", value: tatExhausted,              color: T.notLive, bg: T.notLiveL, cat: "tatExhausted" },
    { label: "Avg TAT",       value: tatStat ? `${tatStat.avgTat}d` : "—", color: "#6366F1", bg: "#EEF2FF", cat: null },
  ] as const;

  const TAT_CHIPS = [
    { label: "Avg TAT", value: tatStat ? `${tatStat.avgTat}d` : "—", color: "#6366F1", bg: "#EEF2FF" },
    { label: "0–7d",    value: tatStat?.d0_7   ?? "—", color: "#16A34A", bg: "#DCFCE7" },
    { label: "8–15d",   value: tatStat?.d8_15  ?? "—", color: "#B45309", bg: "#FEF3C7" },
    { label: "16–30d",  value: tatStat?.d16_30 ?? "—", color: "#C2410C", bg: "#FFEDD5" },
    { label: "31–60d",  value: tatStat?.d31_60 ?? "—", color: "#DC2626", bg: "#FEE2E2" },
    { label: "60+d",    value: tatStat?.d60p   ?? "—", color: "#7F1D1D", bg: "#FEE2E2" },
  ];

  const CAT_LABELS: Record<string, string> = { live:"Live", exception:"Exception", inProcess:"In Process", tatExhausted:"TAT Exhausted", all:"All" };
  const ssOptions = dashData?.columns ?? [];

  if (!otaName || !OTA_COLORS[otaName]) return null;

  return (
    <div style={{ padding: "18px 22px", background: T.pageBg, minHeight: "100vh" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .nl-row:hover > td { background: #F8FAFD !important; }
        .kpi-tile { transition: filter 0.12s, transform 0.12s, box-shadow 0.12s; }
        .kpi-tile:hover { filter: brightness(0.97); transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0,0,0,0.10) !important; }
        .ss-card { box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05); }
        .ss-head-cell, .ss-body-cell, .ss-sticky-cell, .ss-total-cell, .ss-filter-btn {
          transition: background-color 160ms ease, color 160ms ease, opacity 160ms ease, box-shadow 160ms ease, transform 160ms ease;
        }
        .ss-filter-btn:hover { transform: translateY(-1px); }
        .ss-col-head:hover { filter: brightness(0.98); }
        .ss-detail-row:hover > td { background: #F8FAFC !important; }
        .ss-clickable-num { cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
        .ss-clickable-num:hover { opacity: 0.8; }
      `}</style>

      {/* Header + Tab Strip */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 3, height: 22, background: otaColor, borderRadius: 2 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: T.textPri }}>OTA Detail · listing analytics</span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {([
            { key: "live",    label: "Live",     count: liveData?.total, color: T.live,    bg: T.liveL   },
            { key: "notlive", label: "Not Live", count: nlData?.total,   color: T.notLive, bg: T.notLiveL },
          ] as const).map(tab => {
            const active = propTab === tab.key;
            return (
              <button key={tab.key} onClick={() => setPropTab(tab.key)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 16px", fontSize: 11, fontWeight: 700,
                  borderRadius: 999, border: `1px solid ${active ? tab.color : T.cardBdr}`,
                  background: active ? tab.color : "#FFFFFF", color: active ? "#FFFFFF" : T.textSec,
                  cursor: "pointer", transition: "all 0.13s" }}>
                {tab.label}
                {tab.count != null && <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 6px", borderRadius: 99, background: active ? "rgba(255,255,255,0.25)" : tab.bg, color: active ? "#FFFFFF" : tab.color }}>{tab.count.toLocaleString()}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {loading && <div style={{ textAlign: "center", padding: 60, color: T.textMut, fontSize: 12 }}><span style={{ display: "inline-block", animation: "spin 1s linear infinite", marginRight: 6 }}>⟳</span>Loading…</div>}
      {error   && <div style={{ padding: "8px 14px", background: T.notLiveL, border: "1px solid #FECACA", borderRadius: 8, fontSize: 11, color: T.notLive, marginBottom: 14 }}>⚠ {error}</div>}

      {dashData && propTab === "notlive" && (
        <>
          {/* KPI Tiles — compact horizontal */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {KPI_TILES.map(tile => {
              const isActive = tile.cat !== null && nlCategory === tile.cat;
              return (
                <div key={tile.label} className="kpi-tile"
                  onClick={tile.cat !== null ? () => goToCategory(tile.cat!) : undefined}
                  style={{ flex: "1 1 100px", background: T.cardBg, border: `1px solid ${isActive ? tile.color : T.cardBdr}`, borderLeft: `3px solid ${tile.color}`, borderRadius: 7, padding: "7px 12px", boxShadow: isActive ? `0 0 0 2px ${tile.color}22` : "0 1px 3px rgba(0,0,0,0.04)", cursor: tile.cat !== null ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: tile.color, textTransform: "uppercase", letterSpacing: "0.1em" }}>{tile.label}</span>
                  <span style={{ fontSize: 16, fontWeight: 900, color: tile.color, background: tile.bg, padding: "2px 10px", borderRadius: 5, lineHeight: 1.3 }}>{String(tile.value)}</span>
                </div>
              );
            })}
          </div>

          {/* Status × Sub-status */}
          {(() => {
            const xPivot = dashData.ssStatusPivot[otaName] ?? {};
            // ssCols: only columns with count > 0 for this OTA (used for dynamic "Pending at X")
            const ssCols    = dashData.columns.filter(col => (dashData.pivot[otaName]?.[col] ?? 0) > 0);
            // allSsCols: all sub-status columns that exist globally (used for static groups)
            const allSsCols = new Set(dashData.columns);

            const SS_COLS = [
              { label: "Live",              subs: ["Live", "FH Live"].filter(s => allSsCols.has(s)), color: "#16A34A", bg: "#DCFCE7" },
              { label: "Supply/Operations", subs: ["Supply/Operations"],                               color: "#6D28D9", bg: "#F5F3FF" },
              { label: "Revenue",           subs: ["Revenue"],                                         color: "#C2410C", bg: "#FFF7ED" },
              { label: "OTA Team",          subs: ["OTA Team"],                                        color: "#B45309", bg: "#FEF3C7" },
              ...ssCols.filter(s => s.startsWith("Pending at ")).map(s => ({
                label: s,
                subs:  [s],
                color: "#1D4ED8",
                bg:    "#DBEAFE",
              })),
              { label: "Exception",         subs: ["Exception"],                                       color: "#B45309", bg: "#FEF3C7" },
              { label: "Blank",             subs: ["Blank"],                                           color: "#64748B", bg: "#F1F5F9" },
              { label: "Churned",           subs: ["Churned"],                                         color: "#DC2626", bg: "#FEE2E2" },
            ].filter(c => c.subs.some(s => allSsCols.has(s)));

            const colData = SS_COLS.map(col => {
              const activeSubs = col.subs.filter(s => allSsCols.has(s));
              const colTotal = activeSubs.reduce((sum, ss) =>
                sum + Object.values(xPivot[ss] ?? {}).reduce((s, n) => s + n, 0), 0);
              const stBreakdown: Record<string, number> = {};
              for (const ss of activeSubs) {
                for (const [st, n] of Object.entries(xPivot[ss] ?? {})) {
                  stBreakdown[st] = (stBreakdown[st] ?? 0) + n;
                }
              }
              return { ...col, activeSubs, colTotal, stBreakdown };
            });

            const ssGrandTotal = colData.reduce((s, c) => s + c.colTotal, 0);
            const activeCol = colData.find(c => c.label === ssActiveGroup) ?? null;
            const detailRows = activeCol
              ? Object.entries(activeCol.stBreakdown)
                  .filter(([, n]) => n > 0)
                  .sort((a, b) => b[1] - a[1])
              : [];

            const STATUS_COLORS: Record<string, { text: string; bg: string }> = {
              "Live":     { text: "#16A34A", bg: "#DCFCE7" },
              "FH Live":  { text: "#16A34A", bg: "#DCFCE7" },
              "Not Live": { text: "#DC2626", bg: "#FEE2E2" },
              "Sold Out": { text: "#B45309", bg: "#FEF3C7" },
              "Blank":    { text: "#9CA3AF", bg: "#F3F4F6" },
            };
            function stColor(st: string) { return STATUS_COLORS[st] ?? { text: "#475569", bg: "#F1F5F9" }; }

            const TH: React.CSSProperties = {
              padding: "7px 11px",
              fontSize: 9,
              fontWeight: 700,
              background: "#F8FAFC",
              borderBottom: `1px solid ${T.cardBdr}`,
              borderRight: `1px solid ${T.cardBdr}`,
              textAlign: "center",
              whiteSpace: "nowrap",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              color: T.textSec,
            };

            return (
              <div style={{ ...card, marginBottom: 12, borderColor: "#D8E1EC", borderRadius: 12 }} className="ss-card">
                <div style={{ ...cardHeader, background: "linear-gradient(180deg, #FBFCFE 0%, #F8FAFC 100%)", borderBottom: `1px solid #D8E1EC` }}>
                  <button
                    onClick={() => setSsActiveGroup(null)}
                    style={{
                      border: "none",
                      background: "transparent",
                      padding: 0,
                      margin: 0,
                      fontSize: 11,
                      fontWeight: 700,
                      color: T.textPri,
                      cursor: activeCol ? "pointer" : "default",
                    }}
                    title={activeCol ? "Back to default view" : undefined}
                  >
                    Status × Sub-status
                  </button>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {activeCol && (
                      <button className="ss-filter-btn" onClick={() => setSsActiveGroup(null)} style={{ padding: "4px 12px", fontSize: 10, fontWeight: 700, border: `1px solid ${activeCol.color}35`, borderRadius: 999, background: activeCol.bg, color: activeCol.color, cursor: "pointer", boxShadow: `0 4px 12px ${activeCol.color}18`, display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, borderRadius: "50%", background: "#FFFFFFAA", border: `1px solid ${activeCol.color}25`, fontSize: 10, lineHeight: 1 }}>×</span>
                        Clear selection
                      </button>
                    )}
                    <span style={{ fontSize: 10, fontWeight: 800, color: T.orange, background: T.orangeL, border: `1px solid ${T.orange}30`, padding: "3px 10px", borderRadius: 99, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)" }}>
                      {ssGrandTotal} total
                    </span>
                  </div>
                </div>

                <div style={{ overflowX: "auto", background: "#FCFDFE" }}>
                  <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%" }}>
                    <thead>
                      <tr>
                        <th className="ss-head-cell" style={{ ...TH, textAlign: "left", minWidth: 100, position: "sticky", left: 0, zIndex: 3, background: "#F8FAFC" }}>
                          <span style={{ color: T.textMut, fontWeight: 400, fontStyle: "italic", textTransform: "none", letterSpacing: 0 }}>Status</span>
                        </th>
                        {colData.map(col => {
                          const isActive = ssActiveGroup === col.label;
                          return (
                            <th key={col.label}
                              className="ss-head-cell ss-col-head"
                              onClick={() => setSsActiveGroup(isActive ? null : col.label)}
                              style={{ ...TH, color: isActive ? "#FFF" : col.color, background: isActive ? col.color : col.bg, cursor: "pointer", minWidth: 72, boxShadow: isActive ? `inset 0 -2px 0 rgba(255,255,255,0.35), 0 6px 14px ${col.color}22` : "inset 0 -1px 0 rgba(255,255,255,0.5)" }}>
                              {col.label} · {col.colTotal}
                            </th>
                          );
                        })}
                        <th className="ss-head-cell" style={{ ...TH, color: T.orange, background: T.orangeL, borderRight: "none", minWidth: 60 }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ background: "#F8FAFC" }}>
                        <td className="ss-sticky-cell" style={{ padding: "8px 12px", fontWeight: 800, fontSize: 10, color: T.orange, textTransform: "uppercase", letterSpacing: "0.07em", borderRight: `1px solid ${T.cardBdr}`, position: "sticky", left: 0, zIndex: 1, background: "#F8FAFC" }}>Total</td>
                        {colData.map(col => {
                          const isActive = ssActiveGroup === col.label;
                          const dimmed = activeCol && !isActive;
                          return (
                            <td key={col.label} className="ss-body-cell" onClick={() => col.colTotal > 0 ? goToSss(col.activeSubs) : undefined}
                              style={{ padding: "8px 10px", textAlign: "center", borderRight: `1px solid ${T.cardBdr}`, background: col.bg + "55", opacity: dimmed ? 0.24 : 1, cursor: col.colTotal > 0 ? "pointer" : "default" }}>
                              {col.colTotal > 0
                                ? <span className="ss-clickable-num" style={{ fontWeight: 800, color: col.color, fontSize: 12, textDecorationColor: `${col.color}55` }}>{col.colTotal}</span>
                                : <span style={{ color: "#D1D5DB" }}>—</span>}
                            </td>
                          );
                        })}
                        <td className="ss-total-cell" onClick={() => goToSss([])}
                          style={{ padding: "8px 12px", textAlign: "center", background: T.orangeT, borderRight: "none", cursor: "pointer" }}>
                          <span className="ss-clickable-num" style={{ fontWeight: 900, color: T.orange, fontSize: 13, textDecorationColor: `${T.orange}55` }}>{ssGrandTotal}</span>
                        </td>
                      </tr>
                      {activeCol && detailRows.map(([st, n], ri) => {
                        const stSc  = stColor(st);
                        const rowBg = ri % 2 === 0 ? T.cardBg : T.rowAlt;
                        return (
                          <tr key={st} className="ss-detail-row" style={{ background: rowBg, borderBottom: `1px solid ${T.cardBdr}` }}>
                            <td className="ss-sticky-cell" style={{ padding: "7px 12px", fontWeight: 600, fontSize: 10, borderRight: `1px solid ${T.cardBdr}`, position: "sticky", left: 0, zIndex: 1, background: rowBg, whiteSpace: "nowrap" }}>
                              <span style={{ color: stSc.text, background: stSc.bg, padding: "3px 8px", borderRadius: 999, boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)" }}>{st}</span>
                            </td>
                            {colData.map(col => {
                              const isActive = ssActiveGroup === col.label;
                              const v = col.stBreakdown[st] ?? 0;
                              return (
                                <td key={col.label} className="ss-body-cell" style={{ padding: "7px 10px", textAlign: "center", borderRight: `1px solid ${T.cardBdr}`, background: v > 0 && isActive ? col.bg + "88" : undefined, opacity: isActive ? 1 : 0.24 }}>
                                  {v > 0 ? <span style={{ fontWeight: 700, fontSize: 12, color: col.color }}>{v}</span> : <span style={{ color: "#D1D5DB", fontSize: 10 }}>—</span>}
                                </td>
                              );
                            })}
                            <td className="ss-total-cell" onClick={() => activeCol && goToSss(activeCol.activeSubs)}
                              style={{ padding: "7px 12px", textAlign: "center", background: T.orangeL, borderRight: "none", cursor: "pointer" }}>
                              <span className="ss-clickable-num" style={{ fontWeight: 800, fontSize: 12, color: T.orange, textDecorationColor: `${T.orange}55` }}>{n}</span>
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

        </>
      )}

      {/* Live tab: TAT + month table + quality metrics + live properties */}
      {dashData && propTab === "live" && (
        <>
          {/* TAT KPI chips */}
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {TAT_CHIPS.map(chip => (
              <div key={chip.label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 8, background: chip.bg, border: `1px solid ${chip.color}30` }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: chip.color, textTransform: "uppercase", letterSpacing: "0.08em" }}>{chip.label}</span>
                <span style={{ fontSize: 15, fontWeight: 900, color: chip.color }}>{String(chip.value)}</span>
              </div>
            ))}
          </div>

          {/* Month-wise table */}
          {mergedMonthData.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <MergedMonthTable title={`Month-wise · ${otaName}`} rows={mergedMonthData} onMonthClick={goToMonth} />
            </div>
          )}

          {/* Quality Metrics (live tab) */}
          {Object.keys(metricsAgg).length > 0 && (
            <div style={{ background: "#FFFFFF", border: `1px solid ${T.cardBdr}`, borderRadius: 12, marginBottom: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(15,23,42,0.05)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", borderBottom: `1px solid ${T.cardBdr}`, background: T.headerBg }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.textPri }}>Quality Metrics · {otaName}</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {([{ key: "agg", label: "Summary" }, { key: "props", label: "Per Property" }] as const).map(tab => (
                    <button key={tab.key} onClick={() => setMetricsTab(tab.key)}
                      style={{ padding: "3px 11px", fontSize: 10, fontWeight: 700, borderRadius: 999, cursor: "pointer",
                        border: `1px solid ${metricsTab === tab.key ? otaColor : T.cardBdr}`,
                        background: metricsTab === tab.key ? otaColor : "#FFFFFF",
                        color: metricsTab === tab.key ? "#FFFFFF" : T.textSec }}>
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
              {metricsTab === "agg" && (
                <div style={{ padding: "12px 14px", display: "flex", flexWrap: "wrap", gap: 16 }}>
                  {Object.entries(metricsAgg).map(([key, vals]) => (
                    <div key={key} style={{ minWidth: 160 }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: T.textMut, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{key.replace(/_/g, " ")}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {vals.map(v => {
                          const isYes = ["yes","true","1","active","enrolled","level 1","level 2","level 3","preferred"].includes(v.value.toLowerCase());
                          const isNo  = ["no","false","0","inactive","not enrolled","not requested"].includes(v.value.toLowerCase());
                          const color = isYes ? "#16A34A" : isNo ? "#DC2626" : otaColor;
                          const bg    = isYes ? "#DCFCE7" : isNo ? "#FEE2E2" : `${otaColor}15`;
                          return (
                            <div key={v.value} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "4px 10px", borderRadius: 7, background: bg }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color }}>{v.value}</span>
                              <span style={{ fontSize: 13, fontWeight: 800, color, minWidth: 28, textAlign: "right" }}>{v.count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {metricsTab === "props" && (() => {
                const keys = Object.keys(metricsAgg);
                return (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%" }}>
                      <thead>
                        <tr style={{ background: T.headerBg }}>
                          {["ID", "Property", "City", ...keys.map(k => k.replace(/_/g, " ")), "Open"].map((h, i) => (
                            <th key={h} style={{ padding: "6px 12px", fontSize: 9, fontWeight: 700, color: T.textMut, textTransform: "uppercase", letterSpacing: "0.07em", textAlign: i <= 2 ? "left" : "center", borderBottom: `1px solid ${T.cardBdr}`, borderRight: `1px solid ${T.cardBdr}`, whiteSpace: "nowrap", background: T.headerBg }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {metricsProps.map((p, i) => (
                          <tr key={p.propertyId} style={{ borderBottom: `1px solid ${T.cardBdr}`, background: i % 2 === 0 ? "#FFFFFF" : T.headerBg }}>
                            <td style={{ padding: "6px 12px", borderRight: `1px solid ${T.cardBdr}`, fontFamily: "monospace", fontSize: 10, fontWeight: 700, color: otaColor }}>{p.propertyId}</td>
                            <td style={{ padding: "6px 12px", borderRight: `1px solid ${T.cardBdr}`, color: T.textPri, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.name}>{p.name}</td>
                            <td style={{ padding: "6px 12px", borderRight: `1px solid ${T.cardBdr}`, color: T.textSec, textAlign: "center" }}>{p.city || "—"}</td>
                            {keys.map(k => {
                              const val = p.metrics[k];
                              const isYes = val && ["yes","true","1","active","enrolled","level 1","level 2","level 3","preferred"].includes(val.toLowerCase());
                              const isNo  = val && ["no","false","0","inactive","not enrolled","not requested"].includes(val.toLowerCase());
                              const color = !val ? T.textMut : isYes ? "#16A34A" : isNo ? "#DC2626" : T.textSec;
                              const bg    = !val ? "transparent" : isYes ? "#DCFCE7" : isNo ? "#FEE2E2" : `${otaColor}12`;
                              return (
                                <td key={k} style={{ padding: "6px 12px", borderRight: `1px solid ${T.cardBdr}`, textAlign: "center" }}>
                                  {val ? <span style={{ fontSize: 10, fontWeight: 600, color, background: bg, padding: "2px 8px", borderRadius: 5 }}>{val}</span> : <span style={{ color: T.textMut }}>—</span>}
                                </td>
                              );
                            })}
                            <td style={{ padding: "6px 12px", textAlign: "center" }}>
                              <a href={`/crm/${p.propertyId}`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", padding: "3px 10px", fontSize: 10, fontWeight: 700, background: "#5D87FF18", color: "#5D87FF", border: "1px solid #5D87FF40", borderRadius: 6, textDecoration: "none" }}>Open ↗</a>
                            </td>
                          </tr>
                        ))}
                        {metricsProps.length === 0 && (
                          <tr><td colSpan={keys.length + 4} style={{ textAlign: "center", padding: 30, color: T.textMut, fontSize: 11 }}>No metric data entered yet</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
          )}
        </>
      )}

      {/* Properties Card */}
      <div id="prop-section" style={{ background: "#FFFFFF", border: `1px solid ${T.cardBdr}`, borderRadius: 18, overflow: "hidden", boxShadow: "0 4px 16px rgba(15,23,42,0.06)" }}>

        {/* Filter bar — Not Live */}
        {propTab === "notlive" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "10px 16px", borderBottom: `1px solid ${T.cardBdr}`, background: T.headerBg, flexWrap: "wrap", gap: 8 }}>
            {([
              { val: "",             label: "All" },
              { val: "inProcess",    label: "In Process" },
              { val: "tatExhausted", label: "TAT Exhausted" },
            ] as const).map(btn => (
              <button key={btn.val} onClick={() => { setNlCat(btn.val); loadNl(1, nlSearch, btn.val, nlSss); }}
                style={{ padding: "4px 10px", fontSize: 10, fontWeight: 700, borderRadius: 999, cursor: "pointer",
                  border: `1px solid ${nlCategory === btn.val ? T.orange : T.cardBdr}`,
                  background: nlCategory === btn.val ? T.orangeL : "#FFFFFF",
                  color: nlCategory === btn.val ? T.orange : T.textSec }}>
                {btn.label}
              </button>
            ))}
            <input value={nlSearch} onChange={e => { setNlSearch(e.target.value); loadNl(1, e.target.value, nlCategory, nlSss); }}
              placeholder="Search…"
              style={{ padding: "5px 10px", fontSize: 11, border: `1px solid ${T.cardBdr}`, borderRadius: 999, outline: "none", width: 160, color: T.textPri, background: "#FFFFFF" }} />
            {ssOptions.length > 0 && (
              <CheckboxDropdown label="Sub-Status" options={ssOptions} selected={nlSss}
                onChange={v => { setNlSss(v); loadNl(1, nlSearch, nlCategory, v); }} />
            )}
            {(nlSearch || nlCategory || nlSss.length > 0 || nlFhMonth) && (
              <button onClick={() => { setNlSearch(""); setNlCat(""); setNlSss([]); setNlFhMonth(""); loadNl(1, "", "", [], ""); }}
                style={{ padding: "4px 10px", fontSize: 10, background: "#F8FBFD", border: `1px solid ${T.cardBdr}`, borderRadius: 999, cursor: "pointer", color: T.textSec, fontWeight: 700 }}>
                Clear
              </button>
            )}
          </div>
        )}

        {/* Filter bar — Live */}
        {propTab === "live" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "10px 16px", borderBottom: `1px solid ${T.cardBdr}`, background: T.headerBg, gap: 8 }}>
            <input value={liveSearch} onChange={e => { setLiveSearch(e.target.value); loadLive(1, e.target.value); }}
              placeholder="Search…"
              style={{ padding: "5px 10px", fontSize: 11, border: `1px solid ${T.cardBdr}`, borderRadius: 999, outline: "none", width: 160, color: T.textPri, background: "#FFFFFF" }} />
          </div>
        )}

        {/* Not Live table */}
        {propTab === "notlive" && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%" }}>
              <thead>
                <tr style={{ background: T.headerBg }}>
                  {[
                    { label: "FH ID" }, { label: "Property Name" }, { label: "City" }, { label: "FH Live" },
                    { label: "Status", key: "status" as NLSortKey }, { label: "Sub Status", key: "subStatus" as NLSortKey },
                    { label: "OTA Live", key: "liveDate" as NLSortKey }, { label: "TAT", key: "tat" as NLSortKey },
                    { label: "Open" },
                  ].map((h, i) => {
                    const sortable = !!h.key;
                    return (
                      <th key={h.label} onClick={sortable ? () => nlToggleSort(h.key!) : undefined}
                        style={{ padding: "7px 12px", fontSize: 9, fontWeight: 700,
                          color: sortable && nlSortBy === h.key ? T.orange : T.textMut,
                          textTransform: "uppercase", letterSpacing: "0.08em",
                          textAlign: i <= 1 ? "left" : "center",
                          borderBottom: `1px solid ${T.cardBdr}`, borderRight: `1px solid ${T.cardBdr}`,
                          whiteSpace: "nowrap", background: T.headerBg,
                          cursor: sortable ? "pointer" : "default", userSelect: "none" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          {h.label}
                          {sortable && <span style={{ fontSize: 9 }}>{nlSortBy === h.key ? (nlSortDir === "asc" ? "↑" : "↓") : "↕"}</span>}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {nlLoading && <tr><td colSpan={9} style={{ textAlign: "center", padding: 30, color: T.textMut, fontSize: 11 }}>Loading…</td></tr>}
                {!nlLoading && nlSortedRows.map((row, i) => {
                  const sc = getSSColor(row.subStatus ?? "");
                  const isTatError = (row.tatError ?? 0) > 0;
                  return (
                    <tr key={`${row.propertyId}-${i}`} className="nl-row" style={{ borderBottom: `1px solid ${T.cardBdr}`, background: i % 2 === 0 ? "#FFFFFF" : T.headerBg }}>
                      <td style={{ padding: "6px 12px", borderRight: `1px solid ${T.cardBdr}`, color: T.orange, fontSize: 11, fontWeight: 700, fontFamily: "monospace" }}>{row.propertyId}</td>
                      <td style={{ padding: "6px 12px", borderRight: `1px solid ${T.cardBdr}`, color: T.textPri, fontSize: 11, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.name}>{row.name}</td>
                      <td style={{ padding: "6px 12px", borderRight: `1px solid ${T.cardBdr}`, color: T.textSec, fontSize: 11, textAlign: "center" }}>{row.city || "—"}</td>
                      <td style={{ padding: "6px 12px", borderRight: `1px solid ${T.cardBdr}`, color: T.textSec, fontSize: 10, textAlign: "center", fontFamily: "monospace" }}>{fmtDate(row.fhLiveDate)}</td>
                      <td style={{ padding: "6px 12px", borderRight: `1px solid ${T.cardBdr}`, color: T.textSec, fontSize: 11, textAlign: "center" }}>{row.status || "—"}</td>
                      <td style={{ padding: "6px 12px", borderRight: `1px solid ${T.cardBdr}`, textAlign: "center" }}>
                        {row.subStatus ? <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: sc.bg, color: sc.text }}>{row.subStatus}</span> : <span style={{ color: T.textMut }}>—</span>}
                      </td>
                      <td style={{ padding: "6px 12px", borderRight: `1px solid ${T.cardBdr}`, color: T.textSec, fontSize: 10, textAlign: "center", fontFamily: "monospace" }}>{fmtDate(row.liveDate)}</td>
                      <td style={{ padding: "6px 12px", borderRight: `1px solid ${T.cardBdr}`, textAlign: "center" }}>
                        {row.tat > 0 ? <span style={{ fontWeight: 700, color: isTatError ? T.notLive : row.tat > 365 ? "#C2410C" : row.tat > 90 ? "#B45309" : T.textSec }}>{row.tat}d</span> : <span style={{ color: T.textMut }}>—</span>}
                      </td>
                      <td style={{ padding: "6px 12px", textAlign: "center" }}>
                        <a href={`/crm/${row.propertyId}`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", padding: "3px 10px", fontSize: 10, fontWeight: 700, background: "#5D87FF18", color: "#5D87FF", border: "1px solid #5D87FF40", borderRadius: 6, textDecoration: "none" }}>Open ↗</a>
                      </td>
                    </tr>
                  );
                })}
                {!nlLoading && (nlData?.rows.length === 0) && <tr><td colSpan={9} style={{ textAlign: "center", padding: 30, color: T.textMut, fontSize: 11 }}>No records match</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        {/* Not Live pagination */}
        {propTab === "notlive" && nlData && nlData.pages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", borderTop: `1px solid ${T.cardBdr}`, background: T.headerBg }}>
            <span style={{ fontSize: 10, color: T.textMut }}>{((nlData.page-1)*50+1).toLocaleString()}–{Math.min(nlData.page*50,nlData.total).toLocaleString()} of {nlData.total.toLocaleString()}</span>
            <div style={{ display: "flex", gap: 4 }}>
              {([{ label:"«",p:1,dis:nlData.page===1},{ label:"‹",p:nlData.page-1,dis:nlData.page===1},{ label:"›",p:nlData.page+1,dis:nlData.page===nlData.pages},{ label:"»",p:nlData.pages,dis:nlData.page===nlData.pages}] as const).map(({label,p,dis})=>(
                <button key={label} onClick={()=>loadNl(p)} disabled={dis} style={{ padding:"3px 9px",fontSize:11,fontWeight:700,background:dis?"#F1F5F9":T.orange,color:dis?T.textMut:"#FFFFFF",border:"none",borderRadius:5,cursor:dis?"not-allowed":"pointer" }}>{label}</button>
              ))}
              <span style={{ padding:"3px 8px",fontSize:10,color:T.textSec,fontWeight:600 }}>{nlData.page}/{nlData.pages}</span>
            </div>
          </div>
        )}

        {/* Live properties table */}
        {propTab === "live" && (
          <div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%" }}>
                <thead>
                  <tr style={{ background: T.headerBg }}>
                    {[
                      { label: "FH ID" }, { label: "Property Name" }, { label: "City" }, { label: "FH Live" },
                      { label: "OTA Live", key: "liveDate" as NLSortKey }, { label: "TAT (days)", key: "tat" as NLSortKey },
                      { label: "Open" },
                    ].map((h, i) => {
                      const sortable = !!h.key;
                      return (
                        <th key={h.label} onClick={sortable ? () => liveToggleSort(h.key!) : undefined}
                          style={{ padding: "7px 12px", fontSize: 9, fontWeight: 700,
                            color: sortable && liveSortBy === h.key ? T.live : T.textMut,
                            textTransform: "uppercase", letterSpacing: "0.08em",
                            textAlign: i <= 1 ? "left" : "center",
                            borderBottom: `1px solid ${T.cardBdr}`, borderRight: `1px solid ${T.cardBdr}`,
                            whiteSpace: "nowrap", background: T.headerBg,
                            cursor: sortable ? "pointer" : "default", userSelect: "none" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            {h.label}
                            {sortable && <span style={{ fontSize: 9 }}>{liveSortBy === h.key ? (liveSortDir === "asc" ? "↑" : "↓") : "↕"}</span>}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {liveLoading && <tr><td colSpan={7} style={{ textAlign: "center", padding: 30, color: T.textMut, fontSize: 11 }}>Loading…</td></tr>}
                  {!liveLoading && liveSortedRows.map((row, i) => (
                    <tr key={`${row.propertyId}-${i}`} className="nl-row" style={{ borderBottom: `1px solid ${T.cardBdr}`, background: i % 2 === 0 ? "#FFFFFF" : T.headerBg }}>
                      <td style={{ padding: "6px 12px", borderRight: `1px solid ${T.cardBdr}`, color: T.live, fontSize: 11, fontWeight: 700, fontFamily: "monospace" }}>{row.propertyId}</td>
                      <td style={{ padding: "6px 12px", borderRight: `1px solid ${T.cardBdr}`, color: T.textPri, fontSize: 11, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.name}>{row.name}</td>
                      <td style={{ padding: "6px 12px", borderRight: `1px solid ${T.cardBdr}`, color: T.textSec, fontSize: 11, textAlign: "center" }}>{row.city || "—"}</td>
                      <td style={{ padding: "6px 12px", borderRight: `1px solid ${T.cardBdr}`, color: T.textSec, fontSize: 10, textAlign: "center", fontFamily: "monospace" }}>{fmtDate(row.fhLiveDate)}</td>
                      <td style={{ padding: "6px 12px", borderRight: `1px solid ${T.cardBdr}`, color: T.textSec, fontSize: 10, textAlign: "center", fontFamily: "monospace" }}>{fmtDate(row.liveDate)}</td>
                      <td style={{ padding: "6px 12px", borderRight: `1px solid ${T.cardBdr}`, textAlign: "center" }}>
                        {row.tat > 0 ? <span style={{ fontWeight: 700, color: row.tat <= 7 ? T.live : row.tat <= 15 ? "#B45309" : row.tat <= 30 ? "#C2410C" : T.notLive }}>{row.tat}d</span> : <span style={{ color: T.textMut }}>—</span>}
                      </td>
                      <td style={{ padding: "6px 12px", textAlign: "center" }}>
                        <a href={`/crm/${row.propertyId}`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", padding: "3px 10px", fontSize: 10, fontWeight: 700, background: "#16A34A18", color: "#16A34A", border: "1px solid #16A34A40", borderRadius: 6, textDecoration: "none" }}>Open ↗</a>
                      </td>
                    </tr>
                  ))}
                  {!liveLoading && (liveData?.rows.length === 0) && <tr><td colSpan={7} style={{ textAlign: "center", padding: 30, color: T.textMut, fontSize: 11 }}>No live properties found</td></tr>}
                </tbody>
              </table>
            </div>

            {/* Live pagination */}
            {liveData && liveData.pages > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", borderTop: `1px solid ${T.cardBdr}`, background: T.headerBg }}>
                <span style={{ fontSize: 10, color: T.textMut }}>{((liveData.page-1)*50+1).toLocaleString()}–{Math.min(liveData.page*50,liveData.total).toLocaleString()} of {liveData.total.toLocaleString()}</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {([{label:"«",p:1,dis:liveData.page===1},{label:"‹",p:liveData.page-1,dis:liveData.page===1},{label:"›",p:liveData.page+1,dis:liveData.page===liveData.pages},{label:"»",p:liveData.pages,dis:liveData.page===liveData.pages}] as const).map(({label,p,dis})=>(
                    <button key={label} onClick={()=>loadLive(p)} disabled={dis} style={{ padding:"3px 9px",fontSize:11,fontWeight:700,background:dis?"#F1F5F9":T.live,color:dis?T.textMut:"#FFFFFF",border:"none",borderRadius:5,cursor:dis?"not-allowed":"pointer" }}>{label}</button>
                  ))}
                  <span style={{ padding:"3px 8px",fontSize:10,color:T.textSec,fontWeight:600 }}>{liveData.page}/{liveData.pages}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}






