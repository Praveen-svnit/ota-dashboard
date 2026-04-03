"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

/* ─── OTA config ─────────────────────────────────────────────── */
const OTA_COLORS: Record<string, string> = {
  "GoMMT":         "#E83F6F",
  "Booking.com":   "#2563EB",
  "Agoda":         "#7C3AED",
  "Expedia":       "#0EA5E9",
  "Cleartrip":     "#F97316",
  "Yatra":         "#F43F5E",
  "Ixigo":         "#FB923C",
  "Akbar Travels": "#38BDF8",
  "EaseMyTrip":    "#06B6D4",
  "Indigo":        "#6B2FA0",
};

const OTA_SHORT: Record<string, string> = {
  "GoMMT":         "GoMMT",
  "Booking.com":   "BDC",
  "Agoda":         "Agoda",
  "Expedia":       "Expedia",
  "Cleartrip":     "CT",
  "Yatra":         "Yatra",
  "Ixigo":         "Ixigo",
  "Akbar Travels": "AKT",
  "EaseMyTrip":    "EMT",
  "Indigo":        "6E",
};

const STATUS_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  "live":        { color: "#16A34A", bg: "#DCFCE7", border: "#BBF7D0" },
  "not live":    { color: "#DC2626", bg: "#FEE2E2", border: "#FECACA" },
  "notlive":     { color: "#DC2626", bg: "#FEE2E2", border: "#FECACA" },
  "exception":   { color: "#D97706", bg: "#FEF3C7", border: "#FDE68A" },
  "pending":     { color: "#2563EB", bg: "#DBEAFE", border: "#BFDBFE" },
  "duplicate":   { color: "#7C3AED", bg: "#EDE9FE", border: "#DDD6FE" },
  "blank":       { color: "#9CA3AF", bg: "#F3F4F6", border: "#E5E7EB" },
};

function statusStyle(raw: string | null) {
  if (!raw) return STATUS_STYLE["blank"];
  return STATUS_STYLE[raw.toLowerCase().trim()] ?? { color: "#94A3B8", bg: "#0F172A", border: "#334155" };
}

const OTA_LIST = Object.keys(OTA_COLORS);

/* ─── Theme ──────────────────────────────────────────────────── */
const T = {
  pageBg:    "#F9FAFB",
  cardBg:    "#FFFFFF",
  cardBdr:   "#E5E7EB",
  cardHov:   "#F8FAFF",
  cardHovBdr:"#2563EB44",
  textPri:   "#111827",
  textSec:   "#6B7280",
  textMut:   "#9CA3AF",
  inputBg:   "#FFFFFF",
  inputBdr:  "#D1D5DB",
  success:   "#16A34A",
  warn:      "#D97706",
  danger:    "#DC2626",
  accentPri: "#2563EB",
  accentBg:  "#EFF6FF",
  expandBg:  "#F9FAFB",
};

/* ─── Types ──────────────────────────────────────────────────── */
interface OtaEntry {
  liveDate:  string | null;
  otaId:     string | null;
  status:    string | null;
  subStatus: string | null;
}

interface Property {
  fhId:       string;
  name:       string;
  city:       string;
  fhLiveDate: string | null;
  fhStatus:   string | null;
  otas:       Record<string, OtaEntry>;
}

const PAGE_SIZE = 24;

/* ─── Helpers ────────────────────────────────────────────────── */
function fmtDate(raw: string | null): string {
  if (!raw?.trim()) return "";
  const d = new Date(raw.trim());
  return isNaN(d.getTime()) ? raw.trim() : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
}

function fmtTs(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });
}

function healthColor(live: number, total: number) {
  const p = total > 0 ? live / total : 0;
  if (p >= 0.75) return T.success;
  if (p >= 0.45) return T.warn;
  return T.danger;
}

