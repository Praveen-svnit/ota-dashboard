"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const T = {
  pageBg: "#050d17",
  shellBg: "linear-gradient(180deg, #0a1d31 0%, #081729 100%)",
  headerBg: "linear-gradient(180deg, rgba(17, 60, 100, 0.96) 0%, rgba(13, 44, 73, 0.92) 100%)",
  cardBg: "linear-gradient(180deg, rgba(18, 48, 79, 0.98) 0%, rgba(14, 39, 66, 0.98) 100%)",
  cardBdr: "rgba(98, 178, 228, 0.16)",
  shellBdr: "rgba(66, 161, 223, 0.22)",
  textPri: "#E8F6FF",
  textSec: "#9FC0DA",
  textMut: "#6F95B3",
  accent: "#22D3EE",
  accentBg: "rgba(34, 211, 238, 0.18)",
  warn: "#FFB000",
  warnBg: "rgba(255, 176, 0, 0.18)",
  danger: "#FF7A7A",
  dangerBg: "rgba(255, 122, 122, 0.18)",
  indigo: "#BC5CFF",
  indigoBg: "rgba(188, 92, 255, 0.2)",
  sky: "#FF1493",
  skyBg: "rgba(255, 20, 147, 0.18)",
  lime: "#31F2A3",
  limeBg: "rgba(49, 242, 163, 0.18)",
  grid: "rgba(133, 181, 214, 0.14)",
};

type SummaryPayload = {
  profile: {
    tables: number;
    tableCounts: Array<{ table: string; rows: number }>;
  };
  kpis: {
    properties: number;
    otaListings: number;
    liveListings: number;
    exceptionListings: number;
    tatBreaches: number;
    avgTat: number | null;
    avgPendingTat: number | null;
    liveRate: number;
  };
  charts: {
    monthlyTrend: Array<{ month: string; liveListings: number; onboarded: number; soldRns: number; soldRevenue: number }>;
    otaBreakdown: Array<{ ota: string; live: number; exception: number; inProcess: number; tatExhausted: number }>;
    cities: Array<{ city: string; listings: number; live: number; exception: number; avgTat: number | null; liveRate: number }>;
    subStatusDistribution: Array<{ subStatus: string; total: number }>;
  };
  insights: {
    biggestRise: { month: string; delta: number } | null;
    biggestDrop: { month: string; delta: number } | null;
    lowestCity: { city: string; listings: number; liveRate: number } | null;
    topOta: { ota: string } | null;
  };
  executiveSummary: string[];
  recommendations: string[];
  error?: string;
};

function cardStyle(extra?: CSSProperties): CSSProperties {
  return {
    background: T.cardBg,
    border: `1px solid ${T.cardBdr}`,
    borderRadius: 22,
    boxShadow: "0 18px 45px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.03)",
    ...extra,
  };
}

