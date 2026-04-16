"use client";

import React, { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import OtaDetailView from "@/components/dashboard/OtaDetailView";
import GmbTab from "@/components/dashboard/GmbTab";

const OTA_SLUG_MAP: Record<string, string> = {
  "GoMMT":"gommt","Booking.com":"booking-com","Agoda":"agoda","Expedia":"expedia",
  "Cleartrip":"cleartrip","Yatra":"yatra","Ixigo":"ixigo","Akbar Travels":"akbar-travels","EaseMyTrip":"easemytrip",
  "Indigo":"indigo",
};

const OTA_LIST_ORDER = ["GoMMT","Booking.com","Agoda","Expedia","Cleartrip","Yatra","Ixigo","Akbar Travels","EaseMyTrip","Indigo","GMB"];

const T = {
  pageBg:   "#F4F7FB",
  cardBg:   "#FFFFFF",
  cardBdr:  "#D8E1EC",
  headerBg: "#F6F9FC",
  expandBg: "#F7FAFD",
  orange:   "#0F766E",
  orangeL:  "#DFF8F3",
  orangeT:  "#BFEFE4",
  textPri:  "#0F172A",
  textSec:  "#475569",
  textMut:  "#7C8EA5",
  live:     "#16A34A",
  liveL:    "#DCFCE7",
  notLive:  "#DC2626",
  notLiveL: "#FEE2E2",
};

const OTA_COLORS: Record<string, string> = {
  "Overview":      "#5D87FF",
  "GMB":           "#34A853",
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
  "GoMMT":"GoMMT","Booking.com":"Booking.com","Agoda":"Agoda","Expedia":"Expedia",
  "Cleartrip":"Cleartrip","Yatra":"Yatra","Ixigo":"Ixigo","Akbar Travels":"Akbar Travels","EaseMyTrip":"EaseMyTrip",
  "Indigo":"Indigo",
};

const OTA_LOGO_STYLE: Record<string, { mark: string; bg: string; text: string; ring: string }> = {
  "GoMMT":         { mark: "go", bg: "#FFE4EC", text: "#B42352", ring: "#F8B4C8" },
  "Booking.com":   { mark: "B.", bg: "#E6F0FF", text: "#175CD3", ring: "#B2CCFF" },
  "Agoda":         { mark: "a",  bg: "#F1E8FF", text: "#7A28CB", ring: "#D9B8FF" },
  "Expedia":       { mark: "e",  bg: "#E8F7FF", text: "#0E7490", ring: "#B9E6F2" },
  "Cleartrip":     { mark: "ct", bg: "#FFF1E8", text: "#C2410C", ring: "#F7C9B0" },
  "Yatra":         { mark: "y",  bg: "#FFE7EF", text: "#C11574", ring: "#F8B4D9" },
  "Ixigo":         { mark: "ix", bg: "#FFF3E8", text: "#D46B08", ring: "#F7D1A6" },
  "Akbar Travels": { mark: "at", bg: "#E8F7FF", text: "#0369A1", ring: "#BAE6FD" },
  "EaseMyTrip":    { mark: "em", bg: "#E6FFFB", text: "#0F766E", ring: "#99F6E4" },
  "Indigo":        { mark: "6E", bg: "#F0EBFF", text: "#6B2FA0", ring: "#D4B8FF" },
};

const SS_COLOR: Record<string, { text: string; bg: string }> = {
  "Live":                        { text: "#16A34A", bg: "#DCFCE7" },
  "Not Live":                    { text: "#DC2626", bg: "#FEE2E2" },
  "OTA Team":                    { text: "#B45309", bg: "#FEF3C7" },
  "Pending at GoMMT":            { text: "#1D4ED8", bg: "#DBEAFE" },
  "Pending at Booking.com":      { text: "#1D4ED8", bg: "#DBEAFE" },
  "Pending at EaseMyTrip":       { text: "#1D4ED8", bg: "#DBEAFE" },
  "Pending at OTA":              { text: "#1D4ED8", bg: "#DBEAFE" },
  "Pending at Agoda":            { text: "#1D4ED8", bg: "#DBEAFE" },
  "Supply/Operations":           { text: "#6D28D9", bg: "#EDE9FE" },
  "Revenue":                     { text: "#C2410C", bg: "#FFEDD5" },
  "Exception":                   { text: "#92400E", bg: "#FEF3C7" },
  "Duplicate - Listing Closed":  { text: "#475569", bg: "#F1F5F9" },
  "Duplicate - Pending Invoice": { text: "#475569", bg: "#F1F5F9" },
  "Blank":                       { text: "#64748B", bg: "#F1F5F9" },
};

function getSSColor(col: string): { text: string; bg: string } {
  return SS_COLOR[col] ?? (col.startsWith("Pending at") ? { text: "#1D4ED8", bg: "#DBEAFE" } : { text: "#475569", bg: "#F1F5F9" });
}

function liveColor(pct: number): { text: string; bar: string } {
  if (pct >= 90) return { text: "#16A34A", bar: "#22C55E" };
  if (pct >= 70) return { text: "#B45309", bar: "#F59E0B" };
  if (pct >= 40) return { text: "#C2410C", bar: "#F97316" };
  return { text: "#DC2626", bar: "#EF4444" };
}

interface Stats { live: number; soldOut: number; total: number; onboardedThisMonth: number; mtdListings: number; }
interface CatRow { ota: string; live: number; exception: number; readyToGoLive: number; inProcess: number; tatExhausted: number; }
interface TatStat { avgTat: number; d0_7: number; d8_15: number; d16_30: number; d31_60: number; d60p: number; }
interface DashData { pivot: Record<string, Record<string, number>>; columns: string[]; otas: string[]; stats: Stats; categories: CatRow[]; tatThreshold: number; tatBreakdown: Record<string, Record<string, number>>; tatSubStatusList: string[]; tatStats: Record<string, TatStat>; }

/* ── Listing Tracker constants ──────────────────────────────────────────── */
const LT_OTAS = [
  "GoMMT", "Expedia", "Cleartrip", "Indigo",
  "Agoda", "Yatra", "Ixigo", "Akbar Travels", "EaseMyTrip",
  "Booking.com",
  "GMB",
];
const LT_UNSIGNED = new Set(["Ixigo", "Akbar Travels"]);

function ListingDashboardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedOta = searchParams.get("ota") ?? "Overview";
  const [data, setData]               = useState<DashData | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [loading, setLoading]         = useState(true);
  const [liveExpanded, setLiveExpanded] = useState(false);
  const [tatExpanded, setTatExpanded]   = useState(false);
  // ── Listing Tracker state ──
  const [ltView,   setLtView]   = useState<"mom" | "dod">("mom");
  const [ltL12m,   setLtL12m]   = useState<{ months: string[]; byOta: Record<string, number[]> }>({ months: [], byOta: {} });
  const [ltDod,    setLtDod]    = useState<{ labels: string[]; byOta: Record<string, number[]> }>({ labels: [], byOta: {} });
  const [ltRtgl,   setLtRtgl]   = useState<Record<string, number>>({});
  const [ltLoading, setLtLoading] = useState(true);
  type PopupInfo = { type: "live" } | { type: "ota"; ota: string } | { type: "tatExhausted" };
  const [popup,    setPopup]    = useState<PopupInfo | null>(null);
  const [popupPos, setPopupPos] = useState({ x: 240, y: 160 });
  const popupRef  = useRef<HTMLDivElement>(null);
  const dragInfo  = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    const rect = popupRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragInfo.current = { sx: e.clientX, sy: e.clientY, ox: rect.left, oy: rect.top };
    function onMove(ev: MouseEvent) {
      if (!dragInfo.current) return;
      setPopupPos({ x: dragInfo.current.ox + ev.clientX - dragInfo.current.sx, y: dragInfo.current.oy + ev.clientY - dragInfo.current.sy });
    }
    function onUp() { dragInfo.current = null; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  // ── Not-live property list ──
  interface NLRow { propertyId: string; name: string; city: string; fhLiveDate: string | null; ota: string; status: string | null; subStatus: string | null; liveDate: string | null; tat: number; tatError: number; }
  interface NLData { rows: NLRow[]; total: number; page: number; pages: number; }
  const [nl, setNl]           = useState<NLData | null>(null);
  const [nlLoading, setNlLoad]= useState(false);
  const [nlSearch, setNlSrch]   = useState("");
  const [nlOtas, setNlOtas]     = useState<string[]>([]);
  const [nlSss, setNlSss]       = useState<string[]>([]);
  const [nlCategory, setNlCat]  = useState("");
  const [nlPage, setNlPage]     = useState(1);

  function goToCategory(cat: string, ota?: string) {
    const newOtas = ota ? [ota] : [];
    setNlOtas(newOtas); setNlSss([]); setNlCat(cat);
    loadNl(1, nlSearch, newOtas, [], cat);
    setTimeout(() => document.getElementById("nl-section")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  }


  function loadNl(page = 1, search = nlSearch, otas = nlOtas, sss = nlSss, category = nlCategory) {
    setNlLoad(true);
    const p = new URLSearchParams({ page: String(page), size: "50" });
    if (search)        p.set("search", search);
    if (otas.length)   p.set("otas", otas.join(","));
    if (sss.length)    p.set("sss", sss.join(","));
    if (category)      p.set("category", category);
    fetch(`/api/listing-dashboard/not-live?${p}`)
      .then(r => r.json())
      .then(d => { setNl(d); setNlPage(page); })
      .finally(() => setNlLoad(false));
  }

  function load() {
    setLoading(true); setError(null);
    fetch("/api/listing-dashboard")
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }


  useEffect(() => { load(); loadNl(); }, []);

  useEffect(() => {
    let done = 0;
    const tryFinish = () => { if (++done === 2) setLtLoading(false); };
    fetch("/api/dashboard-data")
      .then(r => r.json())
      .then(d => { if (d.l12mOtaLive && d.l12mMonths) setLtL12m({ months: d.l12mMonths, byOta: d.l12mOtaLive }); })
      .catch(console.error)
      .finally(tryFinish);
    fetch("/api/perf-data")
      .then(r => r.json())
      .then(p => { if (p.rtglCounts) setLtRtgl(p.rtglCounts); if (p.dod) setLtDod(p.dod); })
      .catch(console.error)
      .finally(tryFinish);
  }, []);

  return (
    <div style={{ padding: "22px 24px", background: "linear-gradient(180deg, #F7FAFD 0%, #EEF4FA 100%)", minHeight: "100vh" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .trow:hover > td { background: #F5FBFA !important; }
        .srow:hover > td { background: #F3F8FD !important; }
      `}</style>

      {/* ── Header — shown only on Overview ── */}
      {selectedOta === "Overview" && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, padding: "14px 18px", background: "linear-gradient(135deg, #FFFFFF 0%, #F4FAF8 54%, #EEF5FB 100%)", border: `1px solid ${T.cardBdr}`, borderRadius: 18, boxShadow: "0 10px 28px rgba(15, 23, 42, 0.05)" }}>
          <div style={{ width: 4, height: 28, background: "linear-gradient(180deg, #0F766E 0%, #0891B2 100%)", borderRadius: 999 }} />
          <div style={{ fontSize: 18, fontWeight: 800, color: T.textPri, letterSpacing: "-0.02em" }}>Listing Dashboard</div>
        </div>
      )}

      {selectedOta === "GMB" ? (
        <GmbTab />
      ) : selectedOta === "Overview" ? (
        <>

      {loading && <div style={{ textAlign: "center", padding: 60, color: T.textMut, fontSize: 12 }}><span style={{ display: "inline-block", animation: "spin 1s linear infinite", marginRight: 6 }}>⟳</span>Loading…</div>}
      {error   && <div style={{ padding: "8px 14px", background: T.notLiveL, border: `1px solid #FECACA`, borderRadius: 8, fontSize: 11, color: T.notLive, marginBottom: 14 }}>⚠ {error}</div>}

      {data && (() => {
        const nonLiveCols  = data.columns.filter(c => c !== "Live");
        const otaTotal     = (o: string) => data.columns.reduce((s, c) => s + (data.pivot[o]?.[c] ?? 0), 0);
        const otaLive      = (o: string) => data.pivot[o]?.["Live"] ?? 0;
        const otaPct       = (o: string) => { const t = otaTotal(o); return t > 0 ? (otaLive(o) / t) * 100 : 0; };
        const otaNotLive   = (o: string) => nonLiveCols.reduce((s, c) => s + (data.pivot[o]?.[c] ?? 0), 0);
        const grandLive    = data.otas.reduce((s, o) => s + otaLive(o), 0);
        const grandTotal   = data.otas.reduce((s, o) => s + otaTotal(o), 0);
        const grandNotLive = data.otas.reduce((s, o) => s + otaNotLive(o), 0);
        const grandPct     = grandTotal > 0 ? (grandLive / grandTotal) * 100 : 0;

        return (
          <>
          {/* ── KPI Cards ── */}
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
            {[
              { label: "Live",          value: data.stats.live,               accent: "#16A34A" },
              { label: "Sold Out",      value: data.stats.soldOut,            accent: "#DC2626" },
              { label: "Total",         value: data.stats.total,              accent: "#475569" },
              { label: `Onboarded · ${new Date().toLocaleString("en-IN", { month: "short", year: "2-digit" })}`,
                                        value: data.stats.onboardedThisMonth, accent: "#0F766E" },
              { label: "MTD Listings",  value: data.stats.mtdListings,        accent: "#5D87FF" },
              { label: "Live %",        value: `${grandPct.toFixed(1)}%`,     accent: liveColor(grandPct).text, isStr: true },
            ].map(({ label, value, accent, isStr }) => (
              <div key={label} style={{ ...kpi, flex: "1 1 110px", minWidth: 100 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: accent, lineHeight: 1 }}>{isStr ? value : (value as number).toLocaleString()}</div>
              </div>
            ))}
          </div>

          {/* ── OTA Listing Status Table ── */}
            {(() => {
              const cats       = data.categories;
              const otasSorted = cats.map(r => r.ota);
              const catMap: Record<string, CatRow> = Object.fromEntries(cats.map(r => [r.ota, r]));
              const totals = cats.reduce((acc, r) => ({
                live: acc.live + r.live,
                exception: acc.exception + r.exception,
                readyToGoLive: acc.readyToGoLive + (r.readyToGoLive ?? 0),
                inProcess: acc.inProcess + r.inProcess,
                tatExhausted: acc.tatExhausted + r.tatExhausted,
              }), { live: 0, exception: 0, readyToGoLive: 0, inProcess: 0, tatExhausted: 0 });
              const grandTot = totals.live + totals.exception + totals.readyToGoLive + totals.inProcess + totals.tatExhausted;
              const overallLivePct = grandTot > 0 ? ((totals.live + totals.exception) / grandTot) * 100 : 0;

              const ROWS = [
                { key: "live",         label: "Live", color: "#166534", bg: "#F2FBF5", accent: "#22C55E" },
                { key: "exception",    label: "Exception", color: "#9A6700", bg: "#FFF8E8", accent: "#EAB308" },
                { key: "readyToGoLive", label: "Ready to Go Live", color: "#0F766E", bg: "#ECFDF5", accent: "#10B981" },
                { key: "inProcess",    label: "Listing In Progress (Within TAT)", color: "#155E75", bg: "#F0FBFF", accent: "#06B6D4" },
                { key: "tatExhausted", label: "TAT Exhausted", color: "#B42318", bg: "#FFF4F2", accent: "#F97066" },
              ] as const;
              const TABLE_THEME = {
                shellBg: "#FFFFFF",
                shellBorder: "#E2E8F0",
                headerBg: "rgba(15, 118, 110, 0.06)",
                headerBorder: "#D1FAE5",
                title: "#1E293B",
                subtitle: "#64748B",
                badgeBg: "rgba(59, 130, 246, 0.10)",
                badgeText: "#2563EB",
                sectionBg: "#FFFFFF",
                sectionBorder: "#E2E8F0",
                stickyBg: "#F8FAFC",
                stickyMutedBg: "#F1F5F9",
                gridSoft: "#E2E8F0",
                totalRowBg: "#F1F5F9",
                totalCellBg: "#F8FAFC",
                totalText: "#0F172A",
                mutedText: "#64748B",
                headerText: "#1E293B",
              };

              const TH_STICKY: React.CSSProperties = {
                position: "sticky", left: 0, zIndex: 2,
                padding: "11px 14px", textAlign: "left", fontSize: 10, fontWeight: 700,
                color: TABLE_THEME.headerText, background: TABLE_THEME.stickyBg,
                borderBottom: `1px solid ${TABLE_THEME.gridSoft}`, borderRight: `1px solid ${TABLE_THEME.gridSoft}`,
                whiteSpace: "nowrap", minWidth: 130,
              };
              const TH_CELL: React.CSSProperties = {
                padding: "9px 10px", textAlign: "center", fontSize: 10, fontWeight: 700,
                color: TABLE_THEME.headerText, background: TABLE_THEME.sectionBg,
                borderBottom: `1px solid ${TABLE_THEME.gridSoft}`, borderRight: `1px solid ${TABLE_THEME.gridSoft}`, whiteSpace: "nowrap", minWidth: 86,
              };
              const TD_STICKY: React.CSSProperties = {
                position: "sticky", left: 0, zIndex: 1,
                padding: "9px 14px", fontSize: 11, fontWeight: 600,
                background: TABLE_THEME.stickyMutedBg, borderRight: `1px solid ${TABLE_THEME.gridSoft}`,
                whiteSpace: "nowrap", minWidth: 220,
              };
              const TD_CELL: React.CSSProperties = {
                padding: "9px 10px", textAlign: "center", borderTop: `1px solid ${TABLE_THEME.gridSoft}`, borderRight: `1px solid ${TABLE_THEME.gridSoft}`,
                background: TABLE_THEME.sectionBg,
              };
              const INLINE_WRAP: React.CSSProperties = {
                padding: "12px 14px",
                background: "#F8FAFC",
                borderTop: `1px solid ${TABLE_THEME.gridSoft}`,
                borderBottom: `1px solid ${TABLE_THEME.gridSoft}`,
              };
              const INLINE_TH: React.CSSProperties = {
                padding: "8px 10px",
                textAlign: "center",
                fontWeight: 700,
                border: `1px solid ${TABLE_THEME.gridSoft}`,
                background: "#0A1120",
                color: TABLE_THEME.headerText,
                whiteSpace: "nowrap",
              };
              const INLINE_TD: React.CSSProperties = {
                padding: "8px 10px",
                textAlign: "center",
                border: `1px solid ${TABLE_THEME.gridSoft}`,
              };
              const TAT_METRICS = [
                { key: "avgTat", label: "Avg TAT", fmt: (v: number) => `${v}d`, color: "#B45309" },
                { key: "d0_7", label: "0-7d", fmt: (v: number) => v.toString(), color: "#16A34A" },
                { key: "d8_15", label: "8-15d", fmt: (v: number) => v.toString(), color: "#B45309" },
                { key: "d16_30", label: "16-30d", fmt: (v: number) => v.toString(), color: "#C2410C" },
                { key: "d31_60", label: "31-60d", fmt: (v: number) => v.toString(), color: "#DC2626" },
                { key: "d60p", label: "60+d", fmt: (v: number) => v.toString(), color: "#7F1D1D" },
              ] as const;

              return (
                <div style={{ background: TABLE_THEME.shellBg, border: `1px solid ${TABLE_THEME.shellBorder}`, borderRadius: 18, overflow: "hidden", marginBottom: 20, boxShadow: "0 20px 40px rgba(15, 23, 42, 0.25)", padding: 0 }}>

                  {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", borderBottom: `1px solid ${TABLE_THEME.headerBorder}`, background: TABLE_THEME.headerBg, flexWrap: "wrap", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#14B8A6", boxShadow: "0 0 0 6px rgba(16, 185, 129, 0.22)" }} />
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: TABLE_THEME.title, letterSpacing: "-0.02em" }}>OTA Listing Status</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: TABLE_THEME.title }}>{grandTot.toLocaleString()} listings</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: liveColor(overallLivePct).text }}>
                      {overallLivePct.toFixed(1)}% live rate
                    </span>
                  </div>
                </div>

                    <div style={{ overflowX: "auto", padding: "0 16px 16px" }}>
                    <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%", minWidth: 860, color: TABLE_THEME.headerText }}>
                      <thead>
                        <tr style={{ background: TABLE_THEME.sectionBg }}>
                          <th style={{ ...TH_STICKY }}>
                            <div style={{ fontSize: 10, letterSpacing: "0.01em" }}>OTAs</div>
                          </th>
                          {otasSorted.map(ota => {
                            const c = OTA_COLORS[ota] ?? T.orange;
                            const logo = OTA_LOGO_STYLE[ota] ?? { mark: (OTA_SHORT[ota] ?? ota).slice(0, 2), bg: "#F2F4F7", text: "#344054", ring: "#D0D5DD" };
                            return (
                              <th key={ota} style={{ ...TH_CELL, borderBottom: `2px solid ${c}`, background: c + "12" }}>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 8px", borderRadius: 999, background: "#FFFFFF", border: `1px solid ${logo.ring}`, boxShadow: "0 1px 2px rgba(16, 24, 40, 0.06)" }}>
                                  <span style={{ width: 20, height: 20, borderRadius: "50%", background: logo.bg, color: logo.text, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.02em", border: `1px solid ${logo.ring}` }}>
                                    {logo.mark}
                                  </span>
                                  <span style={{ fontSize: 10, fontWeight: 800, color: c, letterSpacing: "0.01em", whiteSpace: "nowrap" }}>
                                    {OTA_SHORT[ota] ?? ota.slice(0, 4)}
                                  </span>
                                </div>
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody>

                        {/* Live % row */}
                        <tr style={{ background: TABLE_THEME.sectionBg, borderBottom: `2px solid ${TABLE_THEME.sectionBorder}` }}>
                          <td style={{ ...TD_STICKY, background: TABLE_THEME.stickyMutedBg, color: TABLE_THEME.headerText }}>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em" }}>Live Rate</span>
                            </div>
                          </td>
                          {otasSorted.map(ota => {
                            const r   = catMap[ota];
                            const tot = r.live + r.exception + (r.readyToGoLive ?? 0) + r.inProcess + r.tatExhausted;
                            const pct = tot > 0 ? ((r.live + r.exception) / tot) * 100 : 0;
                            const { text, bar } = liveColor(pct);
                            return (
                              <td key={ota} style={{ ...TD_CELL, background: TABLE_THEME.sectionBg, padding: "10px 10px" }}>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                                  <span style={{ fontWeight: 800, fontSize: 13, color: text }}>{pct.toFixed(1)}%</span>
                                  <div style={{ width: 48, height: 4, background: "#D8E5F7", borderRadius: 99, overflow: "hidden" }}>
                                    <div style={{ height: "100%", width: `${pct}%`, background: bar, borderRadius: 99 }} />
                                  </div>
                                </div>
                              </td>
                            );
                          })}
                        </tr>

                        {/* Category rows */}
                        {ROWS.map((row, ri) => {
                          const isLiveRow = row.key === "live";
                          const isTatRow = row.key === "tatExhausted";
                          const expanded = isLiveRow ? liveExpanded : isTatRow ? tatExpanded : false;
                          return (
                            <React.Fragment key={row.key}>
                              <tr key={row.key} className="trow"
                            style={{ borderBottom: ri < 3 && !expanded ? `1px solid ${TABLE_THEME.gridSoft}` : "none", cursor: isLiveRow || isTatRow ? "pointer" : "default" }}
                            onClick={
                              isLiveRow
                                ? () => setLiveExpanded(v => !v)
                                : isTatRow
                                  ? () => setTatExpanded(v => !v)
                                  : undefined
                            }
                          >
                            <td style={{ ...TD_STICKY, color: row.color, borderLeft: `3px solid ${row.accent}` }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
                                <span style={{ width: 7, height: 7, borderRadius: "50%", background: row.accent, flexShrink: 0 }} />
                                {row.label}
                                {(isLiveRow || isTatRow) && <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 16, height: 16, borderRadius: "50%", fontSize: 12, lineHeight: 1, color: row.color, background: row.bg, border: `1px solid ${row.accent}40`, flexShrink: 0 }}>{expanded ? "▾" : "▸"}</span>}
                              </span>
                            </td>
                            {otasSorted.map(ota => {
                              const v   = catMap[ota]?.[row.key] ?? 0;
                              const cat = row.key !== "live" ? row.key : null;
                              return (
                                <td key={ota} style={TD_CELL}>
                                  {v > 0
                                    ? <span
                                        onClick={cat ? (e) => { e.stopPropagation(); goToCategory(cat, ota); } : undefined}
                                        style={{
                                          display: "inline-block", padding: "2px 9px", borderRadius: 5,
                                          fontWeight: 700, background: row.bg, color: row.color,
                                          cursor: cat ? "pointer" : "default",
                                          border: `1px solid ${row.accent}30`,
                                        }}
                                        title={cat ? `${ota} · ${row.label}` : undefined}
                                      >{v.toLocaleString()}</span>
                                    : <span style={{ color: "#D1D5DB" }}>—</span>}
                                </td>
                              );
                            })}
                          </tr>
                          {isLiveRow && liveExpanded && (
                            <tr>
                              <td colSpan={otasSorted.length + 1} style={INLINE_WRAP}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: TABLE_THEME.mutedText, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                                  Live Listing TAT Analysis
                                </div>
                                <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11 }}>
                                  <thead>
                                    <tr>
                                      <th style={{ ...INLINE_TH, textAlign: "left", color: TABLE_THEME.headerText }}>OTA</th>
                                      {TAT_METRICS.map(m => (
                                        <th key={m.key} style={{ ...INLINE_TH, color: m.color }}>{m.label}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {otasSorted.map(ota => {
                                      const ts = data.tatStats[ota];
                                      if (!ts) return null;
                                      const oc = OTA_COLORS[ota] ?? T.orange;
                                      return (
                                        <tr key={ota}>
                                          <td style={{ ...INLINE_TD, textAlign: "left" }}>
                                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 600, color: oc }}>
                                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: oc }} />
                                              {ota}
                                            </span>
                                          </td>
                                          {TAT_METRICS.map(m => {
                                            const v = ts[m.key] as number;
                                            return (
                                              <td key={m.key} style={INLINE_TD}>
                                                {v > 0 ? <span style={{ fontWeight: 700, color: m.color }}>{m.fmt(v)}</span> : <span style={{ color: T.textMut }}>-</span>}
                                              </td>
                                            );
                                          })}
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                          {isTatRow && tatExpanded && (
                            <tr>
                              <td colSpan={otasSorted.length + 1} style={INLINE_WRAP}>
                                <div style={{ fontSize: 10, fontWeight: 700, color: TABLE_THEME.mutedText, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                                  TAT Exhausted Breakdown
                                </div>
                                <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11 }}>
                                  <thead>
                                    <tr>
                                      <th style={{ ...INLINE_TH, textAlign: "left", color: TABLE_THEME.headerText }}>Sub-status</th>
                                      {otasSorted.map(ota => {
                                        const oc = OTA_COLORS[ota] ?? T.orange;
                                        return <th key={ota} style={{ ...INLINE_TH, color: oc }}>{ota}</th>;
                                      })}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {data.tatSubStatusList.map(sub => {
                                      const subTot = otasSorted.reduce((s, ota) => s + (data.tatBreakdown[ota]?.[sub] ?? 0), 0);
                                      if (subTot === 0) return null;
                                      const sc = getSSColor(sub);
                                      return (
                                        <tr key={sub}>
                                          <td style={{ ...INLINE_TD, textAlign: "left" }}>
                                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 600, color: sc.text }}>
                                              <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.text }} />
                                              {sub}
                                            </span>
                                          </td>
                                          {otasSorted.map(ota => {
                                            const v = data.tatBreakdown[ota]?.[sub] ?? 0;
                                            return (
                                              <td key={ota} style={INLINE_TD}>
                                                {v > 0 ? <span style={{ fontWeight: 700, color: sc.text, background: sc.bg, borderRadius: 4, padding: "2px 8px" }}>{v}</span> : <span style={{ color: T.textMut }}>-</span>}
                                              </td>
                                            );
                                          })}
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                        );
                        })}

                        {/* Total row */}
                        <tr style={{ borderTop: `2px solid ${TABLE_THEME.sectionBorder}`, background: TABLE_THEME.totalRowBg }}>
                          <td style={{ ...TD_STICKY, background: TABLE_THEME.totalRowBg, color: TABLE_THEME.totalText, fontWeight: 800, borderLeft: `3px solid ${TABLE_THEME.totalText}` }}>
                            TOTAL
                          </td>
                          {otasSorted.map(ota => {
                            const r = catMap[ota];
                            const t = r.live + r.exception + (r.readyToGoLive ?? 0) + r.inProcess + r.tatExhausted;
                            return (
                              <td key={ota} style={{ ...TD_CELL, background: TABLE_THEME.totalRowBg }}>
                                <span style={{ fontWeight: 800, color: TABLE_THEME.totalText, fontSize: 12 }}>{t.toLocaleString()}</span>
                              </td>
                            );
                          })}
                        </tr>

                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* ── Listing Tracker (MoM / DoD) ─────────────────────────────────── */}
            {(() => {
              const LT_GRID   = "#E2E8F0";
              const LT_HDR_BG = "rgba(15, 118, 110, 0.06)";
              const LT_HDR_BR = "#D1FAE5";
              const LT_TH_S: React.CSSProperties = {
                position: "sticky", left: 0, zIndex: 2,
                padding: "6px 10px", textAlign: "left", fontSize: 9, fontWeight: 700,
                color: "#1E293B", background: "#F8FAFC",
                borderBottom: `1px solid ${LT_GRID}`, borderRight: `1px solid ${LT_GRID}`,
                whiteSpace: "nowrap", minWidth: 110,
              };
              const LT_TH_C: React.CSSProperties = {
                padding: "6px 7px", textAlign: "center", fontSize: 9, fontWeight: 700,
                color: "#1E293B", background: "#FFFFFF",
                borderBottom: `1px solid ${LT_GRID}`, borderRight: `1px solid ${LT_GRID}`,
                whiteSpace: "nowrap", minWidth: 42,
              };
              const LT_TD_S: React.CSSProperties = {
                position: "sticky", left: 0, zIndex: 1,
                padding: "5px 10px", fontSize: 10, fontWeight: 600,
                background: "#F1F5F9", borderRight: `1px solid ${LT_GRID}`,
                whiteSpace: "nowrap",
              };
              const LT_TD_C: React.CSSProperties = {
                padding: "5px 7px", textAlign: "center",
                borderTop: `1px solid ${LT_GRID}`, borderRight: `1px solid ${LT_GRID}`,
                background: "#FFFFFF",
              };
              const revMonths = [...ltL12m.months].reverse();
              const revLabels = [...ltDod.labels].reverse();
              const colTotals = revMonths.map((_, mi) => {
                const origIdx = ltL12m.months.length - 1 - mi;
                return LT_OTAS.reduce((s, ota) => s + ((ltL12m.byOta[ota] ?? [])[origIdx] ?? 0), 0);
              });
              return (
                <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 18, overflow: "hidden", marginBottom: 20, boxShadow: "0 20px 40px rgba(15, 23, 42, 0.25)", padding: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px", borderBottom: `1px solid ${LT_HDR_BR}`, background: LT_HDR_BG, flexWrap: "wrap", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#14B8A6", boxShadow: "0 0 0 6px rgba(16, 185, 129, 0.22)" }} />
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#1E293B", letterSpacing: "-0.02em" }}>Listing Tracker</div>
                    </div>
                    <div style={{ display: "flex", gap: 3, background: "#F1F5F9", borderRadius: 8, padding: 3 }}>
                      {(["mom", "dod"] as const).map((v) => {
                        const active = ltView === v;
                        return (
                          <button key={v} onClick={() => setLtView(v)} style={{
                            padding: "4px 14px", fontSize: 10, fontWeight: 700, borderRadius: 6,
                            border: "none", cursor: "pointer", fontFamily: "inherit",
                            background: active ? "#FFFFFF" : "transparent",
                            color: active ? "#0F172A" : "#94A3B8",
                            boxShadow: active ? "0 1px 3px rgba(15,23,42,0.10)" : "none",
                            transition: "all 0.12s",
                          }}>
                            {v === "mom" ? "L12M" : "L15D"}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {ltView === "mom" && ltL12m.months.length > 0 && (
                    <div style={{ overflowX: "auto", padding: "0 16px 16px" }}>
                      <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%", color: "#1E293B" }}>
                        <thead>
                          <tr style={{ background: "#F8FAFC" }}>
                            <th style={{ ...LT_TH_S }}>OTA</th>
                            {revMonths.map((mo, mi) => {
                              const isCm = mi === 0;
                              return (
                                <th key={mo} style={{
                                  ...LT_TH_C,
                                  background:   isCm ? "#EEF2FF" : "#F8FAFC",
                                  color:        isCm ? "#6366F1" : "#64748B",
                                  borderLeft:   isCm ? "2px solid #C7D2FE" : undefined,
                                  borderRight:  isCm ? "2px solid #C7D2FE" : `1px solid ${LT_GRID}`,
                                  borderBottom: isCm ? "2px solid #6366F1" : `1px solid ${LT_GRID}`,
                                  fontWeight:   isCm ? 800 : 700,
                                }}>{mo}</th>
                              );
                            })}
                            <th style={{ ...LT_TH_C, background: "#F0FDF4", color: "#16A34A", minWidth: 60 }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...LT_OTAS].sort((a, b) => {
                            const totalA = (ltL12m.byOta[a] ?? []).reduce((s, v) => s + v, 0);
                            const totalB = (ltL12m.byOta[b] ?? []).reduce((s, v) => s + v, 0);
                            return totalB - totalA;
                          }).map((ota) => {
                            const otaColor = OTA_COLORS[ota] ?? "#64748B";
                            const origVals = ltL12m.byOta[ota] ?? Array(ltL12m.months.length).fill(0);
                            const vals     = [...origVals].reverse();
                            const rowTotal = vals.reduce((s, v) => s + v, 0);
                            const maxVal   = Math.max(...vals, 1);
                            const logo     = OTA_LOGO_STYLE[ota] ?? { mark: ota.slice(0, 2), bg: "#F2F4F7", text: "#344054", ring: "#D0D5DD" };
                            return (
                              <tr key={ota} className="trow" style={{ borderBottom: `1px solid ${LT_GRID}` }}>
                                <td style={{ ...LT_TD_S, borderBottom: `1px solid ${LT_GRID}`, borderLeft: `3px solid ${otaColor}` }}>
                                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 7px", borderRadius: 999, background: "#FFFFFF", border: `1px solid ${logo.ring}`, boxShadow: "0 1px 2px rgba(16,24,40,0.06)" }}>
                                    <span style={{ width: 16, height: 16, borderRadius: "50%", background: logo.bg, color: logo.text, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 900, textTransform: "uppercase", border: `1px solid ${logo.ring}` }}>{logo.mark}</span>
                                    <span style={{ fontSize: 9, fontWeight: 800, color: otaColor, whiteSpace: "nowrap" }}>{OTA_SHORT[ota] ?? ota}</span>
                                  </div>
                                </td>
                                {vals.map((cnt, mi) => {
                                  const isCm      = mi === 0;
                                  const rtgl      = isCm && LT_UNSIGNED.has(ota) ? (ltRtgl[ota] ?? 0) : 0;
                                  const intensity = cnt > 0 ? Math.round((cnt / maxVal) * 80) + 20 : 0;
                                  const bg = cnt === 0 ? (isCm ? "#EEF2FF" : "#FFFFFF") : `${otaColor}${intensity.toString(16).padStart(2, "0")}`;
                                  return (
                                    <td key={mi} style={{ ...LT_TD_C, background: bg, borderLeft: isCm ? "2px solid #C7D2FE" : undefined, borderRight: isCm ? "2px solid #C7D2FE" : `1px solid ${LT_GRID}` }}>
                                      <span style={{ fontSize: 10, fontWeight: cnt > 0 ? 700 : 400, color: cnt > 0 ? (isCm ? "#6366F1" : otaColor) : "#CBD5E1" }}>{ltLoading ? "—" : cnt || "·"}</span>
                                      {!ltLoading && rtgl > 0 && <div style={{ fontSize: 7, fontWeight: 700, color: "#D97706", background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 6, padding: "0 4px", marginTop: 2, whiteSpace: "nowrap" }}>+{rtgl} RTGL</div>}
                                    </td>
                                  );
                                })}
                                <td style={{ ...LT_TD_C, background: "#F0FDF4", borderRight: `1px solid ${LT_GRID}` }}>
                                  <span style={{ fontSize: 11, fontWeight: 800, color: rowTotal > 0 ? "#16A34A" : "#CBD5E1" }}>{ltLoading ? "—" : rowTotal}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: "#F1F5F9", borderTop: `2px solid ${LT_GRID}` }}>
                            <td style={{ ...LT_TD_S, background: "#F1F5F9", fontWeight: 800, fontSize: 10, color: "#0F172A", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${LT_GRID}` }}>Total</td>
                            {colTotals.map((ct, mi) => {
                              const isCm = mi === 0;
                              return (
                                <td key={mi} style={{ ...LT_TD_C, background: isCm ? "#EEF2FF" : "#F1F5F9", borderLeft: isCm ? "2px solid #C7D2FE" : undefined, borderRight: isCm ? "2px solid #C7D2FE" : `1px solid ${LT_GRID}` }}>
                                  <span style={{ fontSize: 12, fontWeight: 800, color: ct > 0 ? (isCm ? "#6366F1" : "#374151") : "#CBD5E1" }}>{ltLoading ? "—" : ct || "·"}</span>
                                </td>
                              );
                            })}
                            <td style={{ ...LT_TD_C, background: "#DCFCE7", borderRight: `1px solid ${LT_GRID}` }}>
                              <span style={{ fontSize: 12, fontWeight: 900, color: "#16A34A" }}>{ltLoading ? "—" : colTotals.reduce((s, v) => s + v, 0)}</span>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}

                  {ltView === "dod" && (
                    <div style={{ overflowX: "auto", padding: "0 16px 16px" }}>
                      <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%", color: "#1E293B" }}>
                        <thead>
                          <tr style={{ background: "#F8FAFC" }}>
                            <th style={{ ...LT_TH_S }}>OTA</th>
                            <th style={{ ...LT_TH_C, background: "#F0FDF4", color: "#16A34A", minWidth: 46 }}>Total</th>
                            {revLabels.map((lbl, i) => {
                              const isToday = i === 0;
                              return (
                                <th key={lbl} style={{
                                  ...LT_TH_C,
                                  background:   isToday ? "#EEF2FF" : "#F8FAFC",
                                  color:        isToday ? "#6366F1" : "#64748B",
                                  borderBottom: isToday ? "2px solid #6366F1" : `1px solid ${LT_GRID}`,
                                  fontWeight:   isToday ? 800 : 700,
                                }}>{lbl}</th>
                              );
                            })}
                          </tr>
                        </thead>
                        <tbody>
                          {[...LT_OTAS].sort((a, b) => {
                            const totalA = (ltDod.byOta[a] ?? []).reduce((s, v) => s + v, 0);
                            const totalB = (ltDod.byOta[b] ?? []).reduce((s, v) => s + v, 0);
                            return totalB - totalA;
                          }).map((ota) => {
                            const otaColor   = OTA_COLORS[ota] ?? "#64748B";
                            const origCounts = ltDod.byOta[ota] ?? Array(15).fill(0);
                            const counts     = [...origCounts].reverse();
                            const rowTotal   = counts.reduce((s, v) => s + v, 0);
                            const maxVal     = Math.max(...counts, 1);
                            const logo       = OTA_LOGO_STYLE[ota] ?? { mark: ota.slice(0, 2), bg: "#F2F4F7", text: "#344054", ring: "#D0D5DD" };
                            return (
                              <tr key={ota} className="trow" style={{ borderBottom: `1px solid ${LT_GRID}` }}>
                                <td style={{ ...LT_TD_S, borderBottom: `1px solid ${LT_GRID}`, borderLeft: `3px solid ${otaColor}` }}>
                                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 7px", borderRadius: 999, background: "#FFFFFF", border: `1px solid ${logo.ring}`, boxShadow: "0 1px 2px rgba(16,24,40,0.06)" }}>
                                    <span style={{ width: 16, height: 16, borderRadius: "50%", background: logo.bg, color: logo.text, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 900, textTransform: "uppercase", border: `1px solid ${logo.ring}` }}>{logo.mark}</span>
                                    <span style={{ fontSize: 9, fontWeight: 800, color: otaColor, whiteSpace: "nowrap" }}>{OTA_SHORT[ota] ?? ota}</span>
                                  </div>
                                </td>
                                <td style={{ ...LT_TD_C, background: "#F0FDF4", borderRight: `1px solid ${LT_GRID}` }}>
                                  <span style={{ fontSize: 11, fontWeight: 800, color: rowTotal > 0 ? "#16A34A" : "#CBD5E1" }}>{ltLoading ? "—" : rowTotal}</span>
                                </td>
                                {counts.map((cnt, di) => {
                                  const isToday   = di === 0;
                                  const rtgl      = isToday && LT_UNSIGNED.has(ota) ? (ltRtgl[ota] ?? 0) : 0;
                                  const intensity = cnt > 0 ? Math.round((cnt / maxVal) * 100) : 0;
                                  const bg = cnt === 0 ? (isToday ? "#EEF2FF" : "#FFFFFF") : `${otaColor}${Math.max(18, intensity).toString(16).padStart(2, "0")}`;
                                  return (
                                    <td key={di} style={{ ...LT_TD_C, background: bg, borderLeft: isToday ? "2px solid #C7D2FE" : undefined, borderRight: isToday ? "2px solid #C7D2FE" : `1px solid ${LT_GRID}` }}>
                                      <span style={{ fontSize: 10, fontWeight: cnt > 0 ? 700 : 400, color: cnt > 0 ? (isToday ? "#6366F1" : otaColor) : "#CBD5E1" }}>{ltLoading ? "—" : cnt || "·"}</span>
                                      {!ltLoading && rtgl > 0 && <div style={{ fontSize: 7, fontWeight: 700, color: "#D97706", background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 6, padding: "0 4px", marginTop: 2, whiteSpace: "nowrap" }}>+{rtgl} RTGL</div>}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: "#F1F5F9", borderTop: `2px solid ${LT_GRID}` }}>
                            <td style={{ ...LT_TD_S, background: "#F1F5F9", fontWeight: 800, fontSize: 9, color: "#0F172A", textTransform: "uppercase", letterSpacing: "0.06em", borderBottom: `1px solid ${LT_GRID}` }}>Total</td>
                            <td style={{ ...LT_TD_C, background: "#DCFCE7", borderRight: `1px solid ${LT_GRID}` }}>
                              <span style={{ fontSize: 11, fontWeight: 900, color: "#16A34A" }}>{ltLoading ? "—" : LT_OTAS.reduce((s, ota) => s + (ltDod.byOta[ota] ?? []).reduce((a, v) => a + v, 0), 0)}</span>
                            </td>
                            {revLabels.map((_, di) => {
                              const origDi   = revLabels.length - 1 - di;
                              const dayTotal = LT_OTAS.reduce((s, ota) => s + ((ltDod.byOta[ota] ?? [])[origDi] ?? 0), 0);
                              const isToday  = di === 0;
                              return (
                                <td key={di} style={{ ...LT_TD_C, background: isToday ? "#EEF2FF" : "#F1F5F9", borderLeft: isToday ? "2px solid #C7D2FE" : undefined, borderRight: isToday ? "2px solid #C7D2FE" : `1px solid ${LT_GRID}` }}>
                                  <span style={{ fontSize: 10, fontWeight: dayTotal > 0 ? 800 : 400, color: dayTotal > 0 ? (isToday ? "#6366F1" : "#374151") : "#CBD5E1" }}>{ltLoading ? "—" : dayTotal || "·"}</span>
                                </td>
                              );
                            })}
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Floating Popup ── */}
            {popup && (() => {
              const cats      = data.categories;
              const catMap2   = Object.fromEntries(cats.map(r => [r.ota, r])) as Record<string, CatRow>;
              const otas2     = cats.map(r => r.ota);
              const c         = popup.type === "ota" ? (OTA_COLORS[popup.ota] ?? T.orange) : T.live;
              const TAT_METRICS = [
                { key: "avgTat",  label: "Avg TAT",  fmt: (v: number) => `${v}d`,       color: "#B45309", bg: "#FEF3C7" },
                { key: "d0_7",    label: "0–7d",     fmt: (v: number) => v.toString(),   color: "#16A34A", bg: "#DCFCE7" },
                { key: "d8_15",   label: "8–15d",    fmt: (v: number) => v.toString(),   color: "#B45309", bg: "#FEF3C7" },
                { key: "d16_30",  label: "16–30d",   fmt: (v: number) => v.toString(),   color: "#C2410C", bg: "#FFEDD5" },
                { key: "d31_60",  label: "31–60d",   fmt: (v: number) => v.toString(),   color: "#DC2626", bg: "#FEE2E2" },
                { key: "d60p",    label: "60+d",     fmt: (v: number) => v.toString(),   color: "#7F1D1D", bg: "#FEE2E2" },
              ] as const;
              return (
                <div ref={popupRef} style={{
                  position: "fixed", left: popupPos.x, top: popupPos.y, zIndex: 9999,
                  background: "#FFFFFF", border: `1px solid ${T.cardBdr}`,
                  borderRadius: 12, boxShadow: "0 16px 48px rgba(0,0,0,0.18)",
                  minWidth: 340, maxWidth: 560, userSelect: "none",
                }}>
                  {/* Drag handle / header */}
                  <div onMouseDown={startDrag} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px", borderBottom: `1px solid ${T.cardBdr}`,
                    background: c + "18", borderRadius: "12px 12px 0 0", cursor: "grab",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: c }} />
                      <span style={{ fontSize: 12, fontWeight: 800, color: c }}>
                        {popup.type === "live" ? "TAT Analysis · Live Listings" : `${"ota" in popup ? popup.ota : ""} · Listing Overview`}
                      </span>
                    </div>
                    <button onClick={() => setPopup(null)} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 16, color: T.textMut, lineHeight: 1, padding: "0 4px" }}>×</button>
                  </div>

                  {/* Content */}
                  <div style={{ padding: "14px", maxHeight: 460, overflowY: "auto" }}>

                    {/* ── Live TAT Analysis popup ── */}
                    {popup.type === "live" && (
                      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11 }}>
                        <thead>
                          <tr style={{ background: T.headerBg }}>
                            <th style={{ padding: "7px 10px", textAlign: "left", fontWeight: 700, color: T.textSec, borderBottom: `1px solid ${T.cardBdr}`, whiteSpace: "nowrap" }}>OTA</th>
                            {TAT_METRICS.map(m => (
                              <th key={m.key} style={{ padding: "7px 10px", textAlign: "center", fontWeight: 700, color: m.color, borderBottom: `1px solid ${T.cardBdr}`, whiteSpace: "nowrap" }}>{m.label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {otas2.map(ota => {
                            const ts = data.tatStats[ota];
                            if (!ts) return null;
                            const oc = OTA_COLORS[ota] ?? T.orange;
                            return (
                              <tr key={ota} style={{ borderBottom: `1px solid ${T.cardBdr}` }}>
                                <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 600, color: oc }}>
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: oc }} />{ota}
                                  </span>
                                </td>
                                {TAT_METRICS.map(m => {
                                  const v = ts[m.key] as number;
                                  return (
                                    <td key={m.key} style={{ padding: "7px 10px", textAlign: "center" }}>
                                      {v > 0 ? <span style={{ fontWeight: 700, color: m.color, background: m.color + "15", borderRadius: 4, padding: "2px 8px" }}>{m.fmt(v)}</span> : <span style={{ color: T.textMut }}>—</span>}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                          <tr style={{ borderTop: `2px solid ${T.cardBdr}`, background: T.headerBg }}>
                            <td style={{ padding: "7px 10px", fontWeight: 800, color: T.orange, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Total</td>
                            {TAT_METRICS.map(m => {
                              const liveOtas = otas2.filter(o => data.tatStats[o]);
                              const v = m.key === "avgTat"
                                ? (liveOtas.length > 0 ? Math.round(liveOtas.reduce((s, o) => s + data.tatStats[o].avgTat, 0) / liveOtas.length) : 0)
                                : otas2.reduce((s, o) => s + ((data.tatStats[o]?.[m.key] as number) ?? 0), 0);
                              return (
                                <td key={m.key} style={{ padding: "7px 10px", textAlign: "center" }}>
                                  {v > 0 ? <span style={{ fontWeight: 800, color: m.color, background: m.color + "22", borderRadius: 4, padding: "2px 8px" }}>{m.fmt(v)}</span> : <span style={{ color: T.textMut }}>—</span>}
                                </td>
                              );
                            })}
                          </tr>
                        </tbody>
                      </table>
                    )}

                    {/* ── OTA detail popup ── */}
                    {popup.type === "ota" && (() => {
                      const ota = popup.ota;
                      const cat = catMap2[ota];
                      const ts  = data.tatStats[ota];
                      const tot = cat ? cat.live + cat.exception + (cat.readyToGoLive ?? 0) + cat.inProcess + cat.tatExhausted : 0;
                      const livePct = tot > 0 ? ((cat.live + cat.exception) / tot * 100).toFixed(1) : "0.0";
                      return (
                        <div>
                          {/* Status grid */}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
                            {([
                              { label: "Live",         value: cat?.live ?? 0,          color: T.live,    bg: T.liveL     },
                              { label: "Exception",    value: cat?.exception ?? 0,      color: "#B45309", bg: "#FEF3C7"   },
                              { label: "In Process",   value: cat?.inProcess ?? 0,      color: "#1D4ED8", bg: "#DBEAFE"   },
                              { label: "TAT Exhausted",value: cat?.tatExhausted ?? 0,   color: T.notLive, bg: T.notLiveL  },
                              { label: "Total",        value: tot,                       color: T.orange,  bg: T.orangeL   },
                              { label: "Live %",       value: livePct + "%",             color: T.live,    bg: T.liveL, str: true },
                            ] as const).map(item => (
                              <div key={item.label} style={{ background: item.bg, borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
                                <div style={{ fontSize: 9, color: item.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{item.label}</div>
                                <div style={{ fontSize: 18, fontWeight: 900, color: item.color }}>
                                  {"str" in item ? item.value : (item.value as number).toLocaleString()}
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Sub-status breakdown */}
                          <div style={{ marginBottom: ts ? 14 : 0 }}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: T.textMut, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Sub-status Breakdown</div>
                            {data.columns.map(col => {
                              const v = data.pivot[ota]?.[col] ?? 0;
                              if (!v) return null;
                              const sc = getSSColor(col);
                              return (
                                <div key={col} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderRadius: 6, background: sc.bg, marginBottom: 4 }}>
                                  <span style={{ fontSize: 11, fontWeight: 600, color: sc.text }}>{col}</span>
                                  <span style={{ fontSize: 13, fontWeight: 800, color: sc.text }}>{v.toLocaleString()}</span>
                                </div>
                              );
                            })}
                          </div>

                          {/* TAT stats */}
                          {ts && (
                            <div>
                              <div style={{ fontSize: 9, fontWeight: 700, color: T.textMut, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>TAT · Live Listings</div>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {TAT_METRICS.map(m => {
                                  const v = ts[m.key] as number;
                                  return (
                                    <div key={m.key} style={{ background: m.bg, borderRadius: 6, padding: "6px 10px", textAlign: "center", flex: "1 1 60px" }}>
                                      <div style={{ fontSize: 9, color: m.color, fontWeight: 700, marginBottom: 3 }}>{m.label}</div>
                                      <div style={{ fontSize: 15, fontWeight: 900, color: m.color }}>{v > 0 ? m.fmt(v) : "—"}</div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* ── TAT Exhausted sub-status popup ── */}
                    {popup.type === "tatExhausted" && (
                      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11 }}>
                        <thead>
                          <tr style={{ background: T.headerBg }}>
                            <th style={{ padding: "7px 10px", textAlign: "left", fontWeight: 700, color: T.textSec, borderBottom: `1px solid ${T.cardBdr}`, whiteSpace: "nowrap" }}>Sub-status</th>
                            {otas2.map(ota => {
                              const oc = OTA_COLORS[ota] ?? T.orange;
                              return (
                                <th key={ota} style={{ padding: "7px 10px", textAlign: "center", fontWeight: 700, color: oc, borderBottom: `1px solid ${T.cardBdr}`, whiteSpace: "nowrap", borderTop: `2px solid ${oc}` }}>{ota}</th>
                              );
                            })}
                            <th style={{ padding: "7px 10px", textAlign: "center", fontWeight: 700, color: T.orange, borderBottom: `1px solid ${T.cardBdr}`, borderTop: `2px solid ${T.orange}` }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.tatSubStatusList.map(sub => {
                            const subTot = otas2.reduce((s, ota) => s + (data.tatBreakdown[ota]?.[sub] ?? 0), 0);
                            if (subTot === 0) return null;
                            const sc = getSSColor(sub);
                            return (
                              <tr key={sub} style={{ borderBottom: `1px solid ${T.cardBdr}` }}>
                                <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 600, color: sc.text }}>
                                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.text }} />{sub}
                                  </span>
                                </td>
                                {otas2.map(ota => {
                                  const v = data.tatBreakdown[ota]?.[sub] ?? 0;
                                  return (
                                    <td key={ota} style={{ padding: "7px 10px", textAlign: "center" }}>
                                      {v > 0 ? <span style={{ fontWeight: 700, color: sc.text, background: sc.bg, borderRadius: 4, padding: "2px 8px" }}>{v}</span> : <span style={{ color: T.textMut }}>—</span>}
                                    </td>
                                  );
                                })}
                                <td style={{ padding: "7px 10px", textAlign: "center" }}>
                                  <span style={{ fontWeight: 800, color: sc.text, background: sc.bg, borderRadius: 4, padding: "2px 8px" }}>{subTot}</span>
                                </td>
                              </tr>
                            );
                          })}
                          <tr style={{ borderTop: `2px solid ${T.cardBdr}`, background: T.headerBg }}>
                            <td style={{ padding: "7px 10px", fontWeight: 800, color: T.orange, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>Total</td>
                            {otas2.map(ota => {
                              const v = data.tatSubStatusList.reduce((s, sub) => s + (data.tatBreakdown[ota]?.[sub] ?? 0), 0);
                              return (
                                <td key={ota} style={{ padding: "7px 10px", textAlign: "center" }}>
                                  {v > 0 ? <span style={{ fontWeight: 800, color: T.orange, background: T.orangeL, borderRadius: 4, padding: "2px 8px" }}>{v}</span> : <span style={{ color: T.textMut }}>—</span>}
                                </td>
                              );
                            })}
                            <td style={{ padding: "7px 10px", textAlign: "center" }}>
                              <span style={{ fontWeight: 900, color: T.orange, background: T.orangeT, borderRadius: 4, padding: "2px 8px" }}>
                                {otas2.reduce((s, ota) => s + data.tatSubStatusList.reduce((s2, sub) => s2 + (data.tatBreakdown[ota]?.[sub] ?? 0), 0), 0)}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Not-live property list */}
            <div id="nl-section">
            <NotLiveList
              data={nl} otas={data.otas} columns={data.columns} loading={nlLoading}
              search={nlSearch} selOtas={nlOtas} selSss={nlSss} category={nlCategory}
              onSearch={v    => { setNlSrch(v);  loadNl(1, v, nlOtas, nlSss, nlCategory); }}
              onOtas={v      => { setNlOtas(v);  loadNl(1, nlSearch, v, nlSss, nlCategory); }}
              onSss={v       => { setNlSss(v);   loadNl(1, nlSearch, nlOtas, v, nlCategory); }}
              onCategory={v  => { setNlCat(v);   loadNl(1, nlSearch, nlOtas, nlSss, v); }}
              onPage={p      => loadNl(p, nlSearch, nlOtas, nlSss, nlCategory)}
            />
            </div>
          </>
        );
      })()}

        </>
      ) : (
        <OtaDetailView otaName={selectedOta} />
      )}
    </div>
  );
}

export default function ListingDashboardPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>Loading…</div>}>
      <ListingDashboardInner />
    </Suspense>
  );
}

// ── Checkbox dropdown ────────────────────────────────────────────────────────
function CheckboxDropdown({ label, options, selected, onChange }: {
  label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function toggle(v: string) {
    onChange(selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v]);
  }

  const active = selected.length > 0;
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(x => !x)} style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "5px 9px", fontSize: 11, fontWeight: 600, cursor: "pointer",
        border: `1px solid ${active ? T.orange : T.cardBdr}`,
        borderRadius: 6,
        background: active ? T.orangeL : "#FFFFFF",
        color: active ? T.orange : T.textSec,
      }}>
        {label}
        {active && (
          <span style={{ background: T.orange, color: "#FFF", fontSize: 9, fontWeight: 800, borderRadius: 99, padding: "1px 5px", lineHeight: 1.4 }}>
            {selected.length}
          </span>
        )}
        <span style={{ fontSize: 9, color: active ? T.orange : T.textMut }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 200,
          background: "#FFFFFF", border: `1px solid ${T.cardBdr}`, borderRadius: 8,
          boxShadow: "0 6px 20px rgba(0,0,0,0.12)", minWidth: 190,
          padding: "6px 0", maxHeight: 280, overflowY: "auto",
        }}>
          {(() => {
            const allSelected = options.length > 0 && options.every(o => selected.includes(o));
            return (
              <label style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 12px", cursor: "pointer", fontSize: 11, fontWeight: 600,
                color: T.textSec, background: "transparent",
                borderBottom: `1px solid ${T.cardBdr}`, userSelect: "none",
              }}>
                <input type="checkbox" checked={allSelected}
                  onChange={() => onChange(allSelected ? [] : [...options])}
                  style={{ accentColor: T.orange, width: 13, height: 13, cursor: "pointer" }} />
                Select All
              </label>
            );
          })()}
          {options.map(opt => {
            const checked = selected.includes(opt);
            return (
              <label key={opt} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 12px", cursor: "pointer", fontSize: 11,
                color: checked ? T.orange : T.textPri,
                background: checked ? T.orangeL : "transparent",
                userSelect: "none",
              }}>
                <input type="checkbox" checked={checked} onChange={() => toggle(opt)}
                  style={{ accentColor: T.orange, width: 13, height: 13, cursor: "pointer" }} />
                {opt}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Not-live property list component ────────────────────────────────────────
function NotLiveList({ data, otas, columns, loading, search, selOtas, selSss, category, onSearch, onOtas, onSss, onCategory, onPage }: {
  data: { rows: { propertyId: string; name: string; city: string; fhLiveDate: string | null; ota: string; status: string | null; subStatus: string | null; liveDate: string | null; tat: number; tatError: number }[]; total: number; page: number; pages: number } | null;
  otas: string[]; columns: string[]; loading: boolean;
  search: string; selOtas: string[]; selSss: string[]; category: string;
  onSearch: (v: string) => void; onOtas: (v: string[]) => void; onSss: (v: string[]) => void; onCategory: (v: string) => void; onPage: (p: number) => void;
}) {
  type SortKey = "status" | "subStatus" | "liveDate" | "tat";
  const nonLiveSS = columns.filter(c => c !== "Live" && c !== "Exception");
  const hasFilters = search || selOtas.length > 0 || selSss.length > 0 || category;
  const [sortBy, setSortBy] = useState<SortKey>("tat");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function fmtDate(d: string | null) {
    if (!d) return "—";
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? d : dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" });
  }

  function onSort(key: SortKey) {
    if (sortBy === key) {
      setSortDir(prev => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortBy(key);
    setSortDir(key === "tat" ? "desc" : "asc");
  }

  const sortedRows = React.useMemo(() => {
    if (!data?.rows) return [];
    const rows = [...data.rows];
    rows.sort((a, b) => {
      let av: string | number = "";
      let bv: string | number = "";

      if (sortBy === "status") {
        av = (a.status ?? "").toLowerCase();
        bv = (b.status ?? "").toLowerCase();
      } else if (sortBy === "subStatus") {
        av = (a.subStatus ?? "").toLowerCase();
        bv = (b.subStatus ?? "").toLowerCase();
      } else if (sortBy === "liveDate") {
        av = a.liveDate ? new Date(a.liveDate).getTime() : -1;
        bv = b.liveDate ? new Date(b.liveDate).getTime() : -1;
      } else {
        av = a.tat ?? -1;
        bv = b.tat ?? -1;
      }

      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return rows;
  }, [data?.rows, sortBy, sortDir]);

  function sortIndicator(key: SortKey) {
    if (sortBy !== key) return "↕";
    return sortDir === "asc" ? "↑" : "↓";
  }

  return (
    <div style={{ marginTop: 22, background: "linear-gradient(180deg, #FFFFFF 0%, #FBFDFC 100%)", border: `1px solid ${T.cardBdr}`, borderRadius: 18, overflow: "hidden", boxShadow: "0 16px 36px rgba(15, 23, 42, 0.07)" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${T.cardBdr}`, background: "linear-gradient(180deg, #F8FCFB 0%, #F2F7FB 100%)", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: T.textPri }}>Not Live Properties</span>
          {data && <span style={{ fontSize: 10, color: T.notLive, background: T.notLiveL, padding: "3px 9px", borderRadius: 999, fontWeight: 700, border: "1px solid #FECACA" }}>{data.total.toLocaleString()} records</span>}
        </div>
        {/* Filters */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {/* Category toggle buttons */}
          {[
            { val: "",             label: "All" },
            { val: "inProcess",    label: "In Process" },
            { val: "tatExhausted", label: "TAT Exhausted" },
          ].map(btn => (
            <button key={btn.val} onClick={() => onCategory(btn.val)} style={{
              padding: "5px 11px", fontSize: 10, fontWeight: 700, borderRadius: 999, cursor: "pointer",
              border: `1px solid ${category === btn.val ? T.orange : T.cardBdr}`,
              background: category === btn.val ? T.orangeL : "#FFFFFF",
              color: category === btn.val ? T.orange : T.textSec,
            }}>{btn.label}</button>
          ))}
          <div style={{ width: 1, height: 18, background: T.cardBdr }} />
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 7, top: "50%", transform: "translateY(-50%)", color: T.textMut, fontSize: 12, pointerEvents: "none" }}>⌕</span>
            <input
              value={search} placeholder="Search name / ID…"
              onChange={e => onSearch(e.target.value)}
              style={{ paddingLeft: 22, paddingRight: 10, paddingTop: 7, paddingBottom: 7, fontSize: 11, border: `1px solid ${T.cardBdr}`, borderRadius: 999, outline: "none", width: 190, color: T.textPri, background: "#FFFFFF" }}
            />
          </div>
          <CheckboxDropdown label="OTAs" options={otas} selected={selOtas} onChange={onOtas} />
          <CheckboxDropdown label="Sub-Status" options={nonLiveSS} selected={selSss} onChange={onSss} />
          {hasFilters && (
            <button onClick={() => { onSearch(""); onOtas([]); onSss([]); onCategory(""); }} style={{ padding: "6px 11px", fontSize: 11, background: "#F8FBFD", border: `1px solid ${T.cardBdr}`, borderRadius: 999, cursor: "pointer", color: T.textSec, fontWeight: 700 }}>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%" }}>
          <thead>
            <tr style={{ background: T.headerBg }}>
              {[
                { label: "FH ID" },
                { label: "Property Name" },
                { label: "City" },
                { label: "FH Live" },
                { label: "OTA" },
                { label: "Status", key: "status" as SortKey },
                { label: "Sub Status", key: "subStatus" as SortKey },
                { label: "OTA Live", key: "liveDate" as SortKey },
                { label: "TAT (days)", key: "tat" as SortKey },
                { label: "Open" },
              ].map((h, i) => {
                const sortable = !!h.key;
                return (
                  <th
                    key={h.label}
                    onClick={sortable ? () => onSort(h.key!) : undefined}
                    style={{
                      padding: "7px 12px",
                      fontSize: 9,
                      fontWeight: 700,
                      color: sortable && sortBy === h.key ? T.orange : T.textMut,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      textAlign: i <= 1 ? "left" : "center",
                      borderBottom: `1px solid ${T.cardBdr}`,
                      borderRight: `1px solid ${T.cardBdr}`,
                      whiteSpace: "nowrap",
                      background: T.headerBg,
                      cursor: sortable ? "pointer" : "default",
                      userSelect: "none",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      {h.label}
                      {sortable && <span style={{ fontSize: 10, color: sortBy === h.key ? T.orange : T.textMut }}>{sortIndicator(h.key!)}</span>}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={10} style={{ textAlign: "center", padding: 30, color: T.textMut, fontSize: 11 }}>Loading…</td></tr>
            )}
            {!loading && sortedRows.map((row, i) => {
              const sc = getSSColor(row.subStatus ?? "");
              const otaCol = OTA_COLORS[row.ota] ?? T.orange;
              const isTatError = row.tatError > 0;
              return (
                <tr key={`${row.propertyId}-${row.ota}-${i}`} style={{ borderBottom: `1px solid ${T.cardBdr}`, background: i % 2 === 0 ? "#FFFFFF" : T.headerBg }}>
                  <td style={{ ...NL_TD, fontWeight: 700, color: T.orange, fontFamily: "monospace" }}>{row.propertyId}</td>
                  <td style={{ ...NL_TD, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.name}>{row.name}</td>
                  <td style={{ ...NL_TD, textAlign: "center", color: T.textSec }}>{row.city || "—"}</td>
                  <td style={{ ...NL_TD, textAlign: "center", color: T.textSec, fontFamily: "monospace", fontSize: 10 }}>{fmtDate(row.fhLiveDate)}</td>
                  <td style={{ ...NL_TD, textAlign: "center" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontWeight: 700, color: otaCol }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: otaCol }} />{row.ota}
                    </span>
                  </td>
                  <td style={{ ...NL_TD, textAlign: "center", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.status ?? ""}>
                    <span style={{ fontSize: 10, color: T.textSec }}>{row.status || "—"}</span>
                  </td>
                  <td style={{ ...NL_TD, textAlign: "center" }}>
                    {row.subStatus
                      ? <span style={{ ...numBadge(sc.text, sc.bg, true) }}>{row.subStatus}</span>
                      : <span style={{ color: T.textMut }}>—</span>}
                  </td>
                  <td style={{ ...NL_TD, textAlign: "center", color: T.textSec, fontFamily: "monospace", fontSize: 10 }}>{fmtDate(row.liveDate)}</td>
                  <td style={{ ...NL_TD, textAlign: "center" }}>
                    {row.tat > 0
                      ? <span style={{ fontWeight: 700, color: isTatError ? T.notLive : row.tat > 365 ? "#C2410C" : row.tat > 90 ? "#B45309" : T.textSec }}>{row.tat}d</span>
                      : <span style={{ color: T.textMut }}>—</span>}
                  </td>
                  <td style={{ ...NL_TD, textAlign: "center" }}>
                    <a href={`/crm/${row.propertyId}`} target="_blank" rel="noopener noreferrer" style={{
                      display: "inline-block", padding: "3px 10px", fontSize: 10, fontWeight: 700,
                      background: "#5D87FF18", color: "#5D87FF", border: "1px solid #5D87FF40",
                      borderRadius: 6, textDecoration: "none", whiteSpace: "nowrap",
                    }}>Open ↗</a>
                  </td>
                </tr>
              );
            })}
            {!loading && data?.rows.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: "center", padding: 30, color: T.textMut, fontSize: 11 }}>No records match</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", borderTop: `1px solid ${T.cardBdr}`, background: T.headerBg }}>
          <span style={{ fontSize: 10, color: T.textMut }}>
            {((data.page - 1) * 50 + 1).toLocaleString()}–{Math.min(data.page * 50, data.total).toLocaleString()} of {data.total.toLocaleString()}
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            {[
              { label: "«", p: 1,            dis: data.page === 1 },
              { label: "‹", p: data.page - 1, dis: data.page === 1 },
              { label: "›", p: data.page + 1, dis: data.page === data.pages },
              { label: "»", p: data.pages,    dis: data.page === data.pages },
            ].map(({ label, p, dis }) => (
              <button key={label} onClick={() => onPage(p)} disabled={dis} style={{
                padding: "3px 9px", fontSize: 11, fontWeight: 700,
                background: dis ? "#F1F5F9" : T.orange,
                color:  dis ? T.textMut : "#FFFFFF",
                border: "none", borderRadius: 5,
                cursor: dis ? "not-allowed" : "pointer",
              }}>{label}</button>
            ))}
            <span style={{ padding: "3px 8px", fontSize: 10, color: T.textSec, fontWeight: 600 }}>
              {data.page} / {data.pages}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

const NL_TD: React.CSSProperties = {
  padding: "6px 12px", borderRight: `1px solid #E4E8F0`,
  color: "#0F172A", fontSize: 11,
};

function Dash() { return <span style={{ color: "#CBD5E1", fontSize: 10 }}>—</span>; }

function numBadge(color: string, bg: string, small = false): React.CSSProperties {
  return {
    display: "inline-block",
    padding: small ? "2px 8px" : "3px 10px",
    borderRadius: 6,
    fontWeight: 700,
    fontSize: small ? 10 : 11,
    color,
    background: bg,
    lineHeight: 1.4,
    minWidth: 32,
    textAlign: "center",
  };
}

function actionBtn(bg: string, color: string, disabled: boolean): React.CSSProperties {
  return {
    display: "flex", alignItems: "center", gap: 5,
    padding: "6px 12px", fontSize: 11, fontWeight: 700,
    background: bg, color,
    border: "none", borderRadius: 6,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
    boxShadow: disabled ? "none" : "0 1px 3px rgba(0,0,0,0.15)",
  };
}

const kpi: React.CSSProperties = {
  background: "#FFFFFF",
  border: `1px solid #E2E8F0`,
  borderRadius: 12,
  padding: "10px 14px",
  boxShadow: "0 1px 4px rgba(15,23,42,0.06)",
  color: "#1E293B",
};

const TH_STICKY: React.CSSProperties = {
  textAlign: "left", padding: "7px 12px",
  background: "#F8FAFD", color: "#94A3B8",
  fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em",
  borderRight: "1px solid #E4E8F0", borderBottom: "1px solid #E4E8F0",
  position: "sticky", left: 0, zIndex: 3, whiteSpace: "nowrap", minWidth: 160,
};

const TH_CELL: React.CSSProperties = {
  textAlign: "center", padding: "7px 10px",
  background: "#F8FAFD", color: "#475569",
  fontSize: 10, fontWeight: 700,
  borderRight: "1px solid #E4E8F0", borderBottom: "1px solid #E4E8F0",
  whiteSpace: "nowrap", minWidth: 80,
};

const TD_STICKY: React.CSSProperties = {
  padding: "7px 12px", fontWeight: 600, whiteSpace: "nowrap", fontSize: 11,
  background: "#FFFFFF", borderRight: "1px solid #E4E8F0", borderBottom: "1px solid #E4E8F0",
  position: "sticky", left: 0, zIndex: 1,
};

const TD_CELL: React.CSSProperties = {
  textAlign: "center", padding: "6px 8px",
  background: "#FFFFFF",
  borderRight: "1px solid #E4E8F0", borderBottom: "1px solid #E4E8F0",
};

