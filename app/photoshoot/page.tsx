"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";

// ── Constants ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 100;

const OTA_FIELDS: { key: string; label: string }[] = [
  { key: "ota_gommt",      label: "GoMMT"      },
  { key: "ota_booking",    label: "Booking.com" },
  { key: "ota_agoda",      label: "Agoda"       },
  { key: "ota_expedia",    label: "Expedia"     },
  { key: "ota_cleartrip",  label: "Cleartrip"  },
  { key: "ota_yatra",      label: "Yatra"       },
  { key: "ota_ixigo",      label: "Ixigo"       },
  { key: "ota_akbar",      label: "Akbar"       },
  { key: "ota_easemytrip", label: "EaseMyTrip" },
  { key: "ota_indigo",     label: "Indigo"      },
  { key: "ota_gmb",        label: "GMB"         },
];

const AI_FIELDS: { key: string; label: string }[] = [
  { key: "ai_gommt",      label: "GoMMT"      },
  { key: "ai_booking",    label: "Booking.com" },
  { key: "ai_agoda",      label: "Agoda"       },
  { key: "ai_expedia",    label: "Expedia"     },
  { key: "ai_cleartrip",  label: "Cleartrip"  },
  { key: "ai_yatra",      label: "Yatra"       },
  { key: "ai_ixigo",      label: "Ixigo"       },
  { key: "ai_akbar",      label: "Akbar"       },
  { key: "ai_easemytrip", label: "EaseMyTrip" },
  { key: "ai_indigo",     label: "Indigo"      },
  { key: "ai_gmb",        label: "GMB"         },
];

const FIELD_TO_OTA: Record<string, string> = {
  ota_gommt: "GoMMT", ota_booking: "Booking.com", ota_agoda: "Agoda",
  ota_expedia: "Expedia", ota_cleartrip: "Cleartrip", ota_yatra: "Yatra",
  ota_ixigo: "Ixigo", ota_akbar: "Akbar", ota_easemytrip: "EaseMyTrip",
  ota_indigo: "Indigo", ota_gmb: "GMB",
};

const OTA_PHOTO_OPTS = ["Pending", "Updated", "Photoshoot Exception"] as const;
const AI_IMG_OPTS    = ["Pending", "Updated"] as const;
const AI_EDIT_OPTS   = ["No", "Yes"] as const;

const BULK_FIELD_OPTS: { key: string; label: string; group: string; opts: string[] | null }[] = [
  { key: "photoshoot_status", label: "Photoshoot Status", group: "General",        opts: ["Shoot Done","Shoot Pending"] },
  ...OTA_FIELDS.map(f => ({ key: f.key, label: f.label, group: "Photoshoot OTA", opts: [...OTA_PHOTO_OPTS] })),
  { key: "ai_editing_done",   label: "AI Editing Done",   group: "AI Editing",     opts: [...AI_EDIT_OPTS] },
  ...AI_FIELDS.map(f  => ({ key: f.key, label: f.label, group: "AI Image OTA",   opts: [...AI_IMG_OPTS] })),
];

const STATUSES = ["Shoot Done", "Shoot Pending"];


const STATUS_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  "Shoot Done":    { bg: "#DCFCE7", text: "#16A34A", border: "#86EFAC" },
  "Shoot Pending": { bg: "#FEF3C7", text: "#D97706", border: "#FDE68A" },
};
const FH_STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  "Live":    { bg: "#DCFCE7", text: "#16A34A" },
  "SoldOut": { bg: "#FEE2E2", text: "#DC2626" },
};
const UPDATED_STYLE   = { bg: "#DCFCE7", text: "#16A34A", border: "#86EFAC" };
const PENDING_STYLE   = { bg: "#F1F5F9", text: "#64748B", border: "#E2E8F0" };
const EXCEPTION_STYLE = { bg: "#FEE2E2", text: "#DC2626", border: "#FECACA" };
const YES_STYLE       = { bg: "#DCFCE7", text: "#16A34A", border: "#86EFAC" };
const NO_STYLE        = { bg: "#F1F5F9", text: "#64748B", border: "#E2E8F0" };

const TH_BASE: React.CSSProperties = {
  padding: "8px 10px", textAlign: "left", fontSize: 10, fontWeight: 700,
  color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em",
  whiteSpace: "nowrap", borderRight: "1px solid #E2E8F0",
};

// Frozen column widths (must match sticky left offsets)
const COL_ID_W   = 88;
const COL_NAME_W = 155;

// ── Types ──────────────────────────────────────────────────────────────────────

interface PhotoRow {
  property_id:       string;
  property_name:     string;
  city:              string;
  fh_status:         string;
  fh_live_date:      string | null;
  photoshoot_status: string;
  shoot_date:        string | null;
  remarks:           string | null;
  shoot_link:        string | null;
  shoot_source:      string | null;
  ai_editing_done:   string;
  updated_by:        string | null;
  updated_at:        string | null;
  live_dates:        Record<string, string> | null;
  ota_ids:           Record<string, string> | null;
  [k: string]: string | null | Record<string, string>;
}

type MainTab = "table" | "ota" | "tat" | "dod" | "perf";

// ── OtaDropdown ── module-level so React never re-mounts it ───────────────────

