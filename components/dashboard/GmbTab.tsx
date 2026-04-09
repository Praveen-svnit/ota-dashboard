"use client";

import { useEffect, useState } from "react";

interface GmbRow {
  propertyId: string; propertyName: string; city: string; createdAt: string;
  fhStatus: string; prePost: string; gmbStatus: string; gmbSubStatus: string;
  listingType: string; number: string; reviewLinkTracker: string;
  gmbRating: string; gmbReviewCount: string;
}
interface Stats {
  total: number; gmbLive: number; gmbNotLive: number; fhLive: number;
  preset: number; postset: number; avgRating: number | null;
}

const TH: React.CSSProperties = {
  padding: "7px 12px", fontSize: 10, fontWeight: 700, color: "#64748B",
  background: "#F8FAFC", borderBottom: "1px solid #E2E8F0",
  whiteSpace: "nowrap", textAlign: "left", position: "sticky", top: 0, zIndex: 1,
};
const TD: React.CSSProperties = {
  padding: "7px 12px", fontSize: 11, whiteSpace: "nowrap",
  borderBottom: "1px solid #F1F5F9", verticalAlign: "middle",
};

function statusPill(val: string | null, map: Record<string, { bg: string; color: string }>) {
  if (!val) return <span style={{ color: "#CBD5E1" }}>—</span>;
  const style = map[val.toLowerCase()] ?? { bg: "#F1F5F9", color: "#64748B" };
  return (
    <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
      background: style.bg, color: style.color, border: `1px solid ${style.color}30` }}>
      {val}
    </span>
  );
}

const GMB_STATUS_MAP: Record<string, { bg: string; color: string }> = {
  live:         { bg: "#D1FAE5", color: "#059669" },
  "not live":   { bg: "#FEE2E2", color: "#DC2626" },
  "in process": { bg: "#FEF3C7", color: "#D97706" },
  pending:      { bg: "#FEF3C7", color: "#D97706" },
  closed:       { bg: "#F1F5F9", color: "#64748B" },
};
const FH_STATUS_MAP: Record<string, { bg: string; color: string }> = {
  live:    { bg: "#D1FAE5", color: "#059669" },
  soldout: { bg: "#EEF2FF", color: "#6366F1" },
  closed:  { bg: "#F1F5F9", color: "#64748B" },
};

