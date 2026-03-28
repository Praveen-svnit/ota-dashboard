"use client";

import { useEffect, useMemo, useState } from "react";
import { OTAS } from "@/lib/constants";
import type { DashboardTaskInsightSummary, DashboardTaskRecord } from "@/lib/dashboard-task-analytics";

interface Props {
  tasks: DashboardTaskRecord[];
  insights: DashboardTaskInsightSummary | null;
  focusSourceAnchor: string | null;
  onFocusSourceChange: (value: string | null) => void;
  onRefresh: () => Promise<void> | void;
  onOpenTaskSource: (task: DashboardTaskRecord) => void;
}

interface TaskCopilotMessage {
  role: "user" | "assistant";
  content: string;
  mode?: "deterministic" | "anthropic";
  followUps?: string[];
}

function metricCard(label: string, value: string, sublabel: string, tone = "#0F172A") {
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
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#94A3B8" }}>{label}</div>
      <div style={{ marginTop: 10, fontSize: 26, fontWeight: 900, color: tone }}>{value}</div>
      <div style={{ marginTop: 10, fontSize: 11, color: "#64748B", lineHeight: 1.6 }}>{sublabel}</div>
    </div>
  );
}

function statusPill(status: string) {
  const palette =
    status === "done" ? { bg: "#DCFCE7", text: "#15803D" } :
    status === "supervisor_attention" ? { bg: "#FEF2F2", text: "#B91C1C" } :
    status === "pending" ? { bg: "#FFF7ED", text: "#C2410C" } :
    status === "in_progress" ? { bg: "#EFF6FF", text: "#1D4ED8" } :
    { bg: "#F8FAFC", text: "#475569" };

  return (
    <span style={{ padding: "5px 9px", borderRadius: 999, background: palette.bg, color: palette.text, fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>
      {status.replace("_", " ")}
    </span>
  );
}

function priorityPill(priority: string) {
  const palette =
    priority === "critical" ? { bg: "#DC2626", text: "#FFFFFF" } :
    priority === "high" ? { bg: "#F97316", text: "#FFFFFF" } :
    priority === "medium" ? { bg: "#DBEAFE", text: "#1D4ED8" } :
    { bg: "#E5E7EB", text: "#475569" };

  return (
    <span style={{ padding: "5px 9px", borderRadius: 999, background: palette.bg, color: palette.text, fontSize: 10, fontWeight: 800, textTransform: "uppercase" }}>
      {priority}
    </span>
  );
}

function renderTaskAnswer(text: string) {
  return text.split("\n").map((line, index) => {
    if (line.startsWith("## ")) {
      return (
        <h4 key={index} style={{ margin: "12px 0 6px", fontSize: 13, fontWeight: 800, color: "#0F172A" }}>
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
    if (!line.trim()) return <div key={index} style={{ height: 8 }} />;
    return <p key={index} style={{ margin: "3px 0", lineHeight: 1.7 }}>{line}</p>;
  });
}

function taskTat(task: DashboardTaskRecord) {
  const start = new Date(task.createdAt);
  const diffMs = Date.now() - start.getTime();
  const hours = Math.max(Math.floor(diffMs / (1000 * 60 * 60)), 0);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  return `${hours}h`;
}

export default function ProductionDashboard2TasksTab({
  tasks,
  insights,
  focusSourceAnchor,
  onFocusSourceChange,
  onRefresh,
  onOpenTaskSource,
}: Props) {
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "in_progress" | "pending" | "supervisor_attention" | "done">("all");
  const [otaFilter, setOtaFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [bucketFilter, setBucketFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [savingTaskId, setSavingTaskId] = useState<number | null>(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<TaskCopilotMessage[]>([]);

  useEffect(() => {
    if (focusSourceAnchor) {
      setStatusFilter("all");
    }
  }, [focusSourceAnchor]);

  useEffect(() => {
    function handleChanged() {
      onRefresh();
    }
    window.addEventListener("dashboard-tasks:changed", handleChanged);
    return () => window.removeEventListener("dashboard-tasks:changed", handleChanged);
  }, [onRefresh]);

  const assignees = useMemo(
    () => [...new Set(tasks.map((task) => task.assignedName).filter((value): value is string => Boolean(value)))].sort(),
    [tasks]
  );
  const buckets = useMemo(
    () => [...new Set(tasks.map((task) => task.bucket).filter((value): value is NonNullable<DashboardTaskRecord["bucket"]> => Boolean(value)))].sort(),
    [tasks]
  );
  const otas = OTAS;

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      if (otaFilter !== "all" && (task.relatedOta ?? "General") !== otaFilter) return false;
      if (assigneeFilter !== "all" && (task.assignedName ?? "Unassigned") !== assigneeFilter) return false;
      if (bucketFilter !== "all" && task.bucket !== bucketFilter) return false;
      if (focusSourceAnchor && task.sourceAnchor !== focusSourceAnchor) return false;
      const haystack = `${task.title} ${task.description ?? ""} ${task.assignedName ?? ""} ${task.relatedOta ?? ""} ${task.sourceLabel ?? ""}`.toLowerCase();
      if (search.trim() && !haystack.includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [tasks, statusFilter, otaFilter, assigneeFilter, bucketFilter, focusSourceAnchor, search]);

  async function updateTask(task: DashboardTaskRecord, nextStatus: DashboardTaskRecord["status"]) {
    const comment = commentDrafts[task.id]?.trim() ?? "";
    if ((nextStatus === "done" || nextStatus === "pending" || nextStatus === "supervisor_attention") && !comment) {
      alert("A comment is required for complete, pending, or supervisor-attention updates.");
      return;
    }

    setSavingTaskId(task.id);
    try {
      const response = await fetch(`/api/dashboard-tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: nextStatus,
          comment,
        }),
      });
      const json = await response.json();
      if (!response.ok || json.error) throw new Error(json.error ?? `HTTP ${response.status}`);
      setCommentDrafts((current) => ({ ...current, [task.id]: "" }));
      await onRefresh();
      window.dispatchEvent(new CustomEvent("dashboard-tasks:changed"));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to update task.");
    } finally {
      setSavingTaskId(null);
    }
  }

  async function askTaskCopilot(nextQuestion: string) {
    const trimmed = nextQuestion.trim();
    if (!trimmed || copilotLoading) return;

    setMessages((current) => [...current, { role: "user", content: trimmed }]);
    setQuestion("");
    setCopilotLoading(true);

    try {
      const response = await fetch("/api/dashboard-tasks-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          history: messages.map((message) => ({ role: message.role, content: message.content })),
        }),
      });
      const json = await response.json();
      if (!response.ok || json.error) throw new Error(json.error ?? `HTTP ${response.status}`);
      setMessages((current) => [...current, { role: "assistant", content: json.answer, mode: json.mode, followUps: json.followUps ?? [] }]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `## Direct Answer\nThe task analyst could not answer right now.\n\n## What Went Wrong\n- The task AI request failed.\n\n## Why It Went Wrong\n- ${error instanceof Error ? error.message : "Unknown error"}\n\n## How It Went Wrong\n- The task insight route did not return a valid response.\n\n## How To Fix\n1. Refresh the page.\n2. Try the question again.\n3. If you want model-assisted answers, configure ANTHROPIC_API_KEY.`,
          mode: "deterministic",
        },
      ]);
    } finally {
      setCopilotLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 18 }}>
      {insights && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
          {metricCard("Active Tasks", insights.totalActive.toLocaleString("en-IN"), `${insights.highPriority} high-priority, ${insights.blocked} pending, and ${insights.supervisorAttention} needing supervisor attention.`)}
          {metricCard("Created Today", insights.createdToday.toLocaleString("en-IN"), `${insights.dueToday} tasks are due today and need same-day follow-through.`)}
          {metricCard("Overdue", insights.overdue.toLocaleString("en-IN"), `${insights.followUpsPending} tasks also need follow-up today.`, insights.overdue > 0 ? "#B91C1C" : "#0F172A")}
          {metricCard("Hot Bucket", insights.bucketCounts[0]?.bucket ?? "None", insights.bucketCounts[0] ? `${insights.bucketCounts[0].count} active tasks in the biggest bucket.` : "No active tasks to bucket right now.", "#0369A1")}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.4fr) minmax(320px, 0.9fr)", gap: 18, alignItems: "start" }}>
        <section style={{ background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: 20, padding: 20, boxShadow: "0 10px 34px rgba(15, 23, 42, 0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>Today&apos;s Assigned Tasks</div>
              <div style={{ marginTop: 4, fontSize: 12, color: "#64748B" }}>
                Consolidated work raised across dashboards and CRM, with source-page links and comment-backed completion.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {focusSourceAnchor && (
                <button
                  onClick={() => onFocusSourceChange(null)}
                  style={{ padding: "9px 12px", borderRadius: 999, border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#475569", fontSize: 11, fontWeight: 800, cursor: "pointer" }}
                >
                  Clear source filter
                </button>
              )}
              <button
                onClick={() => window.dispatchEvent(new CustomEvent("dashboard-tasks:open", { detail: { sourceRoute: "/todays-assigned-tasks", sourceLabel: "Today's Assigned Tasks" } }))}
                style={{ padding: "9px 12px", borderRadius: 999, border: "none", background: "#1D4ED8", color: "#FFFFFF", fontSize: 11, fontWeight: 800, cursor: "pointer" }}
              >
                Raise new task
              </button>
            </div>
          </div>

          {insights && (
            <div style={{ marginTop: 16, padding: 14, borderRadius: 16, background: "#F8FAFC", border: "1px solid #E5E7EB" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>AI workload read</div>
              <div style={{ marginTop: 6, fontSize: 12, color: "#475569", lineHeight: 1.7 }}>{insights.narrative}</div>
              <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
                {insights.recommendations.map((item) => (
                  <div key={item} style={{ fontSize: 12, color: "#334155" }}>• {item}</div>
                ))}
              </div>
            </div>
          )}

              <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) repeat(4, minmax(0, 0.75fr))", gap: 10 }}>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title, owner, OTA, or source"
              style={{ padding: "11px 12px", borderRadius: 14, border: "1px solid #CBD5E1", fontSize: 12, outline: "none" }}
            />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} style={{ padding: "11px 12px", borderRadius: 14, border: "1px solid #CBD5E1", fontSize: 12, background: "#FFFFFF" }}>
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="pending">Pending</option>
              <option value="supervisor_attention">Supervisor attention</option>
              <option value="done">Done</option>
            </select>
            <select value={otaFilter} onChange={(event) => setOtaFilter(event.target.value)} style={{ padding: "11px 12px", borderRadius: 14, border: "1px solid #CBD5E1", fontSize: 12, background: "#FFFFFF" }}>
              <option value="all">All OTAs</option>
              {otas.map((ota) => (
                <option key={ota} value={ota}>{ota}</option>
              ))}
            </select>
            <select value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)} style={{ padding: "11px 12px", borderRadius: 14, border: "1px solid #CBD5E1", fontSize: 12, background: "#FFFFFF" }}>
              <option value="all">All owners</option>
              {assignees.map((assignee) => (
                <option key={assignee} value={assignee}>{assignee}</option>
              ))}
            </select>
            <select value={bucketFilter} onChange={(event) => setBucketFilter(event.target.value)} style={{ padding: "11px 12px", borderRadius: 14, border: "1px solid #CBD5E1", fontSize: 12, background: "#FFFFFF" }}>
              <option value="all">All buckets</option>
              {buckets.map((bucket) => (
                <option key={bucket} value={bucket}>{bucket}</option>
              ))}
            </select>
          </div>

          {insights && insights.otaHotspots.length > 0 && (
            <div style={{ marginTop: 16, padding: 14, borderRadius: 16, background: "#FFF7ED", border: "1px solid #FED7AA" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#9A3412" }}>OTA Segregation</div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {insights.otaHotspots.map((item) => (
                  <button
                    key={item.ota}
                    onClick={() => setOtaFilter(item.ota)}
                    style={{ padding: "7px 10px", borderRadius: 999, border: otaFilter === item.ota ? "none" : "1px solid #FDBA74", background: otaFilter === item.ota ? "#EA580C" : "#FFFFFF", color: otaFilter === item.ota ? "#FFFFFF" : "#9A3412", fontSize: 11, fontWeight: 800, cursor: "pointer" }}
                  >
                    {item.ota} · {item.count}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
            {filteredTasks.length === 0 ? (
              <div style={{ padding: "30px 18px", textAlign: "center", color: "#64748B", border: "1px dashed #CBD5E1", borderRadius: 16 }}>
                No tasks match the current filters.
              </div>
            ) : (
              filteredTasks.map((task) => (
                <div key={task.id} style={{ border: "1px solid #E5E7EB", borderRadius: 18, padding: 16, background: "#FFFFFF" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                        {priorityPill(task.priority)}
                        {statusPill(task.status)}
                        {task.bucket && (
                          <span style={{ padding: "5px 9px", borderRadius: 999, background: "#F8FAFC", color: "#475569", fontSize: 10, fontWeight: 800 }}>
                            {task.bucket}
                          </span>
                        )}
                        {task.relatedOta && (
                          <span style={{ padding: "5px 9px", borderRadius: 999, background: "#EEF6FF", color: "#1D4ED8", fontSize: 10, fontWeight: 800 }}>
                            {task.relatedOta}
                          </span>
                        )}
                      </div>
                      <div style={{ marginTop: 10, fontSize: 16, fontWeight: 800, color: "#0F172A" }}>{task.title}</div>
                      {task.description && (
                        <div style={{ marginTop: 8, fontSize: 12, color: "#475569", lineHeight: 1.7 }}>{task.description}</div>
                      )}
                      <div style={{ marginTop: 12, display: "flex", gap: 14, flexWrap: "wrap", fontSize: 11, color: "#64748B" }}>
                        <span>Owner: <strong style={{ color: "#0F172A" }}>{task.assignedName ?? "Unassigned"}</strong></span>
                        <span>Raised from: <strong style={{ color: "#0F172A" }}>{task.sourceLabel ?? task.sourcePage ?? "Dashboard"}</strong></span>
                        <span>TAT: <strong style={{ color: "#0F172A" }}>{taskTat(task)}</strong></span>
                        {task.dueDate && <span>Due: <strong style={{ color: "#0F172A" }}>{task.dueDate.slice(0, 10)}</strong></span>}
                        {task.followUpAt && <span>Follow-up: <strong style={{ color: "#0F172A" }}>{task.followUpAt.slice(0, 10)}</strong></span>}
                      </div>
                    </div>

                    <button
                      onClick={() => onOpenTaskSource(task)}
                      style={{ padding: "9px 12px", borderRadius: 12, border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#475569", fontSize: 11, fontWeight: 800, cursor: "pointer" }}
                    >
                      Open source
                    </button>
                  </div>

                  <div style={{ marginTop: 14, padding: 12, borderRadius: 14, background: "#F8FAFC", border: "1px solid #E5E7EB" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>AI summary</div>
                    <div style={{ marginTop: 6, fontSize: 12, color: "#334155", lineHeight: 1.7 }}>{task.aiSummary}</div>
                    <div style={{ marginTop: 8, fontSize: 12, color: "#475569", lineHeight: 1.7 }}>{task.aiInsight}</div>
                  </div>

                  <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "minmax(0, 1fr) 180px 140px", gap: 10, alignItems: "start" }}>
                    <textarea
                      value={commentDrafts[task.id] ?? ""}
                      onChange={(event) => setCommentDrafts((current) => ({ ...current, [task.id]: event.target.value }))}
                      rows={3}
                      placeholder="Progress comment or closure note. Pending, supervisor attention, and completion still require a comment."
                      style={{ padding: "11px 12px", borderRadius: 14, border: "1px solid #CBD5E1", fontSize: 12, outline: "none", resize: "vertical", fontFamily: "inherit" }}
                    />
                    <select
                      value={task.status}
                      onChange={(event) => updateTask(task, event.target.value as DashboardTaskRecord["status"])}
                      disabled={savingTaskId === task.id}
                      style={{ padding: "11px 12px", borderRadius: 14, border: "1px solid #CBD5E1", fontSize: 12, background: "#FFFFFF" }}
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In progress</option>
                      <option value="pending">Pending</option>
                      <option value="supervisor_attention">Needs supervisor attention</option>
                      <option value="done">Done with comment</option>
                    </select>
                    <button
                      onClick={() => updateTask(task, "done")}
                      disabled={savingTaskId === task.id}
                      style={{
                        padding: "11px 12px",
                        borderRadius: 14,
                        border: "none",
                        background: savingTaskId === task.id ? "#CBD5E1" : "#1D4ED8",
                        color: "#FFFFFF",
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: savingTaskId === task.id ? "not-allowed" : "pointer",
                      }}
                    >
                      {savingTaskId === task.id ? "Saving..." : "Mark complete"}
                    </button>
                  </div>

                  {task.comments.length > 0 && (
                    <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
                      {task.comments.slice(-3).map((comment) => (
                        <div key={comment.id} style={{ padding: 10, borderRadius: 12, background: "#FFFFFF", border: "1px solid #E5E7EB" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 10, color: "#94A3B8", textTransform: "uppercase", fontWeight: 800 }}>
                            <span>{comment.commentType.replace("_", " ")}</span>
                            <span>{new Date(comment.createdAt).toLocaleString("en-IN")}</span>
                          </div>
                          <div style={{ marginTop: 6, fontSize: 12, color: "#334155", lineHeight: 1.7 }}>{comment.comment}</div>
                          <div style={{ marginTop: 6, fontSize: 11, color: "#64748B" }}>By {comment.createdByName ?? "System"}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <section style={{ background: "#FFFFFF", border: "1px solid #E5E7EB", borderRadius: 20, padding: 20, boxShadow: "0 10px 34px rgba(15, 23, 42, 0.04)" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A" }}>Task AI Analyst</div>
          <div style={{ marginTop: 4, fontSize: 12, color: "#64748B" }}>
            Ask about owners, hotspots, overdue work, follow-up loops, or task buckets. Answers are grounded in the live task board.
          </div>

          <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
            {[
              "Who is overloaded today and what should I reassign?",
              "Which OTA has the highest task concentration today?",
              "Show me the pending, escalated, and overdue tasks first.",
            ].map((prompt) => (
              <button
                key={prompt}
                onClick={() => askTaskCopilot(prompt)}
                style={{ textAlign: "left", padding: "12px 14px", borderRadius: 14, border: "1px solid #E5E7EB", background: "#F8FAFC", color: "#334155", fontSize: 12, cursor: "pointer" }}
              >
                {prompt}
              </button>
            ))}
          </div>

          <div style={{ marginTop: 16, minHeight: 360, maxHeight: 520, overflowY: "auto", padding: 14, borderRadius: 16, background: "#F8FAFC", border: "1px solid #E5E7EB" }}>
            {messages.length === 0 ? (
              <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.7 }}>
                The analyst reads the same task board that powers Today&apos;s Assigned Tasks and explains what is wrong, why it is wrong, how it is happening, and how to fix it.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                {messages.map((message, index) => (
                  <div key={`${message.role}-${index}`} style={{ display: "flex", justifyContent: message.role === "user" ? "flex-end" : "flex-start" }}>
                    <div style={{ maxWidth: "92%", padding: "12px 14px", borderRadius: message.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: message.role === "user" ? "#1D4ED8" : "#FFFFFF", color: message.role === "user" ? "#FFFFFF" : "#0F172A", border: message.role === "user" ? "none" : "1px solid #E5E7EB" }}>
                      {message.role === "assistant" && message.mode && (
                        <div style={{ marginBottom: 8, fontSize: 10, fontWeight: 800, textTransform: "uppercase", color: "#64748B" }}>
                          {message.mode === "anthropic" ? "Model assisted" : "Deterministic analysis"}
                        </div>
                      )}
                      <div style={{ fontSize: 12, lineHeight: 1.7 }}>
                        {message.role === "assistant" ? renderTaskAnswer(message.content) : message.content}
                      </div>
                      {message.role === "assistant" && message.followUps && message.followUps.length > 0 && (
                        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {message.followUps.map((followUp) => (
                            <button
                              key={followUp}
                              onClick={() => askTaskCopilot(followUp)}
                              style={{ padding: "6px 9px", borderRadius: 999, border: "1px solid #DBEAFE", background: "#EFF6FF", color: "#1D4ED8", fontSize: 10, fontWeight: 800, cursor: "pointer" }}
                            >
                              {followUp}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {copilotLoading && <div style={{ fontSize: 12, color: "#64748B" }}>Analysing the live task board...</div>}
              </div>
            )}
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "flex-end" }}>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  askTaskCopilot(question);
                }
              }}
              rows={3}
              placeholder="Ask about owner load, follow-up risk, OTA hotspots, or closure discipline..."
              style={{ flex: 1, padding: "12px 14px", borderRadius: 16, border: "1px solid #CBD5E1", fontSize: 12, fontFamily: "inherit", resize: "vertical", outline: "none" }}
            />
            <button
              onClick={() => askTaskCopilot(question)}
              disabled={!question.trim() || copilotLoading}
              style={{ minWidth: 120, padding: "12px 14px", borderRadius: 16, border: "none", background: !question.trim() || copilotLoading ? "#CBD5E1" : "linear-gradient(135deg, #0F172A, #1D4ED8)", color: "#FFFFFF", fontSize: 12, fontWeight: 800, cursor: !question.trim() || copilotLoading ? "not-allowed" : "pointer" }}
            >
              {copilotLoading ? "Analysing..." : "Ask AI"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
