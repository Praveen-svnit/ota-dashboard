"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { OTAS } from "@/lib/constants";

interface TeamMember {
  id: string;
  name: string;
  teamLead: string;
  role: string;
  otas: string[];
  priority?: "P1" | "P2" | "P3";
}

interface RouteSummary {
  route: string;
  label: string;
  activeCount: number;
  highPriorityCount: number;
  blockedCount: number;
  latestSourceLabel: string | null;
}

interface TaskNotification {
  id: number;
  taskId: number | null;
  type: string;
  title: string;
  message: string;
  recipientUserId: string | null;
  recipientName: string | null;
  status: "unread" | "read";
  metadata: string | null;
  createdAt: string;
  readAt: string | null;
}

interface LauncherPrefill {
  title?: string;
  description?: string;
  sourceRoute?: string;
  sourceLabel?: string;
  sourceAnchor?: string;
  sourceSection?: string;
  relatedOta?: string;
  relatedCity?: string;
  assignedName?: string;
  priority?: "low" | "medium" | "high" | "critical";
  dueDate?: string;
  followUpAt?: string;
  taskType?: "dashboard" | "property" | "adhoc";
  propertyId?: string;
  tags?: string[];
}

type LauncherState = LauncherPrefill & {
  title: string;
  description: string;
  sourceRoute: string;
  sourceLabel: string;
  sourceAnchor: string;
  sourceSection: string;
  relatedOta: string;
  relatedCity: string;
  assignedName: string;
  priority: "low" | "medium" | "high" | "critical";
  dueDate: string;
  followUpAt: string;
  taskType: "dashboard" | "property" | "adhoc";
  propertyId: string;
  tagsText: string;
};

