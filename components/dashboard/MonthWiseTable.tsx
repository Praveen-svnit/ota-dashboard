"use client";

import { useState } from "react";
import { autoMonthKey, daysInMonth, daysDoneInMonth } from "@/lib/utils";
import { RNS_OTAS } from "@/lib/constants";

type MonthEntry  = { cmMTD: number; lmMTD?: number; lmTotal?: number };
type MonthlyData = Record<string, Record<string, MonthEntry>>;

type Metric = "RNS" | "Rev" | "RNPD" | "RPD";

interface Props {
  title:         string;
  stayData:      MonthlyData | null;
  soldData?:     MonthlyData | null;
  revStayData?:  MonthlyData | null;
  accent?:       string;
}

function parseMonthKey(key: string): Date {
  const [mon, yr] = key.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return new Date(2000 + parseInt(yr ?? "0"), months.indexOf(mon ?? ""), 1);
}

export default function MonthWiseTable({ title, stayData, soldData, revStayData, accent = "#2563EB" }: Props) {
  const [view,   setView]   = useState<"Stay" | "Sold">("Stay");
  const [metric, setMetric] = useState<Metric>("RNS");

  const isRev    = metric === "Rev" || metric === "RPD";
  const isPerDay = metric === "RNPD" || metric === "RPD";

  const monthlyData = isRev
    ? (revStayData ?? stayData)
    : (view === "Stay" ? stayData : (soldData ?? stayData));

  if (!monthlyData) return null;

  const cmKey = autoMonthKey();

  const months = Object.keys(monthlyData).sort((a, b) =>
    parseMonthKey(b).getTime() - parseMonthKey(a).getTime()
  );

  if (months.length === 0) return null;

  // For RNPD: current month uses D-1, past months use full days in month
  const d1Days = Math.max(daysDoneInMonth(cmKey) - 1, 1);
  function monthDays(m: string) {
    return m === cmKey ? d1Days : daysInMonth(m);
  }

  function applyMetric(raw: number, m: string) {
    if (!isPerDay) return raw;
    const days = monthDays(m);
    return days > 0 ? Math.round(raw / days) : 0;
  }

  const fmtVal = (n: number) => {
    if (n === 0) return "—";
    if (isRev && !isPerDay) return "₹" + n.toLocaleString("en-IN");
    return n.toLocaleString("en-IN");
  };

  const otaRows = RNS_OTAS.map((ota) => ({
    ota,
    vals: months.map((m) => applyMetric(monthlyData[m]?.[ota]?.cmMTD ?? 0, m)),
  }));

  const colTotals = months.map((_, mi) =>
    otaRows.reduce((sum, r) => sum + r.vals[mi], 0)
  );

  const hasSold = !!soldData;
  const hasRev  = !!revStayData;

  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{title}</span>
        <span style={{ fontSize: 10, color: "#94A3B8" }}>month-wise · current month is MTD</span>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {/* Metric toggle */}
          <div style={{ display: "flex", borderRadius: 7, border: "1px solid #E2E8F0", overflow: "hidden" }}>
            {(["RNS", "Rev", "RNPD", "RPD"] as Metric[]).map((v) => {
              const disabled = (v === "Rev" || v === "RPD") && !hasRev;
              return (
                <button
                  key={v}
                  onClick={() => !disabled && setMetric(v)}
                  title={disabled ? "No revenue data" : undefined}
                  style={{
                    padding: "4px 11px", border: "none", cursor: disabled ? "not-allowed" : "pointer",
                    borderLeft: v !== "RNS" ? "1px solid #E2E8F0" : "none",
                    background: metric === v ? "#0F172A" : "#FFFFFF",
                    color:      metric === v ? "#FFFFFF" : disabled ? "#CBD5E1" : "#64748B",
                    fontFamily: "inherit", fontSize: 11, fontWeight: 600,
                  }}
                >
                  {v}
                </button>
              );
            })}
          </div>

          {/* Stay / Sold toggle */}
          {hasSold && (
            <div style={{ display: "flex", borderRadius: 7, border: "1px solid #E2E8F0", overflow: "hidden" }}>
              {(["Stay", "Sold"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  style={{
                    padding: "4px 12px", border: "none", cursor: "pointer",
                    background: view === v ? "#0F172A" : "#FFFFFF",
                    color:      view === v ? "#FFFFFF" : "#64748B",
                    fontFamily: "inherit", fontSize: 11, fontWeight: 600,
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr style={{ background: "#F8FAFC" }}>
              <th style={{ padding: "9px 14px", fontSize: 10, fontWeight: 700, color: "#94A3B8", textAlign: "left", whiteSpace: "nowrap", borderBottom: "1px solid #E2E8F0", minWidth: 120 }}>
                OTA
              </th>
              {months.map((m) => (
                <th key={m} style={{
                  padding: "9px 12px", fontSize: 10, fontWeight: 700,
                  color: m === cmKey ? accent : "#94A3B8",
                  textAlign: "center", whiteSpace: "nowrap",
                  borderBottom: "1px solid #E2E8F0",
                  background: m === cmKey ? accent + "08" : "#F8FAFC",
                  minWidth: 72,
                }}>
                  {m}{m === cmKey ? " ★" : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {otaRows.map(({ ota, vals }, ri) => (
              <tr key={ota} style={{ borderTop: "1px solid #F1F5F9", background: ri % 2 === 0 ? "#FFFFFF" : "#FAFAFA" }}>
                <td style={{ padding: "8px 14px", fontWeight: 500, color: "#334155", whiteSpace: "nowrap" }}>
                  {ota}
                </td>
                {vals.map((v, mi) => (
                  <td key={months[mi]} style={{
                    padding: "8px 12px", textAlign: "center",
                    background: months[mi] === cmKey ? accent + "05" : "transparent",
                  }}>
                    <span style={{
                      fontWeight: months[mi] === cmKey ? 700 : 400,
                      color: v === 0 ? "#CBD5E1" : months[mi] === cmKey ? accent : "#374151",
                    }}>
                      {fmtVal(v)}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid #E2E8F0", background: "#F8FAFC" }}>
              <td style={{ padding: "9px 14px", fontWeight: 700, color: "#0F172A", fontSize: 12 }}>TOTAL</td>
              {colTotals.map((t, mi) => (
                <td key={months[mi]} style={{
                  padding: "9px 12px", textAlign: "center",
                  background: months[mi] === cmKey ? accent + "10" : "transparent",
                }}>
                  <span style={{ fontWeight: 800, color: months[mi] === cmKey ? accent : "#0F172A", fontSize: 12 }}>
                    {fmtVal(t)}
                  </span>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