function fmtCompact(n: number) {
  if (n >= 10000000) return `${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString("en-IN");
}

function fmtChange(value: number) {
  const rounded = Math.abs(value) >= 100 ? Math.round(value) : Number(value.toFixed(1));
  return `${value > 0 ? "+" : ""}${rounded}`;
}

export default function ReportsSummaryPage() {
  const [data, setData] = useState<SummaryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [cityMetric, setCityMetric] = useState<"listings" | "liveRate">("listings");
  const [summaryMode, setSummaryMode] = useState<"synopsis" | "regional" | "orders">("synopsis");
  const [rankingMetric, setRankingMetric] = useState<"listings" | "liveRate" | "avgTat">("listings");
  const [rankingDirection, setRankingDirection] = useState<"top" | "bottom">("top");

  useEffect(() => {
    fetch("/api/reports-summary")
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  const subStatusColors = useMemo(
    () => [T.warn, T.sky, T.accent, T.lime, T.indigo, "#5AC8FA", "#F97316", "#8B5CF6", "#F43F5E", "#10B981"],
    []
  );

  if (loading) {
    return <div style={{ padding: "22px 24px", color: T.textSec }}>Loading summary report…</div>;
  }

  if (!data || data.error) {
    return <div style={{ padding: "22px 24px", color: T.danger }}>Unable to load summary report: {data?.error ?? "Unknown error"}</div>;
  }

  const monthlyTrend = data.charts.monthlyTrend;
  const latestMonth = monthlyTrend[monthlyTrend.length - 1];
  const previousMonth = monthlyTrend[monthlyTrend.length - 2];
  const cityOverviewRows = [...data.charts.cities].slice(0, 4);
  const cityChartData = [...data.charts.cities].slice(0, 8);
  const liveDelta = latestMonth && previousMonth ? latestMonth.liveListings - previousMonth.liveListings : 0;
  const onboardDelta = latestMonth && previousMonth ? latestMonth.onboarded - previousMonth.onboarded : 0;
  const soldRevenueDelta = latestMonth && previousMonth ? latestMonth.soldRevenue - previousMonth.soldRevenue : 0;
  const soldRnsDelta = latestMonth && previousMonth ? latestMonth.soldRns - previousMonth.soldRns : 0;
  const rankedCities = [...data.charts.cities]
    .filter((city) => (rankingMetric === "avgTat" ? city.avgTat !== null : true))
    .sort((a, b) => {
      const aVal = rankingMetric === "listings" ? a.listings : rankingMetric === "liveRate" ? a.liveRate : a.avgTat ?? 0;
      const bVal = rankingMetric === "listings" ? b.listings : rankingMetric === "liveRate" ? b.liveRate : b.avgTat ?? 0;
      return rankingDirection === "top" ? bVal - aVal : aVal - bVal;
    })
    .slice(0, 5);
  const otaEffectiveness = data.charts.otaBreakdown
    .map((row) => {
      const total = row.live + row.exception + row.inProcess + row.tatExhausted;
      return {
        ...row,
        effectiveLiveRate: total > 0 ? Number((((row.live + row.exception) / total) * 100).toFixed(1)) : 0,
      };
    })
    .sort((a, b) => b.effectiveLiveRate - a.effectiveLiveRate)
    .slice(0, 5);

  return (
    <div style={{ minHeight: "100vh", padding: 22, background: `radial-gradient(circle at top left, rgba(34,211,238,0.08), transparent 28%), radial-gradient(circle at top right, rgba(255,20,147,0.07), transparent 26%), ${T.pageBg}` }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18, gap: 16, flexWrap: "wrap", padding: "22px 22px 18px", marginLeft: -22, marginRight: -22, marginTop: -22, background: T.headerBg, borderBottom: `1px solid ${T.cardBdr}` }}>
        <div>
          <div style={{ fontSize: 31, fontWeight: 800, color: T.accent, letterSpacing: "-0.02em" }}>OTA Supply, Conversion and Turnaround Command Center</div>
          <div style={{ marginTop: 6, fontSize: 14, color: T.textSec, maxWidth: 760 }}>Executive summary across listing health, revenue momentum, city concentration and operational risk</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["Synopsis", "Regional Analysis", "Orders"] as const).map((label) => {
            const active = (label === "Synopsis" && summaryMode === "synopsis") || (label === "Regional Analysis" && summaryMode === "regional") || (label === "Orders" && summaryMode === "orders");
            return (
              <button
                key={label}
                type="button"
                onClick={() => setSummaryMode(label === "Synopsis" ? "synopsis" : label === "Regional Analysis" ? "regional" : "orders")}
                style={{ border: `1px solid ${active ? "transparent" : "rgba(61,170,233,0.35)"}`, background: active ? "linear-gradient(180deg, #23d5ee 0%, #12b6e0 100%)" : "rgba(10,36,60,0.72)", color: active ? "#053048" : T.accent, padding: "10px 16px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 14, marginBottom: 16, marginTop: 18 }}>
        {[
          { label: "Listings", value: data.kpis.otaListings.toLocaleString("en-IN"), color: T.accent, bg: T.accentBg, current: latestMonth?.onboarded ?? 0, previous: previousMonth?.onboarded ?? 0, delta: onboardDelta, note: latestMonth ? `CM ${latestMonth.month}` : "Current month", series: monthlyTrend.map((row) => ({ name: row.month, value: row.onboarded })) },
          { label: "Live Inventory", value: data.kpis.liveListings.toLocaleString("en-IN"), color: T.sky, bg: T.skyBg, current: latestMonth?.liveListings ?? 0, previous: previousMonth?.liveListings ?? 0, delta: liveDelta, note: `${data.kpis.liveRate}% effective live rate`, series: monthlyTrend.map((row) => ({ name: row.month, value: row.liveListings })) },
          { label: "Revenue Pulse", value: fmtCompact(latestMonth?.soldRevenue ?? 0), color: T.lime, bg: T.limeBg, current: latestMonth?.soldRevenue ?? 0, previous: previousMonth?.soldRevenue ?? 0, delta: soldRevenueDelta, note: `${fmtCompact(latestMonth?.soldRevenue ?? 0)} sold revenue`, series: monthlyTrend.map((row) => ({ name: row.month, value: row.soldRevenue })) },
          { label: "Avg TAT", value: data.kpis.avgTat !== null ? `${data.kpis.avgTat}d` : "—", color: T.indigo, bg: T.indigoBg },
          { label: "Avg Pending", value: data.kpis.avgPendingTat !== null ? `${data.kpis.avgPendingTat}d` : "—", color: T.warn, bg: T.warnBg },
          { label: "Orders", value: fmtCompact(latestMonth?.soldRns ?? 0), color: T.warn, bg: T.warnBg, current: latestMonth?.soldRns ?? 0, previous: previousMonth?.soldRns ?? 0, delta: soldRnsDelta, note: `${data.kpis.tatBreaches.toLocaleString("en-IN")} beyond TAT`, series: monthlyTrend.map((row) => ({ name: row.month, value: row.soldRns })) },
        ].map((kpi) => (
          <div key={kpi.label} style={cardStyle({ padding: "18px 18px 10px" })}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: T.textPri }}>{kpi.label}</div>
                <div style={{ marginTop: 8, color: T.textPri, fontSize: 33, fontWeight: 800, letterSpacing: "-0.03em" }}>{kpi.value}</div>
                {"current" in kpi && (
                  <div style={{ display: "flex", gap: 12, marginTop: 10, color: T.textSec, fontSize: 13 }}>
                    <span style={{ color: kpi.color, fontWeight: 800 }}>CM {fmtCompact(kpi.current)}</span>
                    <span>PY {fmtCompact(kpi.previous)}</span>
                  </div>
                )}
              </div>
              <div style={{ width: 18, height: 18, borderRadius: 999, display: "grid", placeItems: "center", background: "rgba(255,255,255,0.12)", color: T.textMut, fontSize: 11, fontWeight: 700 }}>i</div>
            </div>
            {"delta" in kpi ? (
              <>
                <div style={{ marginTop: 10, display: "inline-flex", padding: "5px 10px", borderRadius: 999, background: kpi.delta >= 0 ? T.limeBg : T.dangerBg, color: kpi.delta >= 0 ? T.lime : T.danger, fontSize: 11, fontWeight: 700 }}>{fmtChange(kpi.delta)} vs prior month</div>
                <div style={{ marginTop: 10, color: T.textSec, fontSize: 13 }}>{kpi.note}</div>
                <div style={{ width: "100%", height: 84, marginTop: 10 }}>
                  <ResponsiveContainer>
                    <AreaChart data={kpi.series}>
                      <defs>
                        <linearGradient id={`summary-${kpi.label}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={kpi.color} stopOpacity={0.34} />
                          <stop offset="100%" stopColor={kpi.color} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="value" stroke={kpi.color} strokeWidth={2.5} fill={`url(#summary-${kpi.label})`} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </>
            ) : (
              <div style={{ marginTop: 12, display: "inline-flex", padding: "5px 10px", borderRadius: 999, background: kpi.bg, color: kpi.color, fontSize: 11, fontWeight: 700 }}>Portfolio KPI</div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 14, marginBottom: 16 }}>
        <div style={cardStyle({ padding: 18 })}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.textPri }}>Overview → Monthly Trend</div>
              <div style={{ fontSize: 10, color: T.textMut }}>Live listings vs onboarding vs sold RNS across the latest 12 months</div>
            </div>
          </div>
          <div style={{ width: "100%", height: 310 }}>
            <ResponsiveContainer>
              <BarChart data={monthlyTrend} barGap={20}>
                <CartesianGrid stroke={T.grid} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: T.textSec }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: T.textSec }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#0d2034", border: `1px solid ${T.cardBdr}`, borderRadius: 14, color: T.textPri }} />
                <Bar dataKey="liveListings" fill={T.accent} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={cardStyle({ padding: 18 })}>
          <div style={{ fontSize: 19, fontWeight: 800, color: T.textPri, marginBottom: 8 }}>Executive Narrative</div>
          <div style={{ fontSize: 12, color: T.textSec, lineHeight: 1.8 }}>
            {data.executiveSummary.map((point, idx) => (
              <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <span style={{ color: T.accent, fontWeight: 900 }}>•</span>
                <span>{point}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.cardBdr}` }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.textMut, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Recommended Actions</div>
            {data.recommendations.map((point, idx) => (
              <div key={idx} style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 11, color: T.textSec }}>
                <span style={{ color: T.warn, fontWeight: 900 }}>{idx + 1}.</span>
                <span>{point}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div style={cardStyle({ padding: 14 })}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.textPri, marginBottom: 10 }}>Trends → OTA Status Mix</div>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={data.charts.otaBreakdown}>
                <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
                <XAxis dataKey="ota" tick={{ fontSize: 10, fill: "#64748B" }} />
                <YAxis tick={{ fontSize: 10, fill: "#64748B" }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="live" stackId="a" fill="#16A34A" name="Live" radius={[4, 4, 0, 0]} />
                <Bar dataKey="exception" stackId="a" fill="#F59E0B" name="Exception" />
                <Bar dataKey="inProcess" stackId="a" fill="#3B82F6" name="In Process" />
                <Bar dataKey="tatExhausted" stackId="a" fill="#EF4444" name="TAT Exhausted" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={cardStyle({ padding: 14 })}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: T.textPri }}>Deep Dive → City Performance</div>
            <div style={{ display: "flex", border: `1px solid ${T.cardBdr}`, borderRadius: 999, overflow: "hidden" }}>
              {([
                ["listings", "Listings"],
                ["liveRate", "Live Rate"],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setCityMetric(key)}
                  style={{
                    border: "none",
                    padding: "4px 10px",
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: "pointer",
                    background: cityMetric === key ? T.textPri : "#FFFFFF",
                    color: cityMetric === key ? "#FFFFFF" : T.textSec,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={cityChartData} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#64748B" }} />
                <YAxis type="category" dataKey="city" width={90} tick={{ fontSize: 10, fill: "#64748B" }} />
                <Tooltip />
                <Bar dataKey={cityMetric} fill={cityMetric === "listings" ? T.sky : T.accent} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "0.95fr 1.05fr", gap: 12, marginBottom: 16 }}>
        <div style={cardStyle({ padding: 14 })}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.textPri, marginBottom: 10 }}>Distribution → Top Sub-status Buckets</div>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data.charts.subStatusDistribution} dataKey="total" nameKey="subStatus" outerRadius={110} innerRadius={55} paddingAngle={2}>
                  {data.charts.subStatusDistribution.map((entry, idx) => (
                    <Cell key={entry.subStatus} fill={subStatusColors[idx % subStatusColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={cardStyle({ padding: 14 })}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.textPri, marginBottom: 10 }}>DB Profile & Signal Flags</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
            {[
              {
                label: "Largest OTA",
                value: data.insights.topOta?.ota ?? "—",
                tone: T.sky,
                bg: T.skyBg,
              },
              {
                label: "Biggest Rise",
                value: data.insights.biggestRise ? `${data.insights.biggestRise.month} (${data.insights.biggestRise.delta >= 0 ? "+" : ""}${data.insights.biggestRise.delta})` : "—",
                tone: T.accent,
                bg: T.accentBg,
              },
              {
                label: "Biggest Drop",
                value: data.insights.biggestDrop ? `${data.insights.biggestDrop.month} (${data.insights.biggestDrop.delta})` : "—",
                tone: T.danger,
                bg: T.dangerBg,
              },
              {
                label: "Lowest Live City",
                value: data.insights.lowestCity ? `${data.insights.lowestCity.city} (${data.insights.lowestCity.liveRate}%)` : "—",
                tone: T.warn,
                bg: T.warnBg,
              },
            ].map((item) => (
              <div key={item.label} style={{ border: `1px solid ${T.cardBdr}`, borderRadius: 10, padding: "10px 12px", background: "#FCFDFE" }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: T.textMut, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>{item.label}</div>
                <div style={{ display: "inline-flex", padding: "3px 8px", borderRadius: 6, background: item.bg, color: item.tone, fontSize: 12, fontWeight: 800 }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          <div style={{ border: `1px solid ${T.cardBdr}`, borderRadius: 10, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ background: "#F8FAFC" }}>
                  <th style={{ padding: "8px 10px", textAlign: "left", color: T.textSec, borderBottom: `1px solid ${T.cardBdr}` }}>Table</th>
                  <th style={{ padding: "8px 10px", textAlign: "right", color: T.textSec, borderBottom: `1px solid ${T.cardBdr}` }}>Rows</th>
                </tr>
              </thead>
              <tbody>
                {data.profile.tableCounts.map((row, idx) => (
                  <tr key={row.table} style={{ background: idx % 2 === 0 ? "#FFFFFF" : "#FCFDFE" }}>
                    <td style={{ padding: "8px 10px", borderBottom: `1px solid ${T.cardBdr}`, color: T.textPri }}>{row.table}</td>
                    <td style={{ padding: "8px 10px", borderBottom: `1px solid ${T.cardBdr}`, color: T.textSec, textAlign: "right", fontWeight: 700 }}>{fmtCompact(row.rows)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