function routeLabel(pathname: string) {
  if (pathname === "/") return "Production Dashboard";
  if (pathname === "/production-dashboard-2") return "Production Dashboard 2";
  if (pathname === "/todays-assigned-tasks") return "Today's Assigned Tasks";
  if (pathname.startsWith("/listings")) return "Property Tracker";
  if (pathname.startsWith("/listing-dashboard")) return "Listing Dashboard";
  if (pathname.startsWith("/team")) return "Team";
  return pathname.replace(/^\//, "").replace(/-/g, " ") || "Dashboard";
}

function createDefaultState(pathname: string, prefill?: LauncherPrefill): LauncherState {
  return {
    title: prefill?.title ?? "",
    description: prefill?.description ?? "",
    sourceRoute: prefill?.sourceRoute ?? pathname,
    sourceLabel: prefill?.sourceLabel ?? `${routeLabel(pathname)} task`,
    sourceAnchor: prefill?.sourceAnchor ?? "",
    sourceSection: prefill?.sourceSection ?? "",
    relatedOta: prefill?.relatedOta ?? "",
    relatedCity: prefill?.relatedCity ?? "",
    assignedName: prefill?.assignedName ?? "",
    priority: prefill?.priority ?? "high",
    dueDate: prefill?.dueDate ?? "",
    followUpAt: prefill?.followUpAt ?? "",
    taskType: prefill?.taskType ?? "dashboard",
    propertyId: prefill?.propertyId ?? "dashboard-global",
    tagsText: (prefill?.tags ?? []).join(", "),
  };
}

export default function GlobalDashboardTaskShell() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<LauncherState>(() => createDefaultState(pathname));
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [routeSummary, setRouteSummary] = useState<RouteSummary | null>(null);
  const [globalActiveCount, setGlobalActiveCount] = useState(0);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<TaskNotification[]>([]);
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);

  const preferredMatches = useMemo(() => {
    const ota = form.relatedOta.trim().toLowerCase();
    if (!ota) return teamMembers;
    const matched = teamMembers.filter((member) => member.otas.some((entry) => entry.toLowerCase() === ota));
    return matched.length > 0 ? matched : teamMembers;
  }, [form.relatedOta, teamMembers]);

  async function loadSummary() {
    const response = await fetch(`/api/dashboard-tasks?route=${encodeURIComponent(pathname)}`);
    if (!response.ok) return;
    const json = await response.json();
    setTeamMembers(json.teamMembers ?? []);
    setRouteSummary(json.routeSummary ?? null);
    setGlobalActiveCount(json.insights?.totalActive ?? 0);
  }

  async function loadNotifications() {
    const response = await fetch("/api/task-notifications");
    if (!response.ok) return;
    const json = await response.json();
    setNotifications(json.notifications ?? []);
  }

  useEffect(() => {
    if (pathname === "/login") return;
    loadSummary();
    loadNotifications();
  }, [pathname]);

  useEffect(() => {
    if (pathname === "/login") return;

    function handleOpen(event: Event) {
      const detail = (event as CustomEvent<LauncherPrefill>).detail ?? {};
      setForm(createDefaultState(pathname, detail));
      setOpen(true);
    }

    function handleChanged() {
      loadSummary();
      loadNotifications();
    }

    window.addEventListener("dashboard-tasks:open", handleOpen);
    window.addEventListener("dashboard-tasks:changed", handleChanged);
    return () => {
      window.removeEventListener("dashboard-tasks:open", handleOpen);
      window.removeEventListener("dashboard-tasks:changed", handleChanged);
    };
  }, [pathname]);

  useEffect(() => {
    if (pathname === "/login") return;
    const timer = window.setInterval(() => {
      loadNotifications();
    }, 20000);
    return () => window.clearInterval(timer);
  }, [pathname]);

  if (pathname === "/login") return null;

  // Only show buttons on Today's Assigned Tasks page
  const showButtons = pathname === "/todays-assigned-tasks";

  async function createTask() {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    setSavedMessage(null);

    try {
      const response = await fetch("/api/dashboard-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          sourceRoute: form.sourceRoute,
          sourceLabel: form.sourceLabel,
          sourceAnchor: form.sourceAnchor || undefined,
          sourceSection: form.sourceSection || undefined,
          relatedOta: form.relatedOta || undefined,
          relatedCity: form.relatedCity || undefined,
          assignedName: form.assignedName || undefined,
          priority: form.priority,
          dueDate: form.dueDate || undefined,
          followUpAt: form.followUpAt || undefined,
          taskType: form.taskType,
          propertyId: form.propertyId || "dashboard-global",
          tags: form.tagsText
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
        }),
      });
      const json = await response.json();
      if (!response.ok || json.error) {
        throw new Error(json.error ?? `HTTP ${response.status}`);
      }

      setSavedMessage("Task added to Today's Assigned Tasks.");
      setOpen(false);
      setForm(createDefaultState(pathname));
      window.dispatchEvent(new CustomEvent("dashboard-tasks:changed"));
    } catch (error) {
      setSavedMessage(error instanceof Error ? error.message : "Unable to create task.");
    } finally {
      setSaving(false);
    }
  }

  async function markNotificationRead(notificationId: number) {
    await fetch(`/api/task-notifications/${notificationId}`, {
      method: "PATCH",
    });
    setNotifications((current) => current.filter((item) => item.id !== notificationId));
  }

  function openNotification(notification: TaskNotification) {
    let metadata: { sourceRoute?: string; sourceAnchor?: string; taskId?: number } | null = null;
    try {
      metadata = notification.metadata ? JSON.parse(notification.metadata) as { sourceRoute?: string; sourceAnchor?: string; taskId?: number } : null;
    } catch {
      metadata = null;
    }

    if (metadata?.sourceRoute) {
      window.location.href = `${metadata.sourceRoute}${metadata.sourceAnchor ? `#${metadata.sourceAnchor}` : ""}`;
    } else {
      window.location.href = "/todays-assigned-tasks";
    }
    markNotificationRead(notification.id);
  }

  return (
    <>
      {routeSummary && routeSummary.activeCount > 0 && (
        <div
          style={{
            margin: "16px 24px 0",
            padding: "12px 16px",
            borderRadius: 16,
            border: "1px solid #BFDBFE",
            background: "linear-gradient(135deg, #EFF6FF, #F8FAFC)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>
              {routeSummary.activeCount} task{routeSummary.activeCount === 1 ? "" : "s"} flagged on this page
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: "#475569" }}>
              {routeSummary.highPriorityCount} high priority, {routeSummary.blockedCount} pending or escalated. Latest source: {routeSummary.latestSourceLabel ?? routeSummary.label}.
            </div>
          </div>
          <button
            onClick={() => {
              setForm(createDefaultState(pathname, { sourceLabel: routeSummary.label }));
              setOpen(true);
            }}
            style={{
              padding: "10px 14px",
              borderRadius: 999,
              border: "none",
              background: "#1D4ED8",
              color: "#FFFFFF",
              fontSize: 12,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Raise Another Task
          </button>
        </div>
      )}

      {showButtons && (
        <button
          onClick={() => setNotificationPanelOpen((current) => !current)}
          style={{
            position: "fixed",
            right: 24,
            bottom: 116,
            zIndex: 81,
            border: "none",
            cursor: "pointer",
            borderRadius: 18,
            padding: "12px 14px",
            background: notifications.length > 0 ? "linear-gradient(135deg, #7C2D12, #EA580C)" : "#0F172A",
            color: "#FFFFFF",
            boxShadow: "0 12px 30px rgba(15, 23, 42, 0.22)",
          }}
        >
        <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.8 }}>Alerts</div>
        <div style={{ marginTop: 4, fontSize: 14, fontWeight: 900 }}>Notifications</div>
        <div style={{ marginTop: 4, fontSize: 11 }}>{notifications.length} unread</div>
      </button>
      )}

      {showButtons && (
        <button
          onClick={() => {
            setForm(createDefaultState(pathname));
            setOpen(true);
          }}
          style={{
            position: "fixed",
            right: 24,
            bottom: 24,
            zIndex: 80,
            border: "none",
            cursor: "pointer",
            borderRadius: 20,
            padding: "14px 16px",
            background: "linear-gradient(135deg, #0F172A, #1D4ED8)",
            color: "#FFFFFF",
            boxShadow: "0 14px 36px rgba(15, 23, 42, 0.26)",
          }}
        >
        <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.75 }}>Tasks</div>
        <div style={{ marginTop: 4, fontSize: 14, fontWeight: 900 }}>Raise Task</div>
        <div style={{ marginTop: 4, fontSize: 11 }}>{globalActiveCount} active on board</div>
      </button>
      )}

      {notificationPanelOpen && (
        <div
          style={{
            position: "fixed",
            right: 24,
            bottom: 212,
            width: 360,
            maxWidth: "calc(100vw - 32px)",
            maxHeight: "48vh",
            overflowY: "auto",
            zIndex: 95,
            borderRadius: 18,
            border: "1px solid #E5E7EB",
            background: "#FFFFFF",
            boxShadow: "0 20px 48px rgba(15,23,42,0.18)",
            padding: 14,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 900, color: "#0F172A" }}>Task Notifications</div>
          <div style={{ marginTop: 4, fontSize: 12, color: "#64748B" }}>
            Assignees get alerts for new tasks. Admin also gets alerts when a task is marked pending or needs supervisor attention.
          </div>
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: 12, borderRadius: 14, background: "#F8FAFC", color: "#64748B", fontSize: 12 }}>
                No unread task notifications right now.
              </div>
            ) : notifications.map((notification) => (
              <div key={notification.id} style={{ padding: 12, borderRadius: 14, background: "#F8FAFC", border: "1px solid #E5E7EB" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: "#0F172A" }}>{notification.title}</div>
                <div style={{ marginTop: 6, fontSize: 12, color: "#475569", lineHeight: 1.7 }}>{notification.message}</div>
                <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "#94A3B8" }}>{new Date(notification.createdAt).toLocaleString("en-IN")}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => markNotificationRead(notification.id)}
                      style={{ padding: "6px 8px", borderRadius: 10, border: "1px solid #CBD5E1", background: "#FFFFFF", color: "#475569", fontSize: 10, fontWeight: 800, cursor: "pointer" }}
                    >
                      Mark read
                    </button>
                    <button
                      onClick={() => openNotification(notification)}
                      style={{ padding: "6px 8px", borderRadius: 10, border: "none", background: "#1D4ED8", color: "#FFFFFF", fontSize: 10, fontWeight: 800, cursor: "pointer" }}
                    >
                      Open
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {savedMessage && (
        <div
          style={{
            position: "fixed",
            right: 24,
            bottom: 108,
            zIndex: 90,
            padding: "10px 12px",
            borderRadius: 12,
            background: "#0F172A",
            color: "#FFFFFF",
            fontSize: 12,
            boxShadow: "0 10px 28px rgba(15,23,42,0.2)",
          }}
        >
          {savedMessage}
        </div>
      )}

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 120,
            background: "rgba(15, 23, 42, 0.38)",
            display: "flex",
            alignItems: "stretch",
            justifyContent: "flex-end",
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(520px, 100vw)",
              background: "#FFFFFF",
              boxShadow: "-20px 0 60px rgba(15,23,42,0.16)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ padding: "20px 22px", borderBottom: "1px solid #E5E7EB" }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#64748B" }}>
                Dashboard Assignment
              </div>
              <div style={{ marginTop: 8, fontSize: 24, fontWeight: 900, color: "#0F172A" }}>Raise a task from anywhere</div>
              <div style={{ marginTop: 8, fontSize: 12, color: "#64748B", lineHeight: 1.7 }}>
                This task will be consolidated in Today&apos;s Assigned Tasks and will stay linked to its source page and section.
              </div>
            </div>

            <div style={{ padding: "18px 22px 22px", display: "grid", gap: 12, overflowY: "auto" }}>
              <div style={{ padding: 12, borderRadius: 14, background: "#F8FAFC", border: "1px solid #E5E7EB" }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Source</div>
                <div style={{ marginTop: 6, fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{form.sourceLabel}</div>
                <div style={{ marginTop: 4, fontSize: 11, color: "#64748B" }}>
                  Route: {form.sourceRoute}{form.sourceSection ? ` | Section: ${form.sourceSection}` : ""}
                </div>
              </div>

              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Task title"
                style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid #CBD5E1", fontSize: 13, outline: "none" }}
              />
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="What exactly needs to be done, what follow-up is expected, and what success looks like"
                rows={5}
                style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid #CBD5E1", fontSize: 13, outline: "none", resize: "vertical", fontFamily: "inherit" }}
              />

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                <select
                  value={form.priority}
                  onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as LauncherState["priority"] }))}
                  style={{ padding: "11px 12px", borderRadius: 14, border: "1px solid #CBD5E1", fontSize: 12, background: "#FFFFFF" }}
                >
                  <option value="low">Low priority</option>
                  <option value="medium">Medium priority</option>
                  <option value="high">High priority</option>
                  <option value="critical">Critical priority</option>
                </select>
                <select
                  value={form.assignedName}
                  onChange={(event) => setForm((current) => ({ ...current, assignedName: event.target.value }))}
                  style={{ padding: "11px 12px", borderRadius: 14, border: "1px solid #CBD5E1", fontSize: 12, background: "#FFFFFF" }}
                >
                  <option value="">Select from team list</option>
                  {preferredMatches.map((member) => (
                    <option key={member.id} value={member.name}>
                      {member.name} | {member.role}{member.otas.length > 0 ? ` | ${member.otas.join(", ")}` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <input
                value={form.assignedName}
                onChange={(event) => setForm((current) => ({ ...current, assignedName: event.target.value }))}
                placeholder="Text-based assignment or external owner"
                style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid #CBD5E1", fontSize: 13, outline: "none" }}
              />

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                <select
                  value={form.relatedOta}
                  onChange={(event) => setForm((current) => ({ ...current, relatedOta: event.target.value }))}
                  style={{ padding: "11px 12px", borderRadius: 14, border: "1px solid #CBD5E1", fontSize: 12, background: "#FFFFFF" }}
                >
                  <option value="">Select OTA</option>
                  {OTAS.map((ota) => (
                    <option key={ota} value={ota}>{ota}</option>
                  ))}
                </select>
                <input
                  value={form.relatedCity}
                  onChange={(event) => setForm((current) => ({ ...current, relatedCity: event.target.value }))}
                  placeholder="Related city"
                  style={{ padding: "11px 12px", borderRadius: 14, border: "1px solid #CBD5E1", fontSize: 12, outline: "none" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                <div>
                  <div style={{ marginBottom: 6, fontSize: 10, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Due date</div>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
                    style={{ width: "100%", padding: "11px 12px", borderRadius: 14, border: "1px solid #CBD5E1", fontSize: 12, outline: "none" }}
                  />
                </div>
                <div>
                  <div style={{ marginBottom: 6, fontSize: 10, fontWeight: 800, color: "#64748B", textTransform: "uppercase" }}>Follow-up date</div>
                  <input
                    type="date"
                    value={form.followUpAt}
                    onChange={(event) => setForm((current) => ({ ...current, followUpAt: event.target.value }))}
                    style={{ width: "100%", padding: "11px 12px", borderRadius: 14, border: "1px solid #CBD5E1", fontSize: 12, outline: "none" }}
                  />
                </div>
              </div>

              <input
                value={form.tagsText}
                onChange={(event) => setForm((current) => ({ ...current, tagsText: event.target.value }))}
                placeholder="Tags, separated, by comma"
                style={{ padding: "12px 14px", borderRadius: 14, border: "1px solid #CBD5E1", fontSize: 13, outline: "none" }}
              />
            </div>

            <div style={{ padding: "16px 22px 22px", borderTop: "1px solid #E5E7EB", display: "flex", gap: 10 }}>
              <button
                onClick={() => setOpen(false)}
                style={{
                  flex: 1,
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: "1px solid #CBD5E1",
                  background: "#FFFFFF",
                  color: "#475569",
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={createTask}
                disabled={!form.title.trim() || saving}
                style={{
                  flex: 1.4,
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: "none",
                  background: !form.title.trim() || saving ? "#CBD5E1" : "linear-gradient(135deg, #0F172A, #1D4ED8)",
                  color: "#FFFFFF",
                  fontSize: 12,
                  fontWeight: 900,
                  cursor: !form.title.trim() || saving ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Adding task..." : "Add To Today's Assigned Tasks"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
