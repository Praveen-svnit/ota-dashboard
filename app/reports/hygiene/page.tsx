"use client";
import { useEffect, useMemo, useRef, useState } from "react";

const T = {
  pageBg: "#F9FAFB", cardBg: "#FFFFFF", cardBdr: "#E5E7EB",
  headerBg: "#F8FAFC", textPri: "#0F172A", textSec: "#64748B", textMut: "#94A3B8",
};

const PREF_STYLE: Record<string, { color: string; bg: string }> = {
  "Preferred+": { color: "#7C3AED", bg: "#F5F3FF" },
  "Preferred":  { color: "#2563EB", bg: "#EFF6FF" },
  "None":       { color: "#6B7280", bg: "#F3F4F6" },
};
function prefStyle(s: string) {
  return PREF_STYLE[s] ?? { color: "#94A3B8", bg: "#F9FAFB" };
}

interface Row {
  prop_id: string; bdc_id: string; prop_name: string; city: string;
  review_score: string; review_count: string; preferred: string;
  genius_level: string; perf_score: string; top_promotion: string;
  commission_pct: string; views: string; conversion_pct: string; page_score: string;
  last_checked: string; syncedAt: string;
}
interface ScraperStatus {
  status: "idle" | "starting" | "waiting_login" | "running" | "done" | "error" | "stopped";
  done: number; total: number; current: string; log: string[];
  error?: string; finishedAt?: string;
}

const PAGE_SIZE = 75;

