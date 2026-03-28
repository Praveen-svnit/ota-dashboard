"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardTaskRecord } from "@/lib/dashboard-task-analytics";
import type { ProductionDashboard2Snapshot } from "@/lib/production-dashboard-analytics";

type DashboardTab = "executive" | "ai";

interface CopilotMessage {
  role: "user" | "assistant";
  content: string;
  mode?: "deterministic" | "anthropic";
  followUps?: string[];
}

const COPILOT_PROMPTS = [
  "Give me the complete production diagnosis for this month.",
  "Which OTA is hurting the portfolio most right now and why?",
  "Where did we lose room nights in the last 7 days, and how do we recover them?",
  "Which cities and OTAs should we focus on first for the fastest RN recovery?",
];

function formatCompact(value: number, currency = false) {
  if (currency) return `₹${value.toLocaleString("en-IN")}`;
  return value.toLocaleString("en-IN");
}

function deltaColor(delta: number) {
  if (delta > 0) return "#16A34A";
  if (delta < 0) return "#DC2626";
  return "#64748B";
}

function severityColors(severity: "critical" | "high" | "medium") {
  if (severity === "critical") {
    return { bg: "#FEF2F2", border: "#FECACA", text: "#B91C1C" };
  }
  if (severity === "high") {
    return { bg: "#FFF7ED", border: "#FED7AA", text: "#C2410C" };
  }
  return { bg: "#EFF6FF", border: "#BFDBFE", text: "#1D4ED8" };
}

function renderRichText(text: string) {
  return text.split("\n").map((line, index) => {
    if (line.startsWith("## ")) {
      return (
        <h4 key={index} style={{ margin: "14px 0 6px", fontSize: 13, fontWeight: 800, color: "#0F172A" }}>
          {line.slice(3)}
        </h4>
      );
    }

    if (line.startsWith("- ")) {
      return (
        <div key={index} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
          <span style={{ color: "#2563EB", fontWeight: 800 }}>•</span>
          <span>{line.slice(2)}</span>
        </div>
      );
    }

    if (/^\d+\.\s/.test(line)) {
      const number = line.match(/^(\d+)\./)?.[1] ?? "";
      return (
        <div key={index} style={{ display: "flex", gap: 8, marginBottom: 4 }}>
          <span style={{ color: "#2563EB", fontWeight: 700, minWidth: 18 }}>{number}.</span>
          <span>{line.replace(/^\d+\.\s/, "")}</span>
        </div>
      );
    }

    if (!line.trim()) return <div key={index} style={{ height: 8 }} />;

    return (
      <p key={index} style={{ margin: "3px 0", lineHeight: 1.7 }}>
        {line}
      </p>
    );
  });
}

