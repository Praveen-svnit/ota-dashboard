"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { OTA_COLORS, OTAS } from "@/lib/constants";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const T = {
  pageBg: "#F3F7FB",
  shellBg: "linear-gradient(180deg, #0E2437 0%, #102C45 100%)",
  shellBdr: "rgba(96, 165, 250, 0.16)",
  cardBg: "#FFFFFF",
  cardBdr: "#DCE4EF",
  headerBg: "#F8FAFC",
  rowAlt: "#F8FBFD",
  orange: "#FF6B00",
  orangeL: "#FFF1E7",
  orangeT: "#FFE2CF",
  textPri: "#0F172A",
  textSec: "#475569",
  textMut: "#94A3B8",
  live: "#16A34A",
  liveL: "#DCFCE7",
  notLive: "#DC2626",
  notLiveL: "#FEE2E2",
};

type OvrRow = { fhId: string; fhLiveDate: string | null; ota: string; tat: number };
type MonthRow = {
  quarter: string;
  fhTotal: number;
  liveCount: number;
  l_d0_7: number;
  l_d8_15: number;
  l_d16_30: number;
  l_d31_60: number;
  l_d60p: number;
  avgTat: number;
  nlCount: number;
  nl_d0_15: number;
  nl_d16_30: number;
  nl_d31_60: number;
  nl_d61_90: number;
  nl_d90p: number;
  avgPending: number;
};

function card(extra?: CSSProperties): CSSProperties {
  return {
    background: T.cardBg,
    border: `1px solid ${T.cardBdr}`,
    borderRadius: 18,
    boxShadow: "0 18px 40px rgba(15, 23, 42, 0.08)",
    overflow: "hidden",
    ...extra,
  };
}

function th(opts?: { color?: string; bg?: string }): CSSProperties {
  return {
    padding: "7px 10px",
    fontSize: 9,
    fontWeight: 700,
    color: opts?.color ?? T.textSec,
    background: opts?.bg ?? T.headerBg,
    borderBottom: `1px solid ${T.cardBdr}`,
    borderRight: `1px solid ${T.cardBdr}`,
    textAlign: "center",
    whiteSpace: "nowrap",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };
}

function td(opts?: { bg?: string }): CSSProperties {
  return {
    padding: "6px 10px",
    textAlign: "center",
    borderRight: `1px solid ${T.cardBdr}`,
    borderBottom: `1px solid ${T.cardBdr}`,
    background: opts?.bg,
  };
}

function Num({ value, color, bg, suffix }: { value: number; color: string; bg: string; suffix?: string }) {
  if (!value) return <span style={{ color: "#CBD5E1", fontSize: 10 }}>-</span>;
  return (
    <span style={{ fontWeight: 700, fontSize: 11, color, background: bg, border: `1px solid ${color}25`, borderRadius: 999, padding: "1px 8px" }}>
      {value}
      {suffix ?? ""}
    </span>
  );
}

