"use client";

import { useEffect, useState, use } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { OTA_COLORS } from "@/lib/constants";

const STATUS_OPTIONS = [
  "Live", "Not Live", "Ready to Go Live", "Content in Progress",
  "Listing in Progress", "Pending", "Soldout", "Closed",
];

const SUB_STATUS_OPTIONS = [
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

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  live:                  { bg: "#D1FAE5", color: "#059669" },
  "not live":            { bg: "#FEE2E2", color: "#DC2626" },
  "ready to go live":    { bg: "#FEF9C3", color: "#854D0E" },
  "content in progress": { bg: "#EEF2FF", color: "#4F46E5" },
  "listing in progress": { bg: "#EEF2FF", color: "#4F46E5" },
  pending:               { bg: "#FEF3C7", color: "#D97706" },
  soldout:               { bg: "#F3F4F6", color: "#6B7280" },
};

const ACTION_COLORS: Record<string, string> = {
  field_updated:  "#2563EB",
  note_added:     "#7C3AED",
  assigned:       "#059669",
  metric_updated: "#059669",
};

type MetricType = "toggle" | "select" | "text";
interface DateField { key: string; label: string }
interface MetricDef { key: string; label: string; type: MetricType; options?: string[]; dates?: DateField[] }

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


function statusPill(status: string) {
  const s = STATUS_COLORS[status?.toLowerCase()] ?? { bg: "#F1F5F9", color: "#64748B" };
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
      background: s.bg, color: s.color }}>{status || "—"}</span>
  );
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
  const [noteInput,  setNoteInput]  = useState<Record<number, string>>({});
  const [activeOta,  setActiveOta]  = useState<string | null>(null);

  // Tasks
  interface Task { id: number; title: string; description: string; status: string; priority: string; assignedTo: string | null; assignedName: string | null; createdByName: string | null; dueDate: string | null; createdAt: string; }
  const [tasks,        setTasks]        = useState<Task[]>([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskUsers,    setTaskUsers]    = useState<{ id: string; name: string }[]>([]);
  const [newTask,      setNewTask]      = useState({ title: "", description: "", priority: "medium", assignedTo: "", dueDate: "" });
  const [savingTask,   setSavingTask]   = useState(false);

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
          setActiveOta(preferred ? preferred.ota : d.listings[0].ota);
        }
      })
      .finally(() => setLoading(false));
    fetch(`/api/crm/tasks?propertyId=${encodeURIComponent(propertyId)}`)
      .then((r) => r.json()).then((d) => setTasks(d.tasks ?? []));
    fetch("/api/crm/users/list")
      .then((r) => r.json()).then((d) => setTaskUsers(d.users ?? []));
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
    await fetch(`/api/crm/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status } : t));
  }

  async function deleteTask(taskId: number) {
    await fetch(`/api/crm/tasks/${taskId}`, { method: "DELETE" });
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  }

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

    await fetch("/api/crm/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otaListingId: listingId, propertyId, field, value, note: editNote.trim() }),
    });

    // For Agoda status changes: also save the auto-mapped subStatus silently
    if (field === "status" && autoSubStatus) {
      await fetch("/api/crm/update-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otaListingId: listingId, propertyId, field: "subStatus", value: autoSubStatus, note: `Auto-mapped from status: ${value}` }),
      });
    }

    setSaving(false);
    setEditing(null);
    setEditNote("");
    setAutoSubStatus(null);
    load();
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
    await fetch("/api/crm/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otaListingId: listingId, propertyId, field: "note", value: note }),
    });
    setSaving(false);
    setNoteInput((prev) => ({ ...prev, [listingId]: "" }));
    load();
  }

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 14 }}>Loading…</div>
  );
  if (!property) return (
    <div style={{ padding: 40, textAlign: "center", color: "#DC2626" }}>Property not found</div>
  );

  const activeListing = listings.find((l) => l.ota === activeOta) ?? null;
  const otaLogs = activeListing
    ? logs.filter((l) => Number(l.otaListingId) === Number(activeListing.id))
    : [];

  return (
    <div style={{ padding: "20px 24px", background: "#F8FAFC", minHeight: "100vh" }}>

      {/* Breadcrumb + header */}
      <div style={{ marginBottom: 18 }}>
        <Link href="/crm" style={{ fontSize: 12, color: "#64748B", textDecoration: "none" }}>
          ← CRM
        </Link>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginTop: 8 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>{property.name}</div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
              <span style={{ fontSize: 12, color: "#64748B" }}>#{property.id}</span>
              {property.city && <span style={{ fontSize: 12, color: "#64748B" }}>· {property.city}</span>}
              {statusPill(property.fhStatus)}
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#94A3B8" }}>
            FH Live: {property.fhLiveDate || "—"}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>

        {/* LEFT: OTA tabs + detail + activity log */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* OTA + GMB Tab bar */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            {listings.map((l) => {
              const color = OTA_COLORS[l.ota] ?? "#64748B";
              const active = activeOta === l.ota;
              return (
                <button key={l.ota} onClick={() => setActiveOta(l.ota)}
                  style={{
                    padding: "6px 14px", borderRadius: 20, border: active ? `2px solid ${color}` : "1px solid #E2E8F0",
                    background: active ? color + "18" : "#FFF",
                    color: active ? color : "#64748B",
                    fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer",
                  }}>
                  {l.ota}
                </button>
              );
            })}
          </div>

          {/* Active OTA detail card */}
          {activeListing && (() => {
            const color = OTA_COLORS[activeListing.ota] ?? "#64748B";
            const isEditing = (field: string) => editing?.id === activeListing.id && editing.field === field;
            return (
              <div style={{ background: "#FFF", borderRadius: 12, border: `1px solid ${color}30`,
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>

                {/* Card header */}
                <div style={{ background: `linear-gradient(135deg, ${color}12, ${color}06)`,
                  borderBottom: `1px solid ${color}20`, padding: "12px 18px",
                  display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color }}>{activeListing.ota}</span>
                  {activeListing.otaId && (
                    <span style={{ fontSize: 10, color: "#94A3B8" }}>OTA ID: {activeListing.otaId}</span>
                  )}
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
                  <div style={{ marginLeft: "auto", fontSize: 10, color: "#94A3B8" }}>
                    {activeListing.crmUpdatedAt
                      ? `Updated ${relativeTime(activeListing.crmUpdatedAt)}`
                      : "Not yet updated in CRM"}
                  </div>
                </div>

                <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>

                  {/* Status row */}
                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>

                    {/* Status */}
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", marginBottom: 6 }}>STATUS</div>
                      {isEditing("status") ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 280 }}>
                          <select value={editValue} onChange={(e) => {
                            setEditValue(e.target.value);
                            if (activeListing.ota === "Agoda") {
                              setAutoSubStatus(getAgodaSubStatus(e.target.value, activeListing.prePost));
                            }
                          }}
                            style={{ padding: "6px 8px", borderRadius: 7, border: "1px solid #CBD5E1", fontSize: 12 }}>
                            {(activeListing.ota === "Agoda" ? AGODA_STATUS_OPTIONS : STATUS_OPTIONS).map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                          {activeListing.ota === "Agoda" && autoSubStatus && (
                            <div style={{ display: "flex", alignItems: "center", gap: 6,
                              background: "#F0FDF4", border: "1px solid #BBF7D0",
                              borderRadius: 7, padding: "5px 10px" }}>
                              <span style={{ fontSize: 10, color: "#16A34A", fontWeight: 600 }}>
                                SubStatus will be set →
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: "#059669" }}>
                                {autoSubStatus}
                              </span>
                              <span style={{ fontSize: 9, color: "#86EFAC", marginLeft: "auto" }}>
                                {activeListing.prePost || "postset"}
                              </span>
                            </div>
                          )}
                          <input
                            value={editNote}
                            onChange={(e) => { setEditNote(e.target.value); setNoteErr(false); }}
                            placeholder="Reason for change (required)…"
                            style={{ padding: "6px 10px", borderRadius: 7, fontSize: 12,
                              border: `1px solid ${noteErr ? "#FCA5A5" : "#CBD5E1"}`,
                              outline: "none", background: noteErr ? "#FEF2F2" : "#FFF" }}
                          />
                          {noteErr && <span style={{ fontSize: 10, color: "#DC2626" }}>Note is required before saving</span>}
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => saveField(activeListing.id, "status", editValue)} disabled={saving}
                              style={{ flex: 1, padding: "6px 12px", borderRadius: 7, border: "none",
                                background: color, color: "#FFF", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                              {saving ? "Saving…" : "Save"}
                            </button>
                            <button onClick={() => { setEditing(null); setEditNote(""); setNoteErr(false); setAutoSubStatus(null); }}
                              style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #E2E8F0",
                                background: "#FFF", fontSize: 11, cursor: "pointer" }}>
                              ✕
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {statusPill(activeListing.status)}
                          <button onClick={() => {
                            setEditing({ id: activeListing.id, field: "status" });
                            setEditValue(activeListing.status);
                            setEditNote("");
                            setNoteErr(false);
                            if (activeListing.ota === "Agoda") {
                              setAutoSubStatus(getAgodaSubStatus(activeListing.status, activeListing.prePost));
                            } else {
                              setAutoSubStatus(null);
                            }
                          }}
                            style={{ fontSize: 10, color: "#94A3B8", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                            ✎
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Sub-Status */}
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", marginBottom: 6 }}>SUB-STATUS</div>
                      {activeListing.ota === "Agoda" ? (
                        <span style={{ fontSize: 12, color: "#475569" }}>{activeListing.subStatus || "—"}</span>
                      ) : isEditing("subStatus") ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 260 }}>
                          <select value={editValue} onChange={(e) => setEditValue(e.target.value)}
                            style={{ padding: "6px 8px", borderRadius: 7, border: "1px solid #CBD5E1", fontSize: 12 }}>
                            <option value="">—</option>
                            {SUB_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <input
                            value={editNote}
                            onChange={(e) => { setEditNote(e.target.value); setNoteErr(false); }}
                            placeholder="Reason for change (required)…"
                            style={{ padding: "6px 10px", borderRadius: 7, fontSize: 12,
                              border: `1px solid ${noteErr ? "#FCA5A5" : "#CBD5E1"}`,
                              outline: "none", background: noteErr ? "#FEF2F2" : "#FFF" }}
                          />
                          {noteErr && <span style={{ fontSize: 10, color: "#DC2626" }}>Note is required before saving</span>}
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => saveField(activeListing.id, "subStatus", editValue)} disabled={saving}
                              style={{ flex: 1, padding: "6px 12px", borderRadius: 7, border: "none",
                                background: color, color: "#FFF", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                              {saving ? "Saving…" : "Save"}
                            </button>
                            <button onClick={() => { setEditing(null); setEditNote(""); setNoteErr(false); }}
                              style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #E2E8F0",
                                background: "#FFF", fontSize: 11, cursor: "pointer" }}>
                              ✕
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: "#475569" }}>{activeListing.subStatus || "—"}</span>
                          <button onClick={() => { setEditing({ id: activeListing.id, field: "subStatus" }); setEditValue(activeListing.subStatus ?? ""); setEditNote(""); setNoteErr(false); }}
                            style={{ fontSize: 10, color: "#94A3B8", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                            ✎
                          </button>
                        </div>
                      )}
                    </div>

                    {/* FH Live Date */}
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", marginBottom: 6 }}>FH LIVE DATE</div>
                      <span style={{ fontSize: 12, color: "#475569" }}>{activeListing.liveDate || "—"}</span>
                    </div>

                    {/* TAT */}
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", marginBottom: 6 }}>TAT</div>
                      <span style={{ fontSize: 12, color: activeListing.tatError ? "#DC2626" : "#059669", fontWeight: 600 }}>
                        {activeListing.tat > 0 ? `${activeListing.tat}d` : "—"}
                        {activeListing.tatError === 1 && " (over)"}
                      </span>
                    </div>

                    {/* Listing Link */}
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", marginBottom: 6 }}>LISTING LINK</div>
                      {isEditing("listingLink") ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 260 }}>
                          <input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            placeholder="https://…"
                            style={{ padding: "6px 10px", borderRadius: 7, fontSize: 12,
                              border: "1px solid #CBD5E1", outline: "none" }}
                          />
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={async () => {
                              setSaving(true);
                              await fetch("/api/crm/update-status", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ otaListingId: activeListing.id, propertyId, field: "listingLink", value: editValue, note: "Listing link updated" }),
                              });
                              setSaving(false);
                              setEditing(null);
                              load();
                            }} disabled={saving}
                              style={{ flex: 1, padding: "6px 12px", borderRadius: 7, border: "none",
                                background: color, color: "#FFF", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                              {saving ? "Saving…" : "Save"}
                            </button>
                            <button onClick={() => { setEditing(null); setEditNote(""); setNoteErr(false); }}
                              style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid #E2E8F0",
                                background: "#FFF", fontSize: 11, cursor: "pointer" }}>
                              ✕
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {activeListing.listingLink ? (
                            <a href={activeListing.listingLink} target="_blank" rel="noreferrer"
                              style={{ fontSize: 12, color: "#2563EB", textDecoration: "none",
                                padding: "3px 10px", background: "#EFF6FF", borderRadius: 6,
                                border: "1px solid #BFDBFE" }}>
                              Open ↗
                            </a>
                          ) : (
                            <span style={{ fontSize: 12, color: "#CBD5E1" }}>—</span>
                          )}
                          <button onClick={() => { setEditing({ id: activeListing.id, field: "listingLink" }); setEditValue(activeListing.listingLink ?? ""); setEditNote(""); setNoteErr(false); }}
                            style={{ fontSize: 10, color: "#94A3B8", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                            ✎
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Current note */}
                  {activeListing.crmNote && (
                    <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 14px" }}>
                      <div style={{ fontSize: 10, fontWeight: 600, color: "#92400E", marginBottom: 4 }}>LATEST NOTE</div>
                      <div style={{ fontSize: 12, color: "#1E293B", lineHeight: 1.5 }}>{activeListing.crmNote}</div>
                    </div>
                  )}

                  {/* After-Live Metrics */}
                  {OTA_METRICS[activeListing.ota] && (() => {
                    const defs = OTA_METRICS[activeListing.ota];
                    return (
                      <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 14 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase",
                          letterSpacing: "0.08em", marginBottom: 12 }}>
                          After-Live Metrics
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12 }}>
                          {defs.map((def) => {
                            // Resolve date fields: named ones if defined, else generic {key}_date
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
                              // Save date keys first (pass valueKey so API knows companion for log check)
                              await Promise.all(
                                dateFields.map((df, i) => saveMetric(df.key, draftDates[i], def.key))
                              );
                              // Save value key last — API writes log at this point
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
                                <div style={{ fontSize: 10, fontWeight: 700, color: "#475569", marginBottom: 8 }}>
                                  {def.label}
                                </div>

                                {/* Value */}
                                {def.type === "toggle" && (
                                  <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                                    {["Yes", "No"].map((opt) => (
                                      <button key={opt}
                                        onClick={() => setMetricEdit((p) => ({ ...p, [def.key]: opt }))}
                                        style={{
                                          flex: 1, padding: "4px 0", borderRadius: 20,
                                          fontSize: 11, fontWeight: 700, cursor: "pointer",
                                          border: draftValue === opt ? "none" : "1px solid #E2E8F0",
                                          background: draftValue === opt
                                            ? (opt === "Yes" ? "#D1FAE5" : "#FEE2E2")
                                            : "#FFF",
                                          color: draftValue === opt
                                            ? (opt === "Yes" ? "#059669" : "#DC2626")
                                            : "#94A3B8",
                                        }}>
                                        {opt}
                                      </button>
                                    ))}
                                  </div>
                                )}

                                {def.type === "select" && (
                                  <select value={draftValue}
                                    onChange={(e) => setMetricEdit((p) => ({ ...p, [def.key]: e.target.value }))}
                                    style={{
                                      width: "100%", padding: "5px 8px", borderRadius: 7, marginBottom: 10,
                                      border: `1px solid ${color}30`, fontSize: 12, background: "#FFF",
                                    }}>
                                    {def.options!.map((o) => <option key={o} value={o}>{o}</option>)}
                                  </select>
                                )}

                                {def.type === "text" && (
                                  <input value={draftValue}
                                    onChange={(e) => setMetricEdit((p) => ({ ...p, [def.key]: e.target.value }))}
                                    placeholder="e.g. 15"
                                    style={{
                                      width: "100%", padding: "5px 8px", borderRadius: 7, marginBottom: 10,
                                      border: `1px solid ${color}30`, fontSize: 12,
                                      outline: "none", background: "#FFF", boxSizing: "border-box",
                                    }}
                                  />
                                )}

                                {/* Date fields */}
                                {dateFields.map((df, i) => (
                                  <div key={df.key} style={{ marginBottom: 8 }}>
                                    <div style={{ fontSize: 9, fontWeight: 600, color: "#94A3B8", marginBottom: 3 }}>
                                      {df.label.toUpperCase()}
                                    </div>
                                    <input type="date" value={draftDates[i]}
                                      onChange={(e) => {
                                        const val = e.target.value;
                                        setMetricEdit((p) => ({ ...p, [df.key]: val }));
                                      }}
                                      style={{
                                        width: "100%", padding: "4px 6px", borderRadius: 7,
                                        border: `1px solid ${color}30`, fontSize: 11,
                                        background: "#FFF", boxSizing: "border-box",
                                      }}
                                    />
                                  </div>
                                ))}

                                {/* Save button */}
                                {isDirty ? (
                                  <button onClick={commitMetric} disabled={!canSave || isSaving}
                                    style={{
                                      width: "100%", padding: "5px 0", borderRadius: 7, border: "none",
                                      background: canSave ? color : "#E2E8F0",
                                      color: canSave ? "#FFF" : "#94A3B8",
                                      fontSize: 11, fontWeight: 700,
                                      cursor: canSave ? "pointer" : "not-allowed",
                                      opacity: isSaving ? 0.7 : 1, marginTop: 4,
                                    }}>
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

                  {/* Add note */}
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", marginBottom: 6 }}>ADD NOTE</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        value={noteInput[activeListing.id] ?? ""}
                        onChange={(e) => setNoteInput((p) => ({ ...p, [activeListing.id]: e.target.value }))}
                        placeholder="Type a note or update…"
                        onKeyDown={(e) => e.key === "Enter" && addNote(activeListing.id)}
                        style={{ flex: 1, padding: "8px 12px", borderRadius: 8,
                          border: "1px solid #CBD5E1", fontSize: 12, outline: "none" }}
                      />
                      <button onClick={() => addNote(activeListing.id)} disabled={saving || !(noteInput[activeListing.id]?.trim())}
                        style={{ padding: "8px 16px", borderRadius: 8, border: "none",
                          background: color, color: "#FFF", fontSize: 12, fontWeight: 700,
                          cursor: "pointer", opacity: !(noteInput[activeListing.id]?.trim()) ? 0.5 : 1 }}>
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Tasks Panel */}
          <div style={{ marginTop: 16, background: "#FFF", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Tasks</span>
                {tasks.filter((t) => t.status === "open").length > 0 && (
                  <span style={{ fontSize: 10, fontWeight: 700, background: "#EFF6FF", color: "#2563EB", border: "1px solid #BFDBFE", borderRadius: 20, padding: "1px 8px" }}>
                    {tasks.filter((t) => t.status === "open").length} open
                  </span>
                )}
              </div>
              <button onClick={() => setShowTaskForm((v) => !v)} style={{ fontSize: 11, fontWeight: 700, padding: "5px 12px", borderRadius: 8, border: "1px solid #E2E8F0", background: showTaskForm ? "#0F172A" : "#F8FAFC", color: showTaskForm ? "#FFF" : "#374151", cursor: "pointer" }}>
                {showTaskForm ? "Cancel" : "+ Add Task"}
              </button>
            </div>

            {/* New task form */}
            {showTaskForm && (
              <div style={{ padding: "14px 16px", borderBottom: "1px solid #F1F5F9", background: "#F8FAFC", display: "flex", flexDirection: "column", gap: 10 }}>
                <input
                  placeholder="Task title *"
                  value={newTask.title}
                  onChange={(e) => setNewTask((p) => ({ ...p, title: e.target.value }))}
                  style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12, outline: "none" }}
                />
                <textarea
                  placeholder="Description (optional)"
                  value={newTask.description}
                  onChange={(e) => setNewTask((p) => ({ ...p, description: e.target.value }))}
                  rows={2}
                  style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12, outline: "none", resize: "none", fontFamily: "inherit" }}
                />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <select value={newTask.priority} onChange={(e) => setNewTask((p) => ({ ...p, priority: e.target.value }))}
                    style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12, background: "#FFF" }}>
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                  <select value={newTask.assignedTo} onChange={(e) => setNewTask((p) => ({ ...p, assignedTo: e.target.value }))}
                    style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12, background: "#FFF" }}>
                    <option value="">Unassigned</option>
                    {taskUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                  <input type="date" value={newTask.dueDate} onChange={(e) => setNewTask((p) => ({ ...p, dueDate: e.target.value }))}
                    style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12 }} />
                </div>
                <button onClick={createTask} disabled={!newTask.title.trim() || savingTask}
                  style={{ padding: "8px 0", borderRadius: 8, border: "none", background: newTask.title.trim() ? "#2563EB" : "#E2E8F0", color: newTask.title.trim() ? "#FFF" : "#94A3B8", fontSize: 12, fontWeight: 700, cursor: newTask.title.trim() ? "pointer" : "not-allowed" }}>
                  {savingTask ? "Creating…" : "Create Task"}
                </button>
              </div>
            )}

            {/* Task list */}
            <div style={{ padding: tasks.length === 0 ? "24px 16px" : "6px 0" }}>
              {tasks.length === 0 ? (
                <div style={{ textAlign: "center", color: "#94A3B8", fontSize: 12 }}>No tasks yet</div>
              ) : tasks.map((task) => {
                const priorityColor = task.priority === "high" ? "#DC2626" : task.priority === "medium" ? "#D97706" : "#64748B";
                const isDone = task.status === "done";
                return (
                  <div key={task.id} style={{ padding: "10px 16px", borderBottom: "1px solid #F8FAFC", display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <button onClick={() => updateTaskStatus(task.id, isDone ? "open" : "done")}
                      style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1, border: `2px solid ${isDone ? "#059669" : "#CBD5E1"}`, background: isDone ? "#059669" : "#FFF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#FFF", fontSize: 10 }}>
                      {isDone ? "✓" : ""}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: isDone ? "#94A3B8" : "#1E293B", textDecoration: isDone ? "line-through" : "none", lineHeight: 1.4 }}>
                        {task.title}
                      </div>
                      {task.description && (
                        <div style={{ fontSize: 11, color: "#64748B", marginTop: 2, lineHeight: 1.4 }}>{task.description}</div>
                      )}
                      <div style={{ display: "flex", gap: 8, marginTop: 5, flexWrap: "wrap", alignItems: "center" }}>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 10, background: priorityColor + "18", color: priorityColor }}>
                          {task.priority}
                        </span>
                        {task.assignedName && (
                          <span style={{ fontSize: 10, color: "#475569" }}>→ {task.assignedName}</span>
                        )}
                        {task.dueDate && (
                          <span style={{ fontSize: 10, color: new Date(task.dueDate) < new Date() && !isDone ? "#DC2626" : "#64748B" }}>
                            Due {task.dueDate}
                          </span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => deleteTask(task.id)}
                      style={{ background: "none", border: "none", color: "#CBD5E1", cursor: "pointer", fontSize: 14, padding: "0 2px", lineHeight: 1 }}
                      title="Delete task">×</button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Activity Log — below OTA card */}
          <div style={{ marginTop: 16, background: "#FFF", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #F1F5F9",
              display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Activity Log</span>
              <span style={{ fontSize: 10, color: "#94A3B8" }}>
                {activeListing ? activeListing.ota : "All"} · {otaLogs.length} entries
              </span>
            </div>
            <div style={{ padding: "8px 0" }}>
              {otaLogs.length === 0 ? (
                <div style={{ padding: "24px 16px", textAlign: "center", color: "#94A3B8", fontSize: 12 }}>
                  No activity yet
                </div>
              ) : otaLogs.map((log) => (
                <div key={log.id} style={{ padding: "10px 16px", borderBottom: "1px solid #F8FAFC" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                      background: (ACTION_COLORS[log.action] ?? "#64748B") + "18",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, color: ACTION_COLORS[log.action] ?? "#64748B",
                    }}>
                      {log.action === "note_added" ? "✎" : log.action === "assigned" ? "◎" : "↻"}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#1E293B" }}>
                          {log.userName || "System"}
                        </span>
                        <span style={{ fontSize: 10, color: "#94A3B8" }}>{relativeTime(log.createdAt)}</span>
                      </div>
                      {log.action === "note_added" ? (
                        <div style={{ fontSize: 11, color: "#475569", marginTop: 2, lineHeight: 1.4 }}>{log.note}</div>
                      ) : log.action === "metric_updated" ? (
                        <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 10,
                            background: "#D1FAE5", color: "#059669", marginRight: 5 }}>METRIC</span>
                          <strong>{log.field}</strong>:{" "}
                          <span style={{ color: "#DC2626" }}>{log.oldValue || "—"}</span>
                          {" → "}
                          <span style={{ color: "#059669" }}>{log.newValue || "—"}</span>
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                          Changed <strong>{log.field}</strong>:{" "}
                          <span style={{ color: "#DC2626" }}>{log.oldValue || "—"}</span>
                          {" → "}
                          <span style={{ color: "#059669" }}>{log.newValue || "—"}</span>
                        </div>
                      )}
                      {log.note && log.action !== "note_added" && (
                        <div style={{ fontSize: 10, color: "#6366F1", marginTop: 3, fontStyle: "italic" }}>"{log.note}"</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT: Property details sidebar */}
        <div style={{ width: 260, flexShrink: 0 }}>
          <div style={{ background: "#FFF", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #F1F5F9" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#0F172A" }}>Property Details</span>
            </div>
            <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { label: "Property ID", value: property.id },
                { label: "City", value: property.city || "—" },
                { label: "FH Status", value: property.fhStatus || "—" },
                { label: "FH Live Date", value: property.fhLiveDate || "—" },
                { label: "OTAs Listed", value: String(listings.length) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 12, color: "#1E293B", fontWeight: 500 }}>{value}</div>
                </div>
              ))}

              {/* OTA status overview */}
              <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 12 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>OTA Overview</div>
                {listings.map((l) => {
                  const c = OTA_COLORS[l.ota] ?? "#64748B";
                  const sc = STATUS_COLORS[l.status?.toLowerCase()] ?? { bg: "#F1F5F9", color: "#64748B" };
                  return (
                    <div key={l.ota} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                      marginBottom: 6, padding: "4px 0", borderBottom: "1px solid #F8FAFC" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: c }}>{l.ota}</span>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                        background: sc.bg, color: sc.color }}>{l.status || "—"}</span>
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