const OTA_NOT_LIVE_STYLE = { bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA" };

interface DropdownProps {
  propertyId: string;
  field:      string;
  value:      string;
  opts:       readonly string[];
  saving:     boolean;
  isLive?:    boolean;  // undefined = not an OTA-gated field (AI editing)
  onSave:     (id: string, field: string, val: string) => void;
}

const OtaDropdown = React.memo(function OtaDropdown({ propertyId, field, value, opts, saving, isLive, onSave }: DropdownProps) {
  // When OTA is not live yet and upload isn't already done, show a read-only badge
  if (isLive === false && value !== "Updated" && value !== "Photoshoot Exception") {
    return (
      <span style={{ padding: "3px 7px", borderRadius: 6, border: `1.5px solid ${OTA_NOT_LIVE_STYLE.border}`, background: OTA_NOT_LIVE_STYLE.bg, color: OTA_NOT_LIVE_STYLE.text, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap", display: "inline-block" }}>
        OTA Not Live
      </span>
    );
  }

  const style = value === "Updated"             ? UPDATED_STYLE
    : value === "Photoshoot Exception"          ? EXCEPTION_STYLE
    : value === "Yes"                           ? YES_STYLE
    : opts[0] === "No"                          ? NO_STYLE
    : PENDING_STYLE;

  return (
    <select value={value} onChange={e => onSave(propertyId, field, e.target.value)} disabled={saving}
      style={{ padding: "3px 6px", borderRadius: 6, border: `1.5px solid ${style.border}`, background: style.bg, color: style.text, fontSize: 10, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", outline: "none", opacity: saving ? 0.5 : 1 }}>
      {opts.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
});

// ── TableRow ── module-level for stable identity ───────────────────────────────

interface RowProps {
  row: PhotoRow; rowIndex: number;
  editCell: { id: string; field: string } | null;
  setEditCell: (v: { id: string; field: string } | null) => void;
  savingKeys: Record<string, boolean>;
  onSave: (id: string, field: string, val: string) => void;
}

const TableRow = React.memo(function TableRow({ row, rowIndex, editCell, setEditCell, savingKeys, onSave }: RowProps) {
  const ss        = STATUS_STYLE[row.photoshoot_status] ?? STATUS_STYLE["Shoot Pending"];
  const fs        = FH_STATUS_STYLE[row.fh_status] ?? { bg: "#F1F5F9", text: "#64748B" };
  const even      = rowIndex % 2 === 0;
  const base      = even ? "#fff" : "#FAFAFA";
  const td: React.CSSProperties = { padding: "6px 10px", background: base, borderRight: "1px solid #F1F5F9", borderBottom: "1px solid #F1F5F9" };
  const sv        = (f: string) => !!savingKeys[`${row.property_id}:${f}`];
  const liveDates = row.live_dates as Record<string, string> | null;
  const otaIds    = row.ota_ids    as Record<string, string> | null;
  const otaIsLive = (otaLabel: string) => !!(liveDates?.[otaLabel]);

  const stickyTd = (left: number, extra?: React.CSSProperties): React.CSSProperties => ({
    ...td, position: "sticky", left, zIndex: 1, boxShadow: "2px 0 4px -2px rgba(0,0,0,0.08)", ...extra,
  });

  return (
    <tr>
      <td style={stickyTd(0, { fontWeight: 700, color: "#374151", whiteSpace: "nowrap", width: COL_ID_W, minWidth: COL_ID_W })}>{row.property_id}</td>
      <td style={stickyTd(COL_ID_W, { color: "#475569", width: COL_NAME_W, minWidth: COL_NAME_W, maxWidth: COL_NAME_W, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" })} title={row.property_name}>{row.property_name}</td>
      <td style={{ ...td, color: "#475569", whiteSpace: "nowrap" }}>{row.city}</td>
      <td style={td}><span style={{ fontSize: 10, fontWeight: 700, background: fs.bg, color: fs.text, borderRadius: 6, padding: "2px 7px", whiteSpace: "nowrap" }}>{row.fh_status}</span></td>
      <td style={{ ...td, color: "#64748B", whiteSpace: "nowrap" }}>{row.fh_live_date ? new Date(row.fh_live_date).toLocaleDateString("en-IN") : "—"}</td>

      {/* Photoshoot Status */}
      <td style={td}>
        <select value={row.photoshoot_status} onChange={e => onSave(row.property_id, "photoshoot_status", e.target.value)} disabled={sv("photoshoot_status")}
          style={{ padding: "3px 7px", borderRadius: 6, border: `1.5px solid ${ss.border}`, background: ss.bg, color: ss.text, fontSize: 10, fontWeight: 700, cursor: "pointer", outline: "none", opacity: sv("photoshoot_status") ? 0.5 : 1 }}>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </td>

      {/* Shoot Link */}
      <td style={{ ...td, maxWidth: 180 }}>
        {row.shoot_link
          ? (() => {
              const link  = row.shoot_link as string;
              const isUnc = link.startsWith("\\\\") || link.startsWith("//");
              if (isUnc) {
                // Convert \\server\path → file:////server/path with encoded spaces
                const path = link.replace(/^[\\\/]+/, "").replace(/\\/g, "/");
                const href = "file:////" + path.split("/").map(s => encodeURIComponent(s)).join("/");
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <a href={href} target="_blank" rel="noopener noreferrer"
                      title={link}
                      style={{ fontSize: 10, fontWeight: 600, color: "#0369A1", textDecoration: "none", background: "#E0F2FE", borderRadius: 6, padding: "2px 7px", whiteSpace: "nowrap" }}>
                      📁 View
                    </a>
                    <span onClick={() => navigator.clipboard?.writeText(link)}
                      title="Copy path to clipboard — paste in Windows Explorer address bar"
                      style={{ fontSize: 10, cursor: "pointer", color: "#94A3B8", padding: "2px 5px", borderRadius: 4, background: "#F1F5F9", whiteSpace: "nowrap" }}>
                      📋
                    </span>
                  </div>
                );
              }
              return (
                <a href={link} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 10, fontWeight: 600, color: "#4F46E5", textDecoration: "none", background: "#EEF2FF", borderRadius: 6, padding: "2px 7px", display: "inline-block", whiteSpace: "nowrap" }}>
                  🔗 View
                </a>
              );
            })()
          : <span style={{ color: "#CBD5E1", fontSize: 10 }}>—</span>}
      </td>

      {/* Shoot Date */}
      <td style={{ ...td, borderRight: "2px solid #C7D2FE" }}>
        {editCell?.id === row.property_id && editCell.field === "shoot_date"
          ? <input type="date" defaultValue={(row.shoot_date ?? "").slice(0, 10)} autoFocus onBlur={e => { setEditCell(null); onSave(row.property_id, "shoot_date", e.target.value); }} style={{ padding: "2px 5px", border: "1.5px solid #A5B4FC", borderRadius: 6, fontSize: 10, outline: "none" }} />
          : <div onClick={() => setEditCell({ id: row.property_id, field: "shoot_date" })} style={{ padding: "2px 6px", borderRadius: 6, cursor: "pointer", color: row.shoot_date ? "#374151" : "#CBD5E1", whiteSpace: "nowrap", minWidth: 70 }}>{row.shoot_date ? new Date(row.shoot_date).toLocaleDateString("en-IN") : "—"}</div>}
      </td>


      {/* OTA Photoshoot */}
      {OTA_FIELDS.map((f, idx) => {
        const otaLabel = FIELD_TO_OTA[f.key];
        const otaId    = otaIds?.[otaLabel];
        return (
          <td key={f.key} style={{ ...td, background: even ? "#FDFCFF" : "#FAF9FF", borderRight: idx === OTA_FIELDS.length - 1 ? "2px solid #C7D2FE" : "1px solid #EDE9FE" }}>
            <OtaDropdown propertyId={row.property_id} field={f.key} value={(row[f.key] as string) ?? "Pending"} opts={OTA_PHOTO_OPTS} saving={sv(f.key)} isLive={otaIsLive(otaLabel)} onSave={onSave} />
            {otaId && <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 2, fontFamily: "monospace", letterSpacing: "0.02em" }}>{otaId}</div>}
          </td>
        );
      })}

      {/* AI Editing Done — not OTA-gated, no isLive */}
      <td style={{ ...td, background: even ? "#F0F9FF" : "#E8F5FE", borderRight: "2px solid #BAE6FD" }}>
        <OtaDropdown propertyId={row.property_id} field="ai_editing_done" value={(row.ai_editing_done as string) ?? "No"} opts={AI_EDIT_OPTS} saving={sv("ai_editing_done")} onSave={onSave} />
      </td>

      {/* AI Image — gated by same OTA live date */}
      {AI_FIELDS.map((f, idx) => (
        <td key={f.key} style={{ ...td, background: even ? "#F9FFFE" : "#F2FDF9", borderRight: idx === AI_FIELDS.length - 1 ? "2px solid #6EE7B7" : "1px solid #BBF7D0" }}>
          <OtaDropdown propertyId={row.property_id} field={f.key} value={(row[f.key] as string) ?? "Pending"} opts={AI_IMG_OPTS} saving={sv(f.key)} isLive={otaIsLive(FIELD_TO_OTA["ota_" + f.key.slice(3)])} onSave={onSave} />
        </td>
      ))}

      <td style={{ ...td, color: "#94A3B8", fontSize: 10, whiteSpace: "nowrap", borderRight: "none" }}>{row.updated_by ?? "—"}</td>
    </tr>
  );
});

// ── Main page ──────────────────────────────────────────────────────────────────

export default function PhotoshootPage() {
  const [rows,           setRows]           = useState<PhotoRow[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [syncing,        setSyncing]        = useState(false);
  const [syncResult,     setSyncResult]     = useState<{ shootDone: number; shootPending: number; synced: number } | null>(null);
  const [syncError,      setSyncError]      = useState("");
  const [mainTab,        setMainTab]        = useState<MainTab>("table");
  const [search,         setSearch]         = useState("");
  const [statusFilter,   setStatusFilter]   = useState("all");
  const [filterType,     setFilterType]     = useState<"all" | "photoshoot" | "ai">("all");
  const [filterOta,      setFilterOta]      = useState("");   // OTA suffix, e.g. "gommt"
  const [filterValue,    setFilterValue]    = useState("");
  const [savingKeys,     setSavingKeys]     = useState<Record<string, boolean>>({});
  const [editCell,       setEditCell]       = useState<{ id: string; field: string } | null>(null);
  const [page,           setPage]           = useState(0);
  const [bulkOpen,       setBulkOpen]       = useState(false);
  const [bulkIds,        setBulkIds]        = useState("");
  const [bulkField,      setBulkField]      = useState("photoshoot_status");
  const [bulkValue,      setBulkValue]      = useState("Shoot Done");
  const [bulkApplying,   setBulkApplying]   = useState(false);
  const [bulkResult,     setBulkResult]     = useState<{ updated: number } | null>(null);
  const [bulkError,      setBulkError]      = useState("");
  const [drillIds,       setDrillIds]       = useState<Set<string> | null>(null);
  const [drillLabel,     setDrillLabel]     = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/photoshoot")
      .then(r => r.json())
      .then(d => { setRows(d.rows ?? []); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function syncFromSheets() {
    setSyncing(true); setSyncResult(null); setSyncError("");
    try {
      const res  = await fetch("/api/photoshoot/sync", { method: "POST" });
      const data = await res.json();
      if (data.error) { setSyncError(data.error); return; }
      setSyncResult(data); load();
    } catch (e) { setSyncError((e as Error).message); }
    finally { setSyncing(false); }
  }

  const saveField = useCallback(async (propertyId: string, field: string, value: string) => {
    const key = `${propertyId}:${field}`;
    setSavingKeys(s => ({ ...s, [key]: true }));
    try {
      const res = await fetch("/api/photoshoot/update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property_id: propertyId, field, value }),
      });
      if (!res.ok) throw new Error("Save failed");
      setRows(prev => prev.map(r =>
        r.property_id === propertyId ? { ...r, [field]: value === "" ? null : value } : r
      ));
    } catch {
      // silently revert — UI stays at old value because we didn't update rows
    } finally {
      setSavingKeys(s => ({ ...s, [key]: false }));
    }
  }, []);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    const result = rows.filter(r => {
      if (drillIds !== null && !drillIds.has(r.property_id)) return false;
      if (statusFilter !== "all" && r.photoshoot_status !== statusFilter) return false;
      if (s && !r.property_id.toLowerCase().includes(s) &&
               !r.property_name.toLowerCase().includes(s) &&
               !(r.city ?? "").toLowerCase().includes(s))                return false;

      // Cascading filter: type → OTA → value
      if (filterType !== "all" && filterOta && filterValue) {
        const fieldKey  = `${filterType === "photoshoot" ? "ota" : "ai"}_${filterOta}`;
        const val       = (r[fieldKey] as string) ?? "Pending";
        const otaLabel  = OTA_FIELDS.find(f => f.key === `ota_${filterOta}`)?.label ?? "";
        const otaIsLive = !!(r.live_dates as Record<string, string> | null)?.[otaLabel];
        if (filterValue === "Updated"      && val !== "Updated")              return false;
        if (filterValue === "Not Updated"  && (val === "Updated" || val === "Photoshoot Exception" || !otaIsLive)) return false;
        if (filterValue === "Exception"    && val !== "Photoshoot Exception") return false;
        if (filterValue === "OTA Not Live" && otaIsLive)                      return false;
      }

      return true;
    });
    // Sort by FH ID highest → lowest
    result.sort((a, b) => {
      const aNum = parseInt(a.property_id.replace(/\D/g, "")) || 0;
      const bNum = parseInt(b.property_id.replace(/\D/g, "")) || 0;
      return bNum - aNum;
    });
    return result;
  }, [rows, statusFilter, search, filterType, filterOta, filterValue, drillIds]);

  const totalPages  = Math.ceil(filtered.length / PAGE_SIZE);
  const visibleRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => { setPage(0); }, [statusFilter, search, filterType, filterOta, filterValue, drillIds]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { total: rows.length };
    for (const s of STATUSES) c[s] = rows.filter(r => r.photoshoot_status === s).length;
    return c;
  }, [rows]);

  const hasActiveFilter = search || statusFilter !== "all" || filterType !== "all";

  // ── OTA summary ─────────────────────────────────────────────────────────────
  const otaSummary = useMemo(() => OTA_FIELDS.map(f => {
    const otaLabel  = FIELD_TO_OTA[f.key];
    const total     = rows.length;
    const pUpdated  = rows.filter(r => (r[f.key] as string) === "Updated").length;
    const pExcept   = rows.filter(r => (r[f.key] as string) === "Photoshoot Exception").length;
    const pPending  = rows.filter(r => {
      const live = !!(r.live_dates as Record<string, string> | null)?.[otaLabel];
      return live && ((r[f.key] as string) ?? "Pending") === "Pending";
    }).length;
    const aKey      = "ai_" + f.key.slice(4);
    const aUpdated  = rows.filter(r => (r[aKey] as string) === "Updated").length;
    const aPending  = rows.filter(r => {
      const live = !!(r.live_dates as Record<string, string> | null)?.[otaLabel];
      return live && ((r[aKey] as string) ?? "Pending") === "Pending";
    }).length;
    return { label: f.label, total, pUpdated, pExcept, pPending, aUpdated, aPending };
  }), [rows]);

  // ── Table 1: Month-wise OTA pendencies (FH live date, shoot done only) ──────
  const monthlyPendency = useMemo(() => {
    const now        = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const counts     = new Map<string, Record<string, number>>();
    const ids        = new Map<string, Record<string, string[]>>();  // monthKey → otaKey → propertyIds
    counts.set(currentKey, {}); ids.set(currentKey, {});

    for (const r of rows) {
      if (r.photoshoot_status !== "Shoot Done" || !r.fh_live_date) continue;
      const d   = new Date(r.fh_live_date as string);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!counts.has(key)) { counts.set(key, {}); ids.set(key, {}); }
      const cEntry = counts.get(key)!;
      const iEntry = ids.get(key)!;
      for (const f of OTA_FIELDS) {
        const otaIsLive = !!(r.live_dates as Record<string, string> | null)?.[FIELD_TO_OTA[f.key]];
        if (!otaIsLive) continue; // skip OTA not live yet
        const val = (r[f.key] as string) ?? "Pending";
        if (val === "Pending") {
          cEntry[f.key] = (cEntry[f.key] ?? 0) + 1;
          if (!iEntry[f.key]) iEntry[f.key] = [];
          iEntry[f.key].push(r.property_id);
        }
      }
    }
    return Array.from(counts.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, cEntry]) => {
        const [yr, mo] = key.split("-");
        const label    = new Date(Number(yr), Number(mo) - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
        const total    = OTA_FIELDS.reduce((s, f) => s + (cEntry[f.key] ?? 0), 0);
        const iEntry   = ids.get(key) ?? {};
        const allIds   = [...new Set(Object.values(iEntry).flat())];
        return { label, counts: cEntry, total, isCurrent: key === currentKey, ids: iEntry, allIds };
      })
      .filter(m => m.total > 0 || m.isCurrent);
  }, [rows]);

  // ── DoD Tracker: day-by-day pending cases (days 1–30 only) ──────────────────
  // TAT = today − max(shoot_date, ota_live_date); only 1–30 day range shown
  const tatBucketData = useMemo(() => {
    const today   = Date.now();
    const dayMap:  Record<number, Record<string, number>>   = {};
    const idMap:   Record<number, Record<string, string[]>> = {};
    for (let d = 1; d <= 30; d++) { dayMap[d] = {}; idMap[d] = {}; }

    for (const r of rows) {
      if (r.photoshoot_status !== "Shoot Done") continue;
      for (const f of OTA_FIELDS) {
        const val = (r[f.key] as string) ?? "Pending";
        if (val !== "Pending") continue;
        const liveDateStr = (r.live_dates as Record<string, string> | null)?.[FIELD_TO_OTA[f.key]];
        if (!liveDateStr) continue; // skip OTA not live yet
        const shootMs = r.shoot_date ? new Date(r.shoot_date as string).getTime() : null;
        if (shootMs === null) continue; // no shoot date, can't compute TAT
        const liveMs = new Date(liveDateStr).getTime();
        const tat    = Math.round((today - Math.max(shootMs, liveMs)) / 86400000);
        if (tat < 1 || tat > 30) continue;
        dayMap[tat][f.key] = (dayMap[tat][f.key] ?? 0) + 1;
        if (!idMap[tat][f.key]) idMap[tat][f.key] = [];
        idMap[tat][f.key].push(r.property_id);
      }
    }

    return Array.from({ length: 30 }, (_, i) => {
      const day    = i + 1;
      const counts = dayMap[day];
      const ids    = idMap[day];
      const total  = OTA_FIELDS.reduce((s, f) => s + (counts[f.key] ?? 0), 0);
      const allIds = [...new Set(Object.values(ids).flat())];
      return { day, counts, total, ids, allIds };
    }).filter(d => d.total > 0);
  }, [rows]);

  // ── Daily Performance: per-day count of OTA uploads marked "Updated" ────────
  const dailyPerf = useMemo(() => {
    const dateMap: Record<string, Record<string, string[]>> = {}; // date → otaKey → propertyIds
    for (const r of rows) {
      if (!r.updated_at) continue;
      const date = (r.updated_at as string).slice(0, 10);
      if (!dateMap[date]) dateMap[date] = {};
      const dEntry = dateMap[date];
      for (const f of OTA_FIELDS) {
        if ((r[f.key] as string) === "Updated") {
          if (!dEntry[f.key]) dEntry[f.key] = [];
          dEntry[f.key].push(r.property_id);
        }
      }
    }
    return Object.entries(dateMap)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 60)
      .map(([date, otaMap]) => {
        const [yr, mo, dy] = date.split("-");
        const label  = new Date(Number(yr), Number(mo) - 1, Number(dy)).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        const allIds = [...new Set(Object.values(otaMap).flat())];
        const total  = Object.values(otaMap).reduce((s, ids) => s + ids.length, 0);
        return { date, label, otaMap, allIds, total };
      })
      .filter(d => d.total > 0);
  }, [rows]);

  const bulkParsedIds = useMemo(() => [...new Set(bulkIds.trim().split(/\s+/).filter(Boolean))], [bulkIds]);
  const bulkFieldCfg  = BULK_FIELD_OPTS.find(f => f.key === bulkField)!;

  function onBulkFieldChange(key: string) {
    const cfg = BULK_FIELD_OPTS.find(f => f.key === key)!;
    setBulkField(key); setBulkValue(cfg.opts ? cfg.opts[0] : "");
    setBulkResult(null); setBulkError("");
  }

  async function applyBulk() {
    if (!bulkParsedIds.length) return;
    setBulkApplying(true); setBulkResult(null); setBulkError("");
    try {
      const res  = await fetch("/api/photoshoot/bulk-update", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property_ids: bulkParsedIds, field: bulkField, value: bulkValue }),
      });
      const data = await res.json();
      if (!data.ok) { setBulkError(data.error ?? "Failed"); return; }
      setBulkResult(data); load();
    } catch (e) { setBulkError((e as Error).message); }
    finally { setBulkApplying(false); }
  }

  function drillTo(ids: string[], label: string) {
    setDrillIds(new Set(ids));
    setDrillLabel(label);
    setMainTab("table");
    setPage(0);
  }

  const totalCols = 8 + 11 + 1 + 11 + 1;

  // ── Tab labels ───────────────────────────────────────────────────────────────
  const TABS: { key: MainTab; label: string }[] = [
    { key: "table", label: "📋 Photoshoot Tracker" },
    { key: "ota",   label: "📊 OTA Status" },
    { key: "tat",   label: "⏱ TAT Analysis" },
    { key: "dod",   label: "📈 DoD Tracker" },
    { key: "perf",  label: "🗓 Daily Performance" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "'Segoe UI', Arial, sans-serif" }}>

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2E8F0", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>Photoshoot Tracker</div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>Track photoshoot & OTA image upload status · synced from Google Sheets</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {syncError && <span style={{ fontSize: 11, color: "#DC2626" }}>⚠ {syncError}</span>}
          {syncResult && !syncing && (
            <span style={{ fontSize: 11, color: "#16A34A" }}>✓ {syncResult.synced} synced — Done: {syncResult.shootDone} · Pending: {syncResult.shootPending}</span>
          )}
          <button onClick={() => { setBulkOpen(o => !o); setBulkResult(null); setBulkError(""); }}
            style={{ padding: "8px 18px", borderRadius: 8, border: "1px solid #E2E8F0", background: bulkOpen ? "#EEF2FF" : "#fff", color: bulkOpen ? "#4F46E5" : "#374151", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            ✏ Bulk Update
          </button>
          <button onClick={syncFromSheets} disabled={syncing || loading}
            style={{ padding: "8px 18px", borderRadius: 8, border: "none", cursor: syncing ? "not-allowed" : "pointer", background: syncing ? "#CBD5E1" : "linear-gradient(135deg,#7C3AED,#4F46E5)", color: "#fff", fontSize: 12, fontWeight: 700, boxShadow: syncing ? "none" : "0 2px 8px #7C3AED40" }}>
            {syncing ? "Syncing…" : "↻ Sync from Sheets"}
          </button>
        </div>
      </div>

      <div style={{ padding: "20px 28px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Status tiles — compact inline pills */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {[
            { key: "all",           label: "Total",         val: counts.total,                   bg: "#F1F5F9", text: "#374151", border: "#E2E8F0" },
            { key: "Shoot Done",    label: "Shoot Done",    val: counts["Shoot Done"]    ?? 0, ...STATUS_STYLE["Shoot Done"]    },
            { key: "Shoot Pending", label: "Shoot Pending", val: counts["Shoot Pending"] ?? 0, ...STATUS_STYLE["Shoot Pending"] },
          ].map(tile => (
            <div key={tile.key} onClick={() => { setStatusFilter(tile.key === statusFilter ? "all" : tile.key); setMainTab("table"); }}
              style={{ display: "flex", alignItems: "center", gap: 6, background: tile.bg, border: `2px solid ${statusFilter === tile.key ? tile.text : (tile.border ?? tile.text + "40")}`, borderRadius: 20, padding: "5px 14px", cursor: "pointer", boxShadow: statusFilter === tile.key ? `0 0 0 3px ${tile.text}20` : "none", transition: "all 0.15s" }}>
              <span style={{ fontSize: 15, fontWeight: 900, color: tile.text }}>{tile.val}</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: tile.text }}>{tile.label}</span>
            </div>
          ))}
        </div>

        {/* ── Tab strip ─────────────────────────────────────────────────────── */}
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #E2E8F0", display: "flex", overflow: "hidden" }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setMainTab(t.key)}
              style={{ flex: 1, padding: "11px 0", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: mainTab === t.key ? "#EEF2FF" : "transparent", color: mainTab === t.key ? "#4F46E5" : "#64748B", borderBottom: mainTab === t.key ? "3px solid #4F46E5" : "3px solid transparent", transition: "all 0.15s" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ════════════════════ TABLE TAB ════════════════════ */}
        {mainTab === "table" && (
          <>
            {/* Filters + search — single row */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ID, name, city…"
                style={{ padding: "7px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 12, outline: "none", width: 210 }} />

              <select value={filterType} onChange={e => { setFilterType(e.target.value as "all"|"photoshoot"|"ai"); setFilterOta(""); setFilterValue(""); }}
                style={{ padding: "7px 12px", border: `1px solid ${filterType !== "all" ? "#6D28D9" : "#E2E8F0"}`, borderRadius: 8, fontSize: 12, outline: "none", background: filterType !== "all" ? "#F5F3FF" : "#fff", color: filterType !== "all" ? "#6D28D9" : "#374151", fontWeight: filterType !== "all" ? 700 : 400 }}>
                <option value="all">All</option>
                <option value="photoshoot">📷 Photoshoot</option>
                <option value="ai">🤖 AI Images</option>
              </select>

              {filterType !== "all" && (
                <select value={filterOta} onChange={e => { setFilterOta(e.target.value); setFilterValue(e.target.value && filterType === "photoshoot" ? "OTA Not Live" : ""); }}
                  style={{ padding: "7px 12px", border: `1px solid ${filterOta ? "#6D28D9" : "#E2E8F0"}`, borderRadius: 8, fontSize: 12, outline: "none", background: filterOta ? "#F5F3FF" : "#fff", color: filterOta ? "#6D28D9" : "#374151", fontWeight: filterOta ? 700 : 400 }}>
                  <option value="">All OTAs</option>
                  {OTA_FIELDS.map(f => <option key={f.key} value={f.key.slice(4)}>{f.label}</option>)}
                </select>
              )}

              {filterType !== "all" && filterOta && (
                <select value={filterValue} onChange={e => setFilterValue(e.target.value)}
                  style={{ padding: "7px 12px", border: `1px solid ${filterValue ? "#4F46E5" : "#E2E8F0"}`, borderRadius: 8, fontSize: 12, outline: "none", background: filterValue ? "#EEF2FF" : "#fff", color: filterValue ? "#4F46E5" : "#374151", fontWeight: filterValue ? 700 : 400 }}>
                  <option value="">Any Status</option>
                  <option value="Updated">✓ Updated</option>
                  <option value="Not Updated">🕐 Not Updated</option>
                  {filterType === "photoshoot" && <option value="Exception">⚠ Exception</option>}
                  {filterType === "photoshoot" && <option value="OTA Not Live">🔴 OTA Not Live</option>}
                </select>
              )}

              {hasActiveFilter && (
                <button onClick={() => { setSearch(""); setStatusFilter("all"); setFilterType("all"); setFilterOta(""); setFilterValue(""); }}
                  style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontSize: 12, cursor: "pointer" }}>
                  Clear
                </button>
              )}

              <div style={{ marginLeft: "auto", fontSize: 11, color: "#94A3B8", whiteSpace: "nowrap" }}>
                {loading ? "Loading…" : `${filtered.length} of ${rows.length}`}
              </div>
            </div>

            {/* Bulk Update Panel */}
            {bulkOpen && (
              <div style={{ background: "#fff", borderRadius: 12, border: "2px solid #C7D2FE", padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#4F46E5" }}>✏ Bulk Update</div>
                  <button onClick={() => setBulkOpen(false)}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#94A3B8", lineHeight: 1, padding: "0 4px" }} title="Close">×</button>
                </div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
                  <div style={{ flex: "1 1 280px" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#64748B", marginBottom: 5, textTransform: "uppercase" }}>FH Property IDs (space or newline separated)</div>
                    <textarea value={bulkIds} onChange={e => { setBulkIds(e.target.value); setBulkResult(null); }}
                      placeholder="FH12345 FH67890 FH11111" rows={3}
                      style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #E2E8F0", borderRadius: 8, fontSize: 12, outline: "none", resize: "vertical", fontFamily: "monospace", boxSizing: "border-box" }} />
                    {bulkParsedIds.length > 0 && <div style={{ fontSize: 10, color: "#64748B", marginTop: 4 }}>{bulkParsedIds.length} unique ID{bulkParsedIds.length !== 1 ? "s" : ""} entered</div>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: "0 0 auto" }}>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#64748B", marginBottom: 5, textTransform: "uppercase" }}>Field</div>
                      <select value={bulkField} onChange={e => onBulkFieldChange(e.target.value)}
                        style={{ padding: "7px 12px", border: "1.5px solid #E2E8F0", borderRadius: 8, fontSize: 12, outline: "none", background: "#fff", color: "#374151", minWidth: 200 }}>
                        {["General","Photoshoot OTA","AI Editing","AI Image OTA"].map(grp => (
                          <optgroup key={grp} label={grp}>
                            {BULK_FIELD_OPTS.filter(f => f.group === grp).map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "#64748B", marginBottom: 5, textTransform: "uppercase" }}>Set Value To</div>
                      {bulkFieldCfg.opts
                        ? <select value={bulkValue} onChange={e => setBulkValue(e.target.value)} style={{ padding: "7px 12px", border: "1.5px solid #E2E8F0", borderRadius: 8, fontSize: 12, outline: "none", background: "#fff", color: "#374151", minWidth: 200 }}>
                            {bulkFieldCfg.opts.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        : <input type="text" value={bulkValue} onChange={e => setBulkValue(e.target.value)} placeholder="Enter value…" style={{ padding: "7px 12px", border: "1.5px solid #E2E8F0", borderRadius: 8, fontSize: 12, outline: "none", width: 200 }} />}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 8, flex: "0 0 auto", paddingTop: 24 }}>
                    <button onClick={applyBulk} disabled={bulkApplying || bulkParsedIds.length === 0}
                      style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: bulkParsedIds.length === 0 ? "#CBD5E1" : "linear-gradient(135deg,#4F46E5,#7C3AED)", color: "#fff", fontSize: 12, fontWeight: 800, cursor: bulkParsedIds.length === 0 || bulkApplying ? "not-allowed" : "pointer", boxShadow: bulkParsedIds.length > 0 ? "0 2px 8px #4F46E540" : "none" }}>
                      {bulkApplying ? "Applying…" : `Apply to ${bulkParsedIds.length || 0} IDs`}
                    </button>
                    {bulkResult && <div style={{ fontSize: 11, color: "#16A34A", fontWeight: 700 }}>✓ Updated {bulkResult.updated} propert{bulkResult.updated !== 1 ? "ies" : "y"}</div>}
                    {bulkError  && <div style={{ fontSize: 11, color: "#DC2626" }}>⚠ {bulkError}</div>}
                  </div>
                </div>
              </div>
            )}

            {/* Drill-down banner */}
            {drillIds !== null && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", background: "#EEF2FF", borderRadius: 8, border: "1px solid #C7D2FE" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#4F46E5" }}>🔍 Drill: {drillLabel}</span>
                <span style={{ fontSize: 11, color: "#6366F1" }}>({drillIds.size} properties)</span>
                <button onClick={() => { setDrillIds(null); setDrillLabel(""); }}
                  style={{ marginLeft: "auto", padding: "3px 10px", borderRadius: 6, border: "1px solid #C7D2FE", background: "#fff", color: "#4F46E5", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  × Clear drill
                </button>
              </div>
            )}

            {/* Table */}
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#EEF2FF", borderBottom: "1px solid #C7D2FE" }}>
                      <th colSpan={8}  style={{ padding: "6px 10px", textAlign: "left",   fontSize: 10, fontWeight: 800, color: "#374151", letterSpacing: "0.05em", whiteSpace: "nowrap", borderRight: "2px solid #C7D2FE" }}>Property Info</th>
                      <th colSpan={11} style={{ padding: "6px 10px", textAlign: "center", fontSize: 10, fontWeight: 800, color: "#4F46E5", letterSpacing: "0.05em", whiteSpace: "nowrap", borderRight: "2px solid #C7D2FE", background: "#EDE9FE" }}>📷 Photoshoot OTA Update</th>
                      <th colSpan={1}  style={{ padding: "6px 10px", textAlign: "center", fontSize: 10, fontWeight: 800, color: "#0891B2", letterSpacing: "0.05em", whiteSpace: "nowrap", borderRight: "2px solid #BAE6FD", background: "#E0F2FE" }}>AI Editing</th>
                      <th colSpan={11} style={{ padding: "6px 10px", textAlign: "center", fontSize: 10, fontWeight: 800, color: "#059669", letterSpacing: "0.05em", whiteSpace: "nowrap", borderRight: "2px solid #6EE7B7", background: "#D1FAE5" }}>🤖 AI Image OTA Update</th>
                      <th colSpan={1}  style={{ ...TH_BASE, background: "#EEF2FF", color: "#64748B", borderRight: "none" }}>Meta</th>
                    </tr>
                    <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
                      <th style={{ ...TH_BASE, position: "sticky", left: 0, zIndex: 3, background: "#F8FAFC", width: COL_ID_W, minWidth: COL_ID_W, boxShadow: "2px 0 4px -2px rgba(0,0,0,0.08)" }}>Property ID</th>
                      <th style={{ ...TH_BASE, position: "sticky", left: COL_ID_W, zIndex: 3, background: "#F8FAFC", width: COL_NAME_W, minWidth: COL_NAME_W, boxShadow: "2px 0 4px -2px rgba(0,0,0,0.08)" }}>Property Name</th>
                      <th style={TH_BASE}>City</th>
                      <th style={TH_BASE}>FH Status</th>
                      <th style={TH_BASE}>FH Live Date</th>
                      <th style={TH_BASE}>Shoot Status</th>
                      <th style={TH_BASE}>Shoot Link</th>
                      <th style={{ ...TH_BASE, borderRight: "2px solid #C7D2FE" }}>Shoot Date</th>
                      {OTA_FIELDS.map((f, i) => (
                        <th key={f.key} style={{ ...TH_BASE, background: "#F5F3FF", color: "#6D28D9", borderRight: i === OTA_FIELDS.length - 1 ? "2px solid #C7D2FE" : "1px solid #EDE9FE" }}>{f.label}</th>
                      ))}
                      <th style={{ ...TH_BASE, background: "#F0F9FF", color: "#0369A1", borderRight: "2px solid #BAE6FD" }}>Done?</th>
                      {AI_FIELDS.map((f, i) => (
                        <th key={f.key} style={{ ...TH_BASE, background: "#F0FDF4", color: "#15803D", borderRight: i === AI_FIELDS.length - 1 ? "2px solid #6EE7B7" : "1px solid #BBF7D0" }}>{f.label}</th>
                      ))}
                      <th style={{ ...TH_BASE, borderRight: "none" }}>Updated By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading
                      ? <tr><td colSpan={totalCols} style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>Loading…</td></tr>
                      : filtered.length === 0
                      ? <tr><td colSpan={totalCols} style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>No properties match the current filters</td></tr>
                      : visibleRows.map((row, i) => (
                          <TableRow key={row.property_id} row={row} rowIndex={page * PAGE_SIZE + i}
                            editCell={editCell} setEditCell={setEditCell} savingKeys={savingKeys} onSave={saveField} />
                        ))}
                  </tbody>
                </table>
              </div>
              {!loading && filtered.length > 0 && (
                <div style={{ padding: "10px 14px", background: "#F8FAFC", borderTop: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <div style={{ fontSize: 10, color: "#94A3B8" }}>
                    Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length} · Dropdowns auto-save · Click date/remarks to edit
                  </div>
                  {totalPages > 1 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                        style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #E2E8F0", background: page === 0 ? "#F8FAFC" : "#fff", color: page === 0 ? "#CBD5E1" : "#374151", fontSize: 11, cursor: page === 0 ? "default" : "pointer" }}>← Prev</button>
                      {Array.from({ length: totalPages }, (_, i) => i).filter(i => Math.abs(i - page) < 3 || i === 0 || i === totalPages - 1).map((i, idx, arr) => (
                        <React.Fragment key={i}>
                          {idx > 0 && arr[idx - 1] !== i - 1 && <span style={{ color: "#CBD5E1", fontSize: 11 }}>…</span>}
                          <button onClick={() => setPage(i)}
                            style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${i === page ? "#6366F1" : "#E2E8F0"}`, background: i === page ? "#EEF2FF" : "#fff", color: i === page ? "#4F46E5" : "#374151", fontSize: 11, fontWeight: i === page ? 700 : 400, cursor: "pointer" }}>
                            {i + 1}
                          </button>
                        </React.Fragment>
                      ))}
                      <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                        style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #E2E8F0", background: page === totalPages - 1 ? "#F8FAFC" : "#fff", color: page === totalPages - 1 ? "#CBD5E1" : "#374151", fontSize: 11, cursor: page === totalPages - 1 ? "default" : "pointer" }}>Next →</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ════════════════════ OTA STATUS TAB ════════════════════ */}
        {mainTab === "ota" && (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "baseline", gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>📊 OTA Status Summary</div>
              <div style={{ fontSize: 11, color: "#64748B" }}>across all {rows.length} properties</div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 700 }}>
                <thead>
                  <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
                    <th style={{ ...TH_BASE, minWidth: 100 }}>OTA</th>
                    <th style={{ ...TH_BASE, textAlign: "center", background: "#F0FDF4", color: "#15803D", borderRight: "1px solid #BBF7D0" }}>📷 Updated</th>
                    <th style={{ ...TH_BASE, textAlign: "center", background: "#FEF2F2", color: "#DC2626", borderRight: "1px solid #FECACA" }}>⚠ Exception</th>
                    <th style={{ ...TH_BASE, textAlign: "center", background: "#F5F3FF", color: "#6D28D9", borderRight: "2px solid #C7D2FE" }}>🕐 Pending</th>
                    <th style={{ ...TH_BASE, textAlign: "center", borderRight: "2px solid #C7D2FE", fontWeight: 800 }}>📷 Total</th>
                    <th style={{ ...TH_BASE, textAlign: "center", background: "#F0FDF4", color: "#15803D", borderRight: "1px solid #BBF7D0" }}>🤖 AI Updated</th>
                    <th style={{ ...TH_BASE, textAlign: "center", background: "#F5F3FF", color: "#6D28D9", borderRight: "1px solid #EDE9FE" }}>🤖 AI Pending</th>
                    <th style={{ ...TH_BASE, textAlign: "center", borderRight: "none", fontWeight: 800 }}>🤖 AI Total</th>
                  </tr>
                </thead>
                <tbody>
                  {otaSummary.map((o, i) => (
                    <tr key={o.label} style={{ background: i % 2 === 0 ? "#fff" : "#FAFAFA", borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "8px 12px", fontWeight: 700, color: "#0F172A", whiteSpace: "nowrap" }}>{o.label}</td>
                      <td style={{ padding: "8px 10px", textAlign: "center", background: i % 2 === 0 ? "#F7FEF9" : "#F0FDF4", borderRight: "1px solid #BBF7D0" }}>
                        <span style={{ fontWeight: 700, color: "#16A34A" }}>{o.pUpdated}</span>
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "center", background: i % 2 === 0 ? "#FFF8F8" : "#FEF2F2", borderRight: "1px solid #FECACA" }}>
                        {o.pExcept > 0 ? <span style={{ fontWeight: 700, color: "#DC2626" }}>{o.pExcept}</span> : <span style={{ color: "#E2E8F0" }}>—</span>}
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "center", background: i % 2 === 0 ? "#FDFCFF" : "#FAF9FF", borderRight: "2px solid #C7D2FE" }}>
                        {o.pPending > 0 ? <span style={{ fontWeight: 700, color: "#6D28D9" }}>{o.pPending}</span> : <span style={{ color: "#E2E8F0" }}>—</span>}
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: "#374151", borderRight: "2px solid #C7D2FE" }}>{o.total}</td>
                      <td style={{ padding: "8px 10px", textAlign: "center", background: i % 2 === 0 ? "#F7FEF9" : "#F0FDF4", borderRight: "1px solid #BBF7D0" }}>
                        <span style={{ fontWeight: 700, color: "#059669" }}>{o.aUpdated}</span>
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "center", background: i % 2 === 0 ? "#FDFCFF" : "#FAF9FF", borderRight: "1px solid #EDE9FE" }}>
                        {o.aPending > 0 ? <span style={{ fontWeight: 700, color: "#6D28D9" }}>{o.aPending}</span> : <span style={{ color: "#E2E8F0" }}>—</span>}
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: "#374151", borderRight: "none" }}>{o.total}</td>
                    </tr>
                  ))}
                  {/* Totals row */}
                  {(() => {
                    const pUp  = otaSummary.reduce((s, o) => s + o.pUpdated, 0);
                    const pEx  = otaSummary.reduce((s, o) => s + o.pExcept, 0);
                    const pPen = otaSummary.reduce((s, o) => s + o.pPending, 0);
                    const aUp  = otaSummary.reduce((s, o) => s + o.aUpdated, 0);
                    const aPen = otaSummary.reduce((s, o) => s + o.aPending, 0);
                    return (
                      <tr style={{ background: "#F1F5F9", borderTop: "2px solid #E2E8F0" }}>
                        <td style={{ padding: "8px 12px", fontWeight: 800, color: "#374151" }}>Grand Total</td>
                        <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: "#16A34A", borderRight: "1px solid #BBF7D0" }}>{pUp}</td>
                        <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: pEx > 0 ? "#DC2626" : "#CBD5E1", borderRight: "1px solid #FECACA" }}>{pEx > 0 ? pEx : "—"}</td>
                        <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: "#6D28D9", borderRight: "2px solid #C7D2FE" }}>{pPen}</td>
                        <td style={{ padding: "8px 10px", textAlign: "center", color: "#94A3B8", borderRight: "2px solid #C7D2FE" }}>—</td>
                        <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: "#059669", borderRight: "1px solid #BBF7D0" }}>{aUp}</td>
                        <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: "#6D28D9", borderRight: "1px solid #EDE9FE" }}>{aPen}</td>
                        <td style={{ padding: "8px 10px", textAlign: "center", color: "#94A3B8", borderRight: "none" }}>—</td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ════════════════════ TAT ANALYSIS TAB ════════════════════ */}
        {mainTab === "tat" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* ── Table 1: Month-wise pendencies ── */}
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "baseline", gap: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>📅 Month-wise OTA Pendencies</div>
                <div style={{ fontSize: 11, color: "#64748B" }}>by FH live date · shoot done · pending uploads only</div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 700 }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
                      <th style={{ ...TH_BASE, minWidth: 90 }}>FH Live Month</th>
                      {OTA_FIELDS.map(f => (
                        <th key={f.key} style={{ ...TH_BASE, textAlign: "center", background: "#F5F3FF", color: "#6D28D9", borderRight: "1px solid #EDE9FE" }}>{f.label}</th>
                      ))}
                      <th style={{ ...TH_BASE, textAlign: "center", borderRight: "none", color: "#374151", fontWeight: 800 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyPendency.length === 0 ? (
                      <tr><td colSpan={13} style={{ padding: 28, textAlign: "center", color: "#9CA3AF" }}>No pending cases found</td></tr>
                    ) : monthlyPendency.map((m, i) => (
                      <tr key={m.label} style={{ background: m.isCurrent ? "#EEF2FF" : i % 2 === 0 ? "#fff" : "#FAFAFA", borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "8px 12px", fontWeight: 700, color: m.isCurrent ? "#4F46E5" : "#374151", whiteSpace: "nowrap" }}>
                          {m.label}{m.isCurrent && <span style={{ fontSize: 9, fontWeight: 700, background: "#C7D2FE", color: "#4338CA", borderRadius: 4, padding: "1px 5px", marginLeft: 6 }}>current</span>}
                        </td>
                        {OTA_FIELDS.map(f => {
                          const v       = m.counts[f.key] ?? 0;
                          const cellIds = m.ids[f.key] ?? [];
                          return (
                            <td key={f.key} style={{ padding: "8px 10px", textAlign: "center", background: i % 2 === 0 ? "#FDFCFF" : "#FAF9FF", borderRight: "1px solid #EDE9FE" }}>
                              {v > 0
                                ? <span onClick={() => drillTo(cellIds, `${m.label} · ${f.label} Pending`)} style={{ fontWeight: 700, color: "#6D28D9", cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted" }}>{v}</span>
                                : <span style={{ color: "#E2E8F0" }}>—</span>}
                            </td>
                          );
                        })}
                        <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: m.total > 0 ? "#374151" : "#CBD5E1" }}>
                          {m.total > 0
                            ? <span onClick={() => drillTo(m.allIds, `${m.label} · Any OTA Pending`)} style={{ cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted" }}>{m.total}</span>
                            : "—"}
                        </td>
                      </tr>
                    ))}
                    {/* Totals row */}
                    {monthlyPendency.length > 1 && (() => {
                      const totals: Record<string, number> = {};
                      let grand = 0;
                      for (const m of monthlyPendency) {
                        for (const f of OTA_FIELDS) { totals[f.key] = (totals[f.key] ?? 0) + (m.counts[f.key] ?? 0); }
                        grand += m.total;
                      }
                      return (
                        <tr style={{ background: "#F1F5F9", borderTop: "2px solid #E2E8F0" }}>
                          <td style={{ padding: "8px 12px", fontWeight: 800, color: "#374151" }}>Total</td>
                          {OTA_FIELDS.map(f => (
                            <td key={f.key} style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: "#6D28D9", borderRight: "1px solid #EDE9FE" }}>
                              {totals[f.key] > 0 ? totals[f.key] : "—"}
                            </td>
                          ))}
                          <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: "#0F172A" }}>{grand}</td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ════════════════════ DoD TRACKER TAB ════════════════════ */}
        {mainTab === "dod" && (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "baseline", gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>📈 DoD Tracker — Pending Upload TAT</div>
              <div style={{ fontSize: 11, color: "#64748B" }}>
                TAT = today − max(shoot date, OTA live date) · shoot done · upload still pending
              </div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 700 }}>
                <thead>
                  <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
                    <th style={{ ...TH_BASE, minWidth: 60 }}>Day</th>
                    {OTA_FIELDS.map(f => (
                      <th key={f.key} style={{ ...TH_BASE, textAlign: "center", background: "#F5F3FF", color: "#6D28D9", borderRight: "1px solid #EDE9FE" }}>{f.label}</th>
                    ))}
                    <th style={{ ...TH_BASE, textAlign: "center", borderRight: "none", color: "#374151", fontWeight: 800 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {tatBucketData.length === 0 ? (
                    <tr><td colSpan={13} style={{ padding: 28, textAlign: "center", color: "#9CA3AF" }}>No pending cases found</td></tr>
                  ) : tatBucketData.map((b, i) => {
                    const urgency  = b.day >= 22 ? "high" : b.day >= 15 ? "med" : b.day >= 8 ? "low" : "none";
                    const rowBg    = urgency === "high" ? "#FFF7ED" : urgency === "med" ? "#FFFBEB" : i % 2 === 0 ? "#fff" : "#FAFAFA";
                    const dayColor = urgency === "high" ? "#C2410C" : urgency === "med" ? "#B45309" : urgency === "low" ? "#D97706" : "#374151";
                    return (
                      <tr key={b.day} style={{ background: rowBg, borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "8px 12px", fontWeight: 700, whiteSpace: "nowrap", color: dayColor }}>
                          {b.day}
                        </td>
                        {OTA_FIELDS.map(f => {
                          const v    = b.counts[f.key] ?? 0;
                          const fIds = b.ids[f.key] ?? [];
                          const clr  = urgency === "high" ? "#DC2626" : urgency === "med" ? "#B45309" : "#6D28D9";
                          return (
                            <td key={f.key} style={{ padding: "8px 10px", textAlign: "center", background: urgency === "high" ? "#FFF7ED" : urgency === "med" ? "#FFFBEB" : i % 2 === 0 ? "#FDFCFF" : "#FAF9FF", borderRight: "1px solid #EDE9FE" }}>
                              {v > 0
                                ? <span onClick={() => drillTo(fIds, `Day ${b.day} · ${f.label} Pending`)} style={{ fontWeight: 700, color: clr, cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted" }}>{v}</span>
                                : <span style={{ color: "#E2E8F0" }}>—</span>}
                            </td>
                          );
                        })}
                        <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: dayColor }}>
                          {b.total > 0
                            ? <span onClick={() => drillTo(b.allIds, `Day ${b.day} · Any OTA Pending`)} style={{ cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted" }}>{b.total}</span>
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                  {tatBucketData.length > 1 && (() => {
                    const totals: Record<string, number> = {};
                    let grand = 0;
                    for (const b of tatBucketData) {
                      for (const f of OTA_FIELDS) { totals[f.key] = (totals[f.key] ?? 0) + (b.counts[f.key] ?? 0); }
                      grand += b.total;
                    }
                    return (
                      <tr style={{ background: "#F1F5F9", borderTop: "2px solid #E2E8F0" }}>
                        <td style={{ padding: "8px 12px", fontWeight: 800, color: "#374151" }}>Total</td>
                        {OTA_FIELDS.map(f => (
                          <td key={f.key} style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: "#6D28D9", borderRight: "1px solid #EDE9FE" }}>
                            {totals[f.key] > 0 ? totals[f.key] : "—"}
                          </td>
                        ))}
                        <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: "#0F172A" }}>{grand}</td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "8px 18px", background: "#F8FAFC", borderTop: "1px solid #E2E8F0", fontSize: 10, color: "#94A3B8" }}>
              Day = days since max(shoot date, OTA live date). Only shows days 1–30 with pending uploads. 🟠 8–14 d · 🔴 15–21 d · 🟥 22–30 d
            </div>
          </div>
        )}

        {/* ════════════════════ DAILY PERFORMANCE TAB ════════════════════ */}
        {mainTab === "perf" && (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #E2E8F0", display: "flex", alignItems: "baseline", gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>🗓 Daily Performance</div>
              <div style={{ fontSize: 11, color: "#64748B" }}>OTA uploads marked Updated per day · click numbers to drill into properties</div>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 700 }}>
                <thead>
                  <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
                    <th style={{ ...TH_BASE, minWidth: 110 }}>Date</th>
                    {OTA_FIELDS.map(f => (
                      <th key={f.key} style={{ ...TH_BASE, textAlign: "center", background: "#F0FDF4", color: "#15803D", borderRight: "1px solid #BBF7D0" }}>{f.label}</th>
                    ))}
                    <th style={{ ...TH_BASE, textAlign: "center", borderRight: "none", color: "#374151", fontWeight: 800 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyPerf.length === 0 ? (
                    <tr><td colSpan={13} style={{ padding: 28, textAlign: "center", color: "#9CA3AF" }}>No updated cases found</td></tr>
                  ) : dailyPerf.map((d, i) => (
                    <tr key={d.date} style={{ background: i === 0 ? "#F0FDF4" : i % 2 === 0 ? "#fff" : "#FAFAFA", borderBottom: "1px solid #F1F5F9" }}>
                      <td style={{ padding: "8px 12px", fontWeight: 700, color: i === 0 ? "#15803D" : "#374151", whiteSpace: "nowrap" }}>
                        {d.label}
                        {i === 0 && <span style={{ fontSize: 9, fontWeight: 700, background: "#DCFCE7", color: "#15803D", borderRadius: 4, padding: "1px 5px", marginLeft: 6 }}>latest</span>}
                      </td>
                      {OTA_FIELDS.map(f => {
                        const ids = d.otaMap[f.key] ?? [];
                        const v   = ids.length;
                        return (
                          <td key={f.key} style={{ padding: "8px 10px", textAlign: "center", background: i % 2 === 0 ? "#F7FEF9" : "#F0FDF4", borderRight: "1px solid #BBF7D0" }}>
                            {v > 0
                              ? <span onClick={() => drillTo(ids, `${d.label} · ${f.label} Updated`)} style={{ fontWeight: 700, color: "#16A34A", cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted" }}>{v}</span>
                              : <span style={{ color: "#E2E8F0" }}>—</span>}
                          </td>
                        );
                      })}
                      <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: i === 0 ? "#15803D" : "#374151" }}>
                        {d.total > 0
                          ? <span onClick={() => drillTo(d.allIds, `${d.label} · Any OTA Updated`)} style={{ cursor: "pointer", textDecoration: "underline", textDecorationStyle: "dotted" }}>{d.total}</span>
                          : "—"}
                      </td>
                    </tr>
                  ))}
                  {dailyPerf.length > 1 && (() => {
                    const totals: Record<string, number> = {};
                    let grand = 0;
                    for (const d of dailyPerf) {
                      for (const f of OTA_FIELDS) { totals[f.key] = (totals[f.key] ?? 0) + (d.otaMap[f.key]?.length ?? 0); }
                      grand += d.total;
                    }
                    return (
                      <tr style={{ background: "#F1F5F9", borderTop: "2px solid #E2E8F0" }}>
                        <td style={{ padding: "8px 12px", fontWeight: 800, color: "#374151" }}>Total</td>
                        {OTA_FIELDS.map(f => (
                          <td key={f.key} style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: "#16A34A", borderRight: "1px solid #BBF7D0" }}>
                            {totals[f.key] > 0 ? totals[f.key] : "—"}
                          </td>
                        ))}
                        <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800, color: "#0F172A" }}>{grand}</td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            </div>
            <div style={{ padding: "8px 18px", background: "#F8FAFC", borderTop: "1px solid #E2E8F0", fontSize: 10, color: "#94A3B8" }}>
              Grouped by last-modified date of each property. Total = sum of OTA upload counts across all OTAs.
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
