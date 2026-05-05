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

// Mirror of server-side normalize() in /api/listing-dashboard/route.ts
function normalizeSs(s: string | null | undefined): string {
  if (!s) return "Blank";
  const t = s.trim().toLowerCase();
  if (t === "not live" || t === "others - not live") return "Not Live";
  if (t === "pending at go-mmt")  return "Pending at GoMMT";
  if (t === "pending at bdc")     return "Pending at Booking.com";
  if (t === "pending at emt")     return "Pending at EaseMyTrip";
  if (t === "pending at ota")     return "Pending at OTA";
  if (t === "#n/a")               return "Blank";
  return s.trim();
}

// Type for OTA status config (used in listing creation + config tab)
type OtaStatusConfig = {
  ota: string;
  statusSubStatusMap: Record<string, { preset: string; postset: string }>;
  subStatuses: string[];
  updatedAt: string | null;
  updatedBy: string | null;
  isDefault: boolean;
};

const STATUS_OPTIONS_LC = [
  "New", "Shell Created", "Live", "Not Live", "Ready to Go Live",
  "Content in Progress", "Listing in Progress", "Pending", "Soldout", "Closed",
];

const SUB_STATUS_OPTIONS_LC = [
  "Live", "Not Live", "OTA Team", "Pending at GoMMT", "Pending at Booking.com",
  "Pending at EaseMyTrip", "Pending at OTA", "Supply/Operations", "Revenue",
  "Exception", "Duplicate - Listing Closed", "Duplicate - Pending Invoice", "Blank",
];

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

