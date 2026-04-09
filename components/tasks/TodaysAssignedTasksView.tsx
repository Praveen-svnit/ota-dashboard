"use client";

import { useEffect, useState } from "react";
import ProductionDashboard2TasksTab from "@/components/tasks/ProductionDashboard2TasksTab";
import type { DashboardTaskInsightSummary, DashboardTaskRecord } from "@/lib/dashboard-task-analytics";

export default function TodaysAssignedTasksView({ initialSourceAnchor = null }: { initialSourceAnchor?: string | null }) {
  const [tasks, setTasks] = useState<DashboardTaskRecord[]>([]);
  const [insights, setInsights] = useState<DashboardTaskInsightSummary | null>(null);
  const [focusSourceAnchor, setFocusSourceAnchor] = useState<string | null>(initialSourceAnchor);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadTasks() {
    const response = await fetch("/api/dashboard-tasks?includeCompleted=1");
    const json = await response.json();
    if (!response.ok || json.error) throw new Error(json.error ?? `HTTP ${response.status}`);
    setTasks(json.tasks ?? []);
    setInsights(json.insights ?? null);
  }

  useEffect(() => {
    loadTasks()
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));

    function handleChanged() {
      loadTasks().catch((err: Error) => setError(err.message));
    }

    window.addEventListener("dashboard-tasks:changed", handleChanged);
    return () => window.removeEventListener("dashboard-tasks:changed", handleChanged);
  }, []);

  useEffect(() => {
    setFocusSourceAnchor(initialSourceAnchor);
  }, [initialSourceAnchor]);

  function openTaskSource(task: DashboardTaskRecord) {
    const href = task.sourceRoute
      ? `${task.sourceRoute}${task.sourceAnchor ? `#${task.sourceAnchor}` : ""}`
      : "/";
    window.location.href = href;
  }

  if (loading) {
    return <div style={{ padding: "28px 24px", color: "#64748B", fontSize: 13 }}>Loading Today&apos;s Assigned Tasks...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: "28px 24px" }}>
        <div style={{ color: "#B91C1C", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: 16 }}>
          Unable to load Today&apos;s Assigned Tasks: {error}
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
          "radial-gradient(circle at top left, rgba(14,165,233,0.12), transparent 30%), radial-gradient(circle at top right, rgba(249,115,22,0.10), transparent 26%), linear-gradient(180deg, #F8FAFC 0%, #EEF2FF 100%)",
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #0F172A 0%, #1D4ED8 52%, #F97316 100%)",
          borderRadius: 28,
          padding: "28px 28px 24px",
          color: "#FFFFFF",
          boxShadow: "0 20px 60px rgba(15, 23, 42, 0.22)",
          marginBottom: 22,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.72)" }}>
          Today&apos;s Assigned Tasks
        </div>
        <h1 style={{ margin: "10px 0 8px", fontSize: 34, lineHeight: 1.05, fontWeight: 900 }}>
          One execution board for every task raised across the dashboard
        </h1>
        <p style={{ margin: 0, maxWidth: 860, fontSize: 13, lineHeight: 1.7, color: "rgba(255,255,255,0.84)" }}>
          This board consolidates assignments from listing pages, property CRM, and the global task launcher. Owners can move work to in progress without a comment, but pending, supervisor attention, and completion still require a comment trail.
        </p>
      </div>

      <ProductionDashboard2TasksTab
        tasks={tasks}
        insights={insights}
        focusSourceAnchor={focusSourceAnchor}
        onFocusSourceChange={setFocusSourceAnchor}
        onRefresh={loadTasks}
        onOpenTaskSource={openTaskSource}
      />
    </div>
  );
}