export default function GmbTab() {
  const [rows,    setRows]    = useState<GmbRow[]>([]);
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [empty,   setEmpty]   = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncErr, setSyncErr] = useState(false);
  const [search,  setSearch]  = useState("");
  const [gmbFilter,  setGmbFilter]  = useState("all");
  const [cityFilter, setCityFilter] = useState("all");
  const [showSummary, setShowSummary] = useState(true);

  const load = () => {
    setLoading(true);
    fetch("/api/gmb-data")
      .then((r) => r.json())
      .then((d) => {
        if (d.empty) { setEmpty(true); setRows([]); setStats(null); }
        else { setEmpty(false); setRows(d.rows ?? []); setStats(d.stats ?? null); }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  async function runSync() {
    setSyncing(true); setSyncMsg(null); setSyncErr(false);
    try {
      const res  = await fetch("/api/sync-gmb", { method: "POST" });
      const json = await res.json();
      if (!res.ok || json.error) { setSyncMsg(json.error ?? "Sync failed"); setSyncErr(true); }
      else { setSyncMsg(json.log ?? "Sync complete"); setSyncErr(false); load(); }
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : "Network error"); setSyncErr(true);
    } finally { setSyncing(false); }
  }

  const cities     = ["all", ...Array.from(new Set(rows.map((r) => r.city).filter(Boolean))).sort()];
  const gmbStatuses = ["all", ...Array.from(new Set(rows.map((r) => r.gmbStatus).filter(Boolean))).sort()];

  const filtered = rows.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.propertyName?.toLowerCase().includes(q) || r.propertyId?.includes(q) || r.city?.toLowerCase().includes(q);
    const matchGmb  = gmbFilter === "all" || r.gmbStatus?.toLowerCase() === gmbFilter.toLowerCase();
    const matchCity = cityFilter === "all" || r.city === cityFilter;
    return matchSearch && matchGmb && matchCity;
  });

  return (
    <div style={{ marginTop: 8 }}>
      {/* KPI tiles */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 16 }}>
          {[
            { label: "Total",        val: stats.total,             color: "#6366F1" },
            { label: "GMB Live",     val: stats.gmbLive,           color: "#059669" },
            { label: "GMB Not Live", val: stats.gmbNotLive,        color: "#DC2626" },
            { label: "FH Live",      val: stats.fhLive,            color: "#10B981" },
            { label: "Pre-Set",      val: stats.preset,            color: "#F59E0B" },
            { label: "Avg Rating",   val: stats.avgRating ?? "—",  color: "#8B5CF6" },
          ].map(({ label, val, color }) => (
            <div key={label} style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 12,
              padding: "12px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase",
                letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color }}>{val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Sub-status summary */}
      {rows.length > 0 && (() => {
        const subMap: Record<string, { total: number; fhLive: number; ratings: number[]; reviews: number }> = {};
        for (const r of rows) {
          const key = r.gmbSubStatus?.trim() || "Unknown";
          if (!subMap[key]) subMap[key] = { total: 0, fhLive: 0, ratings: [], reviews: 0 };
          const e = subMap[key];
          e.total++;
          if (r.fhStatus?.toLowerCase() === "live") e.fhLive++;
          const rat = parseFloat(r.gmbRating);    if (!isNaN(rat)) e.ratings.push(rat);
          const rev = parseInt(r.gmbReviewCount); if (!isNaN(rev)) e.reviews += rev;
        }
        const subRows = Object.entries(subMap).sort((a, b) => b[1].total - a[1].total);
        const grand   = subRows.reduce((acc, [, v]) => {
          acc.total += v.total; acc.fhLive += v.fhLive; acc.reviews += v.reviews;
          acc.ratings.push(...v.ratings); return acc;
        }, { total: 0, fhLive: 0, reviews: 0, ratings: [] as number[] });
        const avgRat = (rs: number[]) => rs.length ? (rs.reduce((a, b) => a + b, 0) / rs.length).toFixed(1) : "—";
        const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
          live: { bg: "#D1FAE5", color: "#059669" }, "not live": { bg: "#FEE2E2", color: "#DC2626" },
          "in process": { bg: "#FEF3C7", color: "#D97706" }, pending: { bg: "#FEF3C7", color: "#D97706" },
          closed: { bg: "#F1F5F9", color: "#64748B" }, unknown: { bg: "#F1F5F9", color: "#94A3B8" },
        };
        return (
          <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 12,
            overflow: "hidden", marginBottom: 14 }}>
            <button onClick={() => setShowSummary((s) => !s)} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 8,
              padding: "9px 14px", background: "none", border: "none", cursor: "pointer",
              borderBottom: showSummary ? "1px solid #F1F5F9" : "none",
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#0F172A" }}>Sub-Status Summary</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "#94A3B8" }}>{showSummary ? "▲" : "▼"}</span>
            </button>
            {showSummary && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11 }}>
                  <thead>
                    <tr>
                      {["GMB Sub Status","Count","% of Total","FH Live","Avg Rating","Total Reviews"].map((h) => (
                        <th key={h} style={{ ...TH, textAlign: h === "GMB Sub Status" ? "left" : "center" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {subRows.map(([sub, v]) => {
                      const pct   = grand.total > 0 ? Math.round((v.total / grand.total) * 100) : 0;
                      const style = STATUS_STYLE[sub.toLowerCase()] ?? { bg: "#F1F5F9", color: "#64748B" };
                      return (
                        <tr key={sub}>
                          <td style={{ ...TD, fontWeight: 600 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 10px", borderRadius: 20,
                              background: style.bg, color: style.color, border: `1px solid ${style.color}30` }}>{sub}</span>
                          </td>
                          <td style={{ ...TD, textAlign: "center", fontWeight: 800 }}>{v.total}</td>
                          <td style={{ ...TD, textAlign: "center" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}>
                              <div style={{ width: 60, height: 5, background: "#F1F5F9", borderRadius: 3 }}>
                                <div style={{ height: "100%", width: `${pct}%`, background: style.color, borderRadius: 3 }} />
                              </div>
                              <span style={{ fontSize: 10, fontWeight: 700, color: style.color }}>{pct}%</span>
                            </div>
                          </td>
                          <td style={{ ...TD, textAlign: "center", color: "#059669", fontWeight: 600 }}>{v.fhLive}</td>
                          <td style={{ ...TD, textAlign: "center", fontWeight: 700,
                            color: v.ratings.length ? (parseFloat(avgRat(v.ratings)) >= 4 ? "#059669" : "#D97706") : "#CBD5E1" }}>
                            {v.ratings.length ? `★ ${avgRat(v.ratings)}` : "—"}
                          </td>
                          <td style={{ ...TD, textAlign: "center", color: "#6366F1", fontWeight: 600 }}>
                            {v.reviews > 0 ? v.reviews.toLocaleString() : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#F8FAFC", borderTop: "2px solid #E2E8F0" }}>
                      <td style={{ ...TD, fontWeight: 800, fontSize: 10, color: "#475569" }}>Total</td>
                      <td style={{ ...TD, textAlign: "center", fontWeight: 900 }}>{grand.total}</td>
                      <td style={{ ...TD, textAlign: "center", fontWeight: 800 }}>100%</td>
                      <td style={{ ...TD, textAlign: "center", fontWeight: 800, color: "#059669" }}>{grand.fhLive}</td>
                      <td style={{ ...TD, textAlign: "center", fontWeight: 800, color: "#8B5CF6" }}>★ {avgRat(grand.ratings)}</td>
                      <td style={{ ...TD, textAlign: "center", fontWeight: 800, color: "#6366F1" }}>{grand.reviews.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* Filters + Sync */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search property, city…"
          style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 11, outline: "none", width: 220 }} />
        <select value={gmbFilter} onChange={(e) => setGmbFilter(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 11, background: "#FFF" }}>
          {gmbStatuses.map((s) => <option key={s} value={s}>{s === "all" ? "All GMB Status" : s}</option>)}
        </select>
        <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #E2E8F0", fontSize: 11, background: "#FFF" }}>
          {cities.map((c) => <option key={c} value={c}>{c === "all" ? "All Cities" : c}</option>)}
        </select>
        <span style={{ fontSize: 10, color: "#94A3B8", marginLeft: "auto" }}>{filtered.length} of {rows.length} shown</span>
      </div>

      {/* Table */}
      <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 12 }}>Loading…</div>
        ) : empty ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 6 }}>No GMB data yet</div>
            <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 16 }}>Go to Migration page and run Sync All OTAs to load GMB data.</div>
          </div>
        ) : (
          <div style={{ overflowX: "auto", maxHeight: "60vh", overflowY: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ ...TH, minWidth: 50 }}>#</th>
                  <th style={{ ...TH, minWidth: 200 }}>Property</th>
                  <th style={{ ...TH, minWidth: 110 }}>City</th>
                  <th style={{ ...TH, minWidth: 80 }}>FH Status</th>
                  <th style={{ ...TH, minWidth: 70 }}>Pre/Post</th>
                  <th style={{ ...TH, minWidth: 90 }}>GMB Status</th>
                  <th style={{ ...TH, minWidth: 110 }}>GMB Sub Status</th>
                  <th style={{ ...TH, minWidth: 90 }}>Listing Type</th>
                  <th style={{ ...TH, textAlign: "center", minWidth: 70 }}>Rating</th>
                  <th style={{ ...TH, textAlign: "center", minWidth: 70 }}>Reviews</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr key={row.propertyId} style={{ background: i % 2 === 0 ? "#FFF" : "#FAFBFF" }}>
                    <td style={{ ...TD, color: "#94A3B8", fontSize: 10 }}>{row.propertyId}</td>
                    <td style={{ ...TD, fontWeight: 600, color: "#1E293B", maxWidth: 240 }}>
                      <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{row.propertyName}</div>
                    </td>
                    <td style={{ ...TD, color: "#64748B" }}>{row.city || "—"}</td>
                    <td style={{ ...TD }}>{statusPill(row.fhStatus, FH_STATUS_MAP)}</td>
                    <td style={{ ...TD }}>
                      {row.prePost ? (
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                          background: row.prePost.toLowerCase() === "preset" ? "#FEF3C7" : "#EEF2FF",
                          color:      row.prePost.toLowerCase() === "preset" ? "#D97706"  : "#6366F1" }}>
                          {row.prePost}
                        </span>
                      ) : "—"}
                    </td>
                    <td style={{ ...TD }}>{statusPill(row.gmbStatus, GMB_STATUS_MAP)}</td>
                    <td style={{ ...TD }}>{statusPill(row.gmbSubStatus, GMB_STATUS_MAP)}</td>
                    <td style={{ ...TD, color: "#64748B" }}>{row.listingType || "—"}</td>
                    <td style={{ ...TD, textAlign: "center" }}>
                      {row.gmbRating ? (
                        <span style={{ fontSize: 12, fontWeight: 800,
                          color: parseFloat(row.gmbRating) >= 4 ? "#059669" : "#D97706" }}>
                          ★ {row.gmbRating}
                        </span>
                      ) : "—"}
                    </td>
                    <td style={{ ...TD, textAlign: "center", fontWeight: 700, color: "#6366F1" }}>
                      {row.gmbReviewCount || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