function ExecutiveCard({
  label,
  value,
  sublabel,
  delta,
  taskCount = 0,
  onAssignTask,
  onViewTasks,
  tone = "#0F172A",
}: {
  label: string;
  value: string;
  sublabel: string;
  delta?: number;
  taskCount?: number;
  onAssignTask?: () => void;
  onViewTasks?: () => void;
  tone?: string;
}) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderRadius: 18,
        padding: "18px 18px 16px",
        boxShadow: "0 8px 30px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94A3B8" }}>
        {label}
      </div>
      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {taskCount > 0 && (
          <button
            onClick={onViewTasks}
            style={{ padding: "5px 9px", borderRadius: 999, border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#1D4ED8", fontSize: 10, fontWeight: 800, cursor: "pointer" }}
          >
            {taskCount} linked task{taskCount === 1 ? "" : "s"}
          </button>
        )}
        {onAssignTask && (
          <button
            onClick={onAssignTask}
            style={{ padding: "5px 9px", borderRadius: 999, border: "1px solid #E5E7EB", background: "#FFFFFF", color: "#475569", fontSize: 10, fontWeight: 800, cursor: "pointer" }}
          >
            Assign task
          </button>
        )}
      </div>
      <div style={{ marginTop: 10, fontSize: 28, fontWeight: 800, color: tone }}>{value}</div>
      <div style={{ marginTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <span style={{ fontSize: 11, color: "#64748B" }}>{sublabel}</span>
        {delta !== undefined && (
          <span
            style={{
              padding: "5px 9px",
              borderRadius: 999,
              background: `${deltaColor(delta)}12`,
              color: deltaColor(delta),
              fontSize: 11,
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            {delta > 0 ? "+" : ""}
            {delta.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

function TaskAnchorChip({ count, onClick }: { count: number; onClick: () => void }) {
  if (count <= 0) return null;
  return (
    <button
      onClick={onClick}
      style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid #DBEAFE", background: "#EFF6FF", color: "#1D4ED8", fontSize: 10, fontWeight: 800, cursor: "pointer" }}
    >
      {count} task{count === 1 ? "" : "s"}
    </button>
  );
}

function SectionShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: "#FFFFFF",
        border: "1px solid #E5E7EB",
        borderRadius: 20,
        padding: 20,
        boxShadow: "0 10px 34px rgba(15, 23, 42, 0.04)",
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>{title}</div>
        {subtitle && <div style={{ marginTop: 4, fontSize: 12, color: "#64748B" }}>{subtitle}</div>}
      </div>
      {children}
    </section>
  );
}

export default function ProductionDashboard2View() {
  const [activeTab, setActiveTab] = useState<DashboardTab>("executive");
  const [snapshot, setSnapshot] = useState<ProductionDashboard2Snapshot | null>(null);
  const [tasks, setTasks] = useState<DashboardTaskRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState("");
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/ota-analytics")
      .then((response) => response.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setSnapshot(json);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function loadTasks() {
    const response = await fetch("/api/dashboard-tasks?includeCompleted=1");
    const json = await response.json();
    if (!response.ok || json.error) {
      throw new Error(json.error ?? `HTTP ${response.status}`);
    }
    setTasks(json.tasks ?? []);
  }

  useEffect(() => {
    loadTasks().catch((err: Error) => setError(err.message));

    function handleTaskChange() {
      loadTasks().catch((err: Error) => setError(err.message));
    }

    window.addEventListener("dashboard-tasks:changed", handleTaskChange);
    return () => window.removeEventListener("dashboard-tasks:changed", handleTaskChange);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const activeTaskCount = useMemo(() => tasks.filter((task) => task.status !== "done").length, [tasks]);
  const taskCountsByAnchor = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of tasks) {
      if (task.status === "done" || !task.sourceAnchor) continue;
      counts.set(task.sourceAnchor, (counts.get(task.sourceAnchor) ?? 0) + 1);
    }
    return counts;
  }, [tasks]);

  function linkedTaskCount(anchor: string) {
    return taskCountsByAnchor.get(anchor) ?? 0;
  }

  function openTaskBoardFor(anchor: string) {
    window.location.href = `/todays-assigned-tasks?sourceAnchor=${encodeURIComponent(anchor)}`;
  }

  function raiseTask(prefill: {
    title?: string;
    description?: string;
    sourceLabel: string;
    sourceAnchor: string;
    sourceSection?: string;
    relatedOta?: string;
    relatedCity?: string;
    priority?: "low" | "medium" | "high" | "critical";
  }) {
    window.dispatchEvent(
      new CustomEvent("dashboard-tasks:open", {
        detail: {
          sourceRoute: "/ota-analytics",
          taskType: "dashboard",
          ...prefill,
        },
      })
    );
  }

  const topOtas = snapshot?.otaPerformance.slice().sort((a, b) => b.currentRn - a.currentRn).slice(0, 3) ?? [];

  const comparisonChart = snapshot?.otaPerformance.map((row) => ({
    ota: row.ota === "Booking.com" ? "BDC" : row.ota === "EaseMyTrip" ? "EMT" : row.ota === "Akbar Travels" ? "AKT" : row.ota,
    currentRn: row.currentRn,
    previousRn: row.previousRn,
    shareGapPct: row.shareGapPct,
    color: row.color,
  })) ?? [];

  const cityChart = snapshot?.cityPerformance.map((row) => ({
    city: row.city,
    estimatedRn: row.estimatedRn,
    efficiency: row.efficiency,
  })) ?? [];

  async function askCopilot(nextQuestion: string) {
    const trimmed = nextQuestion.trim();
    if (!trimmed || copilotLoading) return;

    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setQuestion("");
    setCopilotLoading(true);

    try {
      const response = await fetch("/api/ota-analytics-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          history: messages.map((message) => ({ role: message.role, content: message.content })),
        }),
      });
      const json = await response.json();
      if (!response.ok || json.error) throw new Error(json.error ?? `HTTP ${response.status}`);

      if (json.snapshot) setSnapshot(json.snapshot);
      setMessages((prev) => [...prev, { role: "assistant", content: json.answer, mode: json.mode, followUps: json.followUps ?? [] }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `## What Went Wrong\n- The copilot request failed.\n\n## Why It Went Wrong\n- ${err instanceof Error ? err.message : "Unknown error"}\n\n## How It Went Wrong\n- The AI service or dashboard route did not return a valid response.\n\n## How To Fix\n1. Refresh the page and try again.\n2. If you want LLM-powered answers, make sure \`ANTHROPIC_API_KEY\` is configured.\n3. The deterministic copilot will still work once the route is reachable.`,
          mode: "deterministic",
        },
      ]);
    } finally {
      setCopilotLoading(false);
    }
  }

  if (loading) {
    return <div style={{ padding: "28px 24px", color: "#64748B", fontSize: 13 }}>Loading OTA Analytics...</div>;
  }

  if (error || !snapshot) {
    return (
      <div style={{ padding: "28px 24px" }}>
        <div style={{ color: "#B91C1C", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: 16 }}>
          Unable to load OTA Analytics: {error ?? "Unknown error"}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "24px",
        background:
          "radial-gradient(circle at top left, rgba(14,165,233,0.12), transparent 30%), radial-gradient(circle at top right, rgba(16,185,129,0.12), transparent 26%), linear-gradient(180deg, #F8FAFC 0%, #EEF2FF 100%)",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #0F172A 0%, #1D4ED8 52%, #0891B2 100%)",
          borderRadius: 28,
          padding: "28px 28px 24px",
          color: "#FFFFFF",
          boxShadow: "0 20px 60px rgba(15, 23, 42, 0.22)",
          marginBottom: 22,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div style={{ maxWidth: 780 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.72)" }}>
              OTA Analytics
            </div>
            <h1 style={{ margin: "10px 0 8px", fontSize: 34, lineHeight: 1.05, fontWeight: 900 }}>
              Executive analytics, risk intelligence, and AI diagnosis in one view
            </h1>
            <p style={{ margin: 0, maxWidth: 760, fontSize: 13, lineHeight: 1.7, color: "rgba(255,255,255,0.84)" }}>
              This layer sits on top of your existing Production Dashboard and turns the raw OTA data into a management console:
              live coverage, momentum, yield quality, city contribution, risk ranking, and an ask-anything copilot that answers from real calculations.
            </p>
          </div>

          <div
            style={{
              minWidth: 260,
              background: "rgba(255,255,255,0.10)",
              border: "1px solid rgba(255,255,255,0.16)",
              borderRadius: 20,
              padding: 16,
              backdropFilter: "blur(14px)",
            }}
          >
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.70)" }}>
              Snapshot status
            </div>
            <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900 }}>{snapshot.portfolio.mtdRn.toLocaleString("en-IN")} RN</div>
            <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.82)" }}>
              Generated {new Date(snapshot.generatedAt).toLocaleString("en-IN")}
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={{ padding: "6px 10px", borderRadius: 999, background: "rgba(255,255,255,0.12)", fontSize: 11, fontWeight: 700 }}>
                {snapshot.portfolio.riskCount} OTAs need attention
              </span>
              <span style={{ padding: "6px 10px", borderRadius: 999, background: "rgba(255,255,255,0.12)", fontSize: 11, fontWeight: 700 }}>
                {snapshot.portfolio.currentRunRate.toFixed(1)} RN/day run rate
              </span>
              <button
                onClick={() => (window.location.href = "/todays-assigned-tasks")}
                style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.24)", background: "rgba(255,255,255,0.10)", color: "#FFFFFF", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
              >
                Today&apos;s Assigned Tasks ({activeTaskCount})
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 22, flexWrap: "wrap" }}>
          {[
            { key: "executive", label: "Executive Command Center" },
            { key: "ai", label: "AI Copilot" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as DashboardTab)}
              style={{
                padding: "10px 14px",
                borderRadius: 999,
                border: activeTab === tab.key ? "1px solid rgba(255,255,255,0.70)" : "1px solid rgba(255,255,255,0.18)",
                background: activeTab === tab.key ? "#FFFFFF" : "rgba(255,255,255,0.08)",
                color: activeTab === tab.key ? "#0F172A" : "#FFFFFF",
                fontSize: 12,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "executive" && (
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
            <div id="pd2-kpi-mtd-sold-rn">
              <ExecutiveCard
                label="MTD Sold Room Nights"
                value={formatCompact(snapshot.portfolio.mtdRn)}
                sublabel={`${snapshot.portfolio.monthLabel} sold RN vs ${snapshot.portfolio.compareLabel} same-day`}
                delta={snapshot.portfolio.rnDeltaPct}
                taskCount={linkedTaskCount("pd2-kpi-mtd-sold-rn")}
                onViewTasks={() => openTaskBoardFor("pd2-kpi-mtd-sold-rn")}
                onAssignTask={() =>
                  raiseTask({
                    sourceLabel: "MTD Sold Room Nights",
                    sourceAnchor: "pd2-kpi-mtd-sold-rn",
                    sourceSection: "Executive KPI",
                    title: "Review sold RN movement and assign recovery owner",
                    priority: snapshot.portfolio.rnDeltaPct < 0 ? "high" : "medium",
                  })
                }
              />
            </div>
            <div id="pd2-kpi-mtd-stay-revenue">
              <ExecutiveCard
                label="MTD Stay Revenue"
                value={formatCompact(snapshot.portfolio.mtdRevenue, true)}
                sublabel={`${snapshot.portfolio.mtdStayRn.toLocaleString("en-IN")} stay RN in CICO`}
                delta={snapshot.portfolio.revenueDeltaPct}
                taskCount={linkedTaskCount("pd2-kpi-mtd-stay-revenue")}
                onViewTasks={() => openTaskBoardFor("pd2-kpi-mtd-stay-revenue")}
                onAssignTask={() =>
                  raiseTask({
                    sourceLabel: "MTD Stay Revenue",
                    sourceAnchor: "pd2-kpi-mtd-stay-revenue",
                    sourceSection: "Executive KPI",
                    title: "Investigate stay revenue trend and assign owner",
                    priority: snapshot.portfolio.revenueDeltaPct < 0 ? "high" : "medium",
                  })
                }
              />
            </div>
            <div id="pd2-kpi-revenue-per-rn">
              <ExecutiveCard
                label="Revenue / Stay RN"
                value={formatCompact(snapshot.portfolio.revenuePerRn, true)}
                sublabel={`Previous ${formatCompact(snapshot.portfolio.prevRevenuePerRn, true)} | stay-based denominator`}
                delta={
                  snapshot.portfolio.prevRevenuePerRn
                    ? ((snapshot.portfolio.revenuePerRn - snapshot.portfolio.prevRevenuePerRn) / snapshot.portfolio.prevRevenuePerRn) * 100
                    : 0
                }
                taskCount={linkedTaskCount("pd2-kpi-revenue-per-rn")}
                onViewTasks={() => openTaskBoardFor("pd2-kpi-revenue-per-rn")}
                onAssignTask={() =>
                  raiseTask({
                    sourceLabel: "Revenue / Stay RN",
                    sourceAnchor: "pd2-kpi-revenue-per-rn",
                    sourceSection: "Executive KPI",
                    title: "Improve revenue per stay RN",
                    priority: "high",
                  })
                }
              />
            </div>
            <div id="pd2-kpi-projected-month-end-rn">
              <ExecutiveCard
                label="Projected Month-End Sold RN"
                value={formatCompact(snapshot.portfolio.projectedMonthEndRn)}
                sublabel={`${snapshot.portfolio.currentRunRate.toFixed(1)} sold RN/day current run rate`}
                taskCount={linkedTaskCount("pd2-kpi-projected-month-end-rn")}
                onViewTasks={() => openTaskBoardFor("pd2-kpi-projected-month-end-rn")}
                onAssignTask={() =>
                  raiseTask({
                    sourceLabel: "Projected Month-End Sold RN",
                    sourceAnchor: "pd2-kpi-projected-month-end-rn",
                    sourceSection: "Executive KPI",
                    title: "Protect month-end sold RN projection",
                    priority: "high",
                  })
                }
              />
            </div>
            <div id="pd2-kpi-ota-coverage">
              <ExecutiveCard
                label="OTA Listing Coverage"
                value={`${snapshot.portfolio.liveCoveragePct.toFixed(1)}%`}
                sublabel="Live OTA listings / total tracked OTA listings"
                tone="#0369A1"
                taskCount={linkedTaskCount("pd2-kpi-ota-coverage")}
                onViewTasks={() => openTaskBoardFor("pd2-kpi-ota-coverage")}
                onAssignTask={() =>
                  raiseTask({
                    sourceLabel: "OTA Listing Coverage",
                    sourceAnchor: "pd2-kpi-ota-coverage",
                    sourceSection: "Executive KPI",
                    title: "Lift OTA listing coverage",
                    priority: "high",
                  })
                }
              />
            </div>
            <div id="pd2-kpi-7d-momentum">
              <ExecutiveCard
                label="7-Day Sold RN Momentum"
                value={`${snapshot.portfolio.momentum7dPct > 0 ? "+" : ""}${snapshot.portfolio.momentum7dPct.toFixed(1)}%`}
                sublabel={`${snapshot.portfolio.riskCount} OTAs flagged in the reasoning engine`}
                tone={deltaColor(snapshot.portfolio.momentum7dPct)}
                taskCount={linkedTaskCount("pd2-kpi-7d-momentum")}
                onViewTasks={() => openTaskBoardFor("pd2-kpi-7d-momentum")}
                onAssignTask={() =>
                  raiseTask({
                    sourceLabel: "7-Day Sold RN Momentum",
                    sourceAnchor: "pd2-kpi-7d-momentum",
                    sourceSection: "Executive KPI",
                    title: "Recover last 7-day momentum",
                    priority: snapshot.portfolio.momentum7dPct < 0 ? "critical" : "medium",
                  })
                }
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
            <div style={{ display: "grid", gap: 18 }}>
              <SectionShell
                title="Daily Production Pulse"
                subtitle="Portfolio total with the top 3 OTAs over the last 30 days"
              >
                <div style={{ height: 340 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={snapshot.dailyTrend} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#1D4ED8" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#1D4ED8" stopOpacity={0.04} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#E5E7EB" strokeDasharray="4 4" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748B" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#64748B" }} />
                      <Tooltip />
                      <Legend />
                      <Area type="monotone" dataKey="total" stroke="#1D4ED8" fill="url(#totalGradient)" strokeWidth={3} name="Portfolio RN" />
                      {topOtas.map((row) => (
                        <Line
                          key={row.ota}
                          type="monotone"
                          dataKey={(point: { values: Record<string, number> }) => point.values[row.ota] ?? 0}
                          stroke={row.color}
                          strokeWidth={2}
                          dot={false}
                          name={row.ota}
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </SectionShell>

              <SectionShell
                title="MTD Pace vs Same Time Last Month / Last Year"
                subtitle="Cumulative sold RN comparison for this month vs the same day cut last month and last year"
              >
                <div style={{ height: 320 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={snapshot.comparisonTrend} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
                      <CartesianGrid stroke="#E5E7EB" strokeDasharray="4 4" />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748B" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#64748B" }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="currentCumulative" stroke="#1D4ED8" strokeWidth={3} dot={false} name="Current MTD" />
                      <Line type="monotone" dataKey="lastMonthCumulative" stroke="#F97316" strokeWidth={2.5} dot={false} name="Same Time Last Month" />
                      <Line type="monotone" dataKey="lastYearCumulative" stroke="#7C3AED" strokeWidth={2.5} dot={false} name="Same Time Last Year" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </SectionShell>
            </div>

            <SectionShell
              title="Priority Alerts"
              subtitle="Automatic diagnosis of the strongest failure points"
            >
              <div style={{ display: "grid", gap: 10 }}>
                {snapshot.alerts.slice(0, 4).map((alert) => {
                  const palette = severityColors(alert.severity);
                  const anchor = `pd2-alert-${alert.id}`;
                  return (
                    <div
                      key={alert.id}
                      id={anchor}
                      style={{
                        borderRadius: 16,
                        padding: 14,
                        border: `1px solid ${palette.border}`,
                        background: palette.bg,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{alert.title}</div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          <TaskAnchorChip count={linkedTaskCount(anchor)} onClick={() => openTaskBoardFor(anchor)} />
                          <button
                            onClick={() =>
                              raiseTask({
                                sourceLabel: alert.title,
                                sourceAnchor: anchor,
                                sourceSection: "Priority Alerts",
                                title: alert.title,
                                description: `${alert.what} ${alert.fix}`,
                                relatedOta: alert.id.startsWith("ota-") ? alert.id.replace("ota-", "") : undefined,
                                priority: alert.severity === "critical" ? "critical" : "high",
                              })
                            }
                            style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid #E5E7EB", background: "#FFFFFF", color: "#475569", fontSize: 10, fontWeight: 800, cursor: "pointer" }}
                          >
                            Assign task
                          </button>
                          <span style={{ fontSize: 10, fontWeight: 800, color: palette.text, textTransform: "uppercase" }}>
                            {alert.severity}
                          </span>
                        </div>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 11, color: "#475569" }}>{alert.metric}</div>
                      <div style={{ marginTop: 10, fontSize: 12, color: "#0F172A", lineHeight: 1.6 }}>
                        <strong>What:</strong> {alert.what}
                      </div>
                      <div style={{ marginTop: 6, fontSize: 12, color: "#0F172A", lineHeight: 1.6 }}>
                        <strong>Why:</strong> {alert.why}
                      </div>
                      <div style={{ marginTop: 6, fontSize: 12, color: "#0F172A", lineHeight: 1.6 }}>
                        <strong>Fix:</strong> {alert.fix}
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionShell>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
            <SectionShell
              title="OTA Performance Delta"
              subtitle="Current month MTD vs last month MTD on the same day cut"
            >
              <div style={{ height: 340 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonChart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid stroke="#E5E7EB" strokeDasharray="4 4" />
                    <XAxis dataKey="ota" tick={{ fontSize: 11, fill: "#64748B" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748B" }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="currentRn" radius={[8, 8, 0, 0]} fill="#1D4ED8" name="Current MTD RN" />
                    <Bar dataKey="previousRn" radius={[8, 8, 0, 0]} fill="#94A3B8" name="Previous MTD RN" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionShell>

            <SectionShell
              title="City Opportunity Map"
              subtitle="Estimated 30-day room nights allocated by live footprint"
            >
              <div style={{ height: 340 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={cityChart} layout="vertical" margin={{ top: 10, right: 14, left: 20, bottom: 0 }}>
                    <CartesianGrid stroke="#E5E7EB" strokeDasharray="4 4" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#64748B" }} />
                    <YAxis type="category" dataKey="city" width={88} tick={{ fontSize: 11, fill: "#64748B" }} />
                    <Tooltip />
                    <Bar dataKey="estimatedRn" radius={[0, 10, 10, 0]} name="Estimated RN">
                      {cityChart.map((row, index) => (
                        <Cell key={`${row.city}-${index}`} fill={index % 2 === 0 ? "#0EA5E9" : "#14B8A6"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionShell>
          </div>

          <SectionShell
            title="OTA Diagnostics Matrix"
            subtitle={`Best coverage: ${snapshot.benchmarkSummary.bestCoverageOta} | Biggest risk: ${snapshot.benchmarkSummary.biggestRiskOta}`}
          >
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
                <thead>
                  <tr style={{ background: "#F8FAFC" }}>
                    {["OTA", "Coverage", "MTD RN", "Δ RN", "Rev/RN", "RN Share Gap", "Primary Issue", "Recommended Fix"].map((heading) => (
                      <th
                        key={heading}
                        style={{
                          textAlign: "left",
                          padding: "12px 14px",
                          fontSize: 11,
                          fontWeight: 800,
                          color: "#64748B",
                          textTransform: "uppercase",
                          borderBottom: "1px solid #E5E7EB",
                        }}
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {snapshot.otaPerformance.map((row, index) => (
                    <tr key={row.ota} id={`pd2-ota-${row.ota}`} style={{ background: index % 2 === 0 ? "#FFFFFF" : "#FAFAFA" }}>
                      <td style={{ padding: "13px 14px", borderBottom: "1px solid #E5E7EB", fontWeight: 700, color: "#0F172A" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ width: 10, height: 10, borderRadius: 999, background: row.color, display: "inline-block" }} />
                          {row.ota}
                          <TaskAnchorChip count={linkedTaskCount(`pd2-ota-${row.ota}`)} onClick={() => openTaskBoardFor(`pd2-ota-${row.ota}`)} />
                          <button
                            onClick={() =>
                              raiseTask({
                                sourceLabel: `${row.ota} diagnostics`,
                                sourceAnchor: `pd2-ota-${row.ota}`,
                                sourceSection: "OTA Diagnostics Matrix",
                                title: `${row.ota} priority task`,
                                description: `${row.primaryIssue}. ${row.fix}`,
                                relatedOta: row.ota,
                                priority: row.health === "critical" ? "critical" : "high",
                              })
                            }
                            style={{ padding: "5px 8px", borderRadius: 999, border: "1px solid #E5E7EB", background: "#FFFFFF", color: "#475569", fontSize: 10, fontWeight: 800, cursor: "pointer" }}
                          >
                            Assign
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: "13px 14px", borderBottom: "1px solid #E5E7EB", color: "#334155" }}>
                        {row.coveragePct.toFixed(1)}% ({row.live}/{row.total})
                      </td>
                      <td style={{ padding: "13px 14px", borderBottom: "1px solid #E5E7EB", color: "#334155" }}>{row.currentRn.toLocaleString("en-IN")}</td>
                      <td style={{ padding: "13px 14px", borderBottom: "1px solid #E5E7EB", color: deltaColor(row.rnDeltaPct), fontWeight: 700 }}>
                        {row.rnDeltaPct > 0 ? "+" : ""}
                        {row.rnDeltaPct.toFixed(1)}%
                      </td>
                      <td style={{ padding: "13px 14px", borderBottom: "1px solid #E5E7EB", color: "#334155" }}>
                        ₹{row.revenuePerRn.toLocaleString("en-IN")}
                      </td>
                      <td style={{ padding: "13px 14px", borderBottom: "1px solid #E5E7EB", color: deltaColor(row.shareGapPct), fontWeight: 700 }}>
                        {row.shareGapPct > 0 ? "+" : ""}
                        {row.shareGapPct.toFixed(1)} pts
                      </td>
                      <td style={{ padding: "13px 14px", borderBottom: "1px solid #E5E7EB", color: "#334155" }}>{row.primaryIssue}</td>
                      <td style={{ padding: "13px 14px", borderBottom: "1px solid #E5E7EB", color: "#334155", lineHeight: 1.6 }}>{row.fix}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionShell>
        </div>
      )}

      {activeTab === "ai" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18, alignItems: "start" }}>
          <div style={{ display: "grid", gap: 18, position: "sticky", top: 18 }}>
            <SectionShell title="Copilot Context" subtitle="Live snapshot that powers every answer">
              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ padding: 14, borderRadius: 16, background: "#F8FAFC", border: "1px solid #E5E7EB" }}>
                  <div style={{ fontSize: 11, color: "#64748B", textTransform: "uppercase", fontWeight: 800 }}>Portfolio read</div>
                  <div style={{ marginTop: 8, fontSize: 22, fontWeight: 900, color: "#0F172A" }}>{snapshot.portfolio.mtdRn.toLocaleString("en-IN")} RN</div>
                  <div style={{ marginTop: 6, fontSize: 12, color: "#475569" }}>
                    {snapshot.portfolio.rnDeltaPct > 0 ? "+" : ""}
                    {snapshot.portfolio.rnDeltaPct.toFixed(1)}% vs last month MTD, revenue/RN ₹{snapshot.portfolio.revenuePerRn.toLocaleString("en-IN")}
                  </div>
                </div>

                <div style={{ padding: 14, borderRadius: 16, background: "#FFF7ED", border: "1px solid #FED7AA" }}>
                  <div style={{ fontSize: 11, color: "#9A3412", textTransform: "uppercase", fontWeight: 800 }}>Top risk</div>
                  <div style={{ marginTop: 8, fontSize: 15, fontWeight: 800, color: "#7C2D12" }}>
                    {snapshot.alerts[0]?.title ?? "No major risk detected"}
                  </div>
                  {snapshot.alerts[0] && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#7C2D12", lineHeight: 1.6 }}>
                      {snapshot.alerts[0].why}
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#0F172A", marginBottom: 10 }}>Suggested prompts</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {COPILOT_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => askCopilot(prompt)}
                        style={{
                          textAlign: "left",
                          padding: "12px 14px",
                          borderRadius: 14,
                          border: "1px solid #E5E7EB",
                          background: "#FFFFFF",
                          color: "#334155",
                          fontSize: 12,
                          lineHeight: 1.6,
                          cursor: "pointer",
                        }}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </SectionShell>
          </div>

          <SectionShell title="Ask Anything" subtitle="Answers are grounded in the latest dashboard snapshot and always explain what, why, how, and fix">
            <div style={{ display: "flex", flexDirection: "column", minHeight: "70vh" }}>
              <div style={{ flex: 1, background: "#F8FAFC", borderRadius: 18, border: "1px solid #E5E7EB", padding: 18, overflowY: "auto" }}>
                {messages.length === 0 ? (
                  <div style={{ maxWidth: 720, margin: "20px auto", textAlign: "center" }}>
                    <div
                      style={{
                        width: 72,
                        height: 72,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #0F172A, #1D4ED8)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#FFFFFF",
                        fontSize: 28,
                        margin: "0 auto 16px",
                        boxShadow: "0 12px 30px rgba(29,78,216,0.22)",
                      }}
                    >
                      AI
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: "#0F172A" }}>Ask anything about the production data</div>
                    <div style={{ marginTop: 8, fontSize: 13, color: "#64748B", lineHeight: 1.7 }}>
                      The copilot reads the same live analytics snapshot as the dashboard and turns it into actionable diagnosis.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 14 }}>
                    {messages.map((message, index) => (
                      <div
                        key={`${message.role}-${index}`}
                        style={{
                          display: "flex",
                          justifyContent: message.role === "user" ? "flex-end" : "flex-start",
                        }}
                      >
                        <div
                          style={{
                            maxWidth: "86%",
                            padding: "14px 16px",
                            borderRadius: message.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                            background: message.role === "user" ? "#1D4ED8" : "#FFFFFF",
                            border: message.role === "user" ? "none" : "1px solid #E5E7EB",
                            color: message.role === "user" ? "#FFFFFF" : "#0F172A",
                            boxShadow: "0 8px 24px rgba(15,23,42,0.04)",
                          }}
                        >
                          {message.role === "assistant" && message.mode && (
                            <div style={{ marginBottom: 10, fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748B" }}>
                              {message.mode === "anthropic" ? "LLM Assisted" : "Deterministic Analysis"}
                            </div>
                          )}
                          <div style={{ fontSize: 12, lineHeight: 1.7 }}>
                            {message.role === "assistant" ? renderRichText(message.content) : message.content}
                          </div>
                          {message.role === "assistant" && message.followUps && message.followUps.length > 0 && (
                            <div style={{ marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {message.followUps.map((followUp) => (
                                <button
                                  key={followUp}
                                  onClick={() => askCopilot(followUp)}
                                  style={{
                                    padding: "7px 10px",
                                    borderRadius: 999,
                                    border: "1px solid #DBEAFE",
                                    background: "#EFF6FF",
                                    color: "#1D4ED8",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                  }}
                                >
                                  {followUp}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {copilotLoading && (
                      <div style={{ display: "flex", justifyContent: "flex-start" }}>
                        <div style={{ maxWidth: "80%", padding: "14px 16px", borderRadius: "16px 16px 16px 4px", background: "#FFFFFF", border: "1px solid #E5E7EB" }}>
                          <div style={{ fontSize: 12, color: "#64748B" }}>Thinking through the live data...</div>
                        </div>
                      </div>
                    )}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "flex-end" }}>
                <textarea
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      askCopilot(question);
                    }
                  }}
                  placeholder="Ask about OTA drops, city opportunity, pricing yield, run-rate recovery, anything..."
                  rows={3}
                  style={{
                    flex: 1,
                    borderRadius: 16,
                    border: "1px solid #CBD5E1",
                    padding: "14px 16px",
                    fontSize: 13,
                    lineHeight: 1.6,
                    fontFamily: "inherit",
                    resize: "vertical",
                    minHeight: 74,
                  }}
                />
                <button
                  onClick={() => askCopilot(question)}
                  disabled={copilotLoading || !question.trim()}
                  style={{
                    padding: "14px 18px",
                    borderRadius: 16,
                    border: "none",
                    background: copilotLoading || !question.trim() ? "#CBD5E1" : "linear-gradient(135deg, #0F172A, #1D4ED8)",
                    color: "#FFFFFF",
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: copilotLoading || !question.trim() ? "not-allowed" : "pointer",
                    minWidth: 126,
                  }}
                >
                  {copilotLoading ? "Analysing..." : "Ask Copilot"}
                </button>
              </div>
            </div>
          </SectionShell>
        </div>
      )}

    </div>
  );
}
