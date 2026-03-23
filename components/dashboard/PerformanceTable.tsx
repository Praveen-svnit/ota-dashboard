"use client";

import { useState } from "react";
import { autoMonthKey, fmt, cmTrend, daysInMonth, daysDoneInMonth } from "@/lib/utils";

type MonthEntry  = { lmMTD: number; cmMTD: number; lmTotal: number };
type MonthlyData = Record<string, Record<string, MonthEntry>>;

type Metric = "RNS" | "Rev" | "RNPD" | "RPD";

interface Props {
  title:          string;
  rnsMonthly:     MonthlyData;
  rnsSoldMonthly?: MonthlyData | null;
  revMonthly:     MonthlyData | null;
  otas:           string[];
}

function parseMonthKey(key: string): Date {
  const [mon, yr] = key.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return new Date(2000 + parseInt(yr ?? "0"), months.indexOf(mon ?? ""), 1);
}

function nextMonthKey(key: string): string {
  const [mon, yr] = key.split("-");
  const d = new Date(Date.parse(`${mon} 20${yr}`));
  d.setMonth(d.getMonth() + 1);
  return d.toLocaleString("en-GB", { month: "short", year: "2-digit" })
    .replace(" ", "-").replace(/^(\w)/, (c) => c.toUpperCase());
}

function prevMonthKey(key: string): string {
  const [mon, yr] = key.split("-");
  const d = new Date(Date.parse(`${mon} 20${yr}`));
  d.setMonth(d.getMonth() - 1);
  return d.toLocaleString("en-GB", { month: "short", year: "2-digit" })
    .replace(" ", "-").replace(/^(\w)/, (c) => c.toUpperCase());
}

function movement(a: number, b: number): number | null {
  if (b === 0) return null;
  return Math.round(((a - b) / b) * 100);
}

