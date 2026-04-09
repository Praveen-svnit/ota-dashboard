"use client";

import { useEffect, useRef, useState, use } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { OTA_COLORS, OTAS } from "@/lib/constants";

// Fallback arrays (used only if config hasn't loaded yet)
const STATUS_OPTIONS_FALLBACK = [
  "Shell Created", "Live", "Not Live", "Ready to Go Live", "Content in Progress",
  "Listing in Progress", "Pending", "Soldout", "Closed",
];

const SUB_STATUS_OPTIONS_FALLBACK = [
  "Content Pending", "Images Pending", "Approval Pending",
  "OTA Verification", "Under Review", "Suspended", "Duplicate",
];

// Agoda-specific status → subStatus mapping (key = Agoda status, value = {preset, postset})
const AGODA_STATUS_MAP: Record<string, { preset: string; postset: string }> = {
  "Live":                     { preset: "Live",              postset: "Live" },
  "Listing Claimed by Owner": { preset: "Revenue",           postset: "Supply/Operations" },
  "Delisted":                 { preset: "Churned",           postset: "Churned" },
  "Not to List on OTA":       { preset: "Exception",         postset: "Exception" },
  "Only FH":                  { preset: "Rev+",              postset: "Rev+" },
  "Ready to go Live":         { preset: "Pending at OTA",    postset: "Pending at OTA" },
  "Yet to be Shared":         { preset: "Pending at OTA",    postset: "Pending at OTA" },
  "Listing Under Process":    { preset: "Pending at Agoda",  postset: "Pending at Agoda" },
  "Live (Duplicate)":         { preset: "Live",              postset: "Live" },
};
const AGODA_STATUS_OPTIONS = Object.keys(AGODA_STATUS_MAP);

function getAgodaSubStatus(status: string, prePost: string): string {
  const entry = AGODA_STATUS_MAP[status];
  if (!entry) return "";
  const pp = prePost?.toLowerCase();
  if (pp === "preset")  return entry.preset;
  if (pp === "postset") return entry.postset;
  return entry.postset; // default to postset if unknown/null
}

const STATUS_COLORS: Record<string, { bg: string; color: string; dot: string }> = {
  live:                  { bg: "#D1FAE5", color: "#059669", dot: "#10B981" },
  "not live":            { bg: "#FEE2E2", color: "#DC2626", dot: "#EF4444" },
  "ready to go live":    { bg: "#FEF9C3", color: "#854D0E", dot: "#F59E0B" },
  "content in progress": { bg: "#EEF2FF", color: "#4F46E5", dot: "#6366F1" },
  "listing in progress": { bg: "#EEF2FF", color: "#4F46E5", dot: "#6366F1" },
  pending:               { bg: "#FEF3C7", color: "#D97706", dot: "#F59E0B" },
  soldout:               { bg: "#F3F4F6", color: "#6B7280", dot: "#9CA3AF" },
  "shell created":       { bg: "#F5F3FF", color: "#7C3AED", dot: "#8B5CF6" },
  closed:                { bg: "#F1F5F9", color: "#475569", dot: "#94A3B8" },
};

const ACTION_COLORS: Record<string, string> = {
  field_updated:  "#2563EB",
  note_added:     "#7C3AED",
  assigned:       "#059669",
  metric_updated: "#059669",
};

type MetricType = "toggle" | "select" | "text" | "multi-toggle";
interface DateField { key: string; label: string }
interface MultiToggleItem { key: string; label: string }
interface MetricDef { key: string; label: string; type: MetricType; options?: string[]; dates?: DateField[]; items?: MultiToggleItem[] }

const OTA_METRICS: Record<string, MetricDef[]> = {
  "Agoda": [
    { key: "ai",  label: "AI (Agoda Intelligence)", type: "toggle", dates: [
      { key: "ai_paused_date",          label: "Paused Date" },
      { key: "ai_next_activation_date", label: "Next Activation Date (As per Extranet)" },
    ]},
    { key: "agx", label: "AGX", type: "toggle", dates: [
      { key: "agx_start_date", label: "Start Date" },
      { key: "agx_end_date",   label: "End Date" },
    ]},
    { key: "content_boxes", label: "Content Boxes", type: "multi-toggle", items: [
      { key: "cb_mapping",           label: "Mapping" },
      { key: "cb_room_plan",         label: "Room Plan" },
      { key: "cb_rate_plan",         label: "Rate Plan" },
      { key: "cb_policy",            label: "Policy" },
      { key: "cb_promotion",         label: "Promotion" },
      { key: "cb_child_time_policy", label: "Child/Time Policy" },
      { key: "cb_image",             label: "Image" },
    ]},
  ],
  "GoMMT": [
    { key: "mmt_black",      label: "MMT Black",       type: "toggle" },
    { key: "mybizz_assured", label: "MyBizz Assured",  type: "toggle" },
  ],
  "Booking.com": [
    { key: "prepaid_status",    label: "Prepaid Status",   type: "select",
      options: ["—", "Not Requested", "Requested", "Active", "Inactive"] },
    { key: "genius",            label: "Genius",           type: "select",
      options: ["—", "Not Enrolled", "Level 1", "Level 2", "Level 3"] },
    { key: "preferred",         label: "Preferred",        type: "toggle" },
    { key: "eligible_for_dod",  label: "Eligible for DOD", type: "toggle" },
    { key: "commission",        label: "Commission %",     type: "text" },
  ],
  "GMB": [
    { key: "listing_type",       label: "Listing Type",             type: "text" },
    { key: "review_link_status", label: "Review Link Tracker",      type: "text" },
    { key: "gmb_rating",         label: "GMB Rating",               type: "text" },
    { key: "gmb_review_count",   label: "GMB Review Count",         type: "text" },
  ],
};

interface Listing {
  id: number; ota: string; status: string; subStatus: string;
  liveDate: string; tat: number; tatError: number; otaId: string;
  assignedTo: string; crmNote: string; crmUpdatedAt: string; assignedName: string;
  prePost: string; listingLink: string;
}
interface Log {
  id: number; otaListingId: number; action: string; field: string;
  oldValue: string; newValue: string; note: string; createdAt: string;
  userName: string; userRole: string;
}
interface Property {
  id: string; name: string; city: string; fhStatus: string; fhLiveDate: string;
}
interface Task {
  id: number; title: string; description: string; status: string; priority: string;
  assignedTo: string | null; assignedName: string | null; createdByName: string | null;
  dueDate: string | null; createdAt: string;
}


