"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface MyStats {
  userName: string;
  totalAssigned: number;
  openTasks: number;
  overdue: number;
  doneThisMonth: number;
  doneThisWeek: number;
  recentDone: { id: number; title: string; completedAt: string; completionComment: string; propName: string }[];
  myOpen: { id: number; title: string; priority: string; dueDate: string; propName: string; propId: string }[];
}

interface Task {
  id: number;
  propertyId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  assignedName: string | null;
  displayAssignee: string | null;
  dueDate: string | null;
  createdAt: string;
  completedAt: string | null;
  completionComment: string | null;
  relatedOta: string | null;
  propName: string;
  propCity: string;
}

interface Counts { status: string; priority: string; cnt: number; }

function priorityColor(p: string) {
  return p === "high" ? "#EF4444" : p === "medium" ? "#F59E0B" : "#10B981";
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function TasksPage() {
  const [tasks,    setTasks]    = useState<Task[]>([]);
  const [counts,   setCounts]   = useState<Counts[]>([]);
  const [assignees, setAssignees] = useState<{ name: string }[]>([]);
  const [loading,  setLoading]  = useState(true);

  const [statusFilter,   setStatusFilter]   = useState("open");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [search,         setSearch]         = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [completing, setCompleting] = useState<number | null>(null);
  const [completionNote, setCompletionNote] = useState("");

  const [showMyPerf, setShowMyPerf] = useState(false);
  const [myStats, setMyStats] = useState<MyStats | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams({
      status: statusFilter, priority: priorityFilter,
      assignee: assigneeFilter, search: debouncedSearch,
    });
    fetch(`/api/tasks?${q}`)
      .then(r => r.json())
      .then(d => {
        setTasks(d.tasks ?? []);
        setCounts(d.counts ?? []);
        setAssignees(d.assignees ?? []);
      })
      .finally(() => setLoading(false));
  }, [statusFilter, priorityFilter, assigneeFilter, debouncedSearch]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (showMyPerf && !myStats) {
      fetch("/api/tasks/my-stats").then(r => r.json()).then(setMyStats);
    }
  }, [showMyPerf, myStats]);

  async function markDone(id: number) {
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "done", completionComment: completionNote }),
    });
    setCompleting(null);
    setCompletionNote("");
    load();
  }

  async function reopenTask(id: number) {
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "open" }),
    });
    load();
  }

  // Summary counts
  const openCount  = counts.filter(c => c.status === "open").reduce((a, b) => a + b.cnt, 0);
  const doneCount  = counts.filter(c => c.status === "done").reduce((a, b) => a + b.cnt, 0);
  const highOpen   = counts.find(c => c.status === "open" && c.priority === "high")?.cnt ?? 0;
  const today      = new Date().toISOString().split("T")[0];
  const overdueCount = tasks.filter(t => t.status === "open" && t.dueDate && t.dueDate < today).length;

  return (
    <div style={{ padding: "20px 24px", background: "#F8FAFC", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>Task Manager</div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>All tasks across properties</div>
        </div>
        {/* Tab strip */}
        <div style={{ display: "flex", background: "#F1F5F9", borderRadius: 10, padding: 4, gap: 2 }}>
          {([
            ["CRM",          "/crm",         false],
            ["Task Manager", "/tasks",        true ],
            ["Performance",  "/performance",  false],
          ] as [string, string, boolean][]).map(([label, href, active]) => (
            <Link key={label} href={href} style={{
              padding: "7px 22px", borderRadius: 7, fontSize: 12, fontWeight: 600,
              textDecoration: "none", whiteSpace: "nowrap",
              background: active ? "#0F172A" : "transparent",
              color: active ? "#FFFFFF" : "#64748B",
            }}>{label}</Link>
          ))}
        </div>
      </div>

      {/* Summary tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
        {[
          { label: "Open Tasks",    value: openCount,    bg: "#EFF6FF", color: "#2563EB", border: "#BFDBFE" },
          { label: "High Priority", value: highOpen,     bg: "#FEF2F2", color: "#DC2626", border: "#FECACA" },
          { label: "Overdue",       value: overdueCount, bg: overdueCount > 0 ? "#FFF7ED" : "#F0FDF4", color: overdueCount > 0 ? "#C2410C" : "#059669", border: overdueCount > 0 ? "#FED7AA" : "#BBF7D0" },
          { label: "Completed",     value: doneCount,    bg: "#F0FDF4", color: "#059669", border: "#BBF7D0" },
        ].map(t => (
          <div key={t.label} style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: t.color }}>{t.value}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: t.color, opacity: 0.8, marginTop: 2 }}>{t.label}</div>
          </div>
        ))}
      </div>

      {/* My Performance Toggle */}
      <div style={{ marginBottom: 14 }}>
        <button
          onClick={() => setShowMyPerf(p => !p)}
          style={{
            padding: "8px 18px", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer",
            border: "1px solid", borderColor: showMyPerf ? "#7C3AED" : "#E2E8F0",
            background: showMyPerf ? "#F5F3FF" : "#FFF", color: showMyPerf ? "#7C3AED" : "#64748B",
          }}
        >
          ◎ My Performance {showMyPerf ? "▲" : "▼"}
        </button>

        {showMyPerf && myStats && (
          <div style={{ marginTop: 10, background: "#FFF", border: "1px solid #DDD6FE", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6D28D9", marginBottom: 12 }}>
              {myStats.userName} — Performance Summary
            </div>

            {/* Stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 16 }}>
              {[
                { label: "Total Assigned", value: myStats.totalAssigned, color: "#6366F1", bg: "#EEF2FF" },
                { label: "Currently Open", value: myStats.openTasks,     color: "#2563EB", bg: "#EFF6FF" },
                { label: "Overdue",         value: myStats.overdue,       color: myStats.overdue > 0 ? "#DC2626" : "#059669", bg: myStats.overdue > 0 ? "#FEF2F2" : "#F0FDF4" },
                { label: "Done This Week",  value: myStats.doneThisWeek,  color: "#059669", bg: "#F0FDF4" },
                { label: "Done This Month", value: myStats.doneThisMonth, color: "#059669", bg: "#F0FDF4" },
              ].map(s => (
                <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: "10px 14px" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: s.color, opacity: 0.8, marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* My open tasks + recent completions */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* My open tasks */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#1E293B", marginBottom: 8 }}>My Open Tasks</div>
                {myStats.myOpen.length === 0 ? (
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>No open tasks 🎉</div>
                ) : myStats.myOpen.map(t => {
                  const overdue = t.dueDate && t.dueDate < new Date().toISOString().split("T")[0];
                  return (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8,
                      padding: "6px 10px", borderRadius: 7, marginBottom: 4,
                      background: overdue ? "#FEF2F2" : "#F8FAFC", border: `1px solid ${overdue ? "#FECACA" : "#F1F5F9"}` }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                        background: t.priority === "high" ? "#EF4444" : t.priority === "medium" ? "#F59E0B" : "#10B981" }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#1E293B",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
                        <div style={{ fontSize: 10, color: "#94A3B8" }}>{t.propName}</div>
                      </div>
                      {t.dueDate && <span style={{ fontSize: 10, color: overdue ? "#DC2626" : "#64748B", flexShrink: 0 }}>{t.dueDate}</span>}
                      <Link href={`/crm/${t.propId}`} style={{ fontSize: 10, color: "#2563EB", textDecoration: "none", flexShrink: 0 }}>→</Link>
                    </div>
                  );
                })}
              </div>

              {/* Recent completions */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#1E293B", marginBottom: 8 }}>Recent Completions</div>
                {myStats.recentDone.length === 0 ? (
                  <div style={{ fontSize: 11, color: "#94A3B8" }}>No completions yet</div>
                ) : myStats.recentDone.map(t => (
                  <div key={t.id} style={{ padding: "6px 10px", borderRadius: 7, marginBottom: 4,
                    background: "#F0FDF4", border: "1px solid #BBF7D0" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#1E293B",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>✓ {t.title}</div>
                    <div style={{ fontSize: 10, color: "#94A3B8" }}>
                      {t.propName} · {t.completedAt ? timeAgo(t.completedAt) : ""}
                    </div>
                    {t.completionComment && (
                      <div style={{ fontSize: 10, color: "#64748B", marginTop: 2, fontStyle: "italic" }}>"{t.completionComment}"</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {/* Status tabs */}
        <div style={{ display: "flex", background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 8, overflow: "hidden" }}>
          {[["open","Open"],["done","Done"],["all","All"]].map(([v, l]) => (
            <button key={v} onClick={() => setStatusFilter(v)}
              style={{
                padding: "7px 16px", fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer",
                background: statusFilter === v ? "#2563EB" : "transparent",
                color: statusFilter === v ? "#FFF" : "#64748B",
              }}>
              {l}
            </button>
          ))}
        </div>

        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
          style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 11, background: "#FFF" }}>
          <option value="all">All Priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select value={assigneeFilter} onChange={e => setAssigneeFilter(e.target.value)}
          style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 11, background: "#FFF" }}>
          <option value="all">All Assignees</option>
          {assignees.map(a => <option key={a.name} value={a.name}>{a.name}</option>)}
        </select>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search task, property, city…"
          style={{ flex: 1, minWidth: 200, padding: "7px 12px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 11, outline: "none" }}
        />
      </div>

      {/* Tasks list */}
      <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>Loading…</div>
        ) : tasks.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 13 }}>No tasks found</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
                {["", "Task", "Property", "Assigned To", "Due Date", "Status", ""].map((h, i) => (
                  <th key={i} style={{ padding: "9px 12px", fontSize: 10, fontWeight: 700, color: "#64748B",
                    textAlign: "left", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => {
                const overdue = task.status === "open" && task.dueDate && task.dueDate < today;
                const isDone  = task.status === "done";
                return (
                  <>
                    <tr key={task.id} style={{
                      borderBottom: "1px solid #F1F5F9",
                      background: overdue ? "#FFF7F7" : "transparent",
                      opacity: isDone ? 0.6 : 1,
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = overdue ? "#FEF2F2" : "#F8FAFC")}
                      onMouseLeave={e => (e.currentTarget.style.background = overdue ? "#FFF7F7" : "transparent")}
                    >
                      {/* Priority dot */}
                      <td style={{ padding: "10px 8px 10px 14px", width: 8 }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: "50%",
                          background: isDone ? "#10B981" : priorityColor(task.priority),
                        }} />
                      </td>

                      {/* Title + description */}
                      <td style={{ padding: "10px 12px", maxWidth: 300 }}>
                        <div style={{
                          fontSize: 12, fontWeight: 600, color: "#1E293B",
                          textDecoration: isDone ? "line-through" : "none",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {task.title}
                        </div>
                        {task.description && (
                          <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {task.description}
                          </div>
                        )}
                        {task.relatedOta && (
                          <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 10,
                            background: "#EEF2FF", color: "#6366F1", marginTop: 3, display: "inline-block" }}>
                            {task.relatedOta}
                          </span>
                        )}
                      </td>

                      {/* Property */}
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#334155",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>
                          {task.propName || task.propertyId}
                        </div>
                        {task.propCity && (
                          <div style={{ fontSize: 10, color: "#94A3B8" }}>{task.propCity}</div>
                        )}
                      </td>

                      {/* Assignee */}
                      <td style={{ padding: "10px 12px", fontSize: 11, color: "#475569", whiteSpace: "nowrap" }}>
                        {task.displayAssignee || <span style={{ color: "#CBD5E1" }}>—</span>}
                      </td>

                      {/* Due date */}
                      <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                        {task.dueDate ? (
                          <span style={{ fontSize: 11, fontWeight: overdue ? 700 : 400,
                            color: overdue ? "#DC2626" : isDone ? "#94A3B8" : "#475569" }}>
                            {overdue ? "⚠ " : ""}{task.dueDate}
                          </span>
                        ) : <span style={{ color: "#CBD5E1", fontSize: 11 }}>—</span>}
                      </td>

                      {/* Status badge */}
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                          background: isDone ? "#D1FAE5" : overdue ? "#FEE2E2" : "#EFF6FF",
                          color: isDone ? "#059669" : overdue ? "#DC2626" : "#2563EB",
                        }}>
                          {isDone ? "Done" : overdue ? "Overdue" : "Open"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "10px 12px" }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          {!isDone && (
                            <button
                              onClick={() => setCompleting(completing === task.id ? null : task.id)}
                              style={{
                                fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 6,
                                border: "1px solid #BBF7D0", background: "#F0FDF4", color: "#059669",
                                cursor: "pointer", whiteSpace: "nowrap",
                              }}>
                              ✓ Done
                            </button>
                          )}
                          {isDone && (
                            <button onClick={() => reopenTask(task.id)}
                              style={{
                                fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 6,
                                border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#64748B",
                                cursor: "pointer", whiteSpace: "nowrap",
                              }}>
                              Reopen
                            </button>
                          )}
                          <Link href={`/crm/${task.propertyId}`} style={{
                            fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 6,
                            border: "1px solid #BFDBFE", background: "#EFF6FF", color: "#2563EB",
                            textDecoration: "none", whiteSpace: "nowrap",
                          }}>
                            Open →
                          </Link>
                        </div>
                      </td>
                    </tr>

                    {/* Completion note input */}
                    {completing === task.id && (
                      <tr key={`complete-${task.id}`} style={{ background: "#F0FDF4", borderBottom: "1px solid #F1F5F9" }}>
                        <td colSpan={7} style={{ padding: "10px 14px" }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <input
                              autoFocus
                              value={completionNote}
                              onChange={e => setCompletionNote(e.target.value)}
                              placeholder="Optional: add a completion note…"
                              style={{ flex: 1, padding: "6px 10px", borderRadius: 7, border: "1px solid #BBF7D0",
                                fontSize: 11, outline: "none" }}
                            />
                            <button onClick={() => markDone(task.id)}
                              style={{ padding: "6px 16px", borderRadius: 7, border: "none",
                                background: "#059669", color: "#FFF", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                              Mark Done
                            </button>
                            <button onClick={() => setCompleting(null)}
                              style={{ padding: "6px 12px", borderRadius: 7, border: "1px solid #E2E8F0",
                                background: "#FFF", color: "#64748B", fontSize: 11, cursor: "pointer" }}>
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
