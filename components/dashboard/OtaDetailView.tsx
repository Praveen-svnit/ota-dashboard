"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import PropertyRnsView from "@/components/dashboard/PropertyRnsView";

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
interface NLRow    { propertyId: string; name: string; city: string; fhLiveDate: string|null; ota: string; status: string|null; subStatus: string|null; liveDate: string|null; tat: number; }
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
function MergedMonthTable({ title, rows, rnsRows, revRows }: { title: string; rows: Array<Record<string, number | string>>; rnsRows?: RnsRow[]; revRows?: RnsRow[] }) {
  const [view,       setView]       = useState<"TAT" | "PROD">("TAT");
  const [prodMetric, setProdMetric] = useState<"RNs" | "RNPD" | "Revenue" | "RPD">("RNs");
  if (rows.length === 0) return null;

  const now    = new Date();
  const d1Days = Math.max(now.getDate() - 1, 1);
  const cmKey  = `${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][now.getMonth()]} ${now.getFullYear()}`;

  const isRevBased = prodMetric === "Revenue" || prodMetric === "RPD";
  const isPerDay   = prodMetric === "RNPD"    || prodMetric === "RPD";

  // Newest first
  const sorted     = [...rows].reverse();
  const activeRows = isRevBased ? (revRows ?? rnsRows ?? []) : (rnsRows ?? []);
  const rnsSorted  = [...activeRows].reverse();

  const TH = (opts?: { color?: string; bg?: string; span?: number }): React.CSSProperties => ({
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

  function Num({ v, color, bg, suffix }: { v: number; color: string; bg: string; suffix?: string }) {
    if (!v) return <span style={{ color: "#D1D5DB", fontSize: 10 }}>—</span>;
    return <span style={{ fontWeight: 700, fontSize: 11, color, background: bg, border: `1px solid ${color}25`, borderRadius: 4, padding: "1px 7px" }}>{v}{suffix ?? ""}</span>;
  }

  const sum  = (key: string) => sorted.reduce((s, r) => s + ((r[key] as number) || 0), 0);
  const wavg = (key: string, cnt: string) => { const t = sum(cnt); return t ? Math.round(sorted.reduce((s, r) => s + ((r[key] as number)||0) * ((r[cnt] as number)||0), 0) / t) : 0; };

  const LIVE_BKTS = [
    { key: "l_d0_7",   label: "0–7d",   color: "#15803D", bg: "#DCFCE7" },
    { key: "l_d8_15",  label: "8–15d",  color: "#B45309", bg: "#FEF3C7" },
    { key: "l_d16_30", label: "16–30d", color: "#C2410C", bg: "#FFEDD5" },
    { key: "l_d31_60", label: "31–60d", color: "#DC2626", bg: "#FEE2E2" },
    { key: "l_d60p",   label: "60+d",   color: "#7F1D1D", bg: "#FEE2E2" },
  ];
  const NL_BKTS = [
    { key: "nl_d0_15",  label: "0–15d",  color: "#16A34A", bg: "#DCFCE7" },
    { key: "nl_d16_30", label: "16–30d", color: "#B45309", bg: "#FEF3C7" },
    { key: "nl_d31_60", label: "31–60d", color: "#C2410C", bg: "#FFEDD5" },
    { key: "nl_d61_90", label: "61–90d", color: "#DC2626", bg: "#FEE2E2" },
    { key: "nl_d90p",   label: "90+d",   color: "#7F1D1D", bg: "#FEE2E2" },
  ];

  // RNS view helpers
  const rnsSum = (key: keyof RnsRow) => rnsSorted.reduce((s, r) => s + (r[key] as number), 0);

  return (
    <div style={card}>
      <div style={cardHeader}>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.textPri }}>{title}</span>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: T.textMut }}>Last 12 months · newest first</span>
          {(rnsRows && rnsRows.length > 0) && (
            <>
              {/* Main toggle: TAT | Production */}
              <div style={{ display: "flex", borderRadius: 6, border: `1px solid ${T.cardBdr}`, overflow: "hidden" }}>
                {(["TAT", "PROD"] as const).map(v => (
                  <button key={v} onClick={() => setView(v)} style={{ padding: "3px 10px", border: "none", borderLeft: v === "PROD" ? `1px solid ${T.cardBdr}` : "none", cursor: "pointer", fontFamily: "inherit", fontSize: 10, fontWeight: 600, background: view === v ? T.textPri : "#FFF", color: view === v ? "#FFF" : T.textSec }}>
                    {v === "PROD" ? "Production" : "TAT"}
                  </button>
                ))}
              </div>
              {/* Sub-toggles — only in Production mode */}
              {view === "PROD" && (
                <>
                  <div style={{ display: "flex", borderRadius: 6, border: `1px solid ${T.cardBdr}`, overflow: "hidden" }}>
                    {(["RNs", "RNPD"] as const).map(v => (
                      <button key={v} onClick={() => setProdMetric(v)} style={{ padding: "3px 10px", border: "none", borderLeft: v === "RNPD" ? `1px solid ${T.cardBdr}` : "none", cursor: "pointer", fontFamily: "inherit", fontSize: 10, fontWeight: 600, background: prodMetric === v ? "#4338CA" : "#FFF", color: prodMetric === v ? "#FFF" : T.textSec }}>
                        {v}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", borderRadius: 6, border: `1px solid ${T.cardBdr}`, overflow: "hidden" }}>
                    {(["Revenue", "RPD"] as const).map(v => (
                      <button key={v} onClick={() => setProdMetric(v)} style={{ padding: "3px 10px", border: "none", borderLeft: v === "RPD" ? `1px solid ${T.cardBdr}` : "none", cursor: "pointer", fontFamily: "inherit", fontSize: 10, fontWeight: 600, background: prodMetric === v ? "#4338CA" : "#FFF", color: prodMetric === v ? "#FFF" : T.textSec }}>
                        {v === "Revenue" ? "Rev" : "RPD"}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Production view ── */}
      {view === "PROD" && (
        <div style={{ overflowX: "auto" }}>
          {rnsSorted.length === 0 ? (
            <div style={{ padding: "20px 16px", textAlign: "center", color: T.textMut, fontSize: 11 }}>
              {isRevBased ? "Revenue data not available — sync data first" : "No production data available"}
            </div>
          ) : (() => {
            const MNLIST = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

            function getTrendVal(rx: RnsRow): number {
              const [qm, qy] = rx.quarter.split(" ");
              const qm0 = MNLIST.indexOf(qm ?? "");
              const totalDays = new Date(Number(qy), qm0 + 1, 0).getDate();
              if (totalDays === 0 || d1Days === 0) return 0;
              if (isPerDay) {
                if (rx.quarter === cmKey) return Math.round(rx.cmMTD / d1Days);
                return totalDays > 0 ? Math.round(rx.cmTotal / totalDays) : 0;
              }
              if (rx.quarter === cmKey) return Math.round(rx.cmMTD / d1Days * totalDays);
              return rx.cmTotal;
            }

            const chrono = [...rnsSorted].reverse();

            const colLabel = prodMetric === "RNs" ? "CM RNs" : prodMetric === "RNPD" ? "RNPD" : prodMetric === "Revenue" ? "CM Rev" : "RPD";

            return (
            <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ ...TH(), textAlign: "left", minWidth: 90, position: "sticky", left: 0, zIndex: 3 }}>Month</th>
                  <th style={TH({ color: T.textSec })}>LM {isPerDay ? "Per Day" : "MTD"}</th>
                  <th style={TH({ color: "#4338CA", bg: "#EEF2FF" })}>{colLabel}</th>
                  <th style={TH({ color: "#059669", bg: "#ECFDF5" })}>LM vs CM</th>
                  <th style={TH({ color: T.textSec })}>LM Total{isPerDay ? "/Day" : ""}</th>
                  <th style={TH({ color: "#6366F1", bg: "#EEF2FF" })}>CM Projection</th>
                  <th style={{ ...TH({ color: T.orange, bg: T.orangeL }), borderRight: "none" }}>LM vs CM</th>
                </tr>
              </thead>
              <tbody>
                {rnsSorted.map((r, i) => {
                  const isCurrent = r.quarter === cmKey;
                  const [qMon, qYrStr] = r.quarter.split(" ");
                  const qYr      = Number(qYrStr);
                  const qMon0    = MNLIST.indexOf(qMon ?? "");
                  const totalDays = new Date(qYr, qMon0 + 1, 0).getDate();
                  const cmVal    = isPerDay ? (d1Days > 0 ? Math.round(r.cmMTD / d1Days) : 0) : r.cmMTD;
                  const lmVal    = isPerDay ? (d1Days > 0 ? Math.round(r.lmMTD / d1Days) : 0) : r.lmMTD;
                  const lmTVal   = isPerDay ? (totalDays > 0 ? Math.round(r.lmTotal / totalDays) : 0) : r.lmTotal;
                  const tv       = getTrendVal(r);
                  const pct      = lmVal  > 0 ? Math.round(((cmVal - lmVal)  / lmVal)  * 100) : null;
                  const pctTot   = lmTVal > 0 ? Math.round(((tv    - lmTVal) / lmTVal) * 100) : null;
                  const rowBg    = i % 2 === 0 ? T.cardBg : T.rowAlt;
                  const pfx      = isRevBased ? "₹" : "";
                  const fmt      = (v: number) => `${pfx}${v.toLocaleString("en-IN")}`;
                  const chronoIdx = chrono.findIndex(cx => cx.quarter === r.quarter);

                  return (
                    <tr key={r.quarter} style={{ background: rowBg, borderBottom: `1px solid ${T.cardBdr}` }}>
                      <td style={{ ...SL, background: rowBg }}>{r.quarter}{isCurrent && <span style={{ marginLeft: 4, fontSize: 9, color: T.orange }}>d-1</span>}</td>
                      <td style={{ padding: "7px 12px", textAlign: "center", borderRight: `1px solid ${T.cardBdr}` }}>
                        <span style={{ fontWeight: 700, fontSize: 12, color: T.textSec }}>{lmVal > 0 ? fmt(lmVal) : <span style={{ color: "#D1D5DB" }}>—</span>}</span>
                      </td>
                      <td style={{ padding: "7px 12px", textAlign: "center", borderRight: `1px solid ${T.cardBdr}` }}>
                        <span style={{ fontWeight: 700, fontSize: 12, color: "#4338CA" }}>{fmt(cmVal)}</span>
                        {pct !== null && <span style={{ fontSize: 10, color: pct >= 0 ? "#059669" : "#DC2626", marginLeft: 4 }}>{pct >= 0 ? "▲" : "▼"}</span>}
                      </td>
                      <td style={{ padding: "7px 12px", textAlign: "center", borderRight: `1px solid ${T.cardBdr}` }}>
                        {pct === null ? <span style={{ color: "#D1D5DB" }}>—</span> : <span style={{ fontWeight: 700, fontSize: 12, color: pct >= 0 ? "#059669" : "#DC2626" }}>{pct >= 0 ? "▲" : "▼"} {Math.abs(pct)}%</span>}
                      </td>
                      <td style={{ padding: "7px 12px", textAlign: "center", borderRight: `1px solid ${T.cardBdr}` }}>
                        <span style={{ fontWeight: 700, fontSize: 12, color: T.textSec }}>{lmTVal > 0 ? fmt(lmTVal) : <span style={{ color: "#D1D5DB" }}>—</span>}</span>
                      </td>
                      {(() => {
                        const prev  = chronoIdx > 0 ? getTrendVal(chrono[chronoIdx - 1]) : null;
                        const tvUp  = prev !== null && tv > prev;
                        const tvDn  = prev !== null && tv < prev;
                        const tvClr = tvUp ? "#059669" : tvDn ? "#DC2626" : "#6366F1";
                        return (
                          <td style={{ padding: "7px 12px", textAlign: "center", borderRight: `1px solid ${T.cardBdr}` }}>
                            <span style={{ fontWeight: 700, fontSize: 12, color: tvClr }}>{fmt(tv)}</span>
                            {prev !== null && <span style={{ fontSize: 10, color: tvClr, marginLeft: 4 }}>{tvUp ? "▲" : tvDn ? "▼" : "—"}</span>}
                          </td>
                        );
                      })()}
                      <td style={{ padding: "7px 12px", textAlign: "center", borderRight: "none" }}>
                        {pctTot === null ? <span style={{ color: "#D1D5DB" }}>—</span> : <span style={{ fontWeight: 700, fontSize: 12, color: pctTot >= 0 ? "#059669" : "#DC2626" }}>{pctTot >= 0 ? "▲" : "▼"} {Math.abs(pctTot)}%</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: T.orangeL, borderTop: `2px solid ${T.orange}44` }}>
                  <td style={{ ...SL, background: T.orangeL, color: T.orange }}>Total</td>
                  <td style={{ padding: "8px 12px", textAlign: "center", borderRight: `1px solid ${T.cardBdr}`, fontWeight: 700, color: T.textSec }}>{isRevBased ? `₹${rnsSum("lmMTD").toLocaleString("en-IN")}` : rnsSum("lmMTD").toLocaleString("en-IN")}</td>
                  <td style={{ padding: "8px 12px", textAlign: "center", borderRight: `1px solid ${T.cardBdr}` }}><span style={{ fontWeight: 900, color: "#4338CA", fontSize: 13 }}>{isRevBased ? `₹${rnsSum("cmMTD").toLocaleString("en-IN")}` : rnsSum("cmMTD").toLocaleString("en-IN")}</span></td>
                  <td style={{ padding: "8px 12px", borderRight: `1px solid ${T.cardBdr}` }} />
                  <td style={{ padding: "8px 12px", textAlign: "center", borderRight: `1px solid ${T.cardBdr}`, fontWeight: 700, color: T.textMut }}>{isRevBased ? `₹${rnsSum("lmTotal").toLocaleString("en-IN")}` : rnsSum("lmTotal").toLocaleString("en-IN")}</td>
                  <td style={{ padding: "8px 12px", borderRight: `1px solid ${T.cardBdr}` }} />
                  <td style={{ padding: "8px 12px", borderRight: "none" }} />
                </tr>
              </tfoot>
            </table>
            );
          })()}
        </div>
      )}

      {/* ── TAT view ── */}
      {view === "TAT" && (
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%" }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{ ...TH(), textAlign: "left", minWidth: 90, position: "sticky", left: 0, zIndex: 3, verticalAlign: "bottom" }}>Month</th>
              <th rowSpan={2} style={{ ...TH({ color: T.orange, bg: T.orangeL }), verticalAlign: "bottom", minWidth: 60 }}>FH Props</th>
              <th rowSpan={2} style={{ ...TH({ color: T.live, bg: T.liveL }), verticalAlign: "bottom", minWidth: 55 }}>Live</th>
              <th colSpan={5} style={TH({ color: T.live, bg: T.liveL })}>Live TAT Breakdown</th>
              <th rowSpan={2} style={{ ...TH({ color: "#6366F1", bg: "#EEF2FF" }), verticalAlign: "bottom", borderRight: `2px solid ${T.cardBdr}` }}>Avg TAT</th>
              <th rowSpan={2} style={{ ...TH({ color: T.notLive, bg: T.notLiveL }), verticalAlign: "bottom", minWidth: 60 }}>Not Live</th>
              <th colSpan={5} style={TH({ color: T.notLive, bg: T.notLiveL })}>Pending Breakdown</th>
              <th rowSpan={2} style={{ ...TH({ color: "#6366F1", bg: "#EEF2FF" }), verticalAlign: "bottom", borderRight: "none" }}>Avg Pend</th>
            </tr>
            <tr>
              {LIVE_BKTS.map(b => <th key={b.key} style={TH({ color: b.color, bg: b.bg + "88" })}>{b.label}</th>)}
              {NL_BKTS.map(b  => <th key={b.key} style={TH({ color: b.color, bg: b.bg + "88" })}>{b.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr key={r.quarter as string} style={{ background: i % 2 === 0 ? T.cardBg : T.rowAlt }}>
                <td style={{ ...SL, background: i % 2 === 0 ? T.cardBg : T.rowAlt }}>{r.quarter as string}</td>
                <td style={TD({ bg: T.orangeL })}><Num v={(r.fhTotal as number)||0} color={T.orange} bg={T.orangeT} /></td>
                <td style={TD({ bg: T.liveL })}><Num v={(r.liveCount as number)||0} color={T.live} bg="#BBF7D0" /></td>
                {LIVE_BKTS.map(b => <td key={b.key} style={TD()}><Num v={(r[b.key] as number)||0} color={b.color} bg={b.bg} /></td>)}
                <td style={{ ...TD({ bg: "#EEF2FF" }), borderRight: `2px solid ${T.cardBdr}` }}>
                  <Num v={(r.avgTat as number)||0} color="#6366F1" bg="#E0E7FF" suffix="d" />
                </td>
                <td style={TD({ bg: T.notLiveL })}><Num v={(r.nlCount as number)||0} color={T.notLive} bg="#FECACA" /></td>
                {NL_BKTS.map(b => <td key={b.key} style={TD()}><Num v={(r[b.key] as number)||0} color={b.color} bg={b.bg} /></td>)}
                <td style={{ ...TD({ bg: "#EEF2FF" }), borderRight: "none" }}>
                  <Num v={(r.avgPending as number)||0} color="#6366F1" bg="#E0E7FF" suffix="d" />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: T.orangeL, borderTop: `2px solid ${T.orange}44` }}>
              <td style={{ ...SL, background: T.orangeL, color: T.orange }}>Total</td>
              <td style={TD({ bg: T.orangeT, bold: true })}><span style={{ fontWeight: 900, color: T.orange }}>{sum("fhTotal") || "—"}</span></td>
              <td style={TD({ bg: T.liveL })}><Num v={sum("liveCount")} color={T.live} bg="#BBF7D0" /></td>
              {LIVE_BKTS.map(b => <td key={b.key} style={TD({ bg: T.orangeL })}><Num v={sum(b.key)} color={b.color} bg={b.bg} /></td>)}
              <td style={{ ...TD({ bg: "#EEF2FF" }), borderRight: `2px solid ${T.cardBdr}` }}><Num v={wavg("avgTat","liveCount")} color="#6366F1" bg="#E0E7FF" suffix="d" /></td>
              <td style={TD({ bg: T.notLiveL })}><Num v={sum("nlCount")} color={T.notLive} bg="#FECACA" /></td>
              {NL_BKTS.map(b  => <td key={b.key} style={TD({ bg: T.orangeL })}><Num v={sum(b.key)} color={b.color} bg={b.bg} /></td>)}
              <td style={{ ...TD({ bg: "#EEF2FF" }), borderRight: "none" }}><Num v={wavg("avgPending","nlCount")} color="#6366F1" bg="#E0E7FF" suffix="d" /></td>
            </tr>
          </tfoot>
        </table>
      </div>
      )}
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

  const [nlData,    setNlData]    = useState<NLData | null>(null);
  const [nlLoading, setNlLoading] = useState(true);
  const [nlSearch,  setNlSearch]  = useState("");
  const [nlCategory,setNlCat]     = useState("");
  const [nlSss,     setNlSss]     = useState<string[]>([]);
  const [ssActiveGroup, setSsActiveGroup] = useState<string | null>(null);
  const [nlPage,    setNlPage]    = useState(1);

  function loadNl(page = 1, search = nlSearch, category = nlCategory, sss = nlSss) {
    setNlLoading(true);
    const p = new URLSearchParams({ otas: otaName, page: String(page), size: "50" });
    if (search)     p.set("search", search);
    if (category)   p.set("category", category);
    if (sss.length) p.set("sss", sss.join(","));
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
  }

  useEffect(() => {
    setDashData(null); setOvrLive([]); setOvrNotLive([]);
    setRnsMonthly({}); setRevMonthly({}); setNlData(null);
    setNlCat(""); setNlSearch(""); setNlSss([]); setSsActiveGroup(null);
    load();
  }, [otaName]); // eslint-disable-line react-hooks/exhaustive-deps

  function goToCategory(cat: string) {
    setNlCat(cat); setNlSearch(""); setNlSss([]);
    loadNl(1, "", cat, []);
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
    { label: "Live",          value: live,                      color: T.live,    bg: T.liveL,    cat: "live"         },
    { label: "Exception",     value: exception,                 color: "#B45309", bg: "#FEF3C7",  cat: "exception"    },
    { label: "In Process",    value: inProcess,                 color: "#1D4ED8", bg: "#DBEAFE",  cat: "inProcess"    },
    { label: "TAT Exhausted", value: tatExhausted,              color: T.notLive, bg: T.notLiveL, cat: "tatExhausted" },
    { label: "Avg TAT",       value: tatStat ? `${tatStat.avgTat}d` : "—", color: "#6366F1", bg: "#EEF2FF", cat: null },
    { label: "Total",         value: total,                     color: T.orange,  bg: T.orangeL,  cat: "all"          },
    { label: "Live %",        value: livePct.toFixed(1) + "%",  color: T.live,    bg: T.liveL,    cat: null           },
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
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 3, height: 22, background: otaColor, borderRadius: 2 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: T.textPri }}>OTA Detail · listing analytics</span>
        </div>
      </div>

      {loading && <div style={{ textAlign: "center", padding: 60, color: T.textMut, fontSize: 12 }}><span style={{ display: "inline-block", animation: "spin 1s linear infinite", marginRight: 6 }}>⟳</span>Loading…</div>}
      {error   && <div style={{ padding: "8px 14px", background: T.notLiveL, border: "1px solid #FECACA", borderRadius: 8, fontSize: 11, color: T.notLive, marginBottom: 14 }}>⚠ {error}</div>}

      {dashData && (
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

          {/* TAT · Live — horizontal chips below KPI tiles */}
          {tatStat && (
            <div style={{ ...card, marginBottom: 12 }}>
              <div style={cardHeader}><span style={{ fontSize: 11, fontWeight: 700, color: T.textPri }}>TAT · Live</span></div>
              <div style={{ padding: "8px 12px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                {TAT_CHIPS.map(chip => (
                  <div key={chip.label} style={{ display: "flex", alignItems: "center", gap: 8, background: chip.bg, border: `1px solid ${chip.color}30`, borderRadius: 7, padding: "6px 14px", flex: "1 1 80px", minWidth: 80 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: chip.color, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{chip.label}</span>
                    <span style={{ fontSize: 15, fontWeight: 900, color: chip.color, marginLeft: "auto" }}>{String(chip.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status × Sub-status */}
          {(() => {
            const xPivot = dashData.ssStatusPivot[otaName] ?? {};
            const ssCols = dashData.columns.filter(col => (dashData.pivot[otaName]?.[col] ?? 0) > 0);

            const SS_COLS = [
              { label: "Revenue",           subs: ["Revenue"],                                                                          color: "#C2410C", bg: "#FFF7ED" },
              { label: "Supply/Operations", subs: ["Supply/Operations"],                                                                color: "#6D28D9", bg: "#F5F3FF" },
              { label: "GoMMT",             subs: ["Pending at GoMMT"],                                                                 color: "#1D4ED8", bg: "#EFF6FF" },
              { label: "OTA",               subs: ssCols.filter(s => s.startsWith("Pending at ") && s !== "Pending at GoMMT"),          color: "#0369A1", bg: "#F0F9FF" },
              { label: "Live",              subs: ssCols.filter(s => s === "Live" || s === "FH Live"),                                  color: "#16A34A", bg: "#DCFCE7" },
              { label: "Exception",         subs: ["Exception"],                                                                        color: "#B45309", bg: "#FEF3C7" },
              { label: "Blank",             subs: ["Blank"],                                                                            color: "#64748B", bg: "#F1F5F9" },
              { label: "Churned",           subs: ["Churned"],                                                                          color: "#DC2626", bg: "#FEE2E2" },
            ].filter(c => c.subs.some(s => ssCols.includes(s)));

            const colData = SS_COLS.map(col => {
              const activeSubs = col.subs.filter(s => ssCols.includes(s));
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

            const TH: React.CSSProperties = { padding: "6px 10px", fontSize: 9, fontWeight: 700, background: T.headerBg, borderBottom: `2px solid ${T.cardBdr}`, borderRight: `1px solid ${T.cardBdr}`, textAlign: "center", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.05em", color: T.textSec };

            return (
              <div style={{ ...card, marginBottom: 12 }}>
                <div style={cardHeader}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T.textPri }}>Status × Sub-status</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {activeCol && (
                      <button onClick={() => setSsActiveGroup(null)} style={{ padding: "2px 9px", fontSize: 10, fontWeight: 600, border: `1px solid ${T.cardBdr}`, borderRadius: 5, background: "#FFF", color: T.textSec, cursor: "pointer" }}>
                        ✕ Default
                      </button>
                    )}
                    <span style={{ fontSize: 10, fontWeight: 800, color: T.orange, background: T.orangeL, border: `1px solid ${T.orange}30`, padding: "2px 10px", borderRadius: 99 }}>
                      {ssGrandTotal} total
                    </span>
                  </div>
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%" }}>
                    <thead>
                      <tr>
                        <th style={{ ...TH, textAlign: "left", minWidth: 100, position: "sticky", left: 0, zIndex: 3 }}>
                          {activeCol
                            ? <span style={{ color: activeCol.color }}>{activeCol.label}</span>
                            : <span style={{ color: T.textMut, fontWeight: 400, fontStyle: "italic", textTransform: "none", letterSpacing: 0 }}>Status</span>}
                        </th>
                        {colData.map(col => {
                          const isActive = ssActiveGroup === col.label;
                          return (
                            <th key={col.label}
                              onClick={() => setSsActiveGroup(isActive ? null : col.label)}
                              style={{ ...TH, color: isActive ? "#FFF" : col.color, background: isActive ? col.color : col.bg, cursor: "pointer", minWidth: 72 }}>
                              {col.label} · {col.colTotal}
                            </th>
                          );
                        })}
                        <th style={{ ...TH, color: T.orange, background: T.orangeL, borderRight: "none", minWidth: 60 }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ background: T.headerBg }}>
                        <td style={{ padding: "8px 12px", fontWeight: 800, fontSize: 10, color: T.orange, textTransform: "uppercase", letterSpacing: "0.07em", borderRight: `1px solid ${T.cardBdr}`, position: "sticky", left: 0, zIndex: 1, background: T.headerBg }}>Total</td>
                        {colData.map(col => {
                          const isActive = ssActiveGroup === col.label;
                          const dimmed = activeCol && !isActive;
                          return (
                            <td key={col.label} style={{ padding: "8px 10px", textAlign: "center", borderRight: `1px solid ${T.cardBdr}`, background: col.bg + "55", opacity: dimmed ? 0.2 : 1 }}>
                              {col.colTotal > 0 ? <span style={{ fontWeight: 800, color: col.color, fontSize: 12 }}>{col.colTotal}</span> : <span style={{ color: "#D1D5DB" }}>—</span>}
                            </td>
                          );
                        })}
                        <td style={{ padding: "8px 12px", textAlign: "center", background: T.orangeT, borderRight: "none" }}>
                          <span style={{ fontWeight: 900, color: T.orange, fontSize: 13 }}>{ssGrandTotal}</span>
                        </td>
                      </tr>
                      {activeCol && detailRows.map(([st, n], ri) => {
                        const stSc  = stColor(st);
                        const rowBg = ri % 2 === 0 ? T.cardBg : T.rowAlt;
                        return (
                          <tr key={st} style={{ background: rowBg, borderBottom: `1px solid ${T.cardBdr}` }}>
                            <td style={{ padding: "7px 12px", fontWeight: 600, fontSize: 10, borderRight: `1px solid ${T.cardBdr}`, position: "sticky", left: 0, zIndex: 1, background: rowBg, whiteSpace: "nowrap" }}>
                              <span style={{ color: stSc.text, background: stSc.bg, padding: "2px 8px", borderRadius: 4 }}>{st}</span>
                            </td>
                            {colData.map(col => {
                              const isActive = ssActiveGroup === col.label;
                              const v = col.stBreakdown[st] ?? 0;
                              return (
                                <td key={col.label} style={{ padding: "7px 10px", textAlign: "center", borderRight: `1px solid ${T.cardBdr}`, background: v > 0 && isActive ? col.bg + "88" : undefined, opacity: isActive ? 1 : 0.2 }}>
                                  {v > 0 ? <span style={{ fontWeight: 700, fontSize: 12, color: col.color }}>{v}</span> : <span style={{ color: "#D1D5DB", fontSize: 10 }}>—</span>}
                                </td>
                              );
                            })}
                            <td style={{ padding: "7px 12px", textAlign: "center", background: T.orangeL, borderRight: "none" }}>
                              <span style={{ fontWeight: 800, fontSize: 12, color: T.orange }}>{n}</span>
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

      {/* Month-wise Breakdown — merged */}
      {mergedMonthData.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <MergedMonthTable
            title={`Month-wise · ${otaName}`}
            rows={mergedMonthData}
            rnsRows={rnsRows}
            revRows={revRows}
          />
        </div>
      )}

      {/* RNS Production section */}
      <div style={{ marginBottom: 16 }}>
        <PropertyRnsView ota={otaName} />
      </div>

      {/* Property List */}
      <div id="prop-section" style={card}>
        <div style={cardHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.textPri }}>Properties · {otaName}</span>
            {nlCategory && <span style={{ fontSize: 10, fontWeight: 600, color: T.orange, background: T.orangeL, padding: "2px 8px", borderRadius: 4 }}>{CAT_LABELS[nlCategory] ?? nlCategory}</span>}
          </div>
          {nlData && <span style={{ fontSize: 10, color: T.textMut }}>{nlData.total.toLocaleString()} results</span>}
        </div>

        {/* Filters */}
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${T.cardBdr}`, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <input value={nlSearch} onChange={e => { setNlSearch(e.target.value); loadNl(1, e.target.value, nlCategory, nlSss); }}
            placeholder="Search name or ID…"
            style={{ padding: "5px 9px", fontSize: 11, border: `1px solid ${T.cardBdr}`, borderRadius: 6, outline: "none", minWidth: 160, color: T.textPri, background: "#FFF" }} />

          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {([
              { label: "All", cat: "" }, { label: "Live", cat: "live" }, { label: "Exception", cat: "exception" },
              { label: "In Process", cat: "inProcess" }, { label: "TAT Exhausted", cat: "tatExhausted" },
            ] as const).map(({ label, cat }) => {
              const active = nlCategory === cat;
              return (
                <button key={cat} onClick={() => { setNlCat(cat); loadNl(1, nlSearch, cat, nlSss); }}
                  style={{ padding: "4px 10px", fontSize: 10, fontWeight: active ? 700 : 500, borderRadius: 5, cursor: "pointer", border: `1px solid ${active ? T.orange : T.cardBdr}`, background: active ? T.orange : "#FFF", color: active ? "#FFF" : T.textSec }}>
                  {label}
                </button>
              );
            })}
          </div>

          {ssOptions.length > 0 && (
            <CheckboxDropdown label="Sub-status" options={ssOptions} selected={nlSss}
              onChange={v => { setNlSss(v); loadNl(1, nlSearch, nlCategory, v); }} />
          )}

          {(nlSearch || nlCategory || nlSss.length > 0) && (
            <button onClick={() => { setNlSearch(""); setNlCat(""); setNlSss([]); loadNl(1, "", "", []); }}
              style={{ padding: "4px 9px", fontSize: 10, fontWeight: 600, borderRadius: 5, cursor: "pointer", border: `1px solid ${T.cardBdr}`, background: "#FFF", color: T.textSec }}>
              ✕ Clear
            </button>
          )}
        </div>

        {nlLoading ? (
          <div style={{ textAlign: "center", padding: 40, fontSize: 12, color: T.textMut }}><span style={{ display: "inline-block", animation: "spin 1s linear infinite", marginRight: 6 }}>⟳</span>Loading…</div>
        ) : nlData && nlData.rows.length > 0 ? (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%" }}>
                <thead>
                  <tr style={{ background: T.headerBg, borderBottom: `1px solid ${T.cardBdr}` }}>
                    {["Property ID","Name","City","FH Live Date","OTA Live Date","Sub-status","TAT"].map(h => (
                      <th key={h} style={{ padding: "7px 12px", textAlign: "left", fontWeight: 700, color: T.textSec, fontSize: 10, whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {nlData.rows.map((row, idx) => {
                    const ss = row.subStatus ? getSSColor(row.subStatus) : null;
                    const tatColor = row.tat > 30 ? T.notLive : row.tat > 15 ? "#B45309" : T.live;
                    return (
                      <tr key={`${row.propertyId}-${idx}`} className="nl-row" style={{ borderBottom: `1px solid ${T.cardBdr}` }}>
                        <td style={{ padding: "7px 12px", color: T.textPri, fontWeight: 600, whiteSpace: "nowrap" }}>{row.propertyId}</td>
                        <td style={{ padding: "7px 12px", color: T.textSec, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.name || "—"}</td>
                        <td style={{ padding: "7px 12px", color: T.textSec, whiteSpace: "nowrap" }}>{row.city || "—"}</td>
                        <td style={{ padding: "7px 12px", color: T.textSec, whiteSpace: "nowrap" }}>{fmtDate(row.fhLiveDate)}</td>
                        <td style={{ padding: "7px 12px", color: T.textSec, whiteSpace: "nowrap" }}>{fmtDate(row.liveDate)}</td>
                        <td style={{ padding: "7px 12px", whiteSpace: "nowrap" }}>
                          {ss ? <span style={{ fontSize: 10, fontWeight: 600, color: ss.text, background: ss.bg, padding: "2px 7px", borderRadius: 4 }}>{row.subStatus}</span> : <span style={{ color: T.textMut }}>—</span>}
                        </td>
                        <td style={{ padding: "7px 12px", fontWeight: 700, color: tatColor, whiteSpace: "nowrap" }}>{row.tat}d</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {nlData.pages > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderTop: `1px solid ${T.cardBdr}` }}>
                <span style={{ fontSize: 11, color: T.textMut }}>Page {nlPage} of {nlData.pages}</span>
                <div style={{ display: "flex", gap: 4 }}>
                  <button disabled={nlPage <= 1} onClick={() => loadNl(nlPage - 1)} style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600, borderRadius: 5, cursor: nlPage <= 1 ? "default" : "pointer", border: `1px solid ${T.cardBdr}`, background: "#FFF", color: nlPage <= 1 ? T.textMut : T.textSec, opacity: nlPage <= 1 ? 0.5 : 1 }}>‹ Prev</button>
                  <button disabled={nlPage >= nlData.pages} onClick={() => loadNl(nlPage + 1)} style={{ padding: "4px 10px", fontSize: 11, fontWeight: 600, borderRadius: 5, cursor: nlPage >= nlData.pages ? "default" : "pointer", border: `1px solid ${T.cardBdr}`, background: "#FFF", color: nlPage >= nlData.pages ? T.textMut : T.textSec, opacity: nlPage >= nlData.pages ? 0.5 : 1 }}>Next ›</button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ textAlign: "center", padding: 40, fontSize: 12, color: T.textMut }}>No properties found</div>
        )}
      </div>
    </div>
  );
}
