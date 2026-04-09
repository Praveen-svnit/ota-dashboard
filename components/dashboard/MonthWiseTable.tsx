"use client";

import { Fragment, useState } from "react";
import { autoMonthKey, daysInMonth, daysDoneInMonth } from "@/lib/utils";
import { RNS_OTAS, OTA_COLORS, OTA_CHANNELS } from "@/lib/constants";

type MonthEntry  = { cmMTD: number; lmMTD?: number; lmTotal?: number };
type MonthlyData = Record<string, Record<string, MonthEntry>>;

type Metric = "RNS" | "Rev" | "RNPD" | "RPD";

interface Props {
  title:          string;
  stayData:       MonthlyData | null;
  soldData?:      MonthlyData | null;
  occupiedData?:  MonthlyData | null;
  revStayData?:   MonthlyData | null;
  accent?:        string;
}

function parseMonthKey(key: string): Date {
  const [mon, yr] = key.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return new Date(2000 + parseInt(yr ?? "0"), months.indexOf(mon ?? ""), 1);
}

export default function MonthWiseTable({ title, stayData, soldData, occupiedData, revStayData, accent = "#2563EB" }: Props) {
  const [view,       setView]       = useState<"Stay" | "Sold" | "Occupied">("Occupied");
  const [metric,     setMetric]     = useState<Metric>("RNS");
  const [showAllOta, setShowAllOta] = useState(false);

  const isRev    = metric === "Rev" || metric === "RPD";
  const isPerDay = metric === "RNPD" || metric === "RPD";

  const monthlyData = isRev
    ? (revStayData ?? stayData)
    : view === "Occupied" ? (occupiedData ?? stayData)
    : view === "Stay"     ? stayData
    : (soldData ?? stayData);

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
    vals:     months.map((m) => applyMetric((monthlyData[m]?.[ota] as any)?.cmMTD ?? 0, m)),
    channels: OTA_CHANNELS[ota]
      ? OTA_CHANNELS[ota].map((ch) => ({
          name: ch,
          vals: months.map((m) =>
            applyMetric((monthlyData[m]?.[ota] as any)?.channels?.[ch]?.cmMTD ?? 0, m)
          ),
        }))
      : [],
  }));

  const colTotals = months.map((_, mi) =>
    otaRows.reduce((sum, r) => sum + r.vals[mi], 0)
  );

  const hasSold     = !!soldData;
  const hasOccupied = !!occupiedData;
  const hasRev      = !!revStayData;

  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{title}</span>
        <span style={{ fontSize: 10, color: "#94A3B8" }}>month-wise · current month is MTD</span>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {/* Show all OTAs toggle */}
          <button
            onClick={() => setShowAllOta((v) => !v)}
            style={{
              padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer",
              border: "1px solid #E2E8F0", borderRadius: 7,
              background: showAllOta ? "#EFF6FF" : "#FFFFFF",
              color: showAllOta ? accent : "#64748B",
            }}
          >
            {showAllOta ? "▼ All OTAs" : "▶ All OTAs"}
          </button>

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

          {/* Stay (Checkin) / Stay (Occupied) / Sold toggle */}
          <div style={{ display: "flex", borderRadius: 7, border: "1px solid #E2E8F0", overflow: "hidden" }}>
            {([
              ["Stay",     "Stay (Checkin)"],
              ...(hasOccupied ? [["Occupied", "Stay (Occupied)"]] as const : []),
              ...(hasSold     ? [["Sold",     "Sold"]]            as const : []),
            ] as [string, string][]).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setView(v as "Stay" | "Sold" | "Occupied")}
                style={{
                  padding: "4px 12px", border: "none", cursor: "pointer",
                  borderLeft: v !== "Stay" ? "1px solid #E2E8F0" : "none",
                  background: view === v ? "#0F172A" : "#FFFFFF",
                  color:      view === v ? "#FFFFFF" : "#64748B",
                  fontFamily: "inherit", fontSize: 11, fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </button>
            ))}
          </div>
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
            {otaRows.map(({ ota, vals, channels }, ri) => {
              const color = OTA_COLORS[ota] ?? "#64748B";
              return (
                <Fragment key={ota}>
                  <tr style={{ borderTop: "1px solid #F1F5F9", background: ri % 2 === 0 ? "#FFFFFF" : "#FAFAFA" }}>
                    <td style={{ padding: "8px 14px", fontWeight: 500, color: "#334155", whiteSpace: "nowrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                        {ota}
                      </span>
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
                  {showAllOta && channels.map(({ name, vals: chVals }) => (
                    <tr key={`${ota}.${name}`} style={{ borderTop: "1px solid #F8FAFC", background: "#F8FAFC" }}>
                      <td style={{ padding: "6px 14px 6px 28px", color: "#64748B", whiteSpace: "nowrap", fontSize: 11 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, opacity: 0.5, flexShrink: 0 }} />
                          {name}
                        </span>
                      </td>
                      {chVals.map((v, mi) => (
                        <td key={months[mi]} style={{
                          padding: "6px 12px", textAlign: "center",
                          background: months[mi] === cmKey ? accent + "03" : "transparent",
                        }}>
                          <span style={{ fontSize: 11, color: v === 0 ? "#E2E8F0" : "#64748B" }}>
                            {fmtVal(v)}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              );
            })}
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