function MovPct({ pct }: { pct: number | null }) {
  if (pct === null) return <span style={{ color: "#CBD5E1", fontSize: 11 }}>—</span>;
  const pos = pct >= 0;
  return (
    <span style={{
      display: "inline-block", padding: "2px 7px", borderRadius: 5,
      fontSize: 10, fontWeight: 700,
      background: pos ? "#DCFCE7" : "#FEE2E2",
      color:      pos ? "#16A34A" : "#DC2626",
    }}>
      {pos ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

const METRICS: { key: Metric; label: string }[] = [
  { key: "RNS",  label: "RNS"  },
  { key: "Rev",  label: "Rev"  },
  { key: "RNPD", label: "RNPD" },
  { key: "RPD",  label: "RPD"  },
];

export default function PerformanceTable({ title, rnsMonthly, rnsSoldMonthly, revMonthly, otas }: Props) {
  const todayKey  = autoMonthKey();
  const allMonths = Object.keys(rnsMonthly).sort(
    (a, b) => parseMonthKey(b).getTime() - parseMonthKey(a).getTime()
  );

  const [metric,   setMetric]   = useState<Metric>("RNS");
  const [view,     setView]     = useState<"Stay" | "Sold">("Stay");
  const [cmMonth,  setCmMonth]  = useState(todayKey);
  const [lmMonth,  setLmMonth]  = useState(() => prevMonthKey(todayKey));

  if (allMonths.length === 0) return null;

  const cm = allMonths.includes(cmMonth) ? cmMonth : (allMonths[0] ?? todayKey);
  const lm = lmMonth;

  const isRev      = metric === "Rev" || metric === "RPD";
  const isPerDay   = metric === "RNPD" || metric === "RPD";
  const hasSold    = !!rnsSoldMonthly;
  // Rev/RPD always use stay data (no sold revenue data); RNS/RNPD switch on view
  const data       = isRev ? (revMonthly ?? rnsMonthly) : (view === "Sold" ? (rnsSoldMonthly ?? rnsMonthly) : rnsMonthly);

  const isCmCurrent = cm === todayKey;
  const cmDaysDone  = daysDoneInMonth(cm);
  const cmDaysTotal = daysInMonth(cm);
  const lmDaysDone  = daysDoneInMonth(lm);   // same-day cutoff used for lmMTD
  const lmDaysTotal = daysInMonth(lm);

  // Get LM values: prefer embedded lmMTD/lmTotal in the CM month's data (when lm = natural prev of cm)
  // Otherwise look up from the entry where lm is the natural prev month
  const naturalLmOfCm = prevMonthKey(cm);
  const lmIsNatural   = lm === naturalLmOfCm;

  function getLmMTD(ota: string): number {
    if (lmIsNatural) return data[cm]?.[ota]?.lmMTD ?? 0;
    // Find entry where lm is the natural LM (i.e., the month after lm)
    const hostKey = nextMonthKey(lm);
    return data[hostKey]?.[ota]?.lmMTD ?? data[lm]?.[ota]?.cmMTD ?? 0;
  }

  function getLmTotal(ota: string): number {
    if (lmIsNatural) return data[cm]?.[ota]?.lmTotal ?? 0;
    const hostKey = nextMonthKey(lm);
    return data[hostKey]?.[ota]?.lmTotal ?? 0;
  }

  function getCmMTD(ota: string): number {
    return data[cm]?.[ota]?.cmMTD ?? 0;
  }

  // Apply per-day division if needed
  function applyScale(v: number, days: number): number {
    if (!isPerDay || days === 0) return v;
    return Math.round((v / days) * 10) / 10;
  }

  function fmtVal(v: number): string {
    if (isPerDay) return v === 0 ? "—" : v.toLocaleString("en-IN", { minimumFractionDigits: v % 1 === 0 ? 0 : 1, maximumFractionDigits: 1 });
    if (isRev)    return v === 0 ? "—" : "₹" + fmt(Math.round(v));
    return v === 0 ? "—" : fmt(v);
  }

  // Totals
  const totCmMTD  = otas.reduce((s, o) => s + getCmMTD(o),  0);
  const totLmMTD  = otas.reduce((s, o) => s + getLmMTD(o),  0);
  const totLmFull = otas.reduce((s, o) => s + getLmTotal(o), 0);
  const totRawProj = cmTrend(totCmMTD, cmDaysDone, cmDaysTotal);

  const tCm   = applyScale(totCmMTD,  cmDaysDone);
  const tLm   = applyScale(totLmMTD,  lmDaysDone);
  const tLmF  = applyScale(totLmFull, lmDaysTotal);
  const tProj = isPerDay ? tCm : totRawProj;

  const accent = "#2563EB";
  const purple = "#7C3AED";

  const selStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, padding: "4px 10px",
    border: "1px solid #E2E8F0", borderRadius: 7,
    background: "#F8FAFC", color: "#374151",
    cursor: "pointer", outline: "none",
  };
  const TH: React.CSSProperties = {
    padding: "6px 10px", fontSize: 9, fontWeight: 700,
    color: "#94A3B8", textAlign: "center",
    background: "#F8FAFC", borderBottom: "1px solid #E2E8F0",
    whiteSpace: "nowrap",
  };
  const TD: React.CSSProperties = { padding: "7px 10px", textAlign: "center", borderTop: "1px solid #F1F5F9" };

  const projLabel = isPerDay ? (isRev ? "RPD" : "RNPD") : (isCmCurrent ? "CM Proj" : "CM Total");

  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>

      {/* Header bar */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>

        {/* Title + live badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{title}</span>
          {isCmCurrent && !isPerDay && (
            <span style={{ fontSize: 10, color: accent, background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 5, padding: "2px 8px", fontWeight: 600 }}>
              Day {cmDaysDone}/{cmDaysTotal}
            </span>
          )}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>

          {/* Metric toggle */}
          <div style={{ display: "flex", border: "1px solid #E2E8F0", borderRadius: 7, overflow: "hidden" }}>
            {METRICS.map(({ key, label }) => {
              const active  = metric === key;
              const disabled = (key === "Rev" || key === "RPD") && !revMonthly;
              return (
                <button
                  key={key}
                  onClick={() => !disabled && setMetric(key)}
                  title={disabled ? "No revenue data" : undefined}
                  style={{
                    padding: "4px 11px", fontSize: 11, fontWeight: 700,
                    border: "none", borderLeft: key !== "RNS" ? "1px solid #E2E8F0" : "none",
                    cursor: disabled ? "not-allowed" : "pointer",
                    fontFamily: "inherit",
                    background: active ? "#0F172A" : "#F8FAFC",
                    color:      active ? "#FFFFFF"  : disabled ? "#CBD5E1" : "#64748B",
                    transition: "background 0.12s",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Stay / Sold toggle */}
          {hasSold && (
            <div style={{ display: "flex", border: "1px solid #E2E8F0", borderRadius: 7, overflow: "hidden" }}>
              {(["Stay", "Sold"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{
                    padding: "4px 11px", fontSize: 11, fontWeight: 700,
                    border: "none", borderLeft: v === "Sold" ? "1px solid #E2E8F0" : "none",
                    cursor: "pointer", fontFamily: "inherit",
                    background: view === v ? "#0F172A" : "#F8FAFC",
                    color:      view === v ? "#FFFFFF"  : "#64748B",
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          )}

          {/* CM month */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600 }}>CM</span>
            <select value={cm} onChange={(e) => { setCmMonth(e.target.value); setLmMonth(prevMonthKey(e.target.value)); }} style={selStyle}>
              {allMonths.map((m) => (
                <option key={m} value={m}>{m}{m === todayKey ? " ★" : ""}</option>
              ))}
            </select>
          </div>

          {/* LM month */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 600 }}>LM</span>
            <select value={lm} onChange={(e) => setLmMonth(e.target.value)} style={selStyle}>
              {allMonths.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#F8FAFC" }}>
              <th style={{ ...TH, textAlign: "left", minWidth: 120, borderRight: "1px solid #E2E8F0" }}>OTA</th>
              <th style={{ ...TH, color: "#64748B" }}>LM MTD</th>
              <th style={{ ...TH, color: accent }}>CM MTD</th>
              <th style={TH}>Movement %</th>
              <th style={{ ...TH, borderLeft: "1px solid #E2E8F0", color: "#64748B" }}>LM Total</th>
              <th style={{ ...TH, color: purple }}>{projLabel}</th>
              <th style={TH}>Movement %</th>
            </tr>
          </thead>

          <tbody>
            {otas.map((ota, ri) => {
              const rawCm   = getCmMTD(ota);
              const rawLm   = getLmMTD(ota);
              const rawLmF  = getLmTotal(ota);
              const rawProj = isPerDay ? rawCm : cmTrend(rawCm, cmDaysDone, cmDaysTotal);

              const vCm   = applyScale(rawCm,   cmDaysDone);
              const vLm   = applyScale(rawLm,   lmDaysDone);
              const vLmF  = applyScale(rawLmF,  lmDaysTotal);
              const vProj = isPerDay ? vCm : rawProj;

              const mov1 = movement(vCm,   vLm);
              const mov2 = movement(vProj, vLmF);
              const bg   = ri % 2 === 0 ? "#FFFFFF" : "#FAFAFA";

              return (
                <tr key={ota} style={{ background: bg }}>
                  <td style={{ ...TD, textAlign: "left", padding: "7px 14px", fontWeight: 500, color: "#334155", borderRight: "1px solid #F1F5F9", whiteSpace: "nowrap" }}>
                    {ota}
                  </td>
                  <td style={TD}>
                    <span style={{ color: vLm === 0 ? "#CBD5E1" : "#64748B" }}>{fmtVal(vLm)}</span>
                  </td>
                  <td style={TD}>
                    <span style={{ fontWeight: 700, color: vCm === 0 ? "#CBD5E1" : accent }}>{fmtVal(vCm)}</span>
                  </td>
                  <td style={TD}><MovPct pct={mov1} /></td>
                  <td style={{ ...TD, borderLeft: "1px solid #F1F5F9" }}>
                    <span style={{ color: vLmF === 0 ? "#CBD5E1" : "#64748B" }}>{fmtVal(vLmF)}</span>
                  </td>
                  <td style={TD}>
                    <span style={{ fontWeight: 700, color: vProj === 0 ? "#CBD5E1" : purple }}>{fmtVal(vProj)}</span>
                  </td>
                  <td style={TD}><MovPct pct={mov2} /></td>
                </tr>
              );
            })}
          </tbody>

          <tfoot>
            <tr style={{ borderTop: "2px solid #E2E8F0", background: "#F8FAFC" }}>
              <td style={{ padding: "8px 14px", fontWeight: 800, color: "#0F172A", fontSize: 12, borderRight: "1px solid #E2E8F0" }}>TOTAL</td>
              <td style={{ ...TD, fontWeight: 700, color: "#64748B" }}>{fmtVal(tLm)}</td>
              <td style={{ ...TD, fontWeight: 800, color: accent }}>{fmtVal(tCm)}</td>
              <td style={TD}><MovPct pct={movement(tCm, tLm)} /></td>
              <td style={{ ...TD, fontWeight: 700, color: "#64748B", borderLeft: "1px solid #E2E8F0" }}>{fmtVal(tLmF)}</td>
              <td style={{ ...TD, fontWeight: 800, color: purple }}>{fmtVal(tProj)}</td>
              <td style={TD}><MovPct pct={movement(tProj, tLmF)} /></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