export default function HygieneReportPage() {
  const [rows,     setRows]     = useState<Row[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState("");
  const [filter,   setFilter]   = useState<"all" | "pp" | "p" | "none" | "unchecked">("all");
  const [page,     setPage]     = useState(1);
  const [scraper,  setScraper]  = useState<ScraperStatus>({ status: "idle", done: 0, total: 0, current: "", log: [] });
  const [showLog,  setShowLog]  = useState(false);
  const logRef  = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadData() {
    const r = await fetch("/api/hygiene-data");
    const d = await r.json();
    setRows(d.rows ?? []);
    setLoading(false);
  }

  function startPolling() {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      const r = await fetch("/api/hygiene-scraper-status").then(r => r.json()) as ScraperStatus;
      setScraper(r);
      if (r.status === "done") { stopPolling(); loadData(); }
      if (r.status === "error") stopPolling();
    }, 2000);
  }
  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  useEffect(() => {
    loadData();
    fetch("/api/hygiene-scraper-status").then(r => r.json()).then((s: ScraperStatus) => {
      setScraper(s);
      if (s.status === "running" || s.status === "waiting_login" || s.status === "starting") startPolling();
    });
    return () => stopPolling();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [scraper.log]);

  useEffect(() => { setPage(1); }, [search, filter]);

  async function startScraper() {
    setScraper({ status: "starting", done: 0, total: 0, current: "", log: [] });
    setShowLog(true);
    const r = await fetch("/api/run-hygiene-scraper", { method: "POST" });
    const d = await r.json();
    if (d.error) { setScraper(s => ({ ...s, status: "error", error: d.error })); return; }
    startPolling();
  }

  async function stopScraper() {
    stopPolling();
    await fetch("/api/run-hygiene-scraper", { method: "DELETE" });
    setScraper(s => ({ ...s, status: "stopped" as ScraperStatus["status"], current: "", log: [...s.log, "⛔ Stopped by user"] }));
  }

  const isActive = ["starting", "waiting_login", "running"].includes(scraper.status);
  const pct = scraper.total > 0 ? Math.round((scraper.done / scraper.total) * 100) : 0;

  const filtered = useMemo(() => {
    let list = rows;
    if (filter === "pp")        list = list.filter(r => r.preferred === "Preferred+");
    if (filter === "p")         list = list.filter(r => r.preferred === "Preferred");
    if (filter === "none")      list = list.filter(r => r.preferred === "None");
    if (filter === "unchecked") list = list.filter(r => !r.last_checked);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(r =>
        r.prop_name?.toLowerCase().includes(q) ||
        r.bdc_id?.includes(q) ||
        r.prop_id?.includes(q) ||
        r.city?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [rows, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const TH: React.CSSProperties = { padding: "7px 10px", fontSize: 9, fontWeight: 700, color: T.textMut, textTransform: "uppercase", letterSpacing: "0.08em", background: T.headerBg, borderBottom: `1px solid ${T.cardBdr}`, borderRight: `1px solid ${T.cardBdr}`, whiteSpace: "nowrap" };
  const TD: React.CSSProperties = { padding: "6px 10px", fontSize: 11, borderBottom: `1px solid ${T.cardBdr}`, borderRight: `1px solid ${T.cardBdr}`, color: T.textPri };

  return (
    <div style={{ padding: "20px 24px", background: T.pageBg, minHeight: "100vh" }}>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: T.textPri }}>BDC Hygiene Report</span>
          {!loading && <span style={{ fontSize: 11, color: "#2563EB", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 6, padding: "2px 10px", fontWeight: 600 }}>{rows.length.toLocaleString()} properties</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isActive && (
            <button onClick={stopScraper} style={{ padding: "6px 14px", fontSize: 11, fontWeight: 700, color: "#FFF", background: "#DC2626", border: "none", borderRadius: 8, cursor: "pointer" }}>
              ⏹ Stop
            </button>
          )}
          {isActive && (
            <button onClick={() => setShowLog(v => !v)} style={{ padding: "6px 12px", fontSize: 11, fontWeight: 700, color: "#7C3AED", background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 8, cursor: "pointer" }}>
              {showLog ? "Hide Log" : "Show Log"}
            </button>
          )}
          {!isActive && (
            <button onClick={startScraper} style={{ padding: "6px 14px", fontSize: 11, fontWeight: 700, color: "#FFF", background: "#7C3AED", border: "none", borderRadius: 8, cursor: "pointer" }}>
              ▶ Run Scraper
            </button>
          )}
        </div>
      </div>

      {/* Scraper status panel */}
      {(isActive || ["done", "error", "stopped"].includes(scraper.status)) && (
        <div style={{ marginBottom: 14, background: T.cardBg, border: `1px solid ${T.cardBdr}`, borderRadius: 10, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: `1px solid ${T.cardBdr}`, background: T.headerBg, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: scraper.status === "done" ? "#16A34A" : scraper.status === "error" ? "#DC2626" : scraper.status === "stopped" ? "#6B7280" : scraper.status === "waiting_login" ? "#F97316" : "#7C3AED", display: "inline-block", flexShrink: 0, animation: isActive ? "pulse 1.2s infinite" : "none" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: T.textPri }}>
                {scraper.status === "starting"      ? "Starting scraper…" :
                 scraper.status === "waiting_login" ? "⏳ Waiting for Booking.com login in browser…" :
                 scraper.status === "running"       ? `Scraping: ${scraper.current}` :
                 scraper.status === "done"          ? "✓ Scrape complete" :
                 scraper.status === "stopped"       ? "⛔ Stopped" :
                 scraper.status === "error"         ? `Error: ${scraper.error}` : ""}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {scraper.total > 0 && (
                <span style={{ fontSize: 11, color: T.textSec, fontWeight: 600 }}>{scraper.done} / {scraper.total}</span>
              )}
              <button onClick={() => setShowLog(v => !v)} style={{ fontSize: 10, color: T.textSec, background: "transparent", border: `1px solid ${T.cardBdr}`, borderRadius: 5, padding: "2px 8px", cursor: "pointer" }}>
                {showLog ? "Hide log" : "Show log"}
              </button>
            </div>
          </div>
          {scraper.total > 0 && (
            <div style={{ height: 4, background: "#F1F5F9" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: scraper.status === "done" ? "#16A34A" : "#7C3AED", transition: "width 0.4s ease" }} />
            </div>
          )}
          {showLog && (
            <div>
              <div style={{ display: "flex", justifyContent: "flex-end", padding: "4px 14px", background: "#0F172A", borderTop: `1px solid ${T.cardBdr}` }}>
                <button
                  onClick={() => navigator.clipboard.writeText(scraper.log.join("\n"))}
                  style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", background: "transparent", border: "1px solid #334155", borderRadius: 4, padding: "2px 10px", cursor: "pointer" }}
                >
                  Copy Log
                </button>
              </div>
              <div ref={logRef} style={{ maxHeight: 220, overflowY: "auto", padding: "8px 14px", fontFamily: "monospace", fontSize: 11, color: T.textSec, background: "#0F172A", lineHeight: 1.7 }}>
                {scraper.log.length === 0 ? <span style={{ color: "#64748B" }}>Waiting for output…</span> : scraper.log.map((line, i) => (
                  <div key={i} style={{ color: line.startsWith("❌") || line.startsWith("Error") ? "#F87171" : line.startsWith("✅") || line.startsWith("🎉") ? "#4ADE80" : line.startsWith("⚠️") ? "#FBBF24" : line.startsWith("⏳") || line.startsWith("📊") ? "#60A5FA" : "#CBD5E1" }}>
                    {line}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter bar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", borderRadius: 7, border: `1px solid ${T.cardBdr}`, overflow: "hidden" }}>
          {([["all", "All"], ["pp", "Preferred+"], ["p", "Preferred"], ["none", "None"], ["unchecked", "Unchecked"]] as const).map(([v, lbl]) => (
            <button key={v} onClick={() => setFilter(v)} style={{ padding: "5px 12px", fontSize: 11, fontWeight: 700, border: "none", borderLeft: v !== "all" ? `1px solid ${T.cardBdr}` : "none", cursor: "pointer", fontFamily: "inherit", background: filter === v ? T.textPri : T.cardBg, color: filter === v ? "#FFF" : T.textSec }}>
              {lbl}
            </button>
          ))}
        </div>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", color: T.textMut, fontSize: 12, pointerEvents: "none" }}>⌕</span>
          <input value={search} placeholder="Name / Prop ID / BDC ID / City…" onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 24, paddingRight: 8, paddingTop: 5, paddingBottom: 5, fontSize: 11, border: `1px solid ${T.cardBdr}`, borderRadius: 7, outline: "none", width: 230, color: T.textPri, background: "#FFF" }} />
        </div>
        {(search || filter !== "all") && (
          <button onClick={() => { setSearch(""); setFilter("all"); }} style={{ padding: "5px 10px", fontSize: 11, fontWeight: 600, color: T.textSec, background: "transparent", border: `1px solid ${T.cardBdr}`, borderRadius: 7, cursor: "pointer" }}>Clear</button>
        )}
        {filtered.length !== rows.length && !loading && (
          <span style={{ fontSize: 11, color: T.textSec }}>{filtered.length.toLocaleString()} of {rows.length.toLocaleString()}</span>
        )}
      </div>

      {/* Table */}
      <div style={{ background: T.cardBg, border: `1px solid ${T.cardBdr}`, borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 11, width: "100%" }}>
            <thead>
              <tr>
                <th style={{ ...TH, textAlign: "left" }}>Prop ID</th>
                <th style={{ ...TH, textAlign: "left", minWidth: 200 }}>Property Name</th>
                <th style={{ ...TH, textAlign: "left" }}>City</th>
                <th style={{ ...TH, textAlign: "left" }}>BDC ID</th>
                <th style={{ ...TH, textAlign: "center" }}>Score</th>
                <th style={{ ...TH, textAlign: "center" }}>Reviews</th>
                <th style={{ ...TH, textAlign: "center", minWidth: 110 }}>Preferred</th>
                <th style={{ ...TH, textAlign: "center" }}>Genius</th>
                <th style={{ ...TH, textAlign: "center" }}>Perf Score</th>
                <th style={{ ...TH, textAlign: "center" }}>Top Promo</th>
                <th style={{ ...TH, textAlign: "center" }}>Commission</th>
                <th style={{ ...TH, textAlign: "center" }}>Views</th>
                <th style={{ ...TH, textAlign: "center" }}>Conversion</th>
                <th style={{ ...TH, textAlign: "center" }}>Page Score</th>
                <th style={{ ...TH, textAlign: "center", borderRight: "none" }}>Last Checked</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={13} style={{ textAlign: "center", padding: 36, color: T.textMut }}>Loading…</td></tr>}
              {!loading && pageItems.length === 0 && (
                <tr><td colSpan={13} style={{ textAlign: "center", padding: 36, color: T.textMut }}>
                  {rows.length === 0 ? 'No data — click "Run Scraper" to start' : "No records match"}
                </td></tr>
              )}
              {!loading && pageItems.map((row, i) => {
                const ps = prefStyle(row.preferred);
                return (
                  <tr key={row.bdc_id} style={{ background: i % 2 === 0 ? T.cardBg : T.headerBg }}>
                    <td style={{ ...TD, fontFamily: "monospace", fontWeight: 700, color: "#F97316" }}>{row.prop_id || "—"}</td>
                    <td style={{ ...TD, fontWeight: 500, maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.prop_name}>{row.prop_name || "—"}</td>
                    <td style={{ ...TD, color: T.textSec }}>{row.city || "—"}</td>
                    <td style={{ ...TD, fontFamily: "monospace", color: "#003580", fontWeight: 600 }}>{row.bdc_id}</td>
                    <td style={{ ...TD, textAlign: "center", fontWeight: 600 }}>{row.review_score || "—"}</td>
                    <td style={{ ...TD, textAlign: "center", color: T.textSec }}>{row.review_count ? Number(row.review_count).toLocaleString() : "—"}</td>
                    <td style={{ ...TD, textAlign: "center" }}>
                      {row.preferred
                        ? <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 99, fontSize: 10, fontWeight: 700, color: ps.color, background: ps.bg }}>{row.preferred}</span>
                        : <span style={{ color: T.textMut }}>—</span>}
                    </td>
                    <td style={{ ...TD, textAlign: "center" }}>
                      {row.genius_level ? <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700, color: row.genius_level === "G3" ? "#16A34A" : row.genius_level === "G2" ? "#7C3AED" : row.genius_level === "G1" ? "#2563EB" : "#6B7280", background: row.genius_level === "G3" ? "#DCFCE7" : row.genius_level === "G2" ? "#F5F3FF" : row.genius_level === "G1" ? "#EFF6FF" : "#F3F4F6" }}>{row.genius_level}</span> : <span style={{ color: T.textMut }}>—</span>}
                    </td>
                    <td style={{ ...TD, textAlign: "center", color: T.textSec, fontFamily: "monospace" }}>{row.perf_score || "—"}</td>
                    <td style={{ ...TD, textAlign: "center", fontWeight: 700, color: row.top_promotion && row.top_promotion !== "None" ? "#16A34A" : T.textMut }}>{row.top_promotion || "—"}</td>
                    <td style={{ ...TD, textAlign: "center", fontFamily: "monospace", fontWeight: 600 }}>{row.commission_pct || "—"}</td>
                    <td style={{ ...TD, textAlign: "center", color: T.textSec }}>{row.views ? Number(row.views).toLocaleString() : "—"}</td>
                    <td style={{ ...TD, textAlign: "center", fontFamily: "monospace" }}>{row.conversion_pct || "—"}</td>
                    <td style={{ ...TD, textAlign: "center", fontWeight: 600, color: row.page_score === "100%" ? "#16A34A" : T.textPri }}>{row.page_score || "—"}</td>
                    <td style={{ ...TD, textAlign: "center", color: T.textSec, fontFamily: "monospace", fontSize: 10, borderRight: "none" }}>{row.last_checked || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", borderTop: `1px solid ${T.cardBdr}`, background: T.headerBg }}>
            <span style={{ fontSize: 10, color: T.textMut }}>{((page - 1) * PAGE_SIZE + 1).toLocaleString()}–{Math.min(page * PAGE_SIZE, filtered.length).toLocaleString()} of {filtered.length.toLocaleString()}</span>
            <div style={{ display: "flex", gap: 4 }}>
              {(["«", "‹", "›", "»"] as const).map((lbl) => {
                const p   = lbl === "«" ? 1 : lbl === "‹" ? page - 1 : lbl === "›" ? page + 1 : totalPages;
                const dis = (lbl === "«" || lbl === "‹") ? page === 1 : page === totalPages;
                return <button key={lbl} onClick={() => setPage(p)} disabled={dis} style={{ padding: "3px 9px", fontSize: 11, fontWeight: 700, background: dis ? "#F1F5F9" : "#7C3AED", color: dis ? T.textMut : "#FFF", border: "none", borderRadius: 5, cursor: dis ? "not-allowed" : "pointer" }}>{lbl}</button>;
              })}
              <span style={{ padding: "3px 8px", fontSize: 10, color: T.textSec, fontWeight: 600 }}>{page}/{totalPages}</span>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}
