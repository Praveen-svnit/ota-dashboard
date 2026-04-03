"use client";

import { useEffect, useMemo, useRef, useState, use } from "react";
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
  const [noteInput,  setNoteInput]  = useState<Record<number, string>>({});
  const [activeOta,  setActiveOta]  = useState<string | null>(null);