export default function MonthlyTatReportPage() {
  const [selectedOta, setSelectedOta] = useState("GoMMT");
  const [showAllMonths, setShowAllMonths] = useState(false);
  const [ovrLive, setOvrLive] = useState<OvrRow[]>([]);
  const [ovrNotLive, setOvrNotLive] = useState<OvrRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetch("/api/overdue-listings")
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        setOvrLive(data.rows ?? []);
        setOvrNotLive(data.notLiveRows ?? []);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load monthly TAT report");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo<MonthRow[]>(() => {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const cutoff = oneYearAgo.toISOString().slice(0, 10);

    function getKey(dateValue: string | null) {
      if (!dateValue || dateValue < cutoff) return null;
      const date = new Date(dateValue);
      return Number.isNaN(date.getTime()) ? null : `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
    }

    const liveSubset = ovrLive.filter((row) => row.ota === selectedOta);
    const nlSubset = ovrNotLive.filter((row) => row.ota === selectedOta);

    const liveByMonth: Record<string, { fhId: string; tat: number }[]> = {};
    for (const row of liveSubset) {
      const key = getKey(row.fhLiveDate);
      if (key) (liveByMonth[key] ??= []).push({ fhId: row.fhId, tat: row.tat });
    }

    const nlByMonth: Record<string, Record<string, number>> = {};
    for (const row of nlSubset) {
      const key = getKey(row.fhLiveDate);
      if (!key) continue;
      nlByMonth[key] ??= {};
      nlByMonth[key][row.fhId] = Math.max(nlByMonth[key][row.fhId] ?? 0, row.tat);
    }

    const months = Array.from(new Set([...Object.keys(liveByMonth), ...Object.keys(nlByMonth)]));
    const merged = months.map((month) => {
      const propertyTat: Record<string, { sum: number; count: number }> = {};
      for (const row of liveByMonth[month] ?? []) {
        propertyTat[row.fhId] ??= { sum: 0, count: 0 };
        propertyTat[row.fhId].sum += row.tat;
        propertyTat[row.fhId].count += 1;
      }

      let l_d0_7 = 0;
      let l_d8_15 = 0;
      let l_d16_30 = 0;
      let l_d31_60 = 0;
      let l_d60p = 0;
      let tatSum = 0;
      for (const metric of Object.values(propertyTat)) {
        const avg = Math.round(metric.sum / metric.count);
        tatSum += avg;
        if (avg <= 7) l_d0_7 += 1;
        else if (avg <= 15) l_d8_15 += 1;
        else if (avg <= 30) l_d16_30 += 1;
        else if (avg <= 60) l_d31_60 += 1;
        else l_d60p += 1;
      }

      const pendingTats = Object.values(nlByMonth[month] ?? {});
      const nlCount = pendingTats.length;
      const fhTotal = new Set([...(liveByMonth[month] ?? []).map((row) => row.fhId), ...Object.keys(nlByMonth[month] ?? {})]).size;

      return {
        quarter: month,
        fhTotal,
        liveCount: Object.keys(propertyTat).length,
        l_d0_7,
        l_d8_15,
        l_d16_30,
        l_d31_60,
        l_d60p,
        avgTat: Object.keys(propertyTat).length ? Math.round(tatSum / Object.keys(propertyTat).length) : 0,
        nlCount,
        nl_d0_15: pendingTats.filter((value) => value <= 15).length,
        nl_d16_30: pendingTats.filter((value) => value > 15 && value <= 30).length,
        nl_d31_60: pendingTats.filter((value) => value > 30 && value <= 60).length,
        nl_d61_90: pendingTats.filter((value) => value > 60 && value <= 90).length,
        nl_d90p: pendingTats.filter((value) => value > 90).length,
        avgPending: nlCount ? Math.round(pendingTats.reduce((sum, value) => sum + value, 0) / nlCount) : 0,
      };
    });

    return merged.sort((a, b) => {
      const [am, ay] = a.quarter.split(" ");
      const [bm, by] = b.quarter.split(" ");
      return Number(ay) !== Number(by) ? Number(ay) - Number(by) : MONTHS.indexOf(am ?? "") - MONTHS.indexOf(bm ?? "");
    });
  }, [ovrLive, ovrNotLive, selectedOta]);

  const totals = useMemo(() => {
    const sum = (key: keyof MonthRow) => rows.reduce((acc, row) => acc + (typeof row[key] === "number" ? (row[key] as number) : 0), 0);
    const weightedAvg = (avgKey: "avgTat" | "avgPending", countKey: "liveCount" | "nlCount") => {
      const count = sum(countKey);
      return count ? Math.round(rows.reduce((acc, row) => acc + row[avgKey] * row[countKey], 0) / count) : 0;
    };
    return {
      fhTotal: sum("fhTotal"),
      liveCount: sum("liveCount"),
      nlCount: sum("nlCount"),
      avgTat: weightedAvg("avgTat", "liveCount"),
      avgPending: weightedAvg("avgPending", "nlCount"),
      l_d0_7: sum("l_d0_7"),
      l_d8_15: sum("l_d8_15"),
      l_d16_30: sum("l_d16_30"),
      l_d31_60: sum("l_d31_60"),
      l_d60p: sum("l_d60p"),
      nl_d0_15: sum("nl_d0_15"),
      nl_d16_30: sum("nl_d16_30"),
      nl_d31_60: sum("nl_d31_60"),
      nl_d61_90: sum("nl_d61_90"),
      nl_d90p: sum("nl_d90p"),
    };
  }, [rows]);

  const stickyMonth: CSSProperties = {
    padding: "7px 14px",
    whiteSpace: "nowrap",
    borderRight: `2px solid ${T.cardBdr}`,
    borderBottom: `1px solid ${T.cardBdr}`,
    fontWeight: 700,
    color: T.textPri,
    fontSize: 11,
    position: "sticky",
    left: 0,
    zIndex: 1,
    background: T.cardBg,
  };
  const visibleRows = showAllMonths ? rows.slice().reverse() : rows.slice().reverse().slice(0, 4);

  return (
    <div style={{ minHeight: "100vh", padding: 22, background: `radial-gradient(circle at top left, rgba(14,165,233,0.08), transparent 24%), radial-gradient(circle at top right, rgba(232,63,111,0.08), transparent 22%), ${T.pageBg}` }}>
      <div style={{ ...card({ background: T.shellBg, border: `1px solid ${T.shellBdr}`, marginBottom: 16, padding: 18 }), color: "#F8FAFC" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em" }}>Monthly TAT</div>
            <div style={{ marginTop: 6, fontSize: 13, color: "rgba(226, 232, 240, 0.78)", maxWidth: 760 }}>
              Month-wise live and pending turnaround view, moved into Reports for easier review and sharing.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {OTAS.map((ota) => {
              const active = ota === selectedOta;
              const color = OTA_COLORS[ota] ?? "#2563EB";
              return (
                <button
                  key={ota}
                  type="button"
                  onClick={() => setSelectedOta(ota)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 999,
                    border: `1px solid ${active ? "transparent" : "rgba(255,255,255,0.16)"}`,
                    background: active ? color : "rgba(255,255,255,0.08)",
                    color: "#FFF",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: active ? `0 10px 20px ${color}40` : "none",
                  }}
                >
                  {ota}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 16 }}>
        {[
          { label: "FH Properties", value: totals.fhTotal.toLocaleString("en-IN"), color: T.orange, bg: T.orangeL },
          { label: "Live", value: totals.liveCount.toLocaleString("en-IN"), color: T.live, bg: T.liveL },
          { label: "Not Live", value: totals.nlCount.toLocaleString("en-IN"), color: T.notLive, bg: T.notLiveL },
          { label: "Avg TAT", value: totals.avgTat ? `${totals.avgTat}d` : "-", color: "#6366F1", bg: "#EEF2FF" },
          { label: "Avg Pending", value: totals.avgPending ? `${totals.avgPending}d` : "-", color: "#7C3AED", bg: "#F3E8FF" },
        ].map((kpi) => (
          <div key={kpi.label} style={card({ padding: "14px 16px" })}>
            <div style={{ fontSize: 10, fontWeight: 800, color: kpi.color, textTransform: "uppercase", letterSpacing: "0.08em" }}>{kpi.label}</div>
            <div style={{ marginTop: 8, display: "inline-flex", alignItems: "center", padding: "6px 12px", borderRadius: 999, background: kpi.bg, color: kpi.color, fontSize: 24, fontWeight: 800 }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div style={card({ padding: "28px 20px", color: T.textSec, fontSize: 12 })}>Loading monthly TAT report...</div>
      ) : error ? (
        <div style={card({ padding: "20px", color: T.notLive, fontSize: 12 })}>Unable to load monthly TAT report: {error}</div>
      ) : rows.length === 0 ? (
        <div style={card({ padding: "20px", color: T.textSec, fontSize: 12 })}>No month-wise TAT data available for {selectedOta}.</div>
      ) : (
        <div style={card()}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "12px 16px", borderBottom: `1px solid ${T.cardBdr}`, background: "linear-gradient(180deg, #FBFDFF 0%, #F5F9FD 100%)" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: T.textPri }}>Month-wise - {selectedOta}</div>
              <div style={{ marginTop: 4, fontSize: 10, color: T.textMut }}>Last 12 months, newest first</div>
            </div>
            {rows.length > 4 && (
              <button
                type="button"
                onClick={() => setShowAllMonths(value => !value)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: `1px solid ${T.cardBdr}`,
                  background: "#FFF",
                  color: T.textSec,
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {showAllMonths ? "Show latest 4" : `Show older ${rows.length - 4}`}
              </button>
            )}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%" }}>
              <thead>
                <tr>
                  <th rowSpan={2} style={{ ...th(), textAlign: "left", minWidth: 90, position: "sticky", left: 0, zIndex: 3, verticalAlign: "bottom" }}>Month</th>
                  <th rowSpan={2} style={{ ...th({ color: T.orange, bg: T.orangeL }), verticalAlign: "bottom", minWidth: 60 }}>FH Props</th>
                  <th rowSpan={2} style={{ ...th({ color: T.notLive, bg: T.notLiveL }), verticalAlign: "bottom", minWidth: 60 }}>Not Live</th>
                  <th colSpan={5} style={th({ color: T.notLive, bg: T.notLiveL })}>Pending Breakdown</th>
                  <th rowSpan={2} style={{ ...th({ color: "#6366F1", bg: "#EEF2FF" }), verticalAlign: "bottom", borderRight: "none" }}>Avg Pend</th>
                </tr>
                <tr>
                  <th style={th({ color: "#16A34A", bg: "#DCFCE788" })}>0-15d</th>
                  <th style={th({ color: "#B45309", bg: "#FEF3C788" })}>16-30d</th>
                  <th style={th({ color: "#C2410C", bg: "#FFEDD588" })}>31-60d</th>
                  <th style={th({ color: "#DC2626", bg: "#FEE2E288" })}>61-90d</th>
                  <th style={th({ color: "#7F1D1D", bg: "#FEE2E288" })}>90+d</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, index) => {
                  const rowBg = index % 2 === 0 ? T.cardBg : T.rowAlt;
                  return (
                    <tr key={row.quarter} style={{ background: rowBg }}>
                      <td style={{ ...stickyMonth, background: rowBg }}>{row.quarter}</td>
                      <td style={td({ bg: T.orangeL })}><Num value={row.fhTotal} color={T.orange} bg={T.orangeT} /></td>
                      <td style={td({ bg: T.notLiveL })}><Num value={row.nlCount} color={T.notLive} bg="#FECACA" /></td>
                      <td style={td()}><Num value={row.nl_d0_15} color="#16A34A" bg="#DCFCE7" /></td>
                      <td style={td()}><Num value={row.nl_d16_30} color="#B45309" bg="#FEF3C7" /></td>
                      <td style={td()}><Num value={row.nl_d31_60} color="#C2410C" bg="#FFEDD5" /></td>
                      <td style={td()}><Num value={row.nl_d61_90} color="#DC2626" bg="#FEE2E2" /></td>
                      <td style={td()}><Num value={row.nl_d90p} color="#7F1D1D" bg="#FEE2E2" /></td>
                      <td style={{ ...td({ bg: "#EEF2FF" }), borderRight: "none" }}><Num value={row.avgPending} color="#6366F1" bg="#E0E7FF" suffix="d" /></td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: T.orangeL, borderTop: `2px solid ${T.orange}44` }}>
                  <td style={{ ...stickyMonth, background: T.orangeL, color: T.orange }}>Total</td>
                  <td style={td({ bg: T.orangeT })}><span style={{ fontWeight: 900, color: T.orange }}>{totals.fhTotal || "-"}</span></td>
                  <td style={td({ bg: T.notLiveL })}><Num value={totals.nlCount} color={T.notLive} bg="#FECACA" /></td>
                  <td style={td({ bg: T.orangeL })}><Num value={totals.nl_d0_15} color="#16A34A" bg="#DCFCE7" /></td>
                  <td style={td({ bg: T.orangeL })}><Num value={totals.nl_d16_30} color="#B45309" bg="#FEF3C7" /></td>
                  <td style={td({ bg: T.orangeL })}><Num value={totals.nl_d31_60} color="#C2410C" bg="#FFEDD5" /></td>
                  <td style={td({ bg: T.orangeL })}><Num value={totals.nl_d61_90} color="#DC2626" bg="#FEE2E2" /></td>
                  <td style={td({ bg: T.orangeL })}><Num value={totals.nl_d90p} color="#7F1D1D" bg="#FEE2E2" /></td>
                  <td style={{ ...td({ bg: "#EEF2FF" }), borderRight: "none" }}><Num value={totals.avgPending} color="#6366F1" bg="#E0E7FF" suffix="d" /></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