interface CatRow   { ota: string; live: number; exception: number; readyToGoLive: number; inProcess: number; tatExhausted: number; }
interface TatStat  { avgTat: number; d0_7: number; d8_15: number; d16_30: number; d31_60: number; d60p: number; }
interface DashStats { live: number; soldOut: number; total: number; onboardedThisMonth: number; mtdListings: number; }
interface DashData { pivot: Record<string, Record<string, number>>; columns: string[]; otas: string[]; stats: DashStats; categories: CatRow[]; tatThreshold: number; tatBreakdown: Record<string, Record<string, number>>; tatSubStatusList: string[]; tatStats: Record<string, TatStat>; ssStatusPivot: Record<string, Record<string, Record<string, number>>>; }
interface NLRow    { propertyId: string; name: string; city: string; fhLiveDate: string|null; ota: string; status: string|null; subStatus: string|null; liveDate: string|null; tat: number; tatError?: number; }
interface LcRow    { otaListingId: number; propertyId: string; name: string; city: string; fhStatus: string; fhLiveDate: string|null; ota: string; otaId: string|null; status: string; subStatus: string; liveDate: string|null; tat: number|null; prePost: string|null; listingLink: string|null; batchNumber: string|null; crmNote: string|null; crmUpdatedAt: string|null; assignedName: string|null; metrics: Record<string, string> | null; }
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
  // Lazy-load guards: store the otaName they were fetched for so a stale fetch from a previous OTA is ignored
  const [ovrLoaded,  setOvrLoaded]  = useState("");
  const [rnsLoaded,  setRnsLoaded]  = useState("");

  const [propTab,   setPropTab]   = useState<"notlive" | "live" | "listing" | "config">("listing");

  // Status Config tab state
  const [scConfig,        setScConfig]        = useState<OtaStatusConfig | null>(null);
  const [scStatusMap,     setScStatusMap]     = useState<Record<string, { preset: string; postset: string }>>({});
  const [scOtaStatuses,   setScOtaStatuses]   = useState<string[]>([]);
  const [scLoading,       setScLoading]       = useState(false);
  const [scSaving,        setScSaving]        = useState(false);
  const [scSaveOk,        setScSaveOk]        = useState(false);
  const [scSaveErr,       setScSaveErr]       = useState(false);
  const [scNewStatus,     setScNewStatus]     = useState("");
  const [scAddingStatus,  setScAddingStatus]  = useState(false);
  // SSCell editing: key = "otaStatus|field", value = true when showing text input
  const [scSSAdding,      setScSSAdding]      = useState<Record<string, boolean>>({});
  const [scSSNewVal,      setScSSNewVal]      = useState<Record<string, string>>({});

  // Listing Creation sheet state
  const [lcRows,       setLcRows]       = useState<LcRow[]>([]);
  const [lcLoading,    setLcLoading]    = useState(false);
  const [lcLoaded,     setLcLoaded]     = useState(false);
  const [lcSearch,     setLcSearch]     = useState("");
  const [lcStatusFilter, setLcStatusFilter] = useState("all");
  const [lcFhStatus,   setLcFhStatus]   = useState<string[]>(["Live","SoldOut"]);
  const [lcDirty,      setLcDirty]      = useState<Record<number, Record<string, string>>>({});
  const [lcSelected,   setLcSelected]   = useState<Set<number>>(new Set());
  const [lcEditCell,   setLcEditCell]   = useState<{ id: number; field: string } | null>(null);
  const [lcSaving,     setLcSaving]     = useState(false);
  const [lcOtaIdUploadOpen, setLcOtaIdUploadOpen] = useState(false);
  const [lcOtaIdPaste,      setLcOtaIdPaste]      = useState("");
  const [lcSaveOk,     setLcSaveOk]     = useState<Set<number>>(new Set());
  const [lcSaveErr,    setLcSaveErr]    = useState<Set<number>>(new Set());
  const [lcBulkField,     setLcBulkField]     = useState("");
  const [lcBulkValue,     setLcBulkValue]     = useState("");
  const [lcBulkStatus,    setLcBulkStatus]    = useState("");
  const [lcBulkSubStatus, setLcBulkSubStatus] = useState("");
  const [lcBulkNote,      setLcBulkNote]      = useState("");
  const [lcLiveFilter,    setLcLiveFilter]    = useState<"all" | "live" | "notlive">("notlive");
  const [lcBulkIds,       setLcBulkIds]       = useState("");
  const [lcOvvFilter,     setLcOvvFilter]     = useState<{ label: string; field: "status" | "subStatus"; values: string[] } | null>(null);
  const [cbSaving,        setCbSaving]        = useState<Record<string, boolean>>({});  // propertyId+cbKey → saving
  const [cbError,         setCbError]         = useState<Record<string, boolean>>({});  // propertyId+cbKey → save failed
  const [lcCbBulkState,   setLcCbBulkState]   = useState<"idle"|"saving"|"ok"|"err">("idle");
  const [lcCbFilterKey,   setLcCbFilterKey]   = useState("");   // which CB item to filter by
  const [lcCbFilterVal,   setLcCbFilterVal]   = useState("");   // "Yes" | "No" | ""
  const [lcError,         setLcError]         = useState("");

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
  const [nlFhStatus,  setNlFhStatus]   = useState<string[]>([]);
  const [nlStatus,    setNlStatus]     = useState("");
  const [nlFhDateFrom,setNlFhDateFrom] = useState("");
  const [nlFhDateTo,  setNlFhDateTo]   = useState("");
  const [nlOtaDateFrom,setNlOtaDateFrom]= useState("");
  const [nlOtaDateTo,  setNlOtaDateTo]  = useState("");
  const [nlSortBy,  setNlSortBy]  = useState<NLSortKey>("tat");
  const [nlSortDir, setNlSortDir] = useState<"asc" | "desc">("desc");
  const [ssActiveGroup, setSsActiveGroup] = useState<string | null>(null);
  const [nlPage,    setNlPage]    = useState(1);

  const [liveData,    setLiveData]    = useState<NLData | null>(null);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveSearch,  setLiveSearch]  = useState("");
  const [liveSss,     setLiveSss]     = useState<string[]>([]);
  const [liveFhStatus,  setLiveFhStatus]   = useState<string[]>([]);
  const [liveStatus,    setLiveStatus]     = useState("");
  const [liveFhDateFrom,setLiveFhDateFrom] = useState("");
  const [liveFhDateTo,  setLiveFhDateTo]   = useState("");
  const [liveOtaDateFrom,setLiveOtaDateFrom]= useState("");
  const [liveOtaDateTo,  setLiveOtaDateTo]  = useState("");
  const [liveSortBy,  setLiveSortBy]  = useState<NLSortKey>("liveDate");
  const [liveSortDir, setLiveSortDir] = useState<"asc" | "desc">("desc");
  const [livePage,    setLivePage]    = useState(1);
  const [ovvExpanded, setOvvExpanded] = useState(true);
  const [ovvTab,      setOvvTab]      = useState<"status" | "substatus">("status");

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

  function loadLive(page = 1, search = liveSearch, sss = liveSss,
    fhStatus = liveFhStatus, status = liveStatus, fhFrom = liveFhDateFrom, fhTo = liveFhDateTo, otaFrom = liveOtaDateFrom, otaTo = liveOtaDateTo) {
    setLiveLoading(true);
    const p = new URLSearchParams({ otas: otaName, category: "live", page: String(page), size: "50" });
    if (search)          p.set("search", search);
    if (sss.length)      p.set("sss", sss.join(","));
    if (fhStatus.length) p.set("fhStatus", fhStatus.join(","));
    if (status)          p.set("status", status);
    if (fhFrom)          p.set("fhFrom", fhFrom);
    if (fhTo)            p.set("fhTo", fhTo);
    if (otaFrom)         p.set("otaFrom", otaFrom);
    if (otaTo)           p.set("otaTo", otaTo);
    fetch(`/api/listing-dashboard/not-live?${p}`)
      .then(r => r.json())
      .then(d => {
        // Normalize sub_status labels same as Listing Creation and Not Live tabs
        if (d.rows) d.rows = d.rows.map((r: NLRow) => ({ ...r, subStatus: normalizeSs(r.subStatus) }));
        setLiveData(d); setLivePage(page);
      })
      .catch(() => {})
      .finally(() => setLiveLoading(false));
  }

  function loadNl(page = 1, search = nlSearch, category = nlCategory, sss = nlSss, fhMonth = nlFhMonth,
    fhStatus = nlFhStatus, status = nlStatus, fhFrom = nlFhDateFrom, fhTo = nlFhDateTo, otaFrom = nlOtaDateFrom, otaTo = nlOtaDateTo) {
    setNlLoading(true);
    const p = new URLSearchParams({ otas: otaName, page: String(page), size: "50" });
    if (search)          p.set("search", search);
    if (category)        p.set("category", category);
    if (sss.length)      p.set("sss", sss.join(","));
    if (fhMonth)         p.set("fhMonth", fhMonth);
    if (fhStatus.length) p.set("fhStatus", fhStatus.join(","));
    if (status)          p.set("status", status);
    if (fhFrom)          p.set("fhFrom", fhFrom);
    if (fhTo)            p.set("fhTo", fhTo);
    if (otaFrom)         p.set("otaFrom", otaFrom);
    if (otaTo)           p.set("otaTo", otaTo);
    fetch(`/api/listing-dashboard/not-live?${p}`)
      .then(r => r.json())
      .then(d => { setNlData(d); setNlPage(page); })
      .catch(() => {})
      .finally(() => setNlLoading(false));
  }

  function loadLc(fhStatus = lcFhStatus) {
    setLcLoading(true);
    setLcError("");
    const p = new URLSearchParams({ export: "1", ota: otaName });
    if (fhStatus.length) p.set("fhStatus", fhStatus.join(","));
    fetch(`/api/crm/properties?${p}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setLcError(d.error); return; }
        // Normalise sub_status to match dashboard pivot labels
        const rows = ((d.rows ?? []) as LcRow[])
          .map(r => ({ ...r, subStatus: normalizeSs(r.subStatus) }));
        setLcRows(rows);
        setLcLoaded(true);
      })
      .catch((e: Error) => setLcError(e.message))
      .finally(() => setLcLoading(false));
  }

  function load() {
    setLoading(true); setError(null);
    fetch("/api/listing-dashboard")
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setDashData(d); })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false));
  }

  function loadOverdue(name: string) {
    fetch("/api/overdue-listings")
      .then(r => r.json())
      .then(d => { setOvrLive(d.rows ?? []); setOvrNotLive(d.notLiveRows ?? []); setOvrLoaded(name); })
      .catch(() => {});
  }

  function loadRnsData(name: string) {
    fetch("/api/dashboard-data")
      .then(r => r.json())
      .then(d => {
        const extract = (src: unknown) => {
          const map = (src ?? {}) as Record<string, Record<string, { cmMTD: number; cmTotal?: number; lmMTD?: number; lmTotal?: number }>>;
          const result: Record<string, { cmMTD: number; cmTotal: number; lmMTD: number; lmTotal: number }> = {};
          for (const [mk, otas] of Object.entries(map)) {
            const entry = otas[name];
            if (entry) result[mk] = { cmMTD: entry.cmMTD ?? 0, cmTotal: entry.cmTotal ?? entry.cmMTD ?? 0, lmMTD: entry.lmMTD ?? 0, lmTotal: entry.lmTotal ?? 0 };
          }
          return result;
        };
        setRnsMonthly(extract(d.rnsLiveMonthly));
        setRevMonthly(extract(d.revLiveMonthly));
        setRnsLoaded(name);
      })
      .catch(() => {});
  }

  function loadMetrics(name: string) {
    fetch(`/api/ota-metrics-summary?ota=${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then(d => { setMetricsAgg(d.agg ?? {}); setMetricsProps(d.properties ?? []); })
      .catch(() => {});
  }

  useEffect(() => {
    setDashData(null); setOvrLive([]); setOvrNotLive([]); setOvrLoaded(""); setRnsLoaded("");
    setRnsMonthly({}); setRevMonthly({}); setNlData(null); setLiveData(null);
    setNlCat(""); setNlSearch(""); setNlSss([]); setNlFhMonth(""); setSsActiveGroup(null);
    setNlFhStatus([]); setNlStatus(""); setNlFhDateFrom(""); setNlFhDateTo(""); setNlOtaDateFrom(""); setNlOtaDateTo("");
    setLiveSearch(""); setLiveSss([]); setLiveFhStatus([]); setLiveStatus(""); setLiveFhDateFrom(""); setLiveFhDateTo(""); setLiveOtaDateFrom(""); setLiveOtaDateTo("");
    setPropTab("listing");
    setMetricsAgg({}); setMetricsProps([]);
    setOvvExpanded(true); setOvvTab("status");
    setLcRows([]); setLcLoaded(false); setLcDirty({}); setLcSelected(new Set()); setLcSearch(""); setLcStatusFilter("all"); setLcFhStatus(["Live","SoldOut"]); setLcOvvFilter(null); setLcEditCell(null); setLcCbFilterKey(""); setLcCbFilterVal(""); setLcError("");
    setScConfig(null); setScStatusMap({}); setScOtaStatuses([]);
    load();
    loadLc(["Live","SoldOut"]);
    // Load OTA status config + actual OTA statuses from DB (used by listing creation + config tab)
    setScLoading(true);
    Promise.all([
      fetch("/api/admin/status-config").then(r => r.json()),
      fetch(`/api/crm/ota-statuses?ota=${encodeURIComponent(otaName)}`).then(r => r.json()),
    ]).then(([cfgData, ssData]: [{ configs: OtaStatusConfig[] }, { statuses: string[] }]) => {
      const cfg = cfgData.configs?.find(c => c.ota === otaName) ?? null;
      setScConfig(cfg);
      setScStatusMap(cfg?.statusSubStatusMap ?? {});
      setScOtaStatuses(ssData.statuses ?? []);
      setScLoading(false);
    }).catch(() => setScLoading(false));
  }, [otaName]); // eslint-disable-line react-hooks/exhaustive-deps

  function goToCategory(cat: string) {
    setPropTab("notlive");
    setNlCat(cat); setNlSearch(""); setNlSss([]); setNlFhMonth("");
    loadNl(1, "", cat, [], "");
  }

  function goToMonth(month: string) {
    setPropTab("notlive");
    setNlFhMonth(month); setNlSearch(""); setNlCat(""); setNlSss([]);
    loadNl(1, "", "", [], month);
  }

  function goToSss(subs: string[]) {
    setPropTab("notlive");
    setNlSss(subs); setNlSearch(""); setNlCat(""); setNlFhMonth("");
    loadNl(1, "", "", subs, "");
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
    <div style={{ padding: "20px 28px", background: T.pageBg, minHeight: "100vh" }}>
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

      {/* KPI Pills */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
        {[
          { label: "Total",         value: total,                            text: "#475569", bg: "#F1F5F9", border: "#E2E8F0" },
          { label: "Live %",        value: livePct.toFixed(1) + "%",         text: livePct >= 90 ? "#16A34A" : livePct >= 70 ? "#B45309" : livePct >= 40 ? "#C2410C" : "#DC2626", bg: "#F8FAFC", border: "#E2E8F0", isStr: true },
          { label: "Live",          value: live,                             text: "#16A34A", bg: "#DCFCE7", border: "#86EFAC" },
          { label: "Exception",     value: exception,                        text: "#B45309", bg: "#FEF3C7", border: "#FDE68A" },
          { label: "In Process",    value: inProcess,                        text: "#1D4ED8", bg: "#DBEAFE", border: "#93C5FD" },
          { label: "TAT Exhausted", value: tatExhausted,                     text: "#DC2626", bg: "#FEE2E2", border: "#FECACA" },
          { label: "Avg TAT",       value: tatStat ? `${tatStat.avgTat}d` : "—", text: "#6366F1", bg: "#EEF2FF", border: "#A5B4FC", isStr: true },
        ].map(({ label, value, text, bg, border, isStr }) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, background: bg, border: `2px solid ${border}`, borderRadius: 20, padding: "5px 14px" }}>
            <span style={{ fontSize: 15, fontWeight: 900, color: text }}>{isStr ? value : (value as number).toLocaleString()}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: text }}>{label}</span>
          </div>
        ))}
      </div>

      {/* Tab Strip */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #E2E8F0", display: "flex", overflow: "hidden", marginBottom: 14 }}>
        {([
          { key: "listing", label: "Listing Creation", count: lcLoaded ? lcRows.length : undefined },
          { key: "notlive", label: "Not Live",         count: nlData?.total   },
          { key: "live",    label: "Live",             count: liveData?.total  },
          { key: "config",  label: "Status Config",    count: undefined        },
        ] as { key: "live"|"notlive"|"listing"|"config"; label: string; count: number|undefined }[]).map(tab => {
          const active = propTab === tab.key;
          return (
            <button key={tab.key} onClick={() => {
                setPropTab(tab.key);
                if (tab.key === "listing" && !lcLoaded) loadLc();
                if (tab.key === "config" && scConfig) setScStatusMap(scConfig.statusSubStatusMap ?? {});
                if (tab.key === "notlive") {
                  if (!nlData) loadNl(1, "", "", []);
                  if (ovrLoaded !== otaName) loadOverdue(otaName);
                }
                if (tab.key === "live") {
                  if (!liveData) loadLive(1, "");
                  if (ovrLoaded !== otaName) loadOverdue(otaName);
                  if (rnsLoaded !== otaName) loadRnsData(otaName);
                  if (!Object.keys(metricsAgg).length) loadMetrics(otaName);
                }
              }}
              style={{ flex: 1, padding: "11px 0", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
                background: active ? "#EEF2FF" : "transparent",
                color: active ? "#4F46E5" : "#64748B",
                borderBottom: active ? "3px solid #4F46E5" : "3px solid transparent",
                transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              {tab.label}
              {tab.count != null && <span style={{ fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 99, background: active ? "#C7D2FE" : "#E2E8F0", color: active ? "#4338CA" : "#64748B" }}>{tab.count.toLocaleString()}</span>}
            </button>
          );
        })}
      </div>

      {loading && <div style={{ textAlign: "center", padding: 60, color: T.textMut, fontSize: 12 }}><span style={{ display: "inline-block", animation: "spin 1s linear infinite", marginRight: 6 }}>⟳</span>Loading…</div>}
      {error   && <div style={{ padding: "8px 14px", background: T.notLiveL, border: "1px solid #FECACA", borderRadius: 8, fontSize: 11, color: T.notLive, marginBottom: 14 }}>⚠ {error}</div>}

      {/* ── Overview Breakdown ──────────────────────────────────────────── */}
      {dashData && dashData.categories?.length > 0 && (() => {
        const catRow2  = dashData.categories.find(r => r.ota === otaName);
        if (!catRow2) return null;

        const live2         = catRow2.live ?? 0;
        const exception2    = catRow2.exception ?? 0;
        const readyToGoLive2= catRow2.readyToGoLive ?? 0;
        const inProcess2    = catRow2.inProcess ?? 0;
        const tatExhausted2 = catRow2.tatExhausted ?? 0;
        const grandTot2     = live2 + exception2 + readyToGoLive2 + inProcess2 + tatExhausted2;
        const livePct2      = grandTot2 > 0 ? ((live2 + exception2) / grandTot2 * 100).toFixed(1) : "0.0";
        const livePctNum    = parseFloat(livePct2);
        const livePctColor  = livePctNum >= 90 ? "#16A34A" : livePctNum >= 70 ? "#B45309" : livePctNum >= 40 ? "#C2410C" : "#DC2626";

        const STATUS_TILES = [
          { key: "live",           label: "Live",                color: "#166534", dot: "#22C55E", bg: "#DCFCE7", val: live2         },
          { key: "exception",      label: "Exception",           color: "#9A6700", dot: "#EAB308", bg: "#FEF9C3", val: exception2    },
          { key: "readyToGoLive",  label: "Ready to Go Live",    color: "#0F766E", dot: "#10B981", bg: "#CCFBF1", val: readyToGoLive2},
          { key: "inProcess",      label: "Listing In Progress", color: "#155E75", dot: "#06B6D4", bg: "#CFFAFE", val: inProcess2    },
          { key: "tatExhausted",   label: "TAT Exhausted",       color: "#B42318", dot: "#F97066", bg: "#FFE4E6", val: tatExhausted2 },
        ] as const;

        const ovvActiveKey: string | null =
          propTab === "live" ? "live" :
          propTab === "notlive" && nlCat ? nlCat : null;
        const ovvActiveSs: string[] =
          propTab === "live" ? liveSss :
          propTab === "notlive" ? nlSss : [];

        const subStatusEntries2 = Object.entries(dashData.pivot[otaName] ?? {})
          .filter(([, v]) => v > 0)
          .sort((a, b) => b[1] - a[1]);

        return (
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
            {/* Collapsible header */}
            <div onClick={() => setOvvExpanded(v => !v)} style={{
              height: 4, background: otaColor,
            }} />
            <div onClick={() => setOvvExpanded(v => !v)} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 18px", cursor: "pointer", userSelect: "none",
              borderBottom: ovvExpanded ? "1px solid #F1F5F9" : "none",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 800, color: "#0F172A" }}>Overview</span>
                <span style={{ fontSize: 10, color: "#94A3B8" }}>{grandTot2.toLocaleString()} listings</span>
                {propTab !== "listing" && (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    background: live2 > 0 ? "#DCFCE7" : "#F1F5F9",
                    color: live2 > 0 ? "#166534" : "#64748B",
                    padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                  }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: live2 > 0 ? "#22C55E" : "#9CA3AF" }} />
                    {livePct2}% live
                  </span>
                )}
              </div>
              <span style={{ fontSize: 12, color: "#94A3B8", fontWeight: 600 }}>{ovvExpanded ? "▾" : "▸"}</span>
            </div>

            {ovvExpanded && (
              <div style={{ padding: "0 18px 16px 18px" }}>

                {/* Tab strip */}
                <div style={{ display: "flex", gap: 2, background: "#F1F5F9", borderRadius: 8, padding: 3, marginBottom: 14, width: "fit-content" }}>
                  {(["status", "substatus"] as const).map(tab => {
                    const active = ovvTab === tab;
                    return (
                      <button key={tab} onClick={() => setOvvTab(tab)} style={{
                        padding: "5px 16px", fontSize: 11, fontWeight: 700, borderRadius: 6,
                        border: "none", cursor: "pointer", fontFamily: "inherit",
                        background: active ? "#FFFFFF" : "transparent",
                        color: active ? "#0F172A" : "#94A3B8",
                        boxShadow: active ? "0 1px 3px rgba(15,23,42,0.10)" : "none",
                        transition: "all 0.12s",
                      }}>
                        {tab === "status" ? "Status" : "Sub-status"}
                      </button>
                    );
                  })}
                </div>

                {/* Status tiles */}
                {ovvTab === "status" && propTab !== "listing" && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {STATUS_TILES.map(t => {
                      const isLive = t.key === "live";
                      const isActive = ovvActiveKey === t.key;
                      return (
                        <div key={t.key}
                          onClick={() => {
                            if (isLive) {
                              if (isActive) {
                                // toggle off — already on live tab, nothing to clear
                              } else {
                                setPropTab("live");
                                setLiveSearch(""); setLiveSss([]); setLiveFhStatus([]); setLiveStatus("");
                                setLiveFhDateFrom(""); setLiveFhDateTo(""); setLiveOtaDateFrom(""); setLiveOtaDateTo("");
                                loadLive(1, "", [], [], "", "", "", "", "");
                                setTimeout(() => document.getElementById("prop-section")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
                              }
                            } else {
                              if (propTab === "notlive" && nlCat === t.key) {
                                setNlCat(""); loadNl(1, "", "", nlSss);
                              } else {
                                setPropTab("notlive");
                                goToCategory(t.key);
                                setTimeout(() => document.getElementById("prop-section")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
                              }
                            }
                          }}
                          className="kpi-tile"
                          style={{
                            display: "flex", alignItems: "center", gap: 6,
                            background: isActive ? t.dot : t.bg,
                            border: `2px solid ${t.dot}`,
                            borderRadius: 20, padding: "5px 14px", cursor: "pointer",
                            boxShadow: isActive ? `0 2px 8px ${t.dot}50` : "none",
                          }}>
                          <span style={{ fontSize: 15, fontWeight: 900, color: isActive ? "#fff" : t.color }}>{t.val.toLocaleString()}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: isActive ? "#fff" : t.color }}>{t.label}</span>
                        </div>
                      );
                    })}
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6,
                      background: "#F1F5F9", border: `2px solid ${livePctColor}`,
                      borderRadius: 20, padding: "5px 14px",
                    }}>
                      <span style={{ fontSize: 15, fontWeight: 900, color: livePctColor }}>{livePct2}%</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: livePctColor }}>Live %</span>
                    </div>
                  </div>
                )}

                {/* Listing Creation — dynamic status tiles from actual data */}
                {ovvTab === "status" && propTab === "listing" && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {!lcLoaded
                      ? <span style={{ fontSize: 11, color: "#94A3B8" }}>Load Listing Creation tab to see status breakdown</span>
                      : (() => {
                          const statusCounts: Record<string, number> = {};
                          for (const r of lcRows) {
                            const st = r.status?.trim() || "Blank";
                            statusCounts[st] = (statusCounts[st] ?? 0) + 1;
                          }
                          const entries = Object.entries(statusCounts).sort((a, b) => b[1] - a[1]);
                          const STATUS_COLORS_LC: Record<string, { color: string; dot: string; bg: string }> = {
                            "Live":                 { color: "#166534", dot: "#22C55E", bg: "#DCFCE7" },
                            "New":                  { color: "#0F172A", dot: "#64748B", bg: "#F1F5F9" },
                            "Shell Created":        { color: "#1D4ED8", dot: "#3B82F6", bg: "#DBEAFE" },
                            "Not Live":             { color: "#DC2626", dot: "#F87171", bg: "#FEE2E2" },
                            "Ready to Go Live":     { color: "#0F766E", dot: "#14B8A6", bg: "#CCFBF1" },
                            "Content in Progress":  { color: "#6D28D9", dot: "#A78BFA", bg: "#EDE9FE" },
                            "Listing in Progress":  { color: "#155E75", dot: "#06B6D4", bg: "#CFFAFE" },
                            "Pending":              { color: "#B45309", dot: "#F59E0B", bg: "#FEF3C7" },
                            "Soldout":              { color: "#B45309", dot: "#F97316", bg: "#FFEDD5" },
                            "Closed":               { color: "#475569", dot: "#94A3B8", bg: "#F1F5F9" },
                            "Blank":                { color: "#94A3B8", dot: "#CBD5E1", bg: "#F8FAFC" },
                          };
                          const activeFilter = lcOvvFilter?.field === "status" ? lcOvvFilter.values[0] : null;
                          return entries.map(([st, cnt]) => {
                            const c = STATUS_COLORS_LC[st] ?? { color: "#475569", dot: "#94A3B8", bg: "#F1F5F9" };
                            const isActive = activeFilter === st;
                            return (
                              <div key={st}
                                onClick={() => {
                                  setLcOvvFilter(isActive ? null : { label: st, field: "status", values: [st] });
                                  setTimeout(() => document.getElementById("prop-section")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
                                }}
                                className="kpi-tile"
                                style={{
                                  display: "flex", alignItems: "center", gap: 6,
                                  background: isActive ? c.dot : c.bg,
                                  border: `2px solid ${c.dot}`,
                                  borderRadius: 20, padding: "5px 14px", cursor: "pointer",
                                  boxShadow: isActive ? `0 4px 12px ${c.dot}40` : "none",
                                }}>
                                <span style={{ fontSize: 15, fontWeight: 900, color: isActive ? "#fff" : c.color }}>{cnt}</span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: isActive ? "#fff" : c.color }}>{st}</span>
                              </div>
                            );
                          });
                        })()
                    }
                  </div>
                )}

                {/* Sub-status tiles */}
                {ovvTab === "substatus" && subStatusEntries2.length > 0 && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {subStatusEntries2.map(([ss, cnt]) => {
                      const sc = getSSColor(ss);
                      const isLiveSs = ss.toLowerCase() === "live";
                      const isActiveSs = ovvActiveSs.includes(ss);
                      return (
                        <div key={ss}
                          onClick={() => {
                            if (propTab === "listing") {
                              setLcOvvFilter(isActiveSs ? null : { label: ss, field: "subStatus", values: [ss] });
                            } else {
                              if (isLiveSs) {
                                if (propTab === "live" && liveSss.includes(ss)) {
                                  setLiveSss([]); loadLive(1, "", [], [], "", "", "", "", "");
                                } else {
                                  setPropTab("live");
                                  setLiveSss([ss]); setLiveSearch(""); setLiveFhStatus([]); setLiveStatus("");
                                  setLiveFhDateFrom(""); setLiveFhDateTo(""); setLiveOtaDateFrom(""); setLiveOtaDateTo("");
                                  loadLive(1, "", [ss], [], "", "", "", "", "");
                                  setTimeout(() => document.getElementById("prop-section")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
                                }
                              } else {
                                if (propTab === "notlive" && nlSss.includes(ss)) {
                                  setNlSss([]); loadNl(1, "", nlCat, [], "");
                                } else {
                                  setPropTab("notlive");
                                  setNlSss([ss]); setNlSearch(""); setNlCat(""); setNlFhMonth("");
                                  loadNl(1, "", "", [ss], "");
                                  setTimeout(() => document.getElementById("prop-section")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
                                }
                              }
                            }
                          }}
                          className="kpi-tile"
                          style={{
                            display: "flex", alignItems: "center", gap: 6,
                            background: isActiveSs ? sc.text : sc.bg,
                            border: `2px solid ${sc.text}`,
                            borderRadius: 20, padding: "5px 14px", cursor: "pointer",
                            boxShadow: isActiveSs ? `0 2px 8px ${sc.text}50` : "none",
                          }}>
                          <span style={{ fontSize: 15, fontWeight: 900, color: isActiveSs ? "#fff" : sc.text }}>{cnt.toLocaleString()}</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: isActiveSs ? "#fff" : sc.text }}>{ss}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
            )}
          </div>
        );
      })()}

      {dashData && propTab === "notlive" && (
        <>
          {/* Status × Sub-status */}
          {(() => {
            const xPivot = dashData.ssStatusPivot[otaName] ?? {};
            // only sub-statuses with count > 0 for this OTA
            const ssCols = dashData.columns.filter(col => (dashData.pivot[otaName]?.[col] ?? 0) > 0);

            const SS_STYLE: Record<string, { color: string; bg: string }> = {
              "Live":              { color: "#16A34A", bg: "#DCFCE7" },
              "FH Live":           { color: "#16A34A", bg: "#DCFCE7" },
              "Supply/Operations": { color: "#6D28D9", bg: "#F5F3FF" },
              "Revenue":           { color: "#C2410C", bg: "#FFF7ED" },
              "OTA Team":          { color: "#B45309", bg: "#FEF3C7" },
              "Exception":         { color: "#B45309", bg: "#FEF3C7" },
              "Blank":             { color: "#64748B", bg: "#F1F5F9" },
              "Churned":           { color: "#DC2626", bg: "#FEE2E2" },
            };

            // Build SS_COLS dynamically from all sub-statuses with count > 0
            const SS_COLS = ssCols.map(s => {
              const style = SS_STYLE[s] ?? (s.startsWith("Pending at ") ? { color: "#1D4ED8", bg: "#DBEAFE" } : { color: "#475569", bg: "#F1F5F9" });
              return { label: s, subs: [s], ...style };
            });

            const colData = SS_COLS.map(col => {
              const activeSubs = col.subs;
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

      {/* Properties Card — only for Listing Creation and Status Config */}
      {(propTab === "listing" || propTab === "config") && (
      <div id="prop-section" style={{ background: "#FFFFFF", border: `1px solid ${T.cardBdr}`, borderRadius: 18, overflow: "hidden", boxShadow: "0 4px 24px rgba(15,23,42,0.08)" }}>

        {/* Filter bar — Not Live */}
        {propTab === "notlive" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "10px 16px", borderBottom: `1px solid ${T.cardBdr}`, background: "linear-gradient(180deg,#FFF9F5 0%,#FFF4EE 100%)", flexWrap: "wrap", gap: 8 }}>
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
            <CheckboxDropdown label="FH Status" options={["Live","SoldOut","Churned"]} selected={nlFhStatus}
              onChange={v => { setNlFhStatus(v); loadNl(1, nlSearch, nlCategory, nlSss, nlFhMonth, v, nlStatus, nlFhDateFrom, nlFhDateTo, nlOtaDateFrom, nlOtaDateTo); }} />
            <input value={nlStatus} onChange={e => { setNlStatus(e.target.value); loadNl(1, nlSearch, nlCategory, nlSss, nlFhMonth, nlFhStatus, e.target.value, nlFhDateFrom, nlFhDateTo, nlOtaDateFrom, nlOtaDateTo); }}
              placeholder="Status…"
              style={{ padding: "5px 9px", fontSize: 11, border: `1px solid ${nlStatus ? T.orange : T.cardBdr}`, borderRadius: 6, outline: "none", width: 90, color: T.textPri, background: nlStatus ? T.orangeL : "#FFF" }} />
            {ssOptions.length > 0 && (
              <CheckboxDropdown label="Sub-Status" options={ssOptions} selected={nlSss}
                onChange={v => { setNlSss(v); loadNl(1, nlSearch, nlCategory, v); }} />
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: T.textMut }}>FH</span>
              <input type="date" value={nlFhDateFrom} onChange={e => { setNlFhDateFrom(e.target.value); loadNl(1, nlSearch, nlCategory, nlSss, nlFhMonth, nlFhStatus, nlStatus, e.target.value, nlFhDateTo, nlOtaDateFrom, nlOtaDateTo); }}
                style={{ padding: "4px 5px", fontSize: 10, border: `1px solid ${nlFhDateFrom ? T.orange : T.cardBdr}`, borderRadius: 6, outline: "none", background: "#FFF" }} />
              <span style={{ fontSize: 10, color: T.textMut }}>–</span>
              <input type="date" value={nlFhDateTo} onChange={e => { setNlFhDateTo(e.target.value); loadNl(1, nlSearch, nlCategory, nlSss, nlFhMonth, nlFhStatus, nlStatus, nlFhDateFrom, e.target.value, nlOtaDateFrom, nlOtaDateTo); }}
                style={{ padding: "4px 5px", fontSize: 10, border: `1px solid ${nlFhDateTo ? T.orange : T.cardBdr}`, borderRadius: 6, outline: "none", background: "#FFF" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: T.textMut }}>OTA</span>
              <input type="date" value={nlOtaDateFrom} onChange={e => { setNlOtaDateFrom(e.target.value); loadNl(1, nlSearch, nlCategory, nlSss, nlFhMonth, nlFhStatus, nlStatus, nlFhDateFrom, nlFhDateTo, e.target.value, nlOtaDateTo); }}
                style={{ padding: "4px 5px", fontSize: 10, border: `1px solid ${nlOtaDateFrom ? T.orange : T.cardBdr}`, borderRadius: 6, outline: "none", background: "#FFF" }} />
              <span style={{ fontSize: 10, color: T.textMut }}>–</span>
              <input type="date" value={nlOtaDateTo} onChange={e => { setNlOtaDateTo(e.target.value); loadNl(1, nlSearch, nlCategory, nlSss, nlFhMonth, nlFhStatus, nlStatus, nlFhDateFrom, nlFhDateTo, nlOtaDateFrom, e.target.value); }}
                style={{ padding: "4px 5px", fontSize: 10, border: `1px solid ${nlOtaDateTo ? T.orange : T.cardBdr}`, borderRadius: 6, outline: "none", background: "#FFF" }} />
            </div>
            <input value={nlSearch} onChange={e => { setNlSearch(e.target.value); loadNl(1, e.target.value, nlCategory, nlSss); }}
              placeholder="Search…"
              style={{ padding: "5px 10px", fontSize: 11, border: `1px solid ${T.cardBdr}`, borderRadius: 999, outline: "none", width: 140, color: T.textPri, background: "#FFFFFF" }} />
            {(nlSearch || nlCategory || nlSss.length > 0 || nlFhMonth || nlFhStatus.length > 0 || nlStatus || nlFhDateFrom || nlFhDateTo || nlOtaDateFrom || nlOtaDateTo) && (
              <button onClick={() => { setNlSearch(""); setNlCat(""); setNlSss([]); setNlFhMonth(""); setNlFhStatus([]); setNlStatus(""); setNlFhDateFrom(""); setNlFhDateTo(""); setNlOtaDateFrom(""); setNlOtaDateTo(""); loadNl(1, "", "", [], "", [], "", "", "", "", ""); }}
                style={{ padding: "4px 10px", fontSize: 10, background: "#F8FBFD", border: `1px solid ${T.cardBdr}`, borderRadius: 999, cursor: "pointer", color: T.textSec, fontWeight: 700 }}>
                Clear
              </button>
            )}
          </div>
        )}

        {/* Filter bar — Live */}
        {propTab === "live" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap", padding: "10px 16px", borderBottom: `1px solid ${T.cardBdr}`, background: "linear-gradient(180deg,#F0FDF4 0%,#E8F9EE 100%)", gap: 8 }}>
            <CheckboxDropdown label="FH Status" options={["Live","SoldOut","Churned"]} selected={liveFhStatus}
              onChange={v => { setLiveFhStatus(v); loadLive(1, liveSearch, liveSss, v, liveStatus, liveFhDateFrom, liveFhDateTo, liveOtaDateFrom, liveOtaDateTo); }} />
            <input value={liveStatus} onChange={e => { setLiveStatus(e.target.value); loadLive(1, liveSearch, liveSss, liveFhStatus, e.target.value, liveFhDateFrom, liveFhDateTo, liveOtaDateFrom, liveOtaDateTo); }}
              placeholder="Status…"
              style={{ padding: "5px 9px", fontSize: 11, border: `1px solid ${liveStatus ? T.live : T.cardBdr}`, borderRadius: 6, outline: "none", width: 90, color: T.textPri, background: liveStatus ? T.liveL : "#FFF" }} />
            <CheckboxDropdown label="Sub-Status" options={["Live","Exception"]} selected={liveSss}
              onChange={v => { setLiveSss(v); loadLive(1, liveSearch, v); }} />
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: T.textMut }}>FH</span>
              <input type="date" value={liveFhDateFrom} onChange={e => { setLiveFhDateFrom(e.target.value); loadLive(1, liveSearch, liveSss, liveFhStatus, liveStatus, e.target.value, liveFhDateTo, liveOtaDateFrom, liveOtaDateTo); }}
                style={{ padding: "4px 5px", fontSize: 10, border: `1px solid ${liveFhDateFrom ? T.live : T.cardBdr}`, borderRadius: 6, outline: "none", background: "#FFF" }} />
              <span style={{ fontSize: 10, color: T.textMut }}>–</span>
              <input type="date" value={liveFhDateTo} onChange={e => { setLiveFhDateTo(e.target.value); loadLive(1, liveSearch, liveSss, liveFhStatus, liveStatus, liveFhDateFrom, e.target.value, liveOtaDateFrom, liveOtaDateTo); }}
                style={{ padding: "4px 5px", fontSize: 10, border: `1px solid ${liveFhDateTo ? T.live : T.cardBdr}`, borderRadius: 6, outline: "none", background: "#FFF" }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: T.textMut }}>OTA</span>
              <input type="date" value={liveOtaDateFrom} onChange={e => { setLiveOtaDateFrom(e.target.value); loadLive(1, liveSearch, liveSss, liveFhStatus, liveStatus, liveFhDateFrom, liveFhDateTo, e.target.value, liveOtaDateTo); }}
                style={{ padding: "4px 5px", fontSize: 10, border: `1px solid ${liveOtaDateFrom ? T.live : T.cardBdr}`, borderRadius: 6, outline: "none", background: "#FFF" }} />
              <span style={{ fontSize: 10, color: T.textMut }}>–</span>
              <input type="date" value={liveOtaDateTo} onChange={e => { setLiveOtaDateTo(e.target.value); loadLive(1, liveSearch, liveSss, liveFhStatus, liveStatus, liveFhDateFrom, liveFhDateTo, liveOtaDateFrom, e.target.value); }}
                style={{ padding: "4px 5px", fontSize: 10, border: `1px solid ${liveOtaDateTo ? T.live : T.cardBdr}`, borderRadius: 6, outline: "none", background: "#FFF" }} />
            </div>
            <input value={liveSearch} onChange={e => { setLiveSearch(e.target.value); loadLive(1, e.target.value); }}
              placeholder="Search…"
              style={{ padding: "5px 10px", fontSize: 11, border: `1px solid ${T.cardBdr}`, borderRadius: 999, outline: "none", width: 140, color: T.textPri, background: "#FFFFFF" }} />
            {(liveSearch || liveSss.length > 0 || liveFhStatus.length > 0 || liveStatus || liveFhDateFrom || liveFhDateTo || liveOtaDateFrom || liveOtaDateTo) && (
              <button onClick={() => { setLiveSearch(""); setLiveSss([]); setLiveFhStatus([]); setLiveStatus(""); setLiveFhDateFrom(""); setLiveFhDateTo(""); setLiveOtaDateFrom(""); setLiveOtaDateTo(""); loadLive(1, "", [], [], "", "", "", "", ""); }}
                style={{ padding: "4px 10px", fontSize: 10, background: "#F8FBFD", border: `1px solid ${T.cardBdr}`, borderRadius: 999, cursor: "pointer", color: T.textSec, fontWeight: 700 }}>
                Clear
              </button>
            )}
          </div>
        )}

        {/* Not Live table */}
        {propTab === "notlive" && nlData && (nlCat || nlSss.length > 0) && (() => {
          const CAT_LABEL: Record<string,string> = {
            live: "Live", exception: "Exception", readyToGoLive: "Ready to Go Live",
            inProcess: "Listing In Progress", tatExhausted: "TAT Exhausted",
          };
          const filterLabel = nlCat ? (CAT_LABEL[nlCat] ?? nlCat) : nlSss[0];
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 8px", padding: "6px 14px",
              background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, fontSize: 12 }}>
              <span style={{ fontWeight: 700, color: "#1D4ED8" }}>{filterLabel}</span>
              <span style={{ color: "#475569" }}>· {nlData.total.toLocaleString()} properties</span>
              <button onClick={() => { setNlCat(""); setNlSss([]); loadNl(1, "", "", []); }}
                style={{ marginLeft: "auto", padding: "2px 10px", fontSize: 11, fontWeight: 700,
                  background: "#fff", border: "1px solid #BFDBFE", borderRadius: 999, cursor: "pointer", color: "#1D4ED8" }}>
                × Clear
              </button>
            </div>
          );
        })()}
        {propTab === "notlive" && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%" }}>
              <thead>
                <tr style={{ background: "linear-gradient(180deg,#F8FAFC 0%,#F1F5F9 100%)" }}>
                  {[
                    { label: "FH ID" }, { label: "Property Name" }, { label: "City" }, { label: "FH Live" },
                    { label: "Status", key: "status" as NLSortKey }, { label: "Sub Status", key: "subStatus" as NLSortKey },
                    { label: "OTA Live", key: "liveDate" as NLSortKey }, { label: "TAT", key: "tat" as NLSortKey },
                    { label: "" },
                  ].map((h, i) => {
                    const sortable = !!h.key;
                    const active = sortable && nlSortBy === h.key;
                    return (
                      <th key={h.label} onClick={sortable ? () => nlToggleSort(h.key!) : undefined}
                        style={{ padding: "9px 14px", fontSize: 9, fontWeight: 800,
                          color: active ? T.notLive : "#64748B",
                          textTransform: "uppercase", letterSpacing: "0.09em",
                          textAlign: i <= 1 ? "left" : "center",
                          borderBottom: `2px solid ${active ? T.notLive+"44" : T.cardBdr}`,
                          whiteSpace: "nowrap", background: "transparent",
                          cursor: sortable ? "pointer" : "default", userSelect: "none",
                          transition: "color 0.12s" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                          {h.label}
                          {sortable && <span style={{ fontSize: 8, opacity: active ? 1 : 0.4 }}>{active ? (nlSortDir === "asc" ? "▲" : "▼") : "⇅"}</span>}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {nlLoading && <tr><td colSpan={9} style={{ textAlign: "center", padding: 40, color: T.textMut, fontSize: 12 }}><span style={{ display:"inline-block",animation:"spin 1s linear infinite",marginRight:6 }}>⟳</span>Loading…</td></tr>}
                {!nlLoading && nlSortedRows.map((row, i) => {
                  const sc = getSSColor(row.subStatus ?? "");
                  const isTatError = (row.tatError ?? 0) > 0;
                  const tatColor = isTatError ? T.notLive : row.tat > 365 ? "#7F1D1D" : row.tat > 90 ? T.notLive : row.tat > 30 ? "#C2410C" : row.tat > 15 ? "#B45309" : "#64748B";
                  return (
                    <tr key={`${row.propertyId}-${i}`} className="nl-row" style={{ borderBottom: `1px solid #F1F5F9`, background: i % 2 === 0 ? "#FFFFFF" : "#FAFBFC" }}>
                      <td style={{ padding: "8px 14px", borderRight: `1px solid #F1F5F9` }}>
                        <span style={{ display:"inline-block", padding:"2px 8px", borderRadius:6, background:"#FFF4EC", color:T.orange, fontSize:10, fontWeight:800, fontFamily:"monospace", letterSpacing:"0.02em" }}>{row.propertyId}</span>
                      </td>
                      <td style={{ padding: "8px 14px", borderRight: `1px solid #F1F5F9`, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.name}>
                        <span style={{ color: T.textPri, fontSize: 12, fontWeight: 600 }}>{row.name}</span>
                      </td>
                      <td style={{ padding: "8px 14px", borderRight: `1px solid #F1F5F9`, textAlign: "center" }}>
                        <span style={{ color: "#64748B", fontSize: 11, background:"#F8FAFC", padding:"1px 8px", borderRadius:4 }}>{row.city || "—"}</span>
                      </td>
                      <td style={{ padding: "8px 14px", borderRight: `1px solid #F1F5F9`, color: "#94A3B8", fontSize: 10, textAlign: "center", fontFamily: "monospace" }}>{fmtDate(row.fhLiveDate)}</td>
                      <td style={{ padding: "8px 14px", borderRight: `1px solid #F1F5F9`, textAlign: "center" }}>
                        {row.status ? <span style={{ fontSize:10, fontWeight:600, color:"#475569", background:"#F1F5F9", padding:"2px 8px", borderRadius:20 }}>{row.status}</span> : <span style={{ color:"#CBD5E1" }}>—</span>}
                      </td>
                      <td style={{ padding: "8px 14px", borderRight: `1px solid #F1F5F9`, textAlign: "center" }}>
                        {row.subStatus
                          ? <span style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"3px 10px", borderRadius:20, fontSize:10, fontWeight:700, background:sc.bg, color:sc.text, border:`1px solid ${sc.text}20` }}>
                              <span style={{ width:5,height:5,borderRadius:"50%",background:sc.text,flexShrink:0 }} />
                              {row.subStatus}
                            </span>
                          : <span style={{ color:"#CBD5E1" }}>—</span>}
                      </td>
                      <td style={{ padding: "8px 14px", borderRight: `1px solid #F1F5F9`, color: "#64748B", fontSize: 10, textAlign: "center", fontFamily: "monospace" }}>{fmtDate(row.liveDate)}</td>
                      <td style={{ padding: "8px 14px", borderRight: `1px solid #F1F5F9`, textAlign: "center" }}>
                        {row.tat > 0
                          ? <span style={{ display:"inline-block", padding:"3px 10px", borderRadius:20, fontWeight:700, fontSize:10, color:tatColor, background:tatColor+"18", border:`1px solid ${tatColor}30` }}>{row.tat}d</span>
                          : <span style={{ color:"#CBD5E1" }}>—</span>}
                      </td>
                      <td style={{ padding: "8px 14px", textAlign: "center" }}>
                        <a href={`/crm/${row.propertyId}`} style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"4px 12px", fontSize:10, fontWeight:700, background:"linear-gradient(135deg,#667eea 0%,#5D87FF 100%)", color:"#fff", borderRadius:20, textDecoration:"none", boxShadow:"0 2px 6px #5D87FF30" }}>Open ↗</a>
                      </td>
                    </tr>
                  );
                })}
                {!nlLoading && (nlData?.rows.length === 0) && <tr><td colSpan={9} style={{ textAlign: "center", padding: 40, color: T.textMut, fontSize: 12 }}>No records match</td></tr>}
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
        {propTab === "live" && liveData && liveSss.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 8px", padding: "6px 14px",
            background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 8, fontSize: 12 }}>
            <span style={{ fontWeight: 700, color: "#16A34A" }}>{liveSss[0]}</span>
            <span style={{ color: "#475569" }}>· {liveData.total.toLocaleString()} properties</span>
            <button onClick={() => { setLiveSss([]); loadLive(1, liveSearch, [], liveFhStatus, liveStatus, liveFhDateFrom, liveFhDateTo, liveOtaDateFrom, liveOtaDateTo); }}
              style={{ marginLeft: "auto", padding: "2px 10px", fontSize: 11, fontWeight: 700,
                background: "#fff", border: "1px solid #86EFAC", borderRadius: 999, cursor: "pointer", color: "#16A34A" }}>
              × Clear
            </button>
          </div>
        )}
        {propTab === "live" && (
          <div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%" }}>
                <thead>
                  <tr style={{ background: "linear-gradient(180deg,#F0FDF4 0%,#DCFCE7 100%)" }}>
                    {[
                      { label: "FH ID" }, { label: "Property Name" }, { label: "City" }, { label: "FH Live" },
                      { label: "OTA Live", key: "liveDate" as NLSortKey }, { label: "TAT (days)", key: "tat" as NLSortKey },
                      { label: "" },
                    ].map((h, i) => {
                      const sortable = !!h.key;
                      const active = sortable && liveSortBy === h.key;
                      return (
                        <th key={h.label} onClick={sortable ? () => liveToggleSort(h.key!) : undefined}
                          style={{ padding: "9px 14px", fontSize: 9, fontWeight: 800,
                            color: active ? T.live : "#059669",
                            textTransform: "uppercase", letterSpacing: "0.09em",
                            textAlign: i <= 1 ? "left" : "center",
                            borderBottom: `2px solid ${active ? T.live+"55" : "#86EFAC44"}`,
                            whiteSpace: "nowrap", background: "transparent",
                            cursor: sortable ? "pointer" : "default", userSelect: "none" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            {h.label}
                            {sortable && <span style={{ fontSize: 8, opacity: active ? 1 : 0.4 }}>{active ? (liveSortDir === "asc" ? "▲" : "▼") : "⇅"}</span>}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {liveLoading && <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: T.textMut, fontSize: 12 }}><span style={{ display:"inline-block",animation:"spin 1s linear infinite",marginRight:6 }}>⟳</span>Loading…</td></tr>}
                  {!liveLoading && liveSortedRows.map((row, i) => {
                    const tatColor = row.tat <= 7 ? T.live : row.tat <= 15 ? "#059669" : row.tat <= 30 ? "#B45309" : row.tat <= 60 ? "#C2410C" : T.notLive;
                    return (
                    <tr key={`${row.propertyId}-${i}`} className="nl-row" style={{ borderBottom: `1px solid #F0FDF4`, background: i % 2 === 0 ? "#FFFFFF" : "#F7FEF9" }}>
                      <td style={{ padding: "8px 14px", borderRight: `1px solid #E8F5EC` }}>
                        <span style={{ display:"inline-block", padding:"2px 8px", borderRadius:6, background:"#DCFCE7", color:"#15803D", fontSize:10, fontWeight:800, fontFamily:"monospace" }}>{row.propertyId}</span>
                      </td>
                      <td style={{ padding: "8px 14px", borderRight: `1px solid #E8F5EC`, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.name}>
                        <span style={{ color: T.textPri, fontSize: 12, fontWeight: 600 }}>{row.name}</span>
                      </td>
                      <td style={{ padding: "8px 14px", borderRight: `1px solid #E8F5EC`, textAlign: "center" }}>
                        <span style={{ color: "#64748B", fontSize: 11, background:"#F0FDF4", padding:"1px 8px", borderRadius:4 }}>{row.city || "—"}</span>
                      </td>
                      <td style={{ padding: "8px 14px", borderRight: `1px solid #E8F5EC`, color: "#94A3B8", fontSize: 10, textAlign: "center", fontFamily: "monospace" }}>{fmtDate(row.fhLiveDate)}</td>
                      <td style={{ padding: "8px 14px", borderRight: `1px solid #E8F5EC`, textAlign: "center" }}>
                        <span style={{ display:"inline-flex", alignItems:"center", gap:4, fontSize:10, fontWeight:700, color:"#15803D", background:"#DCFCE7", padding:"2px 10px", borderRadius:20 }}>
                          <span style={{ width:5,height:5,borderRadius:"50%",background:"#22C55E",flexShrink:0 }} />
                          {fmtDate(row.liveDate)}
                        </span>
                      </td>
                      <td style={{ padding: "8px 14px", borderRight: `1px solid #E8F5EC`, textAlign: "center" }}>
                        {row.tat > 0
                          ? <span style={{ display:"inline-block", padding:"3px 10px", borderRadius:20, fontWeight:700, fontSize:10, color:tatColor, background:tatColor+"18", border:`1px solid ${tatColor}30` }}>{row.tat}d</span>
                          : <span style={{ color:"#CBD5E1" }}>—</span>}
                      </td>
                      <td style={{ padding: "8px 14px", textAlign: "center" }}>
                        <a href={`/crm/${row.propertyId}`} style={{ display:"inline-flex", alignItems:"center", gap:4, padding:"4px 12px", fontSize:10, fontWeight:700, background:"linear-gradient(135deg,#22C55E 0%,#16A34A 100%)", color:"#fff", borderRadius:20, textDecoration:"none", boxShadow:"0 2px 6px #16A34A30" }}>Open ↗</a>
                      </td>
                    </tr>
                    );
                  })}
                  {!liveLoading && (liveData?.rows.length === 0) && <tr><td colSpan={7} style={{ textAlign: "center", padding: 40, color: T.textMut, fontSize: 12 }}>No live properties found</td></tr>}
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

        {/* ── Listing Creation Sheet ─────────────────────────────────────────── */}
        {propTab === "listing" && (() => {
          // helpers scoped to this section
          function lcVal(row: LcRow, field: string): string {
            return lcDirty[row.otaListingId]?.[field] ?? (row as unknown as Record<string, string | null>)[field] ?? "";
          }
          function lcIsDirty(id: number, field: string) { return lcDirty[id]?.[field] !== undefined; }
          function lcSetField(id: number, field: string, value: string) {
            setLcDirty(prev => ({ ...prev, [id]: { ...(prev[id] ?? {}), [field]: value } }));
          }

          const lcFiltered = lcRows.filter(r => {
            const s = lcSearch.toLowerCase();
            const matchSearch = !s || r.name?.toLowerCase().includes(s) || r.propertyId?.toLowerCase().includes(s) || r.city?.toLowerCase().includes(s);
            // subStatus is already normalised in lcRows; toolbar dropdown filters by it
            const matchStatus = lcStatusFilter === "all" || (r.subStatus ?? "").toLowerCase() === lcStatusFilter.toLowerCase();
            const isLive = (r.subStatus ?? "") === "Live";
            const matchLiveFilter = lcLiveFilter === "all" || (lcLiveFilter === "live" ? isLive : !isLive);
            const matchOvv = !lcOvvFilter || lcOvvFilter.values.some(v =>
              lcOvvFilter.field === "status"
                ? (r.status ?? "").toLowerCase() === v.toLowerCase()
                : (r.subStatus ?? "").toLowerCase() === v.toLowerCase()
            );
            const matchCb = !lcCbFilterKey || !lcCbFilterVal || (() => {
              const raw = (r.metrics ?? {})[lcCbFilterKey] ?? "";
              if (lcCbFilterVal === "Not Set") return !raw;
              return (raw || "No") === lcCbFilterVal;
            })();
            return matchSearch && matchStatus && matchLiveFilter && matchOvv && matchCb;
          });

          const lcDirtyCount = Object.keys(lcDirty).length;
          const lcAllSel = lcFiltered.length > 0 && lcFiltered.every(r => lcSelected.has(r.otaListingId));
          const lcAnySel = lcSelected.size > 0;

          async function lcSaveAll() {
            if (!lcDirtyCount || lcSaving) return;
            setLcSaving(true);
            const dirtySnapshot = { ...lcDirty };
            const tasks: Promise<{ id: number; ok: boolean }>[] = [];
            for (const [idStr, fields] of Object.entries(dirtySnapshot)) {
              const id = Number(idStr);
              const row = lcRows.find(r => r.otaListingId === id);
              if (!row) continue;
              for (const [field, value] of Object.entries(fields)) {
                tasks.push(
                  fetch("/api/crm/update-status", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ otaListingId: id, propertyId: row.propertyId, field, value }),
                  }).then(r => ({ id, ok: r.ok })).catch(() => ({ id, ok: false }))
                );
              }
            }
            const results = await Promise.all(tasks);
            const okIds = new Set(results.filter(r => r.ok).map(r => r.id));
            const errIds = new Set(results.filter(r => !r.ok).map(r => r.id));
            setLcRows(prev => prev.map(r => {
              if (!okIds.has(r.otaListingId)) return r;
              const d = dirtySnapshot[r.otaListingId] ?? {};
              return { ...r,
                status:      d.status      !== undefined ? d.status      : r.status,
                subStatus:   d.subStatus   !== undefined ? d.subStatus   : r.subStatus,
                otaId:       d.otaId       !== undefined ? d.otaId       : r.otaId,
                liveDate:    d.liveDate    !== undefined ? d.liveDate    : r.liveDate,
                prePost:      d.prePost      !== undefined ? d.prePost      : r.prePost,
                listingLink:  d.listingLink  !== undefined ? d.listingLink  : r.listingLink,
                batchNumber:  d.batchNumber  !== undefined ? d.batchNumber  : r.batchNumber,
                crmNote:      d.note         !== undefined ? d.note         : r.crmNote,
                crmUpdatedAt: new Date().toISOString(),
              };
            }));
            setLcDirty(prev => { const n = { ...prev }; for (const id of okIds) delete n[id]; return n; });
            setLcEditCell(null);
            setLcSaveOk(okIds); setLcSaveErr(errIds); setLcSaving(false);
            setTimeout(() => { setLcSaveOk(new Set()); setLcSaveErr(new Set()); }, 2500);
          }

          async function lcApplyBulk() {
            if (!lcAnySel || !lcBulkField || !lcBulkValue) return;
            // CB field — save directly to ota_metrics for each selected row
            if (lcBulkField.startsWith("cb_")) {
              const selectedRows = lcRows.filter(r => lcSelected.has(r.otaListingId));
              setLcCbBulkState("saving");
              const results = await Promise.all(selectedRows.map(r =>
                fetch("/api/crm/metrics", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ propertyId: r.propertyId, ota: otaName, metricKey: lcBulkField, metricValue: lcBulkValue }),
                }).then(res => res.ok).catch(() => false)
              ));
              const anyFailed = results.some(ok => !ok);
              setLcCbBulkState(anyFailed ? "err" : "ok");
              setTimeout(() => setLcCbBulkState("idle"), 3000);
              // Only update rows where save succeeded
              const savedIds = new Set(selectedRows.filter((_, i) => results[i]).map(r => r.otaListingId));
              setLcRows(prev => prev.map(r =>
                savedIds.has(r.otaListingId)
                  ? { ...r, metrics: { ...(r.metrics ?? {}), [lcBulkField]: lcBulkValue } }
                  : r
              ));
            } else {
              setLcDirty(prev => {
                const next = { ...prev };
                for (const id of lcSelected) {
                  next[id] = { ...(next[id] ?? {}), [lcBulkField]: lcBulkValue };
                  // sub-status is now auto-derived from status; no special logic needed here
                }
                return next;
              });
            }
            setLcBulkField(""); setLcBulkValue(""); setLcSelected(new Set()); setLcEditCell(null);
          }

          function lcSelectByFhIds() {
            const ids = lcBulkIds.split(/[\s,]+/).map(s => s.trim().toUpperCase()).filter(Boolean);
            if (!ids.length) return;
            const matched = new Set<number>();
            for (const row of lcFiltered) {
              if (ids.includes(row.propertyId.toUpperCase())) matched.add(row.otaListingId);
            }
            setLcSelected(prev => { const n = new Set(prev); matched.forEach(id => n.add(id)); return n; });
            setLcBulkIds("");
          }

          const CB_ITEMS = [
            { key: "cb_mapping",          label: "Mapping" },
            { key: "cb_room_plan",        label: "Room Plan" },
            { key: "cb_rate_plan",        label: "Rate Plan" },
            { key: "cb_policy",           label: "Policy" },
            { key: "cb_promotion",        label: "Promotion" },
            { key: "cb_child_time_policy",label: "Child/Time" },
            { key: "cb_image",            label: "Image" },
          ];
          const hasCb = otaName === "Agoda" || otaName === "Ixigo";
          const COLS = `28px 90px minmax(160px,2fr) 80px 80px 90px 120px 130px 120px 90px 80px 90px 90px 160px 160px${hasCb ? " 56px 56px 56px 56px 64px 72px 52px" : ""} 44px`;

          const cellSt = (id: number, field: string): React.CSSProperties => ({
            padding: "5px 6px", borderLeft: "1px solid #E8EDF2",
            background: lcIsDirty(id, field) ? "#FEF9C3" : "transparent",
          });

          const liveFilteredRows = lcRows.filter(r => {
            const isLive = (r.subStatus ?? "") === "Live";
            return lcLiveFilter === "all" || (lcLiveFilter === "live" ? isLive : !isLive);
          });
          const allSubStatuses = [...new Set(liveFilteredRows.map(r => r.subStatus).filter(Boolean))].sort();

          const saveCbField = async (propertyId: string, cbKey: string, value: string) => {
            const k = propertyId + cbKey;
            setCbSaving(p => ({ ...p, [k]: true }));
            setCbError(p => ({ ...p, [k]: false }));
            try {
              const res = await fetch("/api/crm/metrics", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ propertyId, ota: otaName, metricKey: cbKey, metricValue: value }),
              });
              if (!res.ok) throw new Error("save failed");
              setLcRows(prev => prev.map(r => r.propertyId === propertyId
                ? { ...r, metrics: { ...(r.metrics ?? {}), [cbKey]: value } }
                : r
              ));
            } catch {
              setCbError(p => ({ ...p, [k]: true }));
              setTimeout(() => setCbError(p => ({ ...p, [k]: false })), 3000);
            }
            setCbSaving(p => ({ ...p, [k]: false }));
          };

          return (
            <div style={{ background: "#FAFAFA" }}>

              {/* Sheet toolbar */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#fff", borderBottom: "1px solid #E2E8F0", flexWrap: "wrap" }}>
                {/* Search */}
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: "#9CA3AF", fontSize: 12, pointerEvents: "none" }}>⌕</span>
                  <input value={lcSearch} onChange={e => setLcSearch(e.target.value)} placeholder="Search name / city…"
                    style={{ padding: "6px 10px 6px 26px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 11, outline: "none", background: "#F8FAFC", width: 200 }} />
                </div>
                {/* Active overview filter badge */}
                {lcOvvFilter && (
                  <div style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"4px 10px", borderRadius:20, background:"#EDE9FE", border:"1px solid #7C3AED40", fontSize:10, fontWeight:700, color:"#6D28D9" }}>
                    <span>⬡ {lcOvvFilter.label}</span>
                    <button onClick={() => setLcOvvFilter(null)} style={{ background:"none", border:"none", cursor:"pointer", color:"#7C3AED", fontSize:12, lineHeight:1, padding:0 }}>×</button>
                  </div>
                )}
                {/* Live / Not Live toggle */}
                <div style={{ display: "flex", borderRadius: 8, border: "1px solid #E2E8F0", overflow: "hidden", flexShrink: 0 }}>
                  {(["notlive", "all", "live"] as const).map((v, i) => {
                    const labels = { notlive: "Not Live", all: "All", live: "Live" };
                    const active = lcLiveFilter === v;
                    const activeColor = v === "live" ? "#16A34A" : v === "notlive" ? "#DC2626" : "#6366F1";
                    return (
                      <button key={v} onClick={() => setLcLiveFilter(v)}
                        style={{ padding: "5px 10px", fontSize: 11, fontWeight: active ? 700 : 500, border: "none",
                          borderLeft: i > 0 ? "1px solid #E2E8F0" : "none",
                          background: active ? activeColor : "#F8FAFC", color: active ? "#fff" : "#64748B", cursor: "pointer" }}>
                        {labels[v]}
                      </button>
                    );
                  })}
                </div>
                {/* Sub-status filter */}
                <select value={lcStatusFilter} onChange={e => setLcStatusFilter(e.target.value)}
                  style={{ padding: "6px 10px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 11, background: lcStatusFilter !== "all" ? "#EDE9FE" : "#F8FAFC", color: lcStatusFilter !== "all" ? "#6D28D9" : "#374151", outline: "none", cursor: "pointer" }}>
                  <option value="all">All Sub-statuses</option>
                  {allSubStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {/* FH Status filter */}
                <CheckboxDropdown
                  label="FH Status"
                  options={["Live","SoldOut","Churned"]}
                  selected={lcFhStatus}
                  onChange={next => { setLcFhStatus(next); loadLc(next); }}
                />
                {/* Content Box filter — Agoda / Ixigo only, two-level */}
                {hasCb && (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <select value={lcCbFilterKey} onChange={e => { setLcCbFilterKey(e.target.value); setLcCbFilterVal(""); }}
                      style={{ padding: "5px 8px", border: `1px solid ${lcCbFilterKey ? "#7C3AED" : "#E2E8F0"}`, borderRadius: 8, fontSize: 11, fontWeight: lcCbFilterKey ? 700 : 400,
                        background: lcCbFilterKey ? "#F3EFFF" : "#F8FAFC", color: lcCbFilterKey ? "#6D28D9" : "#64748B", outline: "none", cursor: "pointer" }}>
                      <option value="">Content Boxes ▾</option>
                      {CB_ITEMS.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}
                    </select>
                    {lcCbFilterKey && !lcCbFilterVal && (
                      <span style={{ fontSize: 10, color: "#94A3B8", fontStyle: "italic" }}>pick Yes or No →</span>
                    )}
                    {lcCbFilterKey && (
                      <select value={lcCbFilterVal} onChange={e => setLcCbFilterVal(e.target.value)}
                        style={{ padding: "5px 8px", border: `1px solid ${lcCbFilterVal ? "#7C3AED" : "#E2E8F0"}`, borderRadius: 8, fontSize: 11, fontWeight: lcCbFilterVal ? 700 : 400,
                          background: lcCbFilterVal === "Yes" ? "#D1FAE5" : lcCbFilterVal === "No" ? "#FEE2E2" : "#F8FAFC",
                          color: lcCbFilterVal === "Yes" ? "#059669" : lcCbFilterVal === "No" ? "#DC2626" : "#64748B",
                          outline: "none", cursor: "pointer" }}>
                        <option value="">Yes / No ▾</option>
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                        <option value="Not Set">Not Set</option>
                      </select>
                    )}
                    {(lcCbFilterKey || lcCbFilterVal) && (
                      <button onClick={() => { setLcCbFilterKey(""); setLcCbFilterVal(""); }}
                        style={{ padding: "4px 7px", borderRadius: 6, border: "1px solid #E2E8F0", background: "transparent", color: "#94A3B8", fontSize: 11, cursor: "pointer" }}>×</button>
                    )}
                  </div>
                )}
                {/* FH ID bulk select */}
                <div style={{ display: "flex", alignItems: "center", gap: 4, background: "#F0F4FF", border: "1px solid #C7D2FE", borderRadius: 8, padding: "3px 4px 3px 10px" }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: "#6366F1", whiteSpace: "nowrap" }}>FH IDs</span>
                  <input
                    value={lcBulkIds}
                    onChange={e => setLcBulkIds(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") lcSelectByFhIds(); }}
                    placeholder="FH001 FH002…"
                    style={{ padding: "4px 8px", border: "none", borderRadius: 6, fontSize: 11, outline: "none", background: "transparent", width: 160, color: "#374151" }}
                  />
                  <button onClick={lcSelectByFhIds} disabled={!lcBulkIds.trim()}
                    style={{ padding: "4px 10px", borderRadius: 6, border: "none", background: lcBulkIds.trim() ? "#6366F1" : "#C7D2FE", color: "#fff", fontSize: 10, fontWeight: 700, cursor: lcBulkIds.trim() ? "pointer" : "not-allowed" }}>
                    Select
                  </button>
                </div>
                <button onClick={() => loadLc()} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", color: "#374151" }}>↻</button>
                <button onClick={() => { setLcOtaIdPaste(""); setLcOtaIdUploadOpen(true); }}
                  style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #7C3AED", background: "#EDE9FE", fontSize: 11, fontWeight: 700, cursor: "pointer", color: "#7C3AED" }}>
                  ⬆ Upload OTA IDs
                </button>
                <div style={{ flex: 1 }} />
                {lcDirtyCount > 0 && <span style={{ fontSize: 11, fontWeight: 700, background: "#FEF9C3", color: "#854D0E", border: "1px solid #FDE68A", borderRadius: 20, padding: "3px 10px" }}>{lcDirtyCount} unsaved</span>}
                {lcDirtyCount > 0 && (
                  <button onClick={() => { if (window.confirm(`Discard ${lcDirtyCount} unsaved change${lcDirtyCount > 1 ? "s" : ""}?`)) { setLcDirty({}); setLcEditCell(null); } }} disabled={lcSaving}
                    style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", color: "#DC2626" }}>
                    Clear
                  </button>
                )}
                <button onClick={lcSaveAll} disabled={lcDirtyCount === 0 || lcSaving}
                  style={{ padding: "7px 18px", borderRadius: 8, border: "none", background: lcDirtyCount > 0 ? "linear-gradient(135deg,#8B5CF6,#7C3AED)" : "#E2E8F0", color: lcDirtyCount > 0 ? "#fff" : "#9CA3AF", fontSize: 11, fontWeight: 700, cursor: lcDirtyCount > 0 ? "pointer" : "not-allowed", opacity: lcSaving ? 0.7 : 1, boxShadow: lcDirtyCount > 0 ? "0 2px 8px #7C3AED40" : "none" }}>
                  {lcSaving ? "Saving…" : `Save All${lcDirtyCount > 0 ? ` (${lcDirtyCount})` : ""}`}
                </button>
              </div>

              {/* Bulk bar */}
              {lcAnySel && (() => {
                const BULK_FIELDS = [
                  { key: "status",      label: "Status",       type: "select", options: (() => { const s = Array.from(new Set([...scOtaStatuses, ...Object.keys(scStatusMap)])).sort(); return s.length ? s : STATUS_OPTIONS_LC; })() },
                  { key: "prePost",     label: "Pre/Post",     type: "select", options: ["Preset","Postset"] },
                  { key: "batchNumber", label: "Batch",        type: "text",   options: [] },
                  { key: "liveDate",    label: "OTA Live Date",type: "date",   options: [] },
                  { key: "listingLink", label: "Listing Link", type: "text",   options: [] },
                  { key: "note",        label: "Note",         type: "text",   options: [] },
                  ...(hasCb ? CB_ITEMS.map(c => ({ key: c.key, label: `CB: ${c.label}`, type: "cb", options: ["Yes","No"] })) : []),
                ];
                const fieldDef = BULK_FIELDS.find(f => f.key === lcBulkField);
                const canApply = !!lcBulkField && !!lcBulkValue;
                return (
                  <div style={{ background: "#1E1B4B", padding: "7px 12px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#C7D2FE" }}>Bulk: {lcSelected.size} row{lcSelected.size > 1 ? "s" : ""}</span>
                    <div style={{ width: 1, height: 14, background: "#4338CA" }} />
                    <select value={lcBulkField} onChange={e => { setLcBulkField(e.target.value); setLcBulkValue(""); }}
                      style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid #4338CA", background: "#312E81", color: lcBulkField ? "#fff" : "#818CF8", fontSize: 11, outline: "none", cursor: "pointer" }}>
                      <option value="">Select field…</option>
                      {BULK_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                    {fieldDef && (fieldDef.type === "select" || fieldDef.type === "cb") && (
                      <select value={lcBulkValue} onChange={e => setLcBulkValue(e.target.value)}
                        style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid #4338CA", background: "#312E81", color: lcBulkValue ? "#fff" : "#818CF8", fontSize: 11, outline: "none", cursor: "pointer" }}>
                        <option value="">Set value…</option>
                        {fieldDef.options.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    )}
                    {fieldDef && fieldDef.type === "date" && (
                      <input type="date" value={lcBulkValue} onChange={e => setLcBulkValue(e.target.value)}
                        style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid #4338CA", background: "#312E81", color: "#fff", fontSize: 11, outline: "none" }} />
                    )}
                    {fieldDef && fieldDef.type === "text" && (
                      <input value={lcBulkValue} onChange={e => setLcBulkValue(e.target.value)} placeholder={`Set ${fieldDef.label}…`}
                        style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid #4338CA", background: "#312E81", color: "#fff", fontSize: 11, outline: "none", width: 200 }} />
                    )}
                    <button onClick={lcApplyBulk} disabled={!canApply || lcCbBulkState === "saving"}
                      style={{ padding: "5px 14px", borderRadius: 5, border: "none", background: "#6366F1", color: "#fff", fontSize: 11, fontWeight: 700, cursor: canApply ? "pointer" : "not-allowed", opacity: canApply && lcCbBulkState !== "saving" ? 1 : 0.5 }}>
                      {lcCbBulkState === "saving" ? "Saving…" : "Apply →"}
                    </button>
                    {lcCbBulkState === "ok"  && <span style={{ fontSize: 11, color: "#6EE7B7", fontWeight: 700 }}>✓ Saved</span>}
                    {lcCbBulkState === "err" && <span style={{ fontSize: 11, color: "#FCA5A5", fontWeight: 700 }}>✗ Some saves failed</span>}
                    <button onClick={() => setLcSelected(new Set())}
                      style={{ padding: "5px 8px", borderRadius: 5, border: "1px solid #4338CA", background: "transparent", color: "#818CF8", fontSize: 11, cursor: "pointer" }}>Cancel</button>
                  </div>
                );
              })()}

              {/* OTA ID Upload Modal */}
              {lcOtaIdUploadOpen && (() => {
                // Parse pasted text: each line = "FH_ID<tab or comma>OTA_ID"
                const lines = lcOtaIdPaste.split("\n").map(l => l.trim()).filter(Boolean);
                const parsed: { fhId: string; otaId: string; row: LcRow | undefined }[] = [];
                for (const line of lines) {
                  const parts = line.includes("\t") ? line.split("\t") : line.split(",");
                  const fhId  = parts[0]?.trim();
                  const otaId = parts[1]?.trim();
                  if (!fhId || !otaId) continue;
                  // skip header row
                  if (fhId.toLowerCase().includes("fh") && isNaN(Number(otaId))) continue;
                  const row = lcRows.find(r => r.propertyId === fhId);
                  parsed.push({ fhId, otaId, row });
                }
                const matched   = parsed.filter(p => p.row);
                const unmatched = parsed.filter(p => !p.row);

                function applyOtaIds() {
                  for (const p of matched) {
                    if (p.row) lcSetField(p.row.otaListingId, "otaId", p.otaId);
                  }
                  setLcOtaIdUploadOpen(false);
                  setLcOtaIdPaste("");
                }

                return (
                  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ background: "#fff", borderRadius: 14, width: 620, maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
                      {/* Header */}
                      <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>Bulk Upload OTA IDs</div>
                          <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Paste two columns: FH ID and OTA ID (tab or comma separated)</div>
                        </div>
                        <button onClick={() => setLcOtaIdUploadOpen(false)} style={{ fontSize: 18, background: "none", border: "none", cursor: "pointer", color: "#94A3B8", lineHeight: 1 }}>✕</button>
                      </div>

                      {/* Paste area */}
                      <div style={{ padding: "14px 20px", borderBottom: "1px solid #E2E8F0" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                          Paste data below (e.g. from Excel — FH ID column + OTA ID column)
                        </div>
                        <textarea
                          value={lcOtaIdPaste}
                          onChange={e => setLcOtaIdPaste(e.target.value)}
                          placeholder={"FH12345\t98765432\nFH12346\t98765433\n..."}
                          rows={5}
                          style={{ width: "100%", fontFamily: "monospace", fontSize: 12, padding: "8px 10px", border: "1.5px solid #C7D2FE", borderRadius: 8, outline: "none", resize: "vertical", color: "#1E293B", background: "#F8FAFF", boxSizing: "border-box" }}
                        />
                      </div>

                      {/* Preview */}
                      {parsed.length > 0 && (
                        <div style={{ padding: "12px 20px", overflowY: "auto", flex: 1 }}>
                          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                            {matched.length > 0
                              ? <div style={{ fontSize: 11, fontWeight: 700, color: "#16A34A", background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 20, padding: "2px 10px" }}>✓ {matched.length} matched</div>
                              : <div style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 20, padding: "2px 10px" }}>No FH IDs matched — check the IDs and try again</div>
                            }
                            {unmatched.length > 0 && <div style={{ fontSize: 11, fontWeight: 700, color: "#DC2626", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 20, padding: "2px 10px" }}>✗ {unmatched.length} not found</div>}
                          </div>
                          <div style={{ border: "1px solid #E2E8F0", borderRadius: 8, overflow: "hidden" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 80px", background: "#F1F5F9", padding: "6px 10px", fontSize: 9, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", gap: 8 }}>
                              <div>FH ID</div><div>Property</div><div>OTA ID</div><div>Status</div>
                            </div>
                            {parsed.map((p, i) => (
                              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 80px", padding: "6px 10px", fontSize: 11, borderTop: "1px solid #F1F5F9", gap: 8, background: p.row ? "#fff" : "#FEF2F2" }}>
                                <div style={{ fontFamily: "monospace", color: "#374151", fontWeight: 600 }}>{p.fhId}</div>
                                <div style={{ color: "#64748B", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.row?.name ?? "—"}</div>
                                <div style={{ fontFamily: "monospace", color: "#7C3AED", fontWeight: 600 }}>{p.otaId}</div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: p.row ? "#16A34A" : "#DC2626" }}>{p.row ? "✓ Match" : "✗ Not found"}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Footer */}
                      <div style={{ padding: "12px 20px", borderTop: "1px solid #E2E8F0", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                        <button onClick={() => setLcOtaIdUploadOpen(false)} style={{ padding: "7px 16px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#374151" }}>Cancel</button>
                        <button onClick={applyOtaIds} disabled={matched.length === 0}
                          style={{ padding: "7px 20px", borderRadius: 8, border: "none", background: matched.length > 0 ? "linear-gradient(135deg,#8B5CF6,#7C3AED)" : "#E2E8F0", color: matched.length > 0 ? "#fff" : "#9CA3AF", fontSize: 12, fontWeight: 700, cursor: matched.length > 0 ? "pointer" : "not-allowed", boxShadow: matched.length > 0 ? "0 2px 8px #7C3AED40" : "none" }}>
                          Apply {matched.length > 0 ? `${matched.length} OTA IDs` : ""}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Sheet grid */}
              <div style={{ overflowX: "auto" }}>
                <div style={{ minWidth: hasCb ? 2070 : 1650 }}>
                  {/* Header row */}
                  <div style={{ display: "grid", gridTemplateColumns: COLS, background: "#F1F5F9", borderBottom: "2px solid #E2E8F0", padding: "0 8px", position: "sticky", top: 0, zIndex: 5 }}>
                    <div style={{ padding: "7px 4px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <input type="checkbox" checked={lcAllSel} onChange={() => {
                        if (lcAllSel) setLcSelected(prev => { const n = new Set(prev); lcFiltered.forEach(r => n.delete(r.otaListingId)); return n; });
                        else setLcSelected(prev => { const n = new Set(prev); lcFiltered.forEach(r => n.add(r.otaListingId)); return n; });
                      }} style={{ accentColor: "#7C3AED", width: 12, height: 12, cursor: "pointer" }} />
                    </div>
                    <div style={{ padding: "7px 6px", fontSize: 9, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.4, display: "flex", alignItems: "center", borderLeft: "1px solid #E2E8F0" }}>FH ID</div>
                    {["Property","City","FH St.","FH Date","OTA ID","Status","Sub-status","OTA Date","TAT","Batch","Pre/Post","Listing Link","Note",...(hasCb ? CB_ITEMS.map(c => c.label) : []),""].map(h => (
                      <div key={h} style={{ padding: "7px 6px", fontSize: 9, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.4, borderLeft: "1px solid #E2E8F0", display: "flex", alignItems: "center" }}>{h}</div>
                    ))}
                  </div>

                  {/* Loading */}
                  {lcLoading && <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 12 }}>Loading…</div>}
                  {!lcLoading && lcError && <div style={{ padding: 40, textAlign: "center", color: "#DC2626", fontSize: 12 }}>Error: {lcError} — <button onClick={() => loadLc()} style={{ textDecoration: "underline", background: "none", border: "none", cursor: "pointer", color: "#DC2626", fontSize: 12 }}>Retry</button></div>}

                  {/* Data rows */}
                  {!lcLoading && lcFiltered.map((row, i) => {
                    const isSel    = lcSelected.has(row.otaListingId);
                    const anyDirty = !!(lcDirty[row.otaListingId] && Object.keys(lcDirty[row.otaListingId]).length);
                    const isSaveOk  = lcSaveOk.has(row.otaListingId);
                    const isSaveErr = lcSaveErr.has(row.otaListingId);
                    const rowBg = isSaveOk ? "#F0FDF4" : isSaveErr ? "#FEF2F2" : isSel ? "#EDE9FE" : anyDirty ? "#FEFCE8" : i % 2 === 0 ? "#FFFFFF" : "#FAFBFC";

                    const statusVal    = lcVal(row, "status");
                    const subStatusVal = lcVal(row, "subStatus");
                    const otaIdVal     = lcVal(row, "otaId");
                    const liveDateVal  = lcVal(row, "liveDate") || "";
                    const prePostVal   = lcVal(row, "prePost");
                    const linkVal      = lcVal(row, "listingLink");
                    const batchVal     = lcVal(row, "batchNumber");
                    const noteVal      = lcDirty[row.otaListingId]?.note ?? row.crmNote ?? "";

                    const sc = getSSColor(subStatusVal);

                    return (
                      <div key={row.otaListingId} style={{ display: "grid", gridTemplateColumns: COLS, padding: "0 8px", background: rowBg, borderBottom: "1px solid #F0F4F8", alignItems: "stretch", outline: isSel ? "2px solid #7C3AED" : "none", outlineOffset: -1 }}>
                        {/* Checkbox */}
                        <div style={{ padding: "8px 4px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <input type="checkbox" checked={isSel} onChange={() => setLcSelected(prev => { const n = new Set(prev); n.has(row.otaListingId) ? n.delete(row.otaListingId) : n.add(row.otaListingId); return n; })}
                            style={{ accentColor: "#7C3AED", width: 12, height: 12, cursor: "pointer" }} />
                        </div>
                        {/* FH ID */}
                        <div style={{ padding: "8px 10px", borderLeft: "1px solid #F0F4F8", display: "flex", alignItems: "center" }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: "#F97316", background: "#FFF4EC", padding: "2px 8px", borderRadius: 6, fontFamily: "monospace", letterSpacing: "0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 80 }}>{row.propertyId}</span>
                        </div>
                        {/* Property */}
                        <div style={{ borderLeft: "1px solid #F0F4F8", padding: "8px 10px", minWidth: 0 }}>
                          <a href={`/crm/${row.propertyId}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 600, color: "#0F172A", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none" }} title={row.name}>{row.name || "—"}</a>
                        </div>
                        {/* City */}
                        <div style={{ padding: "8px 10px", borderLeft: "1px solid #F0F4F8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>
                          <span style={{ fontSize: 11, color: "#64748B", background: "#F8FAFC", padding: "1px 8px", borderRadius: 4 }}>{row.city || "—"}</span>
                        </div>
                        {/* FH Status */}
                        <div style={{ padding: "8px 10px", borderLeft: "1px solid #F0F4F8", textAlign: "center" }}>
                          <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 10, background: row.fhStatus === "Live" ? "#DCFCE7" : "#F1F5F9", color: row.fhStatus === "Live" ? "#15803D" : "#64748B" }}>{row.fhStatus || "—"}</span>
                        </div>
                        {/* FH Date */}
                        <div style={{ padding: "8px 10px", borderLeft: "1px solid #F0F4F8", fontSize: 10, color: "#94A3B8", fontFamily: "monospace", textAlign: "center" }}>{fmtDate(row.fhLiveDate)}</div>
                        {/* OTA ID — editable */}
                        <div style={cellSt(row.otaListingId, "otaId")} onClick={() => setLcEditCell({ id: row.otaListingId, field: "otaId" })}>
                          {lcEditCell?.id === row.otaListingId && lcEditCell.field === "otaId" ? (
                            <input autoFocus value={otaIdVal} onChange={e => lcSetField(row.otaListingId, "otaId", e.target.value)}
                              onBlur={() => setLcEditCell(null)} onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") setLcEditCell(null); }}
                              style={{ width: "100%", padding: "2px 5px", border: "2px solid #7C3AED", borderRadius: 4, fontSize: 11, outline: "none", boxSizing: "border-box" }} />
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                              <span style={{ fontSize: 11, color: otaIdVal ? "#374151" : "#CBD5E1", fontWeight: otaIdVal ? 600 : 400 }}>{otaIdVal || "Add ID…"}</span>
                              <span style={{ fontSize: 9, color: "#CBD5E1", marginLeft: "auto" }}>✎</span>
                            </div>
                          )}
                        </div>
                        {/* Status — editable dropdown (OTA-specific statuses from DB) */}
                        <div style={cellSt(row.otaListingId, "status")} onClick={() => setLcEditCell({ id: row.otaListingId, field: "status" })}>
                          {lcEditCell?.id === row.otaListingId && lcEditCell.field === "status" ? (
                            <select autoFocus value={statusVal}
                              onChange={e => {
                                const newStatus = e.target.value;
                                lcSetField(row.otaListingId, "status", newStatus);
                                setLcEditCell(null);
                              }}
                              onBlur={() => setLcEditCell(null)}
                              style={{ width: "100%", padding: "2px 4px", border: "2px solid #7C3AED", borderRadius: 4, fontSize: 11, outline: "none", cursor: "pointer" }}>
                              <option value="">— Select —</option>
                              {(Array.from(new Set([...scOtaStatuses, ...Object.keys(scStatusMap)])).sort() || STATUS_OPTIONS_LC).map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                              {statusVal
                                ? <span style={{ fontSize: 10, fontWeight: 600, color: "#475569", background: "#F1F5F9", padding: "2px 8px", borderRadius: 20 }}>{statusVal}</span>
                                : <span style={{ fontSize: 10, color: "#CBD5E1" }}>—</span>}
                              <span style={{ fontSize: 9, color: "#CBD5E1", marginLeft: "auto" }}>▾</span>
                            </div>
                          )}
                        </div>
                        {/* Sub-status — read-only, auto-derived from status config (preset/postset) */}
                        {(() => {
                          const prePostKey = (row.prePost ?? "").toLowerCase().includes("post") ? "postset" : "preset";
                          const derivedSS = scStatusMap[statusVal]?.[prePostKey] ?? subStatusVal;
                          const dsc = getSSColor(derivedSS);
                          return (
                            <div style={{ padding: "8px 10px", borderLeft: "1px solid #F0F4F8", display: "flex", alignItems: "center" }}>
                              {derivedSS
                                ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, background: dsc.bg, color: dsc.text, border: `1px solid ${dsc.text}20` }}>
                                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: dsc.text, flexShrink: 0 }} />
                                    {derivedSS}
                                  </span>
                                : <span style={{ fontSize: 10, color: "#CBD5E1" }}>—</span>}
                            </div>
                          );
                        })()}
                        {/* OTA Live Date — editable */}
                        <div style={cellSt(row.otaListingId, "liveDate")} onClick={() => setLcEditCell({ id: row.otaListingId, field: "liveDate" })}>
                          {lcEditCell?.id === row.otaListingId && lcEditCell.field === "liveDate" ? (
                            <input autoFocus type="date" value={liveDateVal} onChange={e => lcSetField(row.otaListingId, "liveDate", e.target.value)}
                              onBlur={() => setLcEditCell(null)}
                              style={{ width: "100%", padding: "2px 4px", border: "2px solid #7C3AED", borderRadius: 4, fontSize: 11, outline: "none", boxSizing: "border-box" }} />
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                              <span style={{ fontSize: 10, color: liveDateVal ? "#64748B" : "#CBD5E1", fontFamily: "monospace" }}>{liveDateVal ? fmtDate(liveDateVal) : "Set date…"}</span>
                              <span style={{ fontSize: 9, color: "#CBD5E1", marginLeft: "auto" }}>✎</span>
                            </div>
                          )}
                        </div>
                        {/* TAT */}
                        <div style={{ padding: "8px 10px", borderLeft: "1px solid #F0F4F8", textAlign: "center" }}>
                          {row.tat != null && row.tat > 0
                            ? (() => {
                                const t = row.tat;
                                const tatColor = t > 365 ? "#7F1D1D" : t > 90 ? "#DC2626" : t > 30 ? "#C2410C" : t > 15 ? "#B45309" : "#64748B";
                                return <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 20, fontWeight: 700, fontSize: 10, color: tatColor, background: tatColor + "18", border: `1px solid ${tatColor}30` }}>{t}d</span>;
                              })()
                            : <span style={{ color: "#CBD5E1" }}>—</span>}
                        </div>
                        {/* Batch — editable */}
                        <div style={cellSt(row.otaListingId, "batchNumber")} onClick={() => setLcEditCell({ id: row.otaListingId, field: "batchNumber" })}>
                          {lcEditCell?.id === row.otaListingId && lcEditCell.field === "batchNumber" ? (
                            <input autoFocus value={batchVal} onChange={e => lcSetField(row.otaListingId, "batchNumber", e.target.value)}
                              onBlur={() => setLcEditCell(null)} onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") setLcEditCell(null); }}
                              style={{ width: "100%", padding: "2px 5px", border: "2px solid #7C3AED", borderRadius: 4, fontSize: 11, outline: "none", boxSizing: "border-box" }} />
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                              {batchVal
                                ? <span style={{ fontSize: 10, fontWeight: 700, color: "#6D28D9", background: "#EDE9FE", padding: "2px 7px", borderRadius: 10 }}>{batchVal}</span>
                                : <span style={{ fontSize: 10, color: "#CBD5E1" }}>—</span>}
                              <span style={{ fontSize: 9, color: "#CBD5E1", marginLeft: "auto" }}>✎</span>
                            </div>
                          )}
                        </div>
                        {/* Pre/Post — editable */}
                        <div style={cellSt(row.otaListingId, "prePost")} onClick={() => setLcEditCell({ id: row.otaListingId, field: "prePost" })}>
                          {lcEditCell?.id === row.otaListingId && lcEditCell.field === "prePost" ? (
                            <select autoFocus value={prePostVal} onChange={e => { lcSetField(row.otaListingId, "prePost", e.target.value); setLcEditCell(null); }} onBlur={() => setLcEditCell(null)}
                              style={{ width: "100%", padding: "2px 4px", border: "2px solid #7C3AED", borderRadius: 4, fontSize: 11, outline: "none", cursor: "pointer" }}>
                              <option value="">—</option>
                              <option value="Preset">Preset</option>
                              <option value="Postset">Postset</option>
                            </select>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                              <span style={{ fontSize: 10, fontWeight: 600, color: prePostVal ? "#374151" : "#CBD5E1" }}>{prePostVal || "—"}</span>
                              <span style={{ fontSize: 9, color: "#CBD5E1", marginLeft: "auto" }}>▾</span>
                            </div>
                          )}
                        </div>
                        {/* Listing Link — editable */}
                        <div style={cellSt(row.otaListingId, "listingLink")} onClick={() => setLcEditCell({ id: row.otaListingId, field: "listingLink" })}>
                          {lcEditCell?.id === row.otaListingId && lcEditCell.field === "listingLink" ? (
                            <input autoFocus value={linkVal} onChange={e => lcSetField(row.otaListingId, "listingLink", e.target.value)}
                              onBlur={() => setLcEditCell(null)} onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") setLcEditCell(null); }}
                              style={{ width: "100%", padding: "2px 5px", border: "2px solid #7C3AED", borderRadius: 4, fontSize: 11, outline: "none", boxSizing: "border-box" }} />
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                              {linkVal
                                ? <a href={linkVal} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: "#3B82F6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }} onClick={e => e.stopPropagation()}>{linkVal}</a>
                                : <span style={{ fontSize: 10, color: "#CBD5E1" }}>Add link…</span>}
                              <span style={{ fontSize: 9, color: "#CBD5E1", flexShrink: 0 }}>✎</span>
                            </div>
                          )}
                        </div>
                        {/* Note — editable */}
                        <div style={cellSt(row.otaListingId, "note")} onClick={() => setLcEditCell({ id: row.otaListingId, field: "note" })}>
                          {lcEditCell?.id === row.otaListingId && lcEditCell.field === "note" ? (
                            <input autoFocus value={noteVal} onChange={e => lcSetField(row.otaListingId, "note", e.target.value)}
                              onBlur={() => setLcEditCell(null)} onKeyDown={e => { if (e.key === "Enter" || e.key === "Escape") setLcEditCell(null); }}
                              style={{ width: "100%", padding: "2px 5px", border: "2px solid #7C3AED", borderRadius: 4, fontSize: 11, outline: "none", boxSizing: "border-box" }} />
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                              <span style={{ fontSize: 10, color: noteVal ? "#374151" : "#CBD5E1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{noteVal || "Add note…"}</span>
                              <span style={{ fontSize: 9, color: "#CBD5E1", flexShrink: 0 }}>✎</span>
                            </div>
                          )}
                        </div>
                        {/* Content Boxes — 7 individual columns, Agoda / Ixigo only */}
                        {hasCb && CB_ITEMS.map(item => {
                          const k = row.propertyId + item.key;
                          const current = (row.metrics ?? {})[item.key] || "No";
                          const isSavingThis = !!cbSaving[k];
                          const isErrThis    = !!cbError[k];
                          return (
                            <div key={item.key} style={{ borderLeft: "1px solid #F0F4F8", padding: "4px 5px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <select
                                value={current}
                                disabled={isSavingThis}
                                onChange={e => saveCbField(row.propertyId, item.key, e.target.value)}
                                title={isErrThis ? "Save failed — try again" : undefined}
                                style={{ width: "100%", padding: "2px 3px", borderRadius: 5, fontSize: 10, fontWeight: 600, cursor: isSavingThis ? "wait" : "pointer", outline: "none",
                                  border: `1px solid ${isErrThis ? "#F87171" : current === "Yes" ? "#6EE7B7" : "#FCA5A5"}`,
                                  background: isErrThis ? "#FEF2F2" : current === "Yes" ? "#D1FAE5" : "#FEE2E2",
                                  color: isErrThis ? "#DC2626" : current === "Yes" ? "#059669" : "#DC2626",
                                  opacity: isSavingThis ? 0.5 : 1 }}>
                                <option value="Yes">Yes</option>
                                <option value="No">No</option>
                              </select>
                            </div>
                          );
                        })}
                        {/* Save feedback / CRM */}
                        <div style={{ padding: "8px 6px", borderLeft: "1px solid #F0F4F8", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {isSaveOk ? <span style={{ fontSize: 12, color: "#16A34A" }}>✓</span>
                            : isSaveErr ? <span style={{ fontSize: 12, color: "#DC2626" }} title="Save failed">✕</span>
                            : <a href={`/crm/${row.propertyId}`} target="_blank" rel="noopener noreferrer"
                                style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "4px 10px", fontSize: 10, fontWeight: 700, background: "linear-gradient(135deg,#667eea 0%,#5D87FF 100%)", color: "#fff", borderRadius: 20, textDecoration: "none", boxShadow: "0 2px 6px #5D87FF30", whiteSpace: "nowrap" }}>
                                CRM ↗
                              </a>}
                        </div>
                      </div>
                    );
                  })}

                  {!lcLoading && lcFiltered.length === 0 && (
                    <div style={{ padding: 40, textAlign: "center", color: "#9CA3AF", fontSize: 12 }}>No rows found</div>
                  )}
                </div>
              </div>

              {/* Row count footer */}
              <div style={{ padding: "6px 12px", background: "#F8FAFC", borderTop: "1px solid #E2E8F0", fontSize: 10, color: "#94A3B8" }}>
                {lcFiltered.length.toLocaleString()} rows{lcFiltered.length !== lcRows.length ? ` (of ${lcRows.length})` : ""}
                {lcSaveErr.size > 0 && <span style={{ color: "#DC2626", fontWeight: 700, marginLeft: 12 }}>{lcSaveErr.size} rows failed to save</span>}
              </div>
            </div>
          );
        })()}

        {/* ── Status Config tab ──────────────────────────────────────── */}
        {propTab === "config" && (
          <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden" }}>
            {/* Header */}
            <div style={{ padding: "12px 16px", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.textPri }}>Status Config · {otaName}</span>
                {scConfig?.updatedAt && (
                  <span style={{ fontSize: 10, color: T.textMut, marginLeft: 10 }}>
                    Last saved {new Date(scConfig.updatedAt).toLocaleDateString("en-IN")}{scConfig.updatedBy ? ` by ${scConfig.updatedBy}` : ""}
                  </span>
                )}
                {scConfig?.isDefault && (
                  <span style={{ marginLeft: 8, fontSize: 10, padding: "2px 6px", borderRadius: 99, background: "#FEF3C7", color: "#B45309", fontWeight: 700 }}>Default</span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {scSaveOk  && <span style={{ fontSize: 11, color: "#16A34A", fontWeight: 700 }}>✓ Saved</span>}
                {scSaveErr && <span style={{ fontSize: 11, color: "#DC2626", fontWeight: 700 }}>✗ Save failed</span>}
                <button
                  onClick={async () => {
                    setScSaving(true); setScSaveOk(false); setScSaveErr(false);
                    try {
                      const res = await fetch("/api/admin/status-config", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ota: otaName, statusSubStatusMap: scStatusMap }),
                      });
                      if (!res.ok) throw new Error("failed");
                      setScConfig(prev => prev ? { ...prev, statusSubStatusMap: { ...scStatusMap }, isDefault: false } : prev);
                      setScSaveOk(true);
                      setTimeout(() => setScSaveOk(false), 3000);
                    } catch {
                      setScSaveErr(true);
                      setTimeout(() => setScSaveErr(false), 3000);
                    }
                    setScSaving(false);
                  }}
                  disabled={scSaving}
                  style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: "#0EA5E9", color: "#fff", fontSize: 11, fontWeight: 700, cursor: scSaving ? "not-allowed" : "pointer", opacity: scSaving ? 0.6 : 1 }}>
                  {scSaving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>

            {scLoading && <div style={{ padding: 40, textAlign: "center", color: T.textMut, fontSize: 12 }}>Loading…</div>}

            {!scLoading && (() => {
              // All unique sub-statuses in the map (for dropdown options)
              const existingSS = Array.from(new Set(
                Object.values(scStatusMap).flatMap(v => [v.preset, v.postset]).filter(Boolean)
              )).sort();

              // Merge DB statuses with saved config keys
              const allStatuses = Array.from(new Set([...scOtaStatuses, ...Object.keys(scStatusMap)])).sort();

              const setSSVal = (otaStatus: string, field: "preset" | "postset", val: string) => {
                setScStatusMap(prev => ({
                  ...prev,
                  [otaStatus]: { preset: prev[otaStatus]?.preset ?? "", postset: prev[otaStatus]?.postset ?? "", [field]: val },
                }));
              };

              const addOtaStatus = (val: string) => {
                const v = val.trim();
                if (v && !allStatuses.includes(v)) {
                  setScStatusMap(prev => ({ ...prev, [v]: { preset: "", postset: "" } }));
                }
                setScNewStatus(""); setScAddingStatus(false);
              };

              return (
                <div style={{ padding: 16 }}>
                  <p style={{ fontSize: 11, color: T.textSec, marginBottom: 14, marginTop: 0 }}>
                    For each <strong>{otaName}</strong> status, set the sub-status shown when a listing is in Preset or Postset mode.
                    Sub-status is automatically derived — not manually editable in Listing Creation or CRM.
                  </p>

                  <div style={{ overflowX: "auto" }}>
                    <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%", minWidth: 500 }}>
                      <thead>
                        <tr style={{ background: "#F8FAFC" }}>
                          <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: 700, color: T.textSec, borderBottom: "2px solid #E2E8F0", borderRight: "1px solid #E2E8F0", whiteSpace: "nowrap", minWidth: 180 }}>OTA Status</th>
                          <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: 700, color: "#5B21B6", borderBottom: "2px solid #E2E8F0", borderRight: "1px solid #E2E8F0", whiteSpace: "nowrap" }}>Preset Sub-status</th>
                          <th style={{ padding: "8px 14px", textAlign: "left", fontWeight: 700, color: "#0369A1", borderBottom: "2px solid #E2E8F0", whiteSpace: "nowrap" }}>PostSet Sub-status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allStatuses.map((status, i) => (
                          <tr key={status} style={{ background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC", borderBottom: "1px solid #F0F4F8" }}>
                            <td style={{ padding: "8px 14px", borderRight: "1px solid #E2E8F0", fontWeight: 600, color: T.textPri }}>{status}</td>
                            {(["preset", "postset"] as const).map(field => {
                              const cellKey = `${status}|${field}`;
                              const cur = scStatusMap[status]?.[field] ?? "";
                              const isAdding = !!scSSAdding[cellKey];
                              return (
                                <td key={field} style={{ padding: "6px 10px", borderRight: field === "preset" ? "1px solid #E2E8F0" : undefined }}>
                                  {isAdding ? (
                                    <input autoFocus value={scSSNewVal[cellKey] ?? ""}
                                      onChange={e => setScSSNewVal(prev => ({ ...prev, [cellKey]: e.target.value }))}
                                      onBlur={() => {
                                        const v = (scSSNewVal[cellKey] ?? "").trim();
                                        if (v) setSSVal(status, field, v);
                                        setScSSAdding(prev => ({ ...prev, [cellKey]: false }));
                                        setScSSNewVal(prev => ({ ...prev, [cellKey]: "" }));
                                      }}
                                      onKeyDown={e => {
                                        if (e.key === "Enter") {
                                          const v = (scSSNewVal[cellKey] ?? "").trim();
                                          if (v) setSSVal(status, field, v);
                                          setScSSAdding(prev => ({ ...prev, [cellKey]: false }));
                                          setScSSNewVal(prev => ({ ...prev, [cellKey]: "" }));
                                        }
                                        if (e.key === "Escape") {
                                          setScSSAdding(prev => ({ ...prev, [cellKey]: false }));
                                          setScSSNewVal(prev => ({ ...prev, [cellKey]: "" }));
                                        }
                                      }}
                                      placeholder="Type new sub-status…"
                                      style={{ padding: "4px 8px", borderRadius: 6, border: "2px solid #7C3AED", fontSize: 11, outline: "none", width: 170 }} />
                                  ) : (
                                    <select value={cur}
                                      onChange={e => {
                                        if (e.target.value === "__new__") {
                                          setScSSAdding(prev => ({ ...prev, [cellKey]: true }));
                                        } else {
                                          setSSVal(status, field, e.target.value);
                                        }
                                      }}
                                      style={{ padding: "5px 8px", borderRadius: 6, border: `1px solid ${cur ? "#7C3AED" : "#CBD5E1"}`, background: cur ? "#F5F3FF" : "#F8FAFC", color: cur ? "#5B21B6" : "#94A3B8", fontSize: 11, outline: "none", cursor: "pointer", minWidth: 160 }}>
                                      <option value="">— None —</option>
                                      {existingSS.map(s => <option key={s} value={s}>{s}</option>)}
                                      <option value="__new__">+ Add new…</option>
                                    </select>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        {/* Add new OTA status row */}
                        <tr style={{ background: "#F0FDF4" }}>
                          <td colSpan={3} style={{ padding: "6px 10px" }}>
                            {scAddingStatus ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <input autoFocus value={scNewStatus} onChange={e => setScNewStatus(e.target.value)}
                                  onKeyDown={e => { if (e.key === "Enter") addOtaStatus(scNewStatus); if (e.key === "Escape") { setScAddingStatus(false); setScNewStatus(""); } }}
                                  placeholder="Type new OTA status…"
                                  style={{ padding: "5px 10px", borderRadius: 6, border: "2px solid #16A34A", fontSize: 11, outline: "none", width: 220 }} />
                                <button onClick={() => addOtaStatus(scNewStatus)}
                                  style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#16A34A", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Add</button>
                                <button onClick={() => { setScAddingStatus(false); setScNewStatus(""); }}
                                  style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontSize: 11, cursor: "pointer" }}>Cancel</button>
                              </div>
                            ) : (
                              <button onClick={() => setScAddingStatus(true)}
                                style={{ padding: "5px 12px", borderRadius: 6, border: "1px dashed #16A34A", background: "none", color: "#16A34A", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                + Add OTA Status
                              </button>
                            )}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
      )}
    </div>
  );
}