function statusPill(status: string) {
  const s = STATUS_COLORS[status?.toLowerCase()] ?? { bg: "#F1F5F9", color: "#64748B" };
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
      background: s.bg, color: s.color }}>{status || "—"}</span>
  );
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function PropertyDetailPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const { propertyId } = use(params);
  const searchParams   = useSearchParams();
  const defaultOta     = searchParams.get("ota");
  const [property, setProperty] = useState<Property | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [logs,     setLogs]     = useState<Log[]>([]);

  const [loading,  setLoading]  = useState(true);
  const [otaConfigs, setOtaConfigs] = useState<Record<string, { subStatuses: string[]; statusMap: Record<string, string[]> }>>({});

  // Metrics
  const [metrics,    setMetrics]    = useState<Record<string, string>>({});
  const [metricEdit, setMetricEdit] = useState<Record<string, string>>({});
  const [savingMetric, setSavingMetric] = useState<string | null>(null);

  // Edit state
  const [editing,       setEditing]       = useState<{ id: number; field: string } | null>(null);
  const [editValue,     setEditValue]     = useState("");
  const [editNote,      setEditNote]      = useState("");
  const [noteErr,       setNoteErr]       = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [autoSubStatus, setAutoSubStatus] = useState<string | null>(null);
  const [noteInput,      setNoteInput]      = useState<Record<number, string>>({});
  const [propNoteInput,  setPropNoteInput]  = useState("");
  const [propNoteSaving, setPropNoteSaving] = useState(false);
  const [activeOta,   setActiveOta]   = useState<string | null>(null);
  const [addOtaOpen,  setAddOtaOpen]  = useState(false);
  const [addingOta,   setAddingOta]   = useState<string | null>(null);
  const [actionDate,  setActionDate]  = useState("");
  const [sessionName, setSessionName] = useState("You");

  // Tasks
  const [tasks,        setTasks]        = useState<Task[]>([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskUsers,    setTaskUsers]    = useState<{ id: string; name: string }[]>([]);
  const [newTask,      setNewTask]      = useState({ title: "", description: "", priority: "medium", assignedTo: "", dueDate: "" });
  const [savingTask,   setSavingTask]   = useState(false);
  const notLiveRef = useRef<HTMLDivElement | null>(null);

  function load() {
    setLoading(true);
    fetch(`/api/crm/properties/${propertyId}`)
      .then((r) => r.json())
      .then((d) => {
        setProperty(d.property ?? null);
        setListings(d.listings ?? []);
        setLogs(d.logs ?? []);
        if (d.listings?.length) {
          const preferred = d.listings.find((l: { ota: string }) => l.ota === defaultOta);
          setActiveOta(preferred ? preferred.ota : "__property__");
        }
      })
      .finally(() => setLoading(false));
    fetch(`/api/crm/tasks?propertyId=${encodeURIComponent(propertyId)}`)
      .then((r) => r.json()).then((d) => setTasks(d.tasks ?? []));
    fetch("/api/crm/users/list")
      .then((r) => r.json()).then((d) => setTaskUsers(d.users ?? []));
    fetch("/api/admin/status-config")
      .then((r) => r.json())
      .then((d: { configs?: { ota: string; subStatuses: string[]; statusMap: Record<string, string[]> }[] }) => {
        if (!d.configs) return;
        const map: Record<string, { subStatuses: string[]; statusMap: Record<string, string[]> }> = {};
        for (const c of d.configs) map[c.ota] = { subStatuses: c.subStatuses, statusMap: c.statusMap };
        setOtaConfigs(map);
      })
      .catch(() => {/* non-admin users may get 403 — silently ignore */});
  }

  function getStatusOptions(ota: string): string[] {
    const cfg = otaConfigs[ota];
    if (!cfg) return ota === "Agoda" ? Object.keys(AGODA_STATUS_MAP) : STATUS_OPTIONS_FALLBACK;
    // Derive unique statuses from the statusMap values
    return [...new Set(Object.values(cfg.statusMap).flat())];
  }

  function getSubStatusOptions(ota: string): string[] {
    const cfg = otaConfigs[ota];
    if (!cfg) return SUB_STATUS_OPTIONS_FALLBACK;
    return cfg.subStatuses;
  }

  async function addOta(ota: string) {
    setAddingOta(ota);
    setAddOtaOpen(false);
    const res  = await fetch(`/api/crm/properties/${propertyId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ota }),
    });
    const json = await res.json();
    if (json.listing) {
      setListings(prev => [...prev, json.listing]);
      setActiveOta(ota);
    }
    setAddingOta(null);
  }

  async function createTask() {
    if (!newTask.title.trim()) return;
    setSavingTask(true);
    await fetch("/api/crm/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId, ...newTask }),
    });
    setSavingTask(false);
    setNewTask({ title: "", description: "", priority: "medium", assignedTo: "", dueDate: "" });
    setShowTaskForm(false);
    fetch(`/api/crm/tasks?propertyId=${encodeURIComponent(propertyId)}`)
      .then((r) => r.json()).then((d) => setTasks(d.tasks ?? []));
  }

  async function updateTaskStatus(taskId: number, status: string) {
    const isCompleting = status === "done";
    const comment = isCompleting ? window.prompt("Add a completion comment before closing this task:")?.trim() ?? "" : "";
    if (isCompleting && !comment) return;

    const response = await fetch(`/api/crm/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, comment }),
    });
    if (!response.ok) {
      const json = await response.json().catch(() => null);
      alert(json?.error ?? "Unable to update task");
      return;
    }
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status } : t));
  }

  async function deleteTask(taskId: number) {
    await fetch(`/api/crm/tasks/${taskId}`, { method: "DELETE" });
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.ok ? r.json() : null).then(d => { if (d?.user?.name) setSessionName(d.user.name); });
  }, []);

  useEffect(() => {
    setProperty(null);
    setListings([]);
    setLogs([]);

    setActiveOta(null);
    setEditing(null);
    setMetrics({});
    setMetricEdit({});
    load();
  }, [propertyId]);

  useEffect(() => {
    if (!activeOta || !propertyId || !OTA_METRICS[activeOta]) { setMetrics({}); setMetricEdit({}); return; }
    fetch(`/api/crm/metrics?propertyId=${encodeURIComponent(propertyId)}&ota=${encodeURIComponent(activeOta)}`)
      .then((r) => r.json())
      .then((d) => { setMetrics(d.metrics ?? {}); setMetricEdit(d.metrics ?? {}); });
  }, [activeOta, propertyId]);

  async function saveField(listingId: number, field: string, value: string) {
    if (!editNote.trim()) { setNoteErr(true); return; }
    setNoteErr(false);
    setSaving(true);
    const noteWithDate = actionDate ? `[Date: ${actionDate}] ${editNote.trim()}` : editNote.trim();
    const now = new Date().toISOString();

    const oldListing = listings.find(l => l.id === listingId);
    const oldValue = oldListing ? String((oldListing as unknown as Record<string, unknown>)[field] ?? "") : "";

    await fetch("/api/crm/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otaListingId: listingId, propertyId, field, value, note: noteWithDate }),
    });

    // Build combined log entry (status+subStatus merged into one)
    const newLog: Log = {
      id: Date.now(),
      otaListingId: listingId,
      action: "field_updated",
      field,
      oldValue,
      newValue: value,
      note: noteWithDate,
      createdAt: now,
      userName: sessionName,
      userRole: "",
    };

    // For Agoda status changes: also save the auto-mapped subStatus, merged into same log display
    if (field === "status" && autoSubStatus) {
      await fetch("/api/crm/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otaListingId: listingId, propertyId, field: "subStatus", value: autoSubStatus, note: `Auto-mapped from status: ${value}` }),
      });
      // Add subStatus change to same log entry
      (newLog as Log & { subStatusChange?: { old: string; new: string } }).subStatusChange = {
        old: oldListing?.subStatus ?? "",
        new: autoSubStatus,
      };
      setListings(prev => prev.map(l => l.id === listingId ? { ...l, status: value, subStatus: autoSubStatus, crmUpdatedAt: now } : l));
    } else {
      setListings(prev => prev.map(l => l.id === listingId
        ? { ...l, [field]: value, crmUpdatedAt: now } : l));
    }

    setLogs(prev => [newLog, ...prev]);
    setSaving(false);
    setEditing(null);
    setEditNote("");
    setActionDate("");
    setAutoSubStatus(null);
  }

  async function saveMetric(key: string, value: string, valueKey?: string) {
    if (!activeOta) return;
    await fetch("/api/crm/metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId, ota: activeOta, metricKey: key, metricValue: value, valueKey }),
    });
    setMetrics((p) => ({ ...p, [key]: value }));
    setMetricEdit((p) => ({ ...p, [key]: value }));
  }

  async function addNote(listingId: number) {
    const note = noteInput[listingId]?.trim();
    if (!note) return;
    setSaving(true);
    const now = new Date().toISOString();
    await fetch("/api/crm/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otaListingId: listingId, propertyId, field: "note", value: note }),
    });
    setSaving(false);
    setNoteInput((prev) => ({ ...prev, [listingId]: "" }));
    setLogs(prev => [{ id: Date.now(), otaListingId: listingId, action: "note_added", field: "note", oldValue: "", newValue: note, note, createdAt: now, userName: sessionName, userRole: "" }, ...prev]);
  }

  async function addPropertyNote() {
    const note = propNoteInput.trim();
    if (!note) return;
    setPropNoteSaving(true);
    const now = new Date().toISOString();
    await fetch("/api/crm/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertyId, field: "note", value: note }),
    });
    setPropNoteSaving(false);
    setPropNoteInput("");
    setLogs(prev => [{ id: Date.now(), otaListingId: null as unknown as number, action: "note_added", field: "note", oldValue: "", newValue: note, note, createdAt: now, userName: sessionName, userRole: "" }, ...prev]);
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", color: "#94A3B8", fontSize: 14 }}>Loading…</div>
  );
  if (!property) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
      height: "100vh", color: "#DC2626" }}>Property not found</div>
  );

  const isPropertyView = activeOta === "__property__";
  const activeListing = isPropertyView ? null : (listings.find((l) => l.ota === activeOta) ?? null);
  const otaLogs = isPropertyView
    ? logs
    : activeListing
    ? logs.filter((l) => Number(l.otaListingId) === Number(activeListing.id))
    : [];

  const fhSc = STATUS_COLORS[property.fhStatus?.toLowerCase()] ?? { bg: "#F1F5F9", color: "#64748B", dot: "#9CA3AF" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh",
      background: "#F0F4F8", overflow: "hidden" }}>

      {/* ── Top bar ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2E8F0", height: 52,
        display: "flex", alignItems: "center", padding: "0 20px", gap: 12, flexShrink: 0 }}>
        <Link href="/crm"
          style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12,
            color: "#64748B", textDecoration: "none", whiteSpace: "nowrap",
            padding: "4px 8px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#F8FAFC" }}>
          ← CRM
        </Link>
        <div style={{ width: 1, height: 22, background: "#E2E8F0" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: "#0F172A",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {property.name}
          </span>
          <span style={{ fontSize: 11, color: "#94A3B8", whiteSpace: "nowrap" }}>#{property.id}</span>
          {property.city && (
            <span style={{ fontSize: 11, color: "#94A3B8", whiteSpace: "nowrap" }}>· {property.city}</span>
          )}
          <span style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: fhSc.dot }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: fhSc.color }}>{property.fhStatus || "—"}</span>
          </span>
        </div>
        <span style={{ fontSize: 11, color: "#94A3B8", whiteSpace: "nowrap", flexShrink: 0 }}>
          FH Live: <strong style={{ color: "#475569" }}>{fmtDate(property.fhLiveDate)}</strong>
        </span>
      </div>

      {/* ── OTA tab bar ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2E8F0",
        padding: "0 20px", display: "flex", alignItems: "center", gap: 4,
        flexShrink: 0, overflowX: "auto" }}>

        {/* Property tab */}
        <button onClick={() => setActiveOta("__property__")}
          style={{ padding: "10px 16px", background: "none", border: "none",
            borderBottom: isPropertyView ? "2px solid #0F172A" : "2px solid transparent",
            cursor: "pointer", fontSize: 12, fontWeight: isPropertyView ? 700 : 500,
            color: isPropertyView ? "#0F172A" : "#64748B", whiteSpace: "nowrap" }}>
          Property
        </button>

        {listings.map((l) => {
          const color = OTA_COLORS[l.ota] ?? "#64748B";
          const active = activeOta === l.ota;
          const sc = STATUS_COLORS[l.status?.toLowerCase()] ?? { dot: "#9CA3AF" };
          return (
            <button key={l.ota} onClick={() => setActiveOta(l.ota)}
              style={{ display: "flex", alignItems: "center", gap: 6,
                padding: "10px 16px", background: "none", border: "none",
                borderBottom: active ? `2px solid ${color}` : "2px solid transparent",
                cursor: "pointer", fontSize: 12, fontWeight: active ? 700 : 500,
                color: active ? color : "#64748B", whiteSpace: "nowrap" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%",
                background: (sc as {dot:string}).dot, flexShrink: 0 }} />
              {l.ota}
            </button>
          );
        })}

        {/* Add OTA */}
        {(() => {
          const existing = new Set(listings.map(l => l.ota));
          const missing  = OTAS.filter(o => !existing.has(o));
          if (missing.length === 0) return null;
          return (
            <div style={{ position: "relative", marginLeft: 4 }}>
              <button onClick={() => setAddOtaOpen(o => !o)} disabled={!!addingOta}
                style={{ padding: "6px 12px", borderRadius: 6, border: "1px dashed #CBD5E1",
                  background: "#F8FAFC", color: "#94A3B8", fontSize: 11, fontWeight: 600,
                  cursor: "pointer", whiteSpace: "nowrap" }}>
                {addingOta ? `Adding ${addingOta}…` : "+ Add OTA"}
              </button>
              {addOtaOpen && (
                <>
                  <div onClick={() => setAddOtaOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 49 }} />
                  <div style={{ position: "absolute", top: "110%", left: 0, zIndex: 50,
                    background: "#fff", border: "1px solid #E2E8F0", borderRadius: 10,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.10)", minWidth: 160, padding: "6px 0" }}>
                    {missing.map(ota => (
                      <button key={ota} onClick={() => addOta(ota)}
                        style={{ display: "block", width: "100%", textAlign: "left",
                          padding: "8px 16px", border: "none", background: "none",
                          fontSize: 12, fontWeight: 600, color: OTA_COLORS[ota] ?? "#0F172A",
                          cursor: "pointer" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#F8FAFC")}
                        onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                        {ota}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })()}
      </div>{/* end OTA tab bar */}

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
        <div style={{ display: "flex", gap: 20, alignItems: "flex-start", maxWidth: 1280 }}>

          {/* LEFT: main content */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Active OTA detail */}
          {activeListing && (() => {
            const color = OTA_COLORS[activeListing.ota] ?? "#64748B";
            const isEditing = (field: string) => editing?.id === activeListing.id && editing.field === field;
            const sc = STATUS_COLORS[activeListing.status?.toLowerCase()] ?? { bg: "#F1F5F9", color: "#64748B", dot: "#9CA3AF" };
            return (
              <>
                {/* ── Status hero card ── */}
                <div style={{ background: "#FFF", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>

                  {/* Colored accent bar */}
                  <div style={{ height: 4, background: color }} />

                  {/* Hero section */}
                  <div style={{ padding: "20px 24px", borderBottom: "1px solid #F1F5F9" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 24 }}>

                      {/* Left: OTA label + status + sub-status */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            {activeListing.ota}
                          </span>
                          {activeListing.ota === "Agoda" && (() => {
                            const pp = (activeListing.prePost || "postset").toLowerCase();
                            return (
                              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                                background: pp === "preset" ? "#EFF6FF" : "#F0FDF4",
                                color: pp === "preset" ? "#2563EB" : "#059669",
                                border: `1px solid ${pp === "preset" ? "#BFDBFE" : "#BBF7D0"}` }}>
                                {activeListing.prePost || "postset"}
                              </span>
                            );
                          })()}
                          <span style={{ fontSize: 10, color: "#CBD5E1" }}>·</span>
                          <span style={{ fontSize: 10, color: "#94A3B8" }}>
                            {activeListing.crmUpdatedAt ? `Updated ${relativeTime(activeListing.crmUpdatedAt)}` : "Not yet updated"}
                          </span>
                        </div>

                        {/* Status display / edit */}
                        {isEditing("status") ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 380 }}>
                            <select value={editValue} onChange={(e) => {
                              setEditValue(e.target.value);
                              if (activeListing.ota === "Agoda") setAutoSubStatus(getAgodaSubStatus(e.target.value, activeListing.prePost));
                            }}
                              style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${color}60`, fontSize: 13, fontWeight: 600, background: "#FFF" }}>
                              {getStatusOptions(activeListing.ota).map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                            {activeListing.ota === "Agoda" && autoSubStatus && (
                              <div style={{ display: "flex", alignItems: "center", gap: 6,
                                background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 7, padding: "5px 10px" }}>
                                <span style={{ fontSize: 10, color: "#16A34A", fontWeight: 600 }}>SubStatus →</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: "#059669" }}>{autoSubStatus}</span>
                              </div>
                            )}
                            <input value={editNote} onChange={(e) => { setEditNote(e.target.value); setNoteErr(false); }}
                              placeholder="Reason for change (required)…"
                              style={{ padding: "7px 10px", borderRadius: 8, fontSize: 12,
                                border: `1px solid ${noteErr ? "#FCA5A5" : "#E2E8F0"}`,
                                outline: "none", background: noteErr ? "#FEF2F2" : "#F8FAFC" }} />
                            {noteErr && <span style={{ fontSize: 10, color: "#DC2626" }}>Note is required before saving</span>}
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <label style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", whiteSpace: "nowrap" }}>Action Date</label>
                              <input type="date" value={actionDate} onChange={(e) => setActionDate(e.target.value)}
                                style={{ flex: 1, padding: "6px 8px", borderRadius: 8, fontSize: 12,
                                  border: "1px solid #E2E8F0", outline: "none", background: "#F8FAFC" }} />
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => saveField(activeListing.id, "status", editValue)} disabled={saving}
                                style={{ padding: "7px 16px", borderRadius: 8, border: "none",
                                  background: color, color: "#FFF", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                                {saving ? "Saving…" : "Save"}
                              </button>
                              <button onClick={() => { setEditing(null); setEditNote(""); setNoteErr(false); setActionDate(""); setAutoSubStatus(null); }}
                                style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #E2E8F0",
                                  background: "#FFF", fontSize: 12, cursor: "pointer", color: "#64748B" }}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            {/* Status badge — colored, editable */}
                            <span style={{
                              display: "inline-flex", alignItems: "center", gap: 5,
                              background: sc.bg, color: sc.color,
                              padding: "5px 12px", borderRadius: 20,
                              fontSize: 13, fontWeight: 700, lineHeight: 1,
                            }}>
                              <span style={{ width: 7, height: 7, borderRadius: "50%", background: sc.dot, flexShrink: 0 }} />
                              {activeListing.status || "—"}
                            </span>

                            {/* Sub-status tag — neutral, read-only */}
                            {activeListing.subStatus && (
                              <span style={{
                                display: "inline-flex", alignItems: "center",
                                background: "#F1F5F9", color: "#475569",
                                padding: "5px 12px", borderRadius: 20,
                                fontSize: 12, fontWeight: 600, lineHeight: 1,
                                border: "1px solid #E2E8F0",
                              }}>
                                {activeListing.subStatus}
                              </span>
                            )}

                            {/* Edit status button */}
                            <button onClick={() => {
                              setEditing({ id: activeListing.id, field: "status" });
                              setEditValue(activeListing.status);
                              setEditNote(""); setNoteErr(false);
                              setAutoSubStatus(activeListing.ota === "Agoda"
                                ? getAgodaSubStatus(activeListing.status, activeListing.prePost) : null);
                            }}
                              style={{ fontSize: 11, color: "#94A3B8", background: "none", border: "none",
                                cursor: "pointer", padding: "3px 8px", borderRadius: 6,
                                transition: "background 0.15s" }}
                              onMouseEnter={e => (e.currentTarget.style.background = "#F1F5F9")}
                              onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                              ✎ Edit
                            </button>
                          </div>
                        )}
                      </div>

                    </div>

                  </div>

                  {/* Last updated strip */}
                  <div style={{ padding: "10px 24px", borderTop: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.07em" }}>Last Updated</span>
                    <span style={{ fontSize: 12, color: "#475569" }}>
                      {activeListing.crmUpdatedAt ? relativeTime(activeListing.crmUpdatedAt) : "Never"}
                    </span>
                  </div>
                </div>


              </>
            );
          })()}

          {/* ── Notes ── */}
          {(() => {
            const propertyNotes = logs.filter(l => l.action === "note_added" && !l.otaListingId);
            return (
              <div style={{ background: "#FFF", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
                <div style={{ padding: "10px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: "#7C3AED" }}>✎</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>Notes</span>
                  {propertyNotes.length > 0 && (
                    <span style={{ fontSize: 9, fontWeight: 800, background: "#7C3AED", color: "#fff",
                      borderRadius: 10, padding: "1px 6px" }}>{propertyNotes.length}</span>
                  )}
                </div>
                <div style={{ padding: "12px 16px", borderBottom: propertyNotes.length > 0 ? "1px solid #F1F5F9" : undefined, display: "flex", gap: 8 }}>
                  <textarea
                    value={propNoteInput}
                    onChange={e => setPropNoteInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) addPropertyNote(); }}
                    placeholder="Add a note… (Ctrl+Enter to save)"
                    rows={2}
                    style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid #E2E8F0",
                      fontSize: 11, resize: "none", outline: "none", fontFamily: "inherit",
                      background: "#F8FAFC", color: "#1E293B" }}
                  />
                  <button onClick={addPropertyNote} disabled={propNoteSaving || !propNoteInput.trim()}
                    style={{ alignSelf: "flex-end", padding: "7px 14px", borderRadius: 8, border: "none",
                      background: "#7C3AED", color: "#FFF", fontSize: 11, fontWeight: 700,
                      cursor: propNoteInput.trim() ? "pointer" : "default",
                      opacity: propNoteInput.trim() ? 1 : 0.4, whiteSpace: "nowrap" }}>
                    {propNoteSaving ? "…" : "Add"}
                  </button>
                </div>
                {propertyNotes.length > 0 && (
                  <div style={{ maxHeight: 260, overflowY: "auto" }}>
                    {propertyNotes.map((log) => (
                      <div key={log.id} style={{ padding: "10px 16px", borderBottom: "1px solid #F8FAFC", display: "flex", gap: 8 }}>
                        <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                          background: "#7C3AED18", display: "flex", alignItems: "center",
                          justifyContent: "center", fontSize: 11, color: "#7C3AED" }}>✎</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#1E293B" }}>{log.userName || "System"}</span>
                            <span style={{ fontSize: 10, color: "#94A3B8" }}>{relativeTime(log.createdAt)}</span>
                          </div>
                          <div style={{ fontSize: 11, color: "#374151", lineHeight: 1.5, whiteSpace: "pre-wrap",
                            background: "#F8FAFC", borderRadius: 6, padding: "6px 10px", border: "1px solid #F1F5F9" }}>
                            {log.note}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Activity timeline */}
          <div style={{ background: "#FFF", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A", letterSpacing: "-0.01em" }}>Activity</span>
              <span style={{ fontSize: 10, fontWeight: 500, color: "#94A3B8" }}>{otaLogs.length} entries</span>
            </div>
            <div style={{ maxHeight: 420, overflowY: "auto" }}>
              {otaLogs.length === 0 ? (
                <div style={{ padding: "32px 16px", textAlign: "center", color: "#CBD5E1", fontSize: 12 }}>No activity yet</div>
              ) : otaLogs.map((log, idx) => {
                const isNote = log.action === "note_added";
                const actionColor = isNote ? "#7C3AED" : ACTION_COLORS[log.action] ?? "#64748B";
                type LogWithSub = Log & { subStatusChange?: { old: string; new: string } };
                const lx = log as LogWithSub;
                const dateMatch = log.note?.match(/^\[Date: (\d{4}-\d{2}-\d{2})\]/);
                const noteText  = log.note?.replace(/^\[Date: \d{4}-\d{2}-\d{2}\]\s*/, "") ?? "";
                const fieldLabel = log.field === "status" ? "Status" : log.field === "subStatus" ? "Sub-Status" : log.field;
                const isLast = idx === otaLogs.length - 1;
                return (
                  <div key={log.id} style={{ display: "flex", gap: 12, padding: "12px 16px", position: "relative" }}>
                    {/* Timeline line */}
                    {!isLast && (
                      <div style={{ position: "absolute", left: 27, top: 38, bottom: 0, width: 1, background: "#F1F5F9", zIndex: 0 }} />
                    )}
                    {/* Avatar */}
                    <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0, zIndex: 1,
                      background: actionColor + "15", border: `1.5px solid ${actionColor}40`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 700, color: actionColor, marginTop: 1 }}>
                      {isNote ? "N" : log.action === "assigned" ? "A" : log.action === "metric_updated" ? "M" : "U"}
                    </div>
                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Top row: user + OTA tag + time */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#0F172A" }}>{log.userName || "System"}</span>
                        {isPropertyView && log.otaListingId && (() => {
                          const l = listings.find(x => Number(x.id) === Number(log.otaListingId));
                          if (!l) return null;
                          const c = OTA_COLORS[l.ota] ?? "#64748B";
                          return (
                            <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 6,
                              background: c + "12", color: c, border: `1px solid ${c}25` }}>
                              {l.ota}
                            </span>
                          );
                        })()}
                        <span style={{ fontSize: 10, color: "#94A3B8", marginLeft: "auto" }}>{relativeTime(log.createdAt)}</span>
                      </div>

                      {/* Body */}
                      {isNote ? (
                        <div style={{ fontSize: 11, color: "#374151", lineHeight: 1.55,
                          background: "#FAFBFF", border: "1px solid #EEF2FF",
                          borderRadius: 8, padding: "7px 10px" }}>
                          {log.note}
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: "#64748B", lineHeight: 1.5 }}>
                          <span style={{ fontWeight: 600, color: "#475569" }}>{fieldLabel}</span>
                          {" changed from "}
                          <span style={{ fontWeight: 600, color: "#DC2626", background: "#FEF2F2", padding: "0 4px", borderRadius: 4 }}>
                            {log.oldValue || "—"}
                          </span>
                          {" to "}
                          <span style={{ fontWeight: 600, color: "#059669", background: "#F0FDF4", padding: "0 4px", borderRadius: 4 }}>
                            {log.newValue || "—"}
                          </span>
                          {lx.subStatusChange && (
                            <div style={{ marginTop: 3 }}>
                              <span style={{ fontWeight: 600, color: "#475569" }}>Sub-Status</span>
                              {" changed from "}
                              <span style={{ fontWeight: 600, color: "#DC2626", background: "#FEF2F2", padding: "0 4px", borderRadius: 4 }}>
                                {lx.subStatusChange.old || "—"}
                              </span>
                              {" to "}
                              <span style={{ fontWeight: 600, color: "#059669", background: "#F0FDF4", padding: "0 4px", borderRadius: 4 }}>
                                {lx.subStatusChange.new}
                              </span>
                            </div>
                          )}
                          {(dateMatch || noteText) && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, flexWrap: "wrap" }}>
                              {dateMatch && (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10,
                                  fontWeight: 600, color: "#7C3AED", background: "#F5F3FF",
                                  border: "1px solid #DDD6FE", borderRadius: 6, padding: "1px 7px" }}>
                                  📅 {fmtDate(dateMatch[1])}
                                </span>
                              )}
                              {noteText && (
                                <span style={{ fontSize: 10, color: "#64748B", fontStyle: "italic" }}>{noteText}</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          </div>

          {/* RIGHT: Property info + Tasks */}
          <div style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Property info compact */}
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>Property</span>
                <span style={{ fontSize: 10, color: "#94A3B8" }}>{listings.length} OTAs</span>
              </div>
              <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "ID",       value: property.id },
                  { label: "City",     value: property.city || "—" },
                  { label: "FH Status",value: property.fhStatus || "—" },
                  { label: "FH Live",  value: fmtDate(property.fhLiveDate) },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
                    <span style={{ fontSize: 11, color: "#1E293B", fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
              </div>
              {isPropertyView && (
                <div style={{ borderTop: "1px solid #F1F5F9", padding: "4px 0" }}>
                  {listings.map((l) => {
                    const c = OTA_COLORS[l.ota] ?? "#64748B";
                    const sc = STATUS_COLORS[l.status?.toLowerCase()] ?? { dot: "#9CA3AF", color: "#64748B" };
                    const isActive = activeOta === l.ota;
                    return (
                      <button key={l.ota} onClick={() => setActiveOta(l.ota)}
                        style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
                          width: "100%", padding: "7px 16px", border: "none", textAlign: "left",
                          background: isActive ? c + "08" : "transparent",
                          borderLeft: isActive ? `3px solid ${c}` : "3px solid transparent",
                          cursor: "pointer", gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: c }}>{l.ota}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: (sc as {dot:string}).dot, flexShrink: 0 }} />
                          <span style={{ fontSize: 10, color: (sc as {color:string}).color, fontWeight: 600 }}>{l.status || "—"}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* OTA Details card (OTA ID + Live Date) */}
            {activeListing && (() => {
              const color = OTA_COLORS[activeListing.ota] ?? "#64748B";
              const isEditingOtaId = editing?.id === activeListing.id && editing.field === "otaId";
              const isEditingLink  = editing?.id === activeListing.id && editing.field === "listingLink";
              return (
                <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
                  <div style={{ padding: "10px 16px", borderBottom: "1px solid #F1F5F9" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#0F172A" }}>OTA Details</span>
                  </div>
                  <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                    {/* OTA Live Date */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.04em" }}>OTA Live Date</span>
                      <span style={{ fontSize: 11, color: "#1E293B", fontWeight: 500 }}>{fmtDate(activeListing.liveDate)}</span>
                    </div>
                    {/* TAT */}
                    {(() => {
                      const tat = Number(activeListing.tat);
                      const tatErr = Number(activeListing.tatError);
                      return (
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.04em" }}>TAT</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: tatErr ? "#DC2626" : (tat > 0 ? "#059669" : "#94A3B8") }}>
                            {tat > 0 ? `${tat}d` : "—"}
                            {tatErr > 0 && <span style={{ fontSize: 9, color: "#DC2626", marginLeft: 4 }}>overdue</span>}
                          </span>
                        </div>
                      );
                    })()}
                    {/* Listing Link editable */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isEditingLink ? 6 : 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.04em" }}>Listing Link</span>
                        {!isEditingLink && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {activeListing.listingLink
                              ? <a href={activeListing.listingLink} target="_blank" rel="noreferrer"
                                  style={{ fontSize: 11, color: "#2563EB", textDecoration: "none", padding: "2px 8px", background: "#EFF6FF", borderRadius: 5, border: "1px solid #BFDBFE" }}>Open ↗</a>
                              : <span style={{ fontSize: 11, color: "#CBD5E1" }}>—</span>}
                            <button onClick={() => { setEditing({ id: activeListing.id, field: "listingLink" }); setEditValue(activeListing.listingLink ?? ""); }}
                              style={{ fontSize: 10, color: "#CBD5E1", background: "none", border: "none", cursor: "pointer", padding: "2px 4px", borderRadius: 4 }}
                              onMouseEnter={e => (e.currentTarget.style.color = "#94A3B8")}
                              onMouseLeave={e => (e.currentTarget.style.color = "#CBD5E1")}>✎</button>
                          </div>
                        )}
                      </div>
                      {isEditingLink && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <input value={editValue} onChange={(e) => setEditValue(e.target.value)}
                            placeholder="https://…"
                            style={{ padding: "6px 10px", borderRadius: 7, fontSize: 12, border: "1px solid #CBD5E1", outline: "none" }} />
                          <div style={{ display: "flex", gap: 5 }}>
                            <button onClick={async () => {
                              setSaving(true);
                              await fetch("/api/crm/update-status", { method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ otaListingId: activeListing.id, propertyId, field: "listingLink", value: editValue, note: "Listing link updated" }) });
                              setSaving(false); setEditing(null);
                              setListings(prev => prev.map(l => l.id === activeListing.id ? { ...l, listingLink: editValue } : l));
                            }} disabled={saving}
                              style={{ flex: 1, padding: "5px 10px", borderRadius: 7, border: "none",
                                background: color, color: "#FFF", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                              {saving ? "…" : "Save"}
                            </button>
                            <button onClick={() => setEditing(null)}
                              style={{ padding: "5px 8px", borderRadius: 7, border: "1px solid #E2E8F0",
                                background: "#FFF", fontSize: 11, cursor: "pointer", color: "#64748B" }}>✕</button>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* OTA ID editable */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: isEditingOtaId ? 6 : 0 }}>
                        <span style={{ fontSize: 10, fontWeight: 600, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: "0.04em" }}>OTA ID</span>
                        {!isEditingOtaId && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 11, color: "#1E293B", fontFamily: "monospace", fontWeight: 500 }}>
                              {activeListing.otaId || <span style={{ color: "#CBD5E1" }}>—</span>}
                            </span>
                            <button onClick={() => { setEditing({ id: activeListing.id, field: "otaId" }); setEditValue(activeListing.otaId ?? ""); }}
                              style={{ fontSize: 10, color: "#CBD5E1", background: "none", border: "none", cursor: "pointer", padding: "2px 4px", borderRadius: 4 }}
                              onMouseEnter={e => (e.currentTarget.style.color = "#94A3B8")}
                              onMouseLeave={e => (e.currentTarget.style.color = "#CBD5E1")}>✎</button>
                          </div>
                        )}
                      </div>
                      {isEditingOtaId && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <input value={editValue} onChange={(e) => setEditValue(e.target.value)}
                            placeholder="Enter OTA ID…"
                            style={{ padding: "6px 10px", borderRadius: 7, fontSize: 12,
                              border: "1px solid #CBD5E1", outline: "none", fontFamily: "monospace" }} />
                          <div style={{ display: "flex", gap: 5 }}>
                            <button onClick={async () => {
                              setSaving(true);
                              await fetch("/api/crm/update-status", { method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ otaListingId: activeListing.id, propertyId, field: "otaId", value: editValue, note: "OTA ID updated" }) });
                              setSaving(false); setEditing(null);
                              setListings(prev => prev.map(l => l.id === activeListing.id ? { ...l, otaId: editValue } : l));
                            }} disabled={saving}
                              style={{ flex: 1, padding: "5px 10px", borderRadius: 7, border: "none",
                                background: color, color: "#FFF", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                              {saving ? "…" : "Save"}
                            </button>
                            <button onClick={() => setEditing(null)}
                              style={{ padding: "5px 8px", borderRadius: 7, border: "1px solid #E2E8F0",
                                background: "#FFF", fontSize: 11, cursor: "pointer", color: "#64748B" }}>✕</button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* After-Live Metrics */}
            {activeListing && OTA_METRICS[activeListing.ota] && (() => {
              const color = OTA_COLORS[activeListing.ota] ?? "#64748B";
              const defs = OTA_METRICS[activeListing.ota];
              return (
                <div style={{ background: "#FFF", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
                  <div style={{ padding: "12px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>After-Live Metrics</span>
                    <span style={{ fontSize: 10, color: "#94A3B8" }}>{activeListing.ota}</span>
                  </div>
                  <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                    {defs.map((def) => {
                      // Multi-toggle tile (e.g. Content Boxes)
                      if (def.type === "multi-toggle" && def.items) {
                        const anyDirty = def.items.some((item) => (metricEdit[item.key] ?? metrics[item.key] ?? "") !== (metrics[item.key] ?? ""));
                        const allSavedMT = def.items.every((item) => !!metrics[item.key]);
                        return (
                          <div key={def.key} style={{
                            background: allSavedMT ? `${color}06` : "#F8FAFC",
                            borderRadius: 10,
                            border: `1px solid ${anyDirty ? color + "50" : color + "20"}`,
                            padding: "10px 12px",
                          }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", marginBottom: 10 }}>{def.label}</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {def.items.map((item) => {
                                const draft = metricEdit[item.key] ?? metrics[item.key] ?? "";
                                const saved = metrics[item.key] ?? "";
                                const dirty = draft !== saved;
                                return (
                                  <div key={item.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                    <span style={{ fontSize: 11, color: "#475569", flex: 1 }}>{item.label}</span>
                                    <div style={{ display: "flex", gap: 3 }}>
                                      {["Yes", "No"].map((opt) => (
                                        <button key={opt} onClick={() => setMetricEdit((p) => ({ ...p, [item.key]: opt }))}
                                          style={{ padding: "3px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700, cursor: "pointer",
                                            border: draft === opt ? "none" : "1px solid #E2E8F0",
                                            background: draft === opt ? (opt === "Yes" ? "#D1FAE5" : "#FEE2E2") : "#FFF",
                                            color: draft === opt ? (opt === "Yes" ? "#059669" : "#DC2626") : "#94A3B8" }}>
                                          {opt}
                                        </button>
                                      ))}
                                      {dirty && (
                                        <button onClick={async () => { setSavingMetric(item.key); await saveMetric(item.key, draft, def.key); setSavingMetric(null); }}
                                          disabled={!draft || savingMetric === item.key}
                                          style={{ padding: "3px 8px", borderRadius: 20, border: "none", background: color, color: "#FFF", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                                          {savingMetric === item.key ? "…" : "Save"}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      }

                      const dateFields  = def.dates ?? [{ key: def.key + "_date", label: "Date" }];
                      const savedValue  = metrics[def.key] ?? "";
                      const draftValue  = metricEdit[def.key] ?? savedValue;
                      const isSaving    = savingMetric === def.key;
                      const savedDates  = dateFields.map((df) => metrics[df.key] ?? "");
                      const draftDates  = dateFields.map((df) => metricEdit[df.key] ?? metrics[df.key] ?? "");
                      const valueChanged = draftValue !== savedValue;
                      const datesChanged = draftDates.some((d, i) => d !== savedDates[i]);
                      const isDirty      = valueChanged || datesChanged;
                      const canSave      = !!draftValue && draftDates.every((d) => !!d);
                      const allSaved     = !!savedValue && savedDates.every((d) => !!d);

                      async function commitMetric() {
                        setSavingMetric(def.key);
                        await Promise.all(dateFields.map((df, i) => saveMetric(df.key, draftDates[i], def.key)));
                        await saveMetric(def.key, draftValue, def.key);
                        setSavingMetric(null);
                        fetch(`/api/crm/properties/${propertyId}`)
                          .then((r) => r.json()).then((d) => setLogs(d.logs ?? []));
                      }

                      return (
                        <div key={def.key} style={{
                          background: allSaved ? `${color}06` : "#F8FAFC",
                          borderRadius: 10,
                          border: `1px solid ${isDirty ? color + "50" : color + "20"}`,
                          padding: "10px 12px",
                        }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", marginBottom: 8 }}>{def.label}</div>
                          {def.type === "toggle" && (
                            <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                              {["Yes", "No"].map((opt) => (
                                <button key={opt} onClick={() => setMetricEdit((p) => ({ ...p, [def.key]: opt }))}
                                  style={{ flex: 1, padding: "4px 0", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer",
                                    border: draftValue === opt ? "none" : "1px solid #E2E8F0",
                                    background: draftValue === opt ? (opt === "Yes" ? "#D1FAE5" : "#FEE2E2") : "#FFF",
                                    color: draftValue === opt ? (opt === "Yes" ? "#059669" : "#DC2626") : "#94A3B8" }}>
                                  {opt}
                                </button>
                              ))}
                            </div>
                          )}
                          {def.type === "select" && (
                            <select value={draftValue} onChange={(e) => setMetricEdit((p) => ({ ...p, [def.key]: e.target.value }))}
                              style={{ width: "100%", padding: "5px 8px", borderRadius: 7, marginBottom: 10,
                                border: `1px solid ${color}30`, fontSize: 12, background: "#FFF" }}>
                              {def.options!.map((o) => <option key={o} value={o}>{o}</option>)}
                            </select>
                          )}
                          {def.type === "text" && (
                            <input value={draftValue} onChange={(e) => setMetricEdit((p) => ({ ...p, [def.key]: e.target.value }))}
                              placeholder="e.g. 15"
                              style={{ width: "100%", padding: "5px 8px", borderRadius: 7, marginBottom: 10,
                                border: `1px solid ${color}30`, fontSize: 12, outline: "none", background: "#FFF", boxSizing: "border-box" }} />
                          )}
                          {dateFields.map((df, i) => (
                            <div key={df.key} style={{ marginBottom: 8 }}>
                              <div style={{ fontSize: 9, fontWeight: 600, color: "#94A3B8", marginBottom: 3 }}>{df.label.toUpperCase()}</div>
                              <input type="date" value={draftDates[i]}
                                onChange={(e) => setMetricEdit((p) => ({ ...p, [df.key]: e.target.value }))}
                                style={{ width: "100%", padding: "4px 6px", borderRadius: 7,
                                  border: `1px solid ${color}30`, fontSize: 11, background: "#FFF", boxSizing: "border-box" }} />
                            </div>
                          ))}
                          {isDirty ? (
                            <button onClick={commitMetric} disabled={!canSave || isSaving}
                              style={{ width: "100%", padding: "5px 0", borderRadius: 7, border: "none",
                                background: canSave ? color : "#E2E8F0", color: canSave ? "#FFF" : "#94A3B8",
                                fontSize: 11, fontWeight: 700, cursor: canSave ? "pointer" : "not-allowed",
                                opacity: isSaving ? 0.7 : 1, marginTop: 4 }}>
                              {isSaving ? "Saving…" : canSave ? "Save" : "Fill all fields"}
                            </button>
                          ) : allSaved && (
                            <div style={{ fontSize: 9, color: "#059669", fontWeight: 600, marginTop: 4 }}>✓ Saved</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Tasks panel */}
            <div style={{ background: "#FFF", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>Tasks</span>
                {tasks.filter((t) => t.status === "open").length > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE", borderRadius: 20, padding: "1px 8px" }}>
                    {tasks.filter((t) => t.status === "open").length} open
                  </span>
                )}
                <div style={{ flex: 1 }} />
                <button onClick={() => setShowTaskForm((v) => !v)}
                  style={{ fontSize: 10, fontWeight: 700, padding: "4px 10px", borderRadius: 7,
                    border: "1px solid #E2E8F0", background: showTaskForm ? "#0F172A" : "#F8FAFC",
                    color: showTaskForm ? "#FFF" : "#374151", cursor: "pointer", whiteSpace: "nowrap" }}>
                  {showTaskForm ? "✕ Cancel" : "+ Add Task"}
                </button>
              </div>
              {showTaskForm && (
                <div style={{ padding: "12px 14px", borderBottom: "1px solid #F1F5F9", background: "#F8FAFC", display: "flex", flexDirection: "column", gap: 8 }}>
                  <input placeholder="Task title *" value={newTask.title}
                    onChange={(e) => setNewTask((p) => ({ ...p, title: e.target.value }))}
                    style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid #E2E8F0", fontSize: 12, outline: "none" }} />
                  <textarea placeholder="Description (optional)" value={newTask.description}
                    onChange={(e) => setNewTask((p) => ({ ...p, description: e.target.value }))}
                    rows={2}
                    style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid #E2E8F0", fontSize: 12, outline: "none", resize: "none", fontFamily: "inherit" }} />
                  <select value={newTask.priority} onChange={(e) => setNewTask((p) => ({ ...p, priority: e.target.value }))}
                    style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #E2E8F0", fontSize: 12, background: "#FFF" }}>
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                  <select value={newTask.assignedTo} onChange={(e) => setNewTask((p) => ({ ...p, assignedTo: e.target.value }))}
                    style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #E2E8F0", fontSize: 12, background: "#FFF" }}>
                    <option value="">Unassigned</option>
                    {taskUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                  <input type="date" value={newTask.dueDate} onChange={(e) => setNewTask((p) => ({ ...p, dueDate: e.target.value }))}
                    style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #E2E8F0", fontSize: 12 }} />
                  <button onClick={createTask} disabled={!newTask.title.trim() || savingTask}
                    style={{ padding: "7px 0", borderRadius: 7, border: "none",
                      background: newTask.title.trim() ? "#2563EB" : "#E2E8F0",
                      color: newTask.title.trim() ? "#FFF" : "#94A3B8",
                      fontSize: 12, fontWeight: 700, cursor: newTask.title.trim() ? "pointer" : "not-allowed" }}>
                    {savingTask ? "Creating…" : "Create Task"}
                  </button>
                </div>
              )}
              <div style={{ maxHeight: 440, overflowY: "auto", padding: tasks.length === 0 ? "20px 14px" : "4px 0" }}>
                {tasks.length === 0 ? (
                  <div style={{ textAlign: "center", color: "#94A3B8", fontSize: 12 }}>No tasks yet</div>
                ) : tasks.map((task) => {
                  const priorityColor = task.priority === "high" ? "#DC2626" : task.priority === "medium" ? "#D97706" : "#64748B";
                  const isDone = task.status === "done";
                  return (
                    <div key={task.id} style={{ padding: "9px 14px", borderBottom: "1px solid #F8FAFC", display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <button onClick={() => updateTaskStatus(task.id, isDone ? "open" : "done")}
                        style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, marginTop: 1,
                          border: `2px solid ${isDone ? "#059669" : "#CBD5E1"}`,
                          background: isDone ? "#059669" : "#FFF", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "#FFF", fontSize: 9 }}>
                        {isDone ? "✓" : ""}
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: isDone ? "#94A3B8" : "#1E293B",
                          textDecoration: isDone ? "line-through" : "none", lineHeight: 1.4 }}>
                          {task.title}
                        </div>
                        {task.description && (
                          <div style={{ fontSize: 10, color: "#64748B", marginTop: 2, lineHeight: 1.4 }}>{task.description}</div>
                        )}
                        <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap", alignItems: "center" }}>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 10,
                            background: priorityColor + "18", color: priorityColor }}>
                            {task.priority}
                          </span>
                          {task.assignedName && (
                            <span style={{ fontSize: 10, color: "#475569" }}>→ {task.assignedName}</span>
                          )}
                          {task.dueDate && (
                            <span style={{ fontSize: 9, color: new Date(task.dueDate) < new Date() && !isDone ? "#DC2626" : "#64748B" }}>
                              Due {task.dueDate}
                            </span>
                          )}
                        </div>
                      </div>
                      <button onClick={() => deleteTask(task.id)}
                        style={{ background: "none", border: "none", color: "#CBD5E1", cursor: "pointer", fontSize: 13, padding: "0 2px" }}
                        title="Delete">×</button>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