/* ─── Property Tile ──────────────────────────────────────────── */
function PropertyTile({ prop, expanded, onToggle, onOtaClick }: {
  prop: Property; expanded: boolean; onToggle: () => void; onOtaClick: (ota: string) => void;
}) {
  const liveOtas  = OTA_LIST.filter((o) => prop.otas[o]?.subStatus?.toLowerCase() === "live");
  const liveCount = liveOtas.length;
  const total     = OTA_LIST.length;
  const bar       = healthColor(liveCount, total);

  return (
    <div
      onClick={onToggle}
      style={{
        background: T.cardBg,
        border: `1px solid ${T.cardBdr}`,
        borderRadius: 14,
        overflow: "hidden",
        cursor: "pointer",
        transition: "background 0.15s, border-color 0.15s, box-shadow 0.15s",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.background    = T.cardHov;
        el.style.borderColor   = "#2563EB55";
        el.style.boxShadow     = "0 0 0 1px #2563EB22, 0 4px 12px rgba(0,0,0,0.08)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLDivElement;
        el.style.background    = T.cardBg;
        el.style.borderColor   = T.cardBdr;
        el.style.boxShadow     = "none";
      }}
    >
      {/* Top accent bar */}
      <div style={{ height: 3, background: `linear-gradient(90deg, ${bar}, ${bar}88)` }} />

      <div style={{ padding: "14px 16px" }}>

        {/* ID + city row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, color: "#2563EB",
            background: "#EFF6FF", border: "1px solid #BFDBFE",
            borderRadius: 6, padding: "2px 8px", letterSpacing: 0.4,
          }}>
            {prop.fhId}
          </span>
          {prop.city && (
            <span style={{ fontSize: 10, color: T.textSec, whiteSpace: "nowrap", marginLeft: 8 }}>
              📍 {prop.city}
            </span>
          )}
        </div>

        {/* Property name */}
        <div style={{
          fontSize: 13, fontWeight: 700, color: T.textPri,
          lineHeight: 1.4, marginBottom: 12,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {prop.name}
        </div>

        {/* Live OTA pills */}
        {liveCount > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
            {liveOtas.map((ota) => {
              const color = OTA_COLORS[ota];
              const id    = prop.otas[ota]?.otaId;
              return (
                <span
                  key={ota}
                  title={`Open ${ota} in CRM`}
                  onClick={(e) => { e.stopPropagation(); onOtaClick(ota); }}
                  style={{
                    fontSize: 9, fontWeight: 800, padding: "3px 8px",
                    borderRadius: 6, letterSpacing: 0.4,
                    background: color, color: "#FFFFFF",
                    cursor: "pointer",
                  }}
                >
                  {OTA_SHORT[ota]}
                </span>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: 10, color: T.textMut, marginBottom: 12, fontStyle: "italic" }}>
            Not listed on any OTA
          </div>
        )}

        {/* Footer bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, height: 4, background: "#E5E7EB", borderRadius: 99, overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${(liveCount / total) * 100}%`,
              background: `linear-gradient(90deg, ${bar}, ${bar}BB)`,
              borderRadius: 99,
            }} />
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, color: bar, whiteSpace: "nowrap" }}>
            {liveCount} / {total}
          </span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div
          style={{ borderTop: `1px solid ${T.cardBdr}`, padding: "12px 16px", background: T.expandBg }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ fontSize: 9, fontWeight: 700, color: T.textMut, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>
            OTA Details
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {OTA_LIST.map((ota) => {
              const entry  = prop.otas[ota];
              const isLive = entry?.subStatus?.toLowerCase() === "live";
              const color  = OTA_COLORS[ota];
              const id     = entry?.otaId;
              const status = entry?.status;
              const date   = fmtDate(entry?.liveDate ?? null);
              const ss     = statusStyle(status ?? null);
              return (
                <div
                  key={ota}
                  onClick={() => onOtaClick(ota)}
                  title={`Open ${ota} in CRM`}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "6px 10px",
                    background: isLive ? color + "12" : "#F9FAFB",
                    border: `1px solid ${isLive ? color + "30" : "#E5E7EB"}`,
                    borderRadius: 8,
                    cursor: "pointer",
                    transition: "opacity 0.1s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0, background: isLive ? color : T.textMut }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: isLive ? color : T.textMut, minWidth: 46 }}>
                    {OTA_SHORT[ota]}
                  </span>
                  {id ? (
                    <span style={{
                      fontSize: 9, fontWeight: 600, color: T.textSec,
                      background: "#F3F4F6", border: `1px solid ${T.cardBdr}`,
                      borderRadius: 4, padding: "1px 6px", fontFamily: "monospace",
                    }}>
                      {id}
                    </span>
                  ) : (
                    <span style={{ fontSize: 9, color: T.textMut, minWidth: 20 }}>—</span>
                  )}
                  {status ? (
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "1px 7px",
                      borderRadius: 4, letterSpacing: 0.3,
                      background: ss.bg, color: ss.color, border: `1px solid ${ss.border}`,
                      textTransform: "capitalize",
                    }}>
                      {status}
                    </span>
                  ) : (
                    <span style={{ fontSize: 9, color: T.textMut }}>—</span>
                  )}
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 10, fontWeight: 600, color: isLive ? T.success : T.textMut }}>
                    {isLive ? date : "Not Listed"}
                  </span>
                  <span style={{ fontSize: 10, color: T.textMut, marginLeft: 4 }}>→</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Search input ───────────────────────────────────────────── */
function SearchInput({ placeholder, value, onChange }: {
  placeholder: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div style={{ position: "relative", flex: "1 1 180px", maxWidth: 260 }}>
      <span style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: T.textMut, pointerEvents: "none" }}>⌕</span>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%", paddingLeft: 28, paddingRight: value ? 28 : 10,
          paddingTop: 7, paddingBottom: 7,
          fontSize: 11, border: `1px solid ${T.inputBdr}`, borderRadius: 8,
          outline: "none", background: T.inputBg, color: T.textPri,
          boxSizing: "border-box",
        }}
        onFocus={(e) => (e.target.style.borderColor = "#2563EB")}
        onBlur={(e)  => (e.target.style.borderColor = T.inputBdr)}
      />
      {value && (
        <button onClick={() => onChange("")} style={{
          position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
          background: "none", border: "none", cursor: "pointer",
          color: T.textSec, fontSize: 15, padding: 0, lineHeight: 1,
        }}>×</button>
      )}
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────── */
export default function ListingsPage() {
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [fetchedAt, setFetchedAt]   = useState<string | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  const [nameSearch,   setNameSearch]   = useState("");
  const [fhSearch,     setFhSearch]     = useState("");
  const [otaSearch,    setOtaSearch]    = useState("");
  const [otaFilter,    setOtaFilter]    = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "live" | "not-live">("all");
  const [viewFilter,   setViewFilter]   = useState<"all" | "live" | "not-live">("all");
  const [page, setPage]             = useState(1);
  const [expanded, setExpanded]     = useState<Set<string>>(new Set());

  function load() {
    setLoading(true); setError(null);
    fetch("/api/listing-data")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); return; }
        setProperties(d.properties);
        setFetchedAt(d.fetchedAt);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { setPage(1); }, [nameSearch, fhSearch, otaSearch, otaFilter, statusFilter, viewFilter]);

  const filtered = useMemo(() => {
    let list = properties;
    if (viewFilter === "live")     list = list.filter((p) => p.fhStatus?.toLowerCase() === "live");
    if (viewFilter === "not-live") list = list.filter((p) => p.fhStatus?.toLowerCase() !== "live");
    if (nameSearch.trim()) {
      const q = nameSearch.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    if (fhSearch.trim()) {
      const q = fhSearch.trim().toLowerCase();
      list = list.filter((p) => p.fhId.toLowerCase().includes(q));
    }
    if (otaSearch.trim()) {
      const q = otaSearch.trim().toLowerCase();
      list = list.filter((p) =>
        OTA_LIST.some((ota) => (p.otas[ota]?.otaId ?? "").toLowerCase().includes(q))
      );
    }
    if (otaFilter) {
      if (statusFilter === "live")     list = list.filter((p) => p.otas[otaFilter]?.subStatus?.toLowerCase() === "live");
      if (statusFilter === "not-live") list = list.filter((p) => p.otas[otaFilter]?.subStatus?.toLowerCase() !== "live");
    }
    return list;
  }, [properties, nameSearch, fhSearch, otaSearch, otaFilter, statusFilter, viewFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleExpand = (id: string) =>
    setExpanded((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const hasFilter = !!(nameSearch || fhSearch || otaSearch || otaFilter || viewFilter !== "all");

  const selStyle: React.CSSProperties = {
    padding: "7px 10px", fontSize: 11,
    border: `1px solid ${T.inputBdr}`, borderRadius: 8,
    background: T.inputBg, color: T.textSec,
    cursor: "pointer", outline: "none",
  };

  return (
    <div style={{ padding: "20px 24px", background: T.pageBg, minHeight: "100vh" }}>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: T.textPri }}>Property Status</span>
          {!loading && (
            <span style={{ fontSize: 11, color: "#374151", background: T.accentBg, border: "1px solid #BFDBFE", borderRadius: 6, padding: "2px 10px", fontWeight: 600 }}>
              {filtered.length.toLocaleString()}{hasFilter ? ` of ${properties.length.toLocaleString()}` : ""} properties
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {fetchedAt && <span style={{ fontSize: 10, color: T.textMut }}>Updated {fmtTs(fetchedAt)}</span>}
        </div>
      </div>

      {/* Live / Not Live / All toggle */}
      <div style={{ display: "flex", gap: 0, marginBottom: 12, borderRadius: 8, border: `1px solid ${T.cardBdr}`, overflow: "hidden", width: "fit-content" }}>
        {(["all", "live", "not-live"] as const).map((v) => {
          const active = viewFilter === v;
          const label  = v === "all" ? "All" : v === "live" ? "Live" : "Not Live";
          const activeColor = v === "live" ? T.success : v === "not-live" ? T.danger : T.accentPri;
          return (
            <button key={v} onClick={() => setViewFilter(v)} style={{ padding: "6px 16px", fontSize: 11, fontWeight: 700, border: "none", borderLeft: v !== "all" ? `1px solid ${T.cardBdr}` : "none", cursor: "pointer", fontFamily: "inherit", background: active ? activeColor : T.cardBg, color: active ? "#FFF" : T.textSec, transition: "background 0.15s" }}>
              {label}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <SearchInput placeholder="Search property name…"        value={nameSearch} onChange={setNameSearch} />
        <SearchInput placeholder="Search FH ID…"               value={fhSearch}   onChange={setFhSearch} />
        <SearchInput placeholder="Search OTA ID…"              value={otaSearch}  onChange={setOtaSearch} />

        <select value={otaFilter} onChange={(e) => { setOtaFilter(e.target.value); setStatusFilter("all"); }} style={selStyle}>
          <option value="">All OTAs</option>
          {OTA_LIST.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | "live" | "not-live")} style={{ ...selStyle, opacity: otaFilter ? 1 : 0.45, pointerEvents: otaFilter ? "auto" : "none" }}>
          <option value="all">All Sub-status</option>
          <option value="live">Live</option>
          <option value="not-live">Not Live</option>
        </select>

        {hasFilter && (
          <button
            onClick={() => { setNameSearch(""); setFhSearch(""); setOtaSearch(""); setOtaFilter(""); setStatusFilter("all"); setViewFilter("all"); }}
            style={{ padding: "7px 12px", fontSize: 11, fontWeight: 600, color: T.textSec, background: "transparent", border: `1px solid ${T.cardBdr}`, borderRadius: 8, cursor: "pointer" }}
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div style={{ padding: "8px 12px", background: "#FEE2E2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, color: "#DC2626", marginBottom: 14 }}>
          {error}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: T.textMut, fontSize: 13 }}>
          Loading…
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 12, marginBottom: 16 }}>
            {pageItems.map((prop) => (
              <PropertyTile
                key={prop.fhId}
                prop={prop}
                expanded={expanded.has(prop.fhId)}
                onToggle={() => toggleExpand(prop.fhId)}
                onOtaClick={(ota) => router.push(`/crm/${prop.fhId}?ota=${encodeURIComponent(ota)}`)}
              />
            ))}
            {pageItems.length === 0 && (
              <div style={{ gridColumn: "1/-1", padding: 60, textAlign: "center", color: T.textMut, fontSize: 13 }}>
                No properties match your filters
              </div>
            )}
          </div>

          {/* Pagination */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: `1px solid ${T.cardBdr}` }}>
            <span style={{ fontSize: 11, color: T.textMut }}>
              {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length.toLocaleString()}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {[
                { label: "«", fn: () => setPage(1),                                    dis: page === 1 },
                { label: "‹", fn: () => setPage((p) => Math.max(1, p - 1)),            dis: page === 1 },
                { label: "›", fn: () => setPage((p) => Math.min(totalPages, p + 1)),   dis: page === totalPages },
                { label: "»", fn: () => setPage(totalPages),                            dis: page === totalPages },
              ].map(({ label, fn, dis }) => (
                <button key={label} onClick={fn} disabled={dis} style={{
                  padding: "4px 10px", fontSize: 12, fontWeight: 700,
                  color:      dis ? T.textMut  : "#374151",
                  background: dis ? "transparent" : "#FFFFFF",
                  border: `1px solid ${dis ? T.cardBdr : "#D1D5DB"}`,
                  borderRadius: 6, cursor: dis ? "not-allowed" : "pointer",
                }}>
                  {label}
                </button>
              ))}
              <span style={{ fontSize: 11, color: T.textSec, padding: "4px 10px", fontWeight: 700 }}>
                {page} / {totalPages}
              </span>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        ::placeholder { color: #9CA3AF; }
      `}</style>
    </div>
  );
}
