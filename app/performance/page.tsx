"use client";

import { useEffect, useState } from "react";

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

const MONTH_DAYS: Record<string, number> = {
  Jan: 31, Feb: 28, Mar: 31, Apr: 30, May: 31, Jun: 30,
  Jul: 31, Aug: 31, Sep: 30, Oct: 31, Nov: 30, Dec: 31,
};

/* ── Team structure ─────────────────────────────────────────────────────── */
interface Member { name: string; ota?: string; role?: string; pip?: boolean; adhoc?: boolean }
interface TeamLead { name: string; color: string; members: Member[]; type: "ota" | "ops" }

const TEAMS: TeamLead[] = [
  {
    name: "Jyoti", color: "#E83F6F", type: "ota",
    members: [
      { name: "Rudra",    ota: "GoMMT"     },
      { name: "Mohit",    ota: "Expedia"   },
      { name: "Karan",    ota: "Cleartrip" },
      { name: "Abhishek", ota: "Indigo"    },
      { name: "Umesh",    role: "Ria Travels" },
      { name: "Rahul",    role: "Ad-Hoc", pip: true },
    ],
  },
  {
    name: "Gourav", color: "#F59E0B", type: "ota",
    members: [
      { name: "Aman",     ota: "Agoda"        },
      { name: "Ajeet",    ota: "Yatra"         },
      { name: "Shrishti", ota: "Ixigo",        pip: true },
      { name: "Joti",     ota: "Akbar Travels" },
      { name: "Vipul",    ota: "EaseMyTrip"    },
    ],
  },
  {
    name: "Ajay", color: "#10B981", type: "ota",
    members: [
      { name: "Gaurav Pandey", ota: "Booking.com"  },
      { name: "Sadik",         role: "BDC Content", pip: true },
      { name: "Sajjak",        role: "BDC Content" },
    ],
  },
  {
    name: "Salim", color: "#8B5CF6", type: "ops",
    members: [
      { name: "Karan",      role: "FH Onboarding" },
      { name: "Vishal",     role: "FH Listing"    },
      { name: "Ajay Dhama", role: "FH Images & GMB" },
      { name: "Yash",       role: "OTA RLD"       },
      { name: "Gunjan",     role: "OTA Images"    },
      { name: "Vanshika",   role: "OTA Images"    },
    ],
  },
];

/* ── Data interfaces ────────────────────────────────────────────────────── */
interface MtdListing { ota: string; cmMTD: number; lmSameDay: number; lmTotal: number }

/* ── Score out of 5 (0.5 steps) ─────────────────────────────────────────
   Live Rate  → base score 0–5   (primary driver)
   Per Day CM → pace bonus 0–3   (effort compensator — rewards high pace
                                   even when live rate is still building)
   Final = min(5, round to nearest 0.5)

   Calibration:
     Aman  (98% lr, 5.5/day)  → 5.0   [lr=5.0, pd bonus=0, total=5.0]
     Rudra (96% lr, 4.9/day)  → 4.5   [lr=4.5, pd bonus=0, total=4.5]
     Shrishti (23% lr, 22.6/day) → 3.5 [lr=0.5, pd bonus=3.0, total=3.5]
   ──────────────────────────────────────────────────────────────────── */
function computeScore(liveRate: number, cmPerDay: number | null): number {
  let lr = 0;
  if      (liveRate >= 97) lr = 5.0;
  else if (liveRate >= 95) lr = 4.5;
  else if (liveRate >= 90) lr = 4.0;
  else if (liveRate >= 80) lr = 3.0;
  else if (liveRate >= 65) lr = 2.0;
  else if (liveRate >= 50) lr = 1.5;
  else if (liveRate >= 35) lr = 1.0;
  else if (liveRate >= 20) lr = 0.5;

  let pd = 0;
  if (cmPerDay !== null) {
    if      (cmPerDay >= 20) pd = 3.0;
    else if (cmPerDay >= 12) pd = 2.0;
    else if (cmPerDay >= 8)  pd = 1.5;
    else if (cmPerDay >= 6)  pd = 0.5;
  }

  return Math.min(5, Math.round((lr + pd) * 2) / 2);
}

function scoreMeta(score: number): { color: string; bg: string } {
  if (score >= 4.5) return { color: "#6366F1", bg: "#EEF2FF" };
  if (score >= 3.5) return { color: "#10B981", bg: "#D1FAE5" };
  if (score >= 2.5) return { color: "#F59E0B", bg: "#FFF7ED" };
  if (score >= 1.0) return { color: "#F97316", bg: "#FFF7ED" };
  return               { color: "#EF4444", bg: "#FEF2F2" };
}

/* ── Shared cell style helpers ──────────────────────────────────────────── */
const TD: React.CSSProperties = { padding: "7px 12px", whiteSpace: "nowrap", verticalAlign: "middle" };
const TH_BASE: React.CSSProperties = {
  padding: "8px 12px", fontSize: 9, fontWeight: 700, color: "#94A3B8",
  background: "#F8FAFC", borderBottom: "1px solid #E2E8F0",
  whiteSpace: "nowrap", letterSpacing: "0.06em", textTransform: "uppercase",
};

/* ── OTAs not yet formally signed ──────────────────────────────────────── */
const UNSIGNED_OTAS = new Set(["Ixigo", "Akbar Travels"]);

// Convert "Mar-25" → "2025-03" for tatMonthly lookups
const MO_ABBR = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function abbrevToYYYYMM(mo: string): string {
  const [abbr, yr] = mo.split("-");
  const m = MO_ABBR.indexOf(abbr) + 1;
  return `${2000 + parseInt(yr, 10)}-${String(m).padStart(2, "0")}`;
}

/* ── OTA → intern mapping (derived from TEAMS) ──────────────────────────── */
const OTA_INTERN: Record<string, string> = {};
for (const team of TEAMS) {
  for (const m of team.members) {
    if (m.ota) OTA_INTERN[m.ota] = m.name;
  }
}

/* ── Page ───────────────────────────────────────────────────────────────── */
export default function PerformancePage() {
  const [mtdData,      setMtdData]      = useState<MtdListing[]>([]);
  const [l12m,         setL12m]         = useState<{ months: string[]; byOta: Record<string, number[]> }>({ months: [], byOta: {} });
  const [l12mOnboarded, setL12mOnboarded] = useState<number[]>([]);
  const [otaLive,         setOtaLive]         = useState<Record<string, number>>({});
  const [adjustedOtaLive, setAdjustedOtaLive] = useState<Record<string, number>>({});
  const [tatCounts,    setTatCounts]    = useState<Record<string, { inTat: number; afterTat: number; avgTat: number | null }>>({});
  const [tatMonthly,   setTatMonthly]   = useState<Record<string, Record<string, { inTat: number; afterTat: number }>>>({});
  const [rtglCounts,   setRtglCounts]   = useState<Record<string, number>>({});
  const [dodFull,      setDodFull]      = useState<Record<string, Record<string, number>>>({});
  const [fhLive,       setFhLive]       = useState<number>(0);
  const [dod,          setDod]          = useState<{ labels: string[]; byOta: Record<string, number[]> }>({ labels: [], byOta: {} });
  const [loading,      setLoading]      = useState(true);
  const [activeTeam,   setActiveTeam]   = useState("all");
  const [sessionUser,  setSessionUser]  = useState<{ name: string; role: string; ota: string | null } | null>(null);
  const [showL3mDetail,  setShowL3mDetail]  = useState(false);
  const [formulaHover,   setFormulaHover]   = useState(false);
  const [listingView,    setListingView]    = useState<"mom" | "dod">("mom");
  const [perfTab,        setPerfTab]        = useState<"summary" | "individual" | "reports1" | "reports2">("summary");
  const [selectedMember, setSelectedMember] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => setSessionUser(d.user ?? null));
  }, []);

  useEffect(() => {
    let done = 0;
    const tryFinish = () => { if (++done === 2) setLoading(false); };

    fetch("/api/dashboard-data")
      .then((r) => r.json())
      .then((dash) => {
        if (dash.mtdListings) setMtdData(dash.mtdListings);
        if (dash.l12mOtaLive && dash.l12mMonths) {
          setL12m({ months: dash.l12mMonths, byOta: dash.l12mOtaLive });
        }
        if (dash.l12mOnboarded) setL12mOnboarded(dash.l12mOnboarded);
      })
      .catch(console.error)
      .finally(tryFinish);

    fetch("/api/perf-data")
      .then((r) => r.json())
      .then((p) => {
        if (p.otaLive)         setOtaLive(p.otaLive);
        if (p.adjustedOtaLive) setAdjustedOtaLive(p.adjustedOtaLive);
        if (p.tatCounts)       setTatCounts(p.tatCounts);
        if (p.tatMonthly)      setTatMonthly(p.tatMonthly);
        if (p.rtglCounts)      setRtglCounts(p.rtglCounts);
        if (p.dodFull)         setDodFull(p.dodFull);
        if (p.fhLive)     setFhLive(p.fhLive);
        if (p.dod)        setDod(p.dod);
      })
      .catch(console.error)
      .finally(tryFinish);
  }, []);

  const mtdByOta = Object.fromEntries(mtdData.map((m) => [m.ota, m]));
  const daysDone = new Date().getDate();

  // Total Live = sub-status "Live" count from tracker
  // Not Live   = FH Live total − OTA live count
  // Live Rate  = Total Live ÷ FH Live total
  const effectiveLiveForOta = (ota: string) => adjustedOtaLive[ota] ?? otaLive[ota];
  const getOtaCounts = (ota: string) => {
    const live = effectiveLiveForOta(ota);
    if (live == null || fhLive === 0) return null;
    return { live, notLive: Math.max(0, fhLive - live) };
  };
  const getLiveRate = (ota: string) => {
    const c = getOtaCounts(ota);
    return c && fhLive > 0 ? (c.live / fhLive) * 100 : null;
  };
  const last3Labels = l12m.months.slice(-4, -1); // [LM-2, LM-1, LM]

  // Role-based team filtering
  const roleFilteredTeams = (() => {
    if (!sessionUser) return TEAMS;
    if (sessionUser.role === "tl") {
      return TEAMS.filter(t => t.name.toLowerCase() === sessionUser.name.toLowerCase());
    }
    if (sessionUser.role === "intern") {
      // Show only the team that contains this intern (matched by OTA or name)
      return TEAMS.filter(t => t.members.some(m =>
        m.name.toLowerCase() === sessionUser.name.toLowerCase() ||
        (m.ota && sessionUser.ota && m.ota === sessionUser.ota)
      ));
    }
    return TEAMS; // head / admin: all
  })();

  const visibleTeams = roleFilteredTeams.filter((t) => activeTeam === "all" || t.name === activeTeam);

  return (
    <div style={{ padding: "24px 28px", background: "#F8FAFC", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>IC Performance</span>
        {/* Tab toggle */}
        <div style={{ display: "flex", gap: 3, background: "#F1F5F9", borderRadius: 10, padding: 3 }}>
          {([
            { key: "summary",    label: "Team Summary"          },
            { key: "individual", label: "Individual Performance" },
            { key: "reports1",   label: "Reports 1"             },
            { key: "reports2",   label: "Reports 2"             },
          ] as const).map(({ key, label }) => {
            const active = perfTab === key;
            return (
              <button key={key} onClick={() => setPerfTab(key)} style={{
                padding: "6px 14px", fontSize: 11, fontWeight: 700, borderRadius: 8,
                border: "none", cursor: "pointer",
                background: active ? "#FFFFFF" : "transparent",
                color: active ? "#0F172A" : "#94A3B8",
                boxShadow: active ? "0 1px 4px rgba(15,23,42,0.10)" : "none",
                transition: "all 0.12s", whiteSpace: "nowrap",
              }}>
                {label}
              </button>
            );
          })}
        </div>
        {loading && <span style={{ fontSize: 10, color: "#94A3B8", marginLeft: "auto" }}>Loading…</span>}
      </div>
        {/* Nav tab strip */}
        <div style={{ display: "flex", background: "#F1F5F9", borderRadius: 10, padding: 4, gap: 2 }}>
          {([
            ["CRM",          "/crm",         false],
            ["Task Manager", "/tasks",        false],
            ["Performance",  "/performance",  true ],
          ] as [string, string, boolean][]).map(([label, href, active]) => (
            <a key={label} href={href} style={{
              padding: "7px 22px", borderRadius: 7, fontSize: 12, fontWeight: 600,
              textDecoration: "none", whiteSpace: "nowrap", display: "inline-block",
              background: active ? "#0F172A" : "transparent",
              color: active ? "#FFFFFF" : "#64748B",
            }}>{label}</a>
          ))}
        </div>
      </div>

      {perfTab === "summary" && (<>

      {/* Team filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        {(sessionUser?.role === "tl" || sessionUser?.role === "intern" ? [] : ["all"]).concat(roleFilteredTeams.map((t) => t.name)).map((t) => {
          const team  = TEAMS.find((x) => x.name === t);
          const color = team?.color ?? "#6366F1";
          const active = activeTeam === t;
          if (t === "all") {
            return (
              <div key="all" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button onClick={() => setActiveTeam("all")} style={{
                  padding: "4px 14px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                  cursor: "pointer", border: `1px solid ${color}40`,
                  background: active ? color : color + "18",
                  color: active ? "#FFF" : color,
                  transition: "all 0.15s",
                }}>
                  All Teams
                </button>
                {/* Scoring formula info icon */}
                <div
                  style={{ position: "relative", display: "inline-flex" }}
                  onMouseEnter={() => setFormulaHover(true)}
                  onMouseLeave={() => setFormulaHover(false)}
                >
                  <span style={{
                    width: 16, height: 16, borderRadius: "50%",
                    background: "#EEF2FF", border: "1px solid #C7D2FE",
                    color: "#6366F1", fontSize: 10, fontWeight: 800,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    cursor: "default", userSelect: "none",
                  }}>ⓘ</span>
                  {formulaHover && (
                    <div style={{
                      position: "absolute", top: "calc(100% + 8px)", left: 0,
                      zIndex: 200, background: "#FFF",
                      border: "1px solid #E2E8F0", borderRadius: 12,
                      boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                      padding: "14px 16px", width: 540,
                    }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: "#6366F1", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                        Scoring Formula — Score / 5 · 0.5 steps · Live Rate + Per Day (CM) pace
                      </div>
                      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>

                        {/* Live Rate table */}
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#6366F1", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                            Live Rate → Base Score (max 5)
                          </div>
                          <table style={{ borderCollapse: "collapse", fontSize: 10 }}>
                            <thead>
                              <tr>
                                {["Live Rate", "Base"].map((h) => (
                                  <th key={h} style={{ padding: "3px 10px", background: "#EEF2FF", color: "#6366F1", fontWeight: 700, fontSize: 9, textAlign: "left", border: "1px solid #C7D2FE" }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {[
                                ["≥ 97%", "5.0"], ["≥ 95%", "4.5"], ["≥ 90%", "4.0"],
                                ["≥ 80%", "3.0"], ["≥ 65%", "2.0"], ["≥ 50%", "1.5"],
                                ["≥ 35%", "1.0"], ["≥ 20%", "0.5"], ["< 20%", "0"],
                              ].map(([lr, base]) => (
                                <tr key={lr}>
                                  <td style={{ padding: "3px 10px", border: "1px solid #F1F5F9", color: "#374151" }}>{lr}</td>
                                  <td style={{ padding: "3px 10px", border: "1px solid #F1F5F9", fontWeight: 700, color: "#6366F1", textAlign: "center" }}>{base}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Per Day bonus table */}
                        <div>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#10B981", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                            Per Day (CM) → Pace Bonus (max +3, capped at 5)
                          </div>
                          <table style={{ borderCollapse: "collapse", fontSize: 10 }}>
                            <thead>
                              <tr>
                                {["Per Day", "Bonus"].map((h) => (
                                  <th key={h} style={{ padding: "3px 10px", background: "#D1FAE5", color: "#10B981", fontWeight: 700, fontSize: 9, textAlign: "left", border: "1px solid #6EE7B7" }}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {[
                                ["≥ 20 / day", "+3.0"], ["≥ 12 / day", "+2.0"],
                                ["≥ 8 / day",  "+1.5"], ["≥ 6 / day",  "+0.5"],
                                ["< 6 / day",  "+0"],
                              ].map(([pd, bonus]) => (
                                <tr key={pd}>
                                  <td style={{ padding: "3px 10px", border: "1px solid #F1F5F9", color: "#374151" }}>{pd}</td>
                                  <td style={{ padding: "3px 10px", border: "1px solid #F1F5F9", fontWeight: 700, color: "#10B981", textAlign: "center" }}>{bonus}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* Color bands + Note */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          <div>
                            <div style={{ fontSize: 9, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
                              Score Bands
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              {[
                                { range: "4.5 – 5.0", color: "#6366F1", bg: "#EEF2FF" },
                                { range: "3.5 – 4.0", color: "#10B981", bg: "#D1FAE5" },
                                { range: "2.5 – 3.0", color: "#F59E0B", bg: "#FFF7ED" },
                                { range: "1.0 – 2.0", color: "#F97316", bg: "#FFF7ED" },
                                { range: "0  – 0.5",  color: "#EF4444", bg: "#FEF2F2" },
                              ].map((s) => (
                                <span key={s.range} style={{
                                  fontSize: 10, fontWeight: 700, padding: "3px 12px",
                                  borderRadius: 20, color: s.color,
                                  background: s.bg, border: `1px solid ${s.color}30`,
                                  display: "inline-block",
                                }}>{s.range}</span>
                              ))}
                            </div>
                          </div>
                          <div style={{ fontSize: 10, color: "#94A3B8", lineHeight: 1.6 }}>
                            <b style={{ color: "#64748B" }}>Note:</b> Final = Base + Bonus, capped at 5.0, rounded to 0.5.<br />
                            High pace (≥ 20/day) rewards effort even with low live rate.
                          </div>
                        </div>

                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          }
          return (
            <button key={t} onClick={() => setActiveTeam(t)} style={{
              padding: "4px 14px", borderRadius: 20, fontSize: 10, fontWeight: 700,
              cursor: "pointer", border: `1px solid ${color}40`,
              background: active ? color : color + "18",
              color: active ? "#FFF" : color,
              transition: "all 0.15s",
            }}>
              {t}
            </button>
          );
        })}
      </div>

      {/* ── Member Table ───────────────────────────────────────────────── */}
      <div style={{
        background: "#FFF", border: "1px solid #E2E8F0",
        borderRadius: 12, overflow: "hidden",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}>
        <div style={{ padding: "9px 14px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#0F172A" }}>Member Performance</span>
          <span style={{ fontSize: 9, color: "#94A3B8" }}>Individual OTA-assigned members · Score = Live Rate base + Pace bonus</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
            <thead>
              <tr>
                {/* Fixed columns */}
                <th style={{ ...TH_BASE, textAlign: "left" }}>Member</th>
                <th style={{ ...TH_BASE, textAlign: "left" }}>OTA</th>
                <th style={{ ...TH_BASE, textAlign: "center" }}>Live Rate</th>
                <th style={{ ...TH_BASE, textAlign: "center" }}>CM Listings</th>
                <th style={{ ...TH_BASE, textAlign: "center" }}>Per Day (CM)</th>

                {/* L3M — collapsed: 1 col with toggle; expanded: 3 month cols */}
                {showL3mDetail
                  ? last3Labels.map((mo, i) => (
                      <th key={mo} style={{
                        ...TH_BASE, textAlign: "center",
                        background: i === last3Labels.length - 1 ? "#F0F4FF" : "#F8FAFC",
                        borderLeft: i === 0 ? "2px solid #C7D2FE" : undefined,
                        borderRight: i === last3Labels.length - 1 ? "2px solid #C7D2FE" : undefined,
                      }}>
                        {i === 0 && (
                          <button onClick={() => setShowL3mDetail(false)} title="Collapse" style={{
                            background: "none", border: "none", cursor: "pointer",
                            color: "#6366F1", fontSize: 9, fontWeight: 700, marginRight: 4,
                            padding: 0, lineHeight: 1,
                          }}>◀</button>
                        )}
                        {mo}
                      </th>
                    ))
                  : (
                    <th style={{ ...TH_BASE, textAlign: "center", minWidth: 110 }}>
                      Avg / Day (L3M)
                      <button onClick={() => setShowL3mDetail(true)} title="Expand months" style={{
                        background: "#EEF2FF", border: "1px solid #C7D2FE",
                        borderRadius: 4, cursor: "pointer",
                        color: "#6366F1", fontSize: 8, fontWeight: 700,
                        padding: "1px 5px", marginLeft: 5, lineHeight: 1.3,
                        verticalAlign: "middle",
                      }}>▶▶</button>
                    </th>
                  )
                }

                {/* Always visible */}
                <th style={{ ...TH_BASE, textAlign: "center" }}>Total Live</th>
                <th style={{ ...TH_BASE, textAlign: "center", color: "#10B981" }}>In TAT</th>
                <th style={{ ...TH_BASE, textAlign: "center", color: "#EF4444" }}>After TAT</th>
                <th style={{ ...TH_BASE, textAlign: "center" }}>Not Live</th>
                <th style={{ ...TH_BASE, textAlign: "center" }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {visibleTeams.map((team) => {
                const allMembers = team.members
                  .map((member) => {
                    if (!member.ota) return { member, score: -1 };
                    const lrPct   = getLiveRate(member.ota) ?? 0;
                    const mtd     = mtdByOta[member.ota];
                    const cmPerDay = mtd && daysDone > 0 ? +(mtd.cmMTD / daysDone).toFixed(1) : null;
                    return { member, score: computeScore(lrPct, cmPerDay) };
                  })
                  .sort((a, b) => b.score - a.score)
                  .map((x) => x.member);

                return allMembers.map((member, i) => {
                  const isLast    = i === allMembers.length - 1;
                  const hasOta        = !!member.ota;
                  const isUnsigned    = hasOta && UNSIGNED_OTAS.has(member.ota!);
                  const effLive       = hasOta ? (effectiveLiveForOta(member.ota!) ?? null) : null;
                  const mtd           = hasOta ? mtdByOta[member.ota!] : undefined;
                  const lrRaw         = hasOta && !isUnsigned ? getLiveRate(member.ota!) : null;
                  const liveRatePct   = lrRaw ?? 0;
                  const liveRateDisp  = isUnsigned ? "—" : lrRaw != null ? liveRatePct.toFixed(2) + "%" : "—";
                  const otaColor      = OTA_COLORS[member.ota!] ?? "#64748B";
                  const cmPerDay      = mtd && daysDone > 0 ? +(mtd.cmMTD / daysDone).toFixed(1) : null;
                  const liveRateColor = liveRatePct >= 95 ? "#6366F1" : liveRatePct >= 75 ? "#10B981" : liveRatePct >= 50 ? "#F59E0B" : "#EF4444";

                  // L3M
                  const otaMonthVals = l12m.byOta[member.ota!] ?? [];
                  const last3PerDay  = last3Labels.map((mo, mi) => {
                    const idx   = l12m.months.length - 4 + mi;
                    const total = otaMonthVals[idx] ?? 0;
                    const days  = MONTH_DAYS[mo.split("-")[0]] ?? 30;
                    return +(total / days).toFixed(1);
                  });
                  const avgL3m = last3PerDay.length
                    ? +(last3PerDay.reduce((s, v) => s + v, 0) / last3PerDay.length).toFixed(1)
                    : null;

                  const score       = computeScore(liveRatePct, cmPerDay);
                  const perf        = scoreMeta(score);
                  const rowBorder   = isLast ? "2px solid #E2E8F0" : "1px solid #F1F5F9";

                  return (
                    <tr key={`${team.name}-${member.name}`} style={{ borderBottom: rowBorder, borderLeft: `3px solid ${team.color}` }}>

                      {/* Member */}
                      <td style={{ ...TD }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{
                            width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                            background: team.color + "18", color: team.color,
                            fontSize: 8, fontWeight: 800,
                            display: "inline-flex", alignItems: "center", justifyContent: "center",
                          }}>{member.name[0]}</span>
                          <span style={{ fontWeight: 600, color: "#1E293B", fontSize: 11 }}>{member.name}</span>
                          {member.pip && (
                            <span style={{
                              fontSize: 8, fontWeight: 700, color: "#EF4444",
                              background: "#FEF2F2", border: "1px solid #FECACA",
                              borderRadius: 20, padding: "1px 4px",
                            }}>PIP</span>
                          )}
                        </div>
                      </td>

                      {/* OTA */}
                      <td style={{ ...TD }}>
                        <span style={{
                          fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                          background: otaColor + "18", color: hasOta ? otaColor : "#64748B",
                          border: `1px solid ${otaColor}35`,
                        }}>{hasOta ? member.ota : member.role}</span>
                      </td>

                      {/* Live Rate — sub-status live ÷ FH total live */}
                      <td style={{ ...TD, textAlign: "center" }}>
                        {isUnsigned ? (
                          <span style={{
                            fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                            background: "#FEF9C3", color: "#A16207", border: "1px solid #FDE68A",
                          }}>OTA unsigned</span>
                        ) : (
                          <>
                            <span style={{ fontSize: 13, fontWeight: 800, color: loading || lrRaw == null ? "#CBD5E1" : liveRateColor }}>
                              {!hasOta || loading ? "—" : liveRateDisp}
                            </span>
                            {hasOta && !loading && lrRaw != null && fhLive > 0 && (
                              <div style={{ fontSize: 8, color: "#94A3B8", marginTop: 1 }}>
                                {effLive ?? 0} / {fhLive}
                              </div>
                            )}
                          </>
                        )}
                      </td>

                      {/* CM Listings */}
                      <td style={{ ...TD, textAlign: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: !hasOta || loading || !mtd ? "#CBD5E1" : "#10B981" }}>
                          {!hasOta || loading ? "—" : (mtd?.cmMTD ?? 0)}
                        </span>
                        {hasOta && !loading && (
                          <div style={{ fontSize: 8, color: "#94A3B8", marginTop: 1 }}>day {daysDone}</div>
                        )}
                      </td>

                      {/* Per Day (CM) */}
                      <td style={{ ...TD, textAlign: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: loading ? "#CBD5E1" : otaColor }}>
                          {!hasOta || loading ? "—" : (cmPerDay ?? "—")}
                        </span>
                      </td>

                      {/* L3M — avg or 3 months */}
                      {!hasOta
                        ? (showL3mDetail
                            ? last3Labels.map((_, mi) => <td key={mi} style={{ ...TD, textAlign: "center" }}><span style={{ color: "#CBD5E1" }}>—</span></td>)
                            : <td style={{ ...TD, textAlign: "center" }}><span style={{ color: "#CBD5E1" }}>—</span></td>)
                        : showL3mDetail
                        ? last3PerDay.map((pd, mi) => (
                            <td key={mi} style={{
                              ...TD, textAlign: "center",
                              background: mi === last3Labels.length - 1 ? "#F0F4FF" : undefined,
                              borderLeft: mi === 0 ? "2px solid #C7D2FE" : undefined,
                              borderRight: mi === last3Labels.length - 1 ? "2px solid #C7D2FE" : undefined,
                            }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: loading ? "#CBD5E1" : "#374151" }}>
                                {loading ? "—" : pd}
                              </span>
                            </td>
                          ))
                        : (
                          <td style={{ ...TD, textAlign: "center" }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: loading ? "#CBD5E1" : "#374151" }}>
                              {loading ? "—" : (avgL3m ?? "—")}
                            </span>
                            {!loading && last3Labels.length > 0 && (
                              <div style={{ fontSize: 8, color: "#CBD5E1", marginTop: 1 }}>
                                avg of {last3Labels[0]?.split("-")[0]}–{last3Labels[2]?.split("-")[0]}
                              </div>
                            )}
                          </td>
                        )
                      }

                      {/* Total Live — sub-status "Live" count from tracker (adjusted for exception OTAs) */}
                      <td style={{ ...TD, textAlign: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: !hasOta || loading || effLive == null ? "#CBD5E1" : "#6366F1" }}>
                          {!hasOta || loading || effLive == null ? "—" : effLive}
                        </span>
                      </td>

                      {/* In TAT — listed within 15 days */}
                      <td style={{ ...TD, textAlign: "center" }}>
                        {(() => {
                          const tc = hasOta ? tatCounts[member.ota!] : null;
                          return (
                            <span style={{ fontSize: 13, fontWeight: 800, color: !hasOta || loading || !tc ? "#CBD5E1" : "#10B981" }}>
                              {!hasOta || loading || !tc ? "—" : tc.inTat}
                            </span>
                          );
                        })()}
                      </td>

                      {/* After TAT — listed after 15 days */}
                      <td style={{ ...TD, textAlign: "center" }}>
                        {(() => {
                          const tc = hasOta ? tatCounts[member.ota!] : null;
                          return (
                            <span style={{ fontSize: 13, fontWeight: 800, color: !hasOta || loading || !tc ? "#CBD5E1" : tc.afterTat > 0 ? "#EF4444" : "#94A3B8" }}>
                              {!hasOta || loading || !tc ? "—" : tc.afterTat}
                            </span>
                          );
                        })()}
                      </td>

                      {/* Not Live — FH Live total − OTA live (adjusted for exception OTAs) */}
                      <td style={{ ...TD, textAlign: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: !hasOta || loading || effLive == null ? "#CBD5E1" : "#EF4444" }}>
                          {!hasOta || loading || effLive == null ? "—" : Math.max(0, fhLive - effLive)}
                        </span>
                      </td>

                      {/* Score */}
                      <td style={{ ...TD, textAlign: "center" }}>
                        {!hasOta || loading || isUnsigned
                          ? <span style={{ color: "#CBD5E1" }}>—</span>
                          : (
                            <span style={{
                              fontSize: 11, fontWeight: 800, padding: "3px 11px", borderRadius: 20,
                              background: perf.bg, color: perf.color,
                              border: `1px solid ${perf.color}25`,
                              letterSpacing: "0.01em",
                            }}>
                              {score.toFixed(1)}
                              <span style={{ fontSize: 9, fontWeight: 600, opacity: 0.7 }}> /5</span>
                            </span>
                          )
                        }
                      </td>

                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      </div>


      {/* ── Listing Tracker (MoM / DoD) ─────────────────────────────────── */}
      <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>

        {/* Header with toggle */}
        <div style={{ padding: "9px 14px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#0F172A" }}>Listing Tracker</span>
          {/* Toggle */}
          <div style={{ display: "flex", gap: 3, background: "#F1F5F9", borderRadius: 8, padding: 3, marginLeft: 4 }}>
            {(["mom", "dod"] as const).map((v) => {
              const active = listingView === v;
              return (
                <button key={v} onClick={() => setListingView(v)} style={{
                  padding: "4px 12px", fontSize: 10, fontWeight: 700, borderRadius: 6,
                  border: "none", cursor: "pointer",
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
          <span style={{ fontSize: 9, color: "#94A3B8" }}>
            {listingView === "mom"
              ? `OTA listings month-wise · ${l12m.months[l12m.months.length - 1] ?? ""} = current (partial)`
              : "Daily listings · from OTA live-date columns"}
          </span>
        </div>

        {/* Month Wise view */}
        {listingView === "mom" && l12m.months.length > 0 && (() => {
          const revMonths  = [...l12m.months].reverse();
          const colTotals  = revMonths.map((_, mi) => {
            const origIdx = l12m.months.length - 1 - mi;
            return TEAMS.flatMap(t => t.members.filter(m => m.ota)).reduce((s, m) => s + ((l12m.byOta[m.ota!] ?? [])[origIdx] ?? 0), 0);
          });
          return (
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11 }}>
                <thead>
                  <tr>
                    <th style={{ ...TH_BASE, textAlign: "left", position: "sticky", left: 0, zIndex: 2, background: "#F8FAFC", minWidth: 90 }}>OTA</th>
                    <th style={{ ...TH_BASE, textAlign: "left", position: "sticky", left: 90, zIndex: 2, background: "#F8FAFC", minWidth: 90 }}>Intern</th>
                    {revMonths.map((mo, mi) => {
                      const isCm = mi === 0;
                      return (
                        <th key={mo} style={{
                          ...TH_BASE, textAlign: "center", minWidth: 48, padding: "8px 6px",
                          background:   isCm ? "#EEF2FF" : "#F8FAFC",
                          color:        isCm ? "#6366F1"  : "#94A3B8",
                          borderLeft:   isCm ? "2px solid #C7D2FE" : undefined,
                          borderRight:  isCm ? "2px solid #C7D2FE" : undefined,
                          borderBottom: isCm ? "2px solid #6366F1" : "1px solid #E2E8F0",
                        }}>{mo}</th>
                      );
                    })}
                    <th style={{ ...TH_BASE, textAlign: "center", background: "#F0FDF4", color: "#16A34A", minWidth: 52 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {TEAMS.flatMap((team) =>
                    team.members.filter((m) => m.ota).map((member, i, arr) => {
                      const origVals = l12m.byOta[member.ota!] ?? Array(l12m.months.length).fill(0);
                      const vals     = [...origVals].reverse();
                      const rowTotal = vals.reduce((s, v) => s + v, 0);
                      const maxVal   = Math.max(...vals, 1);
                      const otaColor = OTA_COLORS[member.ota!] ?? "#64748B";
                      const isLast   = i === arr.length - 1;
                      return (
                        <tr key={`mom-${team.name}-${member.name}`} style={{ borderBottom: isLast ? "2px solid #E2E8F0" : "1px solid #F8FAFC" }}>
                          <td style={{ ...TD, position: "sticky", left: 0, background: "#FFF", borderLeft: `3px solid ${otaColor}`, minWidth: 90 }}>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: otaColor + "18", color: otaColor, border: `1px solid ${otaColor}35` }}>{member.ota}</span>
                          </td>
                          <td style={{ ...TD, position: "sticky", left: 90, background: "#FFF", minWidth: 90 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <span style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, background: team.color + "20", color: team.color, fontSize: 8, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{member.name[0]}</span>
                              <span style={{ fontSize: 11, fontWeight: 600, color: "#1E293B" }}>{member.name}</span>
                            </div>
                          </td>
                          {vals.map((cnt, mi) => {
                            const isCm      = mi === 0;
                            const rtgl      = isCm && UNSIGNED_OTAS.has(member.ota!) ? (rtglCounts[member.ota!] ?? 0) : 0;
                            const intensity = cnt > 0 ? Math.round((cnt / maxVal) * 80) + 20 : 0;
                            const bg = cnt === 0 ? (isCm ? "#EEF2FF" : "transparent") : `${otaColor}${intensity.toString(16).padStart(2, "0")}`;
                            return (
                              <td key={mi} style={{ ...TD, textAlign: "center", padding: "6px 6px", background: bg, borderLeft: isCm ? "2px solid #C7D2FE" : undefined, borderRight: isCm ? "2px solid #C7D2FE" : undefined }}>
                                <span style={{ fontSize: 11, fontWeight: cnt > 0 ? 700 : 400, color: cnt > 0 ? (isCm ? "#6366F1" : otaColor) : "#CBD5E1" }}>{loading ? "—" : cnt || "·"}</span>
                                {!loading && rtgl > 0 && <div style={{ fontSize: 7, fontWeight: 700, color: "#D97706", background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 6, padding: "0px 4px", marginTop: 2, whiteSpace: "nowrap" }}>+{rtgl} RTGL</div>}
                              </td>
                            );
                          })}
                          <td style={{ ...TD, textAlign: "center", background: "#F0FDF4" }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: rowTotal > 0 ? "#16A34A" : "#CBD5E1" }}>{loading ? "—" : rowTotal}</span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#F8FAFC", borderTop: "2px solid #E2E8F0" }}>
                    <td style={{ ...TD, position: "sticky", left: 0, background: "#F8FAFC", fontWeight: 800, fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", minWidth: 90 }} colSpan={2}>Total</td>
                    {colTotals.map((ct, mi) => {
                      const isCm = mi === 0;
                      return (
                        <td key={mi} style={{ ...TD, textAlign: "center", padding: "6px 6px", background: isCm ? "#EEF2FF" : "transparent", borderLeft: isCm ? "2px solid #C7D2FE" : undefined, borderRight: isCm ? "2px solid #C7D2FE" : undefined }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: ct > 0 ? (isCm ? "#6366F1" : "#374151") : "#CBD5E1" }}>{loading ? "—" : ct || "·"}</span>
                        </td>
                      );
                    })}
                    <td style={{ ...TD, textAlign: "center", background: "#F0FDF4" }}>
                      <span style={{ fontSize: 12, fontWeight: 900, color: "#16A34A" }}>{loading ? "—" : colTotals.reduce((s, v) => s + v, 0)}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          );
        })()}

        {/* Last 15 Days view */}
        {listingView === "dod" && (() => {
          const revLabels = [...dod.labels].reverse();
          return (
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11 }}>
                <thead>
                  <tr>
                    <th style={{ ...TH_BASE, textAlign: "left", position: "sticky", left: 0, zIndex: 2, background: "#F8FAFC", minWidth: 80 }}>TL</th>
                    <th style={{ ...TH_BASE, textAlign: "left", position: "sticky", left: 80, zIndex: 2, background: "#F8FAFC", minWidth: 90 }}>Member</th>
                    <th style={{ ...TH_BASE, textAlign: "left", minWidth: 80 }}>OTA</th>
                    {revLabels.map((lbl, i) => {
                      const isToday = i === 0;
                      return (
                        <th key={lbl} style={{
                          ...TH_BASE, textAlign: "center", minWidth: 36, padding: "8px 6px",
                          background: isToday ? "#EEF2FF" : "#F8FAFC",
                          color:      isToday ? "#6366F1"  : "#94A3B8",
                          borderBottom: isToday ? "2px solid #6366F1" : "1px solid #E2E8F0",
                        }}>{lbl}</th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {visibleTeams.map((team) =>
                    team.members.filter((m) => m.ota).map((member, i) => {
                      const origCounts = dod.byOta[member.ota!] ?? Array(15).fill(0);
                      const counts     = [...origCounts].reverse();
                      const maxVal     = Math.max(...counts, 1);
                      const otaColor   = OTA_COLORS[member.ota!] ?? "#64748B";
                      const isLast     = i === team.members.filter((m) => m.ota).length - 1;
                      return (
                        <tr key={`dod-${team.name}-${member.name}`} style={{ borderBottom: isLast ? "2px solid #E2E8F0" : "1px solid #F8FAFC" }}>
                          <td style={{ ...TD, position: "sticky", left: 0, background: team.color + "07", borderLeft: `3px solid ${team.color}`, fontSize: 10, fontWeight: 700, color: team.color, minWidth: 80 }}>
                            {i === 0 ? team.name : ""}
                          </td>
                          <td style={{ ...TD, position: "sticky", left: 80, background: "#FFF", fontWeight: 600, color: "#1E293B", fontSize: 11, minWidth: 90 }}>{member.name}</td>
                          <td style={{ ...TD }}>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: otaColor + "18", color: otaColor, border: `1px solid ${otaColor}35` }}>{member.ota}</span>
                          </td>
                          {counts.map((cnt, di) => {
                            const isToday   = di === 0;
                            const rtgl      = isToday && UNSIGNED_OTAS.has(member.ota!) ? (rtglCounts[member.ota!] ?? 0) : 0;
                            const intensity = cnt > 0 ? Math.round((cnt / maxVal) * 100) : 0;
                            const bg = cnt === 0 ? (isToday ? "#EEF2FF" : "transparent") : `${otaColor}${Math.max(18, intensity).toString(16).padStart(2, "0")}`;
                            return (
                              <td key={di} style={{ ...TD, textAlign: "center", padding: "6px 4px", background: bg, borderLeft: isToday ? "1px solid #C7D2FE" : undefined, borderRight: isToday ? "1px solid #C7D2FE" : undefined }}>
                                <span style={{ fontSize: 11, fontWeight: cnt > 0 ? 700 : 400, color: cnt > 0 ? (isToday ? "#6366F1" : otaColor) : "#CBD5E1" }}>{loading ? "—" : cnt || "·"}</span>
                                {!loading && rtgl > 0 && <div style={{ fontSize: 7, fontWeight: 700, color: "#D97706", background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 6, padding: "0px 4px", marginTop: 2, whiteSpace: "nowrap" }}>+{rtgl} RTGL</div>}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#F8FAFC", borderTop: "2px solid #E2E8F0" }}>
                    <td style={{ ...TD, position: "sticky", left: 0, background: "#F8FAFC", fontWeight: 800, fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", minWidth: 80 }} colSpan={3}>Total</td>
                    {revLabels.map((_, di) => {
                      const origDi   = revLabels.length - 1 - di;
                      const dayTotal = visibleTeams.flatMap(t => t.members.filter(m => m.ota).map(m => (dod.byOta[m.ota!] ?? [])[origDi] ?? 0)).reduce((s, v) => s + v, 0);
                      const isToday  = di === 0;
                      return (
                        <td key={di} style={{ ...TD, textAlign: "center", padding: "6px 4px", background: isToday ? "#EEF2FF" : "transparent", borderLeft: isToday ? "1px solid #C7D2FE" : undefined, borderRight: isToday ? "1px solid #C7D2FE" : undefined }}>
                          <span style={{ fontSize: 11, fontWeight: dayTotal > 0 ? 800 : 400, color: dayTotal > 0 ? (isToday ? "#6366F1" : "#374151") : "#CBD5E1" }}>{loading ? "—" : dayTotal || "·"}</span>
                        </td>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          );
        })()}
      </div>

      </>)}

      {/* ── Individual Performance Tab ──────────────────────────────────── */}
      {perfTab === "individual" && (() => {
        const allMembers = TEAMS.flatMap((team) =>
          team.members.map((m) => ({ ...m, teamName: team.name, teamColor: team.color }))
        );
        const sel = selectedMember ? allMembers.find((m) => m.name === selectedMember) ?? null : null;
        const ota = sel?.ota ?? null;
        const lrPct     = ota ? (getLiveRate(ota) ?? 0) : 0;
        const mtd       = ota ? mtdByOta[ota] : undefined;
        const cmPerDay  = mtd && daysDone > 0 ? +(mtd.cmMTD / daysDone).toFixed(1) : null;
        const score     = ota ? computeScore(lrPct, cmPerDay) : 0;
        const perf      = scoreMeta(score);
        const tc        = ota ? tatCounts[ota] : null;
        const effLive   = ota ? (effectiveLiveForOta(ota) ?? null) : null;
        const notLive   = effLive != null ? Math.max(0, fhLive - effLive) : null;
        const monthVals = ota ? (l12m.byOta[ota] ?? []) : [];
        const revMonths = [...l12m.months].reverse();
        const revVals   = [...monthVals].reverse();
        const maxMonthVal = Math.max(...revVals, 1);
        const otaColor  = OTA_COLORS[ota ?? ""] ?? "#6366F1";

        return (
          <div>
            {/* Member selector */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
              {allMembers.map((m) => {
                const active = selectedMember === m.name;
                return (
                  <button
                    key={`${m.teamName}-${m.name}`}
                    onClick={() => setSelectedMember(active ? null : m.name)}
                    style={{
                      padding: "5px 13px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                      cursor: "pointer", border: `1px solid ${m.teamColor}50`,
                      background: active ? m.teamColor : m.teamColor + "12",
                      color: active ? "#FFF" : m.teamColor,
                      transition: "all 0.15s",
                    }}
                  >
                    {m.name}
                  </button>
                );
              })}
            </div>

            {!sel && (
              <div style={{ textAlign: "center", padding: "60px 24px", color: "#94A3B8", fontSize: 12 }}>
                Select an employee above to view their performance details.
              </div>
            )}

            {sel && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

                {/* Member header */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 42, height: 42, borderRadius: "50%", background: sel.teamColor + "20", color: sel.teamColor, fontSize: 17, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {sel.name[0]}
                  </span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>{sel.name}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>
                      {sel.ota ?? sel.role ?? "—"} · Team: {sel.teamName}
                    </div>
                  </div>
                  {sel.pip && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#EF4444", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 20, padding: "2px 7px" }}>PIP</span>
                  )}
                </div>

                {/* KPI Tiles */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                  <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 12, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Live Rate</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: ota && !loading ? (lrPct >= 90 ? "#6366F1" : lrPct >= 65 ? "#10B981" : lrPct >= 50 ? "#F59E0B" : "#EF4444") : "#CBD5E1" }}>
                      {ota && !loading ? lrPct.toFixed(1) + "%" : "—"}
                    </div>
                    <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 4 }}>Properties live / total</div>
                  </div>
                  <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 12, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Performance Score</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: ota && !loading ? perf.color : "#CBD5E1" }}>
                      {ota && !loading ? score.toFixed(1) : "—"}<span style={{ fontSize: 13, fontWeight: 500, opacity: 0.6 }}>/5</span>
                    </div>
                    <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 4 }}>Live rate + pace bonus</div>
                  </div>
                  <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 12, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>MTD Listings</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: mtd && !loading ? "#10B981" : "#CBD5E1" }}>
                      {mtd && !loading ? mtd.cmMTD : "—"}
                    </div>
                    <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 4 }}>{cmPerDay != null ? `${cmPerDay} / day pace` : "This month"}</div>
                  </div>
                  <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 12, padding: "14px 16px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Pace (Per Day)</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: cmPerDay != null && !loading ? (cmPerDay >= 20 ? "#6366F1" : cmPerDay >= 12 ? "#10B981" : cmPerDay >= 6 ? "#F59E0B" : "#EF4444") : "#CBD5E1" }}>
                      {cmPerDay != null && !loading ? cmPerDay : "—"}
                    </div>
                    <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 4 }}>Avg listings / day (CM)</div>
                  </div>
                </div>

                {/* Live Props TAT */}
                {ota && (
                  <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 12, padding: "14px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#0F172A", marginBottom: 14 }}>Live Props TAT</div>
                    <div style={{ display: "flex", gap: 28, alignItems: "flex-start", flexWrap: "wrap" }}>
                      {[
                        { label: "In TAT",    val: tc ? String(tc.inTat) : "—",  color: "#10B981", note: "Listed within deadline" },
                        { label: "After TAT", val: tc ? String(tc.afterTat) : "—", color: tc && tc.afterTat > 0 ? "#EF4444" : "#94A3B8", note: "Listed after deadline" },
                        { label: "Avg TAT",   val: tc?.avgTat != null ? tc.avgTat.toFixed(1) + "d" : "—", color: "#6366F1", note: "Average turnaround days" },
                        { label: "Not Live",  val: notLive != null ? String(notLive) : "—", color: notLive != null && notLive > 0 ? "#F97316" : "#94A3B8", note: "Pending properties" },
                      ].map(({ label, val, color, note }) => (
                        <div key={label}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{label}</div>
                          <div style={{ fontSize: 22, fontWeight: 900, color: loading ? "#CBD5E1" : color }}>{loading ? "—" : val}</div>
                          <div style={{ fontSize: 9, color: "#94A3B8" }}>{note}</div>
                        </div>
                      ))}
                      {tc && (() => {
                        const total = tc.inTat + tc.afterTat;
                        if (total === 0) return null;
                        const pct = Math.round((tc.inTat / total) * 100);
                        return (
                          <div style={{ flex: 1, minWidth: 160, alignSelf: "center" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#94A3B8", marginBottom: 6 }}>
                              <span>TAT Compliance</span>
                              <span style={{ fontWeight: 700, color: pct >= 80 ? "#10B981" : "#F59E0B" }}>{pct}%</span>
                            </div>
                            <div style={{ height: 10, background: "#FEE2E2", borderRadius: 5, overflow: "hidden" }}>
                              <div style={{ height: "100%", width: `${pct}%`, background: pct >= 80 ? "#10B981" : "#F59E0B", borderRadius: 5 }} />
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* Month × Day DOD matrix */}
                {ota && (() => {
                  const dayMap   = dodFull[ota] ?? {};
                  const months   = l12m.months; // oldest→newest
                  const allDays  = Array.from({ length: 31 }, (_, i) => i + 1);
                  const maxVal   = Math.max(...Object.values(dayMap), 1);

                  return (
                    <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                      <div style={{ padding: "10px 14px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#0F172A" }}>Day-wise Listings</span>
                        <span style={{ fontSize: 9, color: "#94A3B8" }}>Month × Day matrix · darker = more listings</span>
                      </div>
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ borderCollapse: "collapse", fontSize: 10 }}>
                          <thead>
                            <tr>
                              <th style={{ ...TH_BASE, textAlign: "left", position: "sticky", left: 0, zIndex: 2, background: "#F8FAFC", minWidth: 72 }}>Month</th>
                              {allDays.map((d) => (
                                <th key={d} style={{ ...TH_BASE, textAlign: "center", padding: "6px 4px", minWidth: 28, color: "#94A3B8", fontWeight: 600 }}>{d}</th>
                              ))}
                              <th style={{ ...TH_BASE, textAlign: "center", background: "#F0FDF4", color: "#16A34A", minWidth: 44 }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...months].reverse().map((mo) => {
                              const { year, month0 } = (() => {
                                const [abbr, yr] = mo.split("-");
                                return { year: 2000 + parseInt(yr, 10), month0: MO_ABBR.indexOf(abbr) };
                              })();
                              const ym    = `${year}-${String(month0 + 1).padStart(2, "0")}`;
                              const isNow = year === new Date().getFullYear() && month0 === new Date().getMonth();
                              const rowTotal = allDays.reduce((s, d) => {
                                const key = `${ym}-${String(d).padStart(2, "0")}`;
                                return s + (dayMap[key] ?? 0);
                              }, 0);
                              return (
                                <tr key={mo} style={{ borderBottom: "1px solid #F8FAFC" }}>
                                  <td style={{ ...TD, position: "sticky", left: 0, background: isNow ? "#EEF2FF" : "#FFF", fontWeight: isNow ? 700 : 500, color: isNow ? "#6366F1" : "#374151", fontSize: 10, minWidth: 72, borderLeft: isNow ? "3px solid #6366F1" : "3px solid transparent" }}>
                                    {mo}
                                  </td>
                                  {allDays.map((d) => {
                                    const key = `${ym}-${String(d).padStart(2, "0")}`;
                                    const cnt = dayMap[key] ?? 0;
                                    const intensity = cnt > 0 ? Math.max(20, Math.round((cnt / maxVal) * 90)) : 0;
                                    const bg = cnt > 0 ? `${otaColor}${intensity.toString(16).padStart(2, "0")}` : "transparent";
                                    return (
                                      <td key={d} style={{ ...TD, textAlign: "center", padding: "5px 3px", background: bg, minWidth: 28 }}>
                                        <span style={{ fontSize: 10, fontWeight: cnt > 0 ? 700 : 400, color: cnt > 0 ? otaColor : "#E2E8F0" }}>
                                          {loading ? "" : cnt > 0 ? cnt : "·"}
                                        </span>
                                      </td>
                                    );
                                  })}
                                  <td style={{ ...TD, textAlign: "center", background: "#F0FDF4" }}>
                                    <span style={{ fontSize: 10, fontWeight: 800, color: rowTotal > 0 ? "#16A34A" : "#CBD5E1" }}>{loading ? "—" : rowTotal}</span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {/* Monthly Listings + Analytical Suggestions — side by side */}
                <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>

                  {/* Monthly Listings Bar Chart */}
                  {ota && revMonths.length > 0 && (() => {
                    const otaTatMap = tatMonthly[ota] ?? {};
                    const bars = revMonths.map((mo, i) => {
                      const tatMo = otaTatMap[abbrevToYYYYMM(mo)];
                      const total = revVals[i] ?? 0;
                      if (tatMo) return { mo, inTat: tatMo.inTat, afterTat: tatMo.afterTat, total: tatMo.inTat + tatMo.afterTat };
                      return { mo, inTat: total, afterTat: 0, total };
                    });
                    const maxTotal = Math.max(...bars.map((b) => b.total), 1);
                    return (
                      <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 12, padding: "14px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", flexShrink: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#0F172A" }}>Monthly Listings</span>
                          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "#10B981" }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: "#10B981", display: "inline-block" }} /> In TAT
                          </span>
                          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "#EF4444" }}>
                            <span style={{ width: 8, height: 8, borderRadius: 2, background: "#EF4444", display: "inline-block" }} /> After TAT
                          </span>
                        </div>
                        <div style={{ fontSize: 9, color: "#94A3B8", marginBottom: 14 }}>Last 12 months · most recent on left</div>
                        <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 120, paddingBottom: 18 }}>
                          {bars.map(({ mo, inTat, afterTat, total }, i) => {
                            const isCm      = i === 0;
                            const totalH    = maxTotal > 0 ? Math.max(total > 0 ? 4 : 0, Math.round((total / maxTotal) * 90)) : 0;
                            const inTatH    = total > 0 ? Math.round((inTat / total) * totalH) : 0;
                            const afterTatH = totalH - inTatH;
                            return (
                              <div key={mo} style={{ width: 28, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%" }}>
                                <span style={{ fontSize: 7, fontWeight: 700, color: isCm ? "#6366F1" : "#94A3B8", marginBottom: 2 }}>{total > 0 ? total : ""}</span>
                                <div style={{ width: "100%", display: "flex", flexDirection: "column", borderRadius: "3px 3px 0 0", overflow: "hidden", outline: isCm ? "1.5px solid #6366F150" : "none" }}>
                                  {afterTatH > 0 && <div style={{ height: afterTatH, background: isCm ? "#EF444490" : "#EF444460" }} />}
                                  {inTatH    > 0 && <div style={{ height: inTatH,    background: isCm ? "#10B98190" : "#10B98160" }} />}
                                </div>
                                <span style={{ fontSize: 7, color: isCm ? "#6366F1" : "#CBD5E1", fontWeight: isCm ? 700 : 400, marginTop: 3, whiteSpace: "nowrap" }}>{mo.slice(0, 3)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Analytical Suggestions */}
                  {ota && !loading && (
                    <div style={{ flex: 1, minWidth: 0, background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 12, padding: "14px 18px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#0F172A", marginBottom: 12 }}>Analytical Suggestions</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {([
                          lrPct < 80 && { type: "warn",  msg: `Live rate is ${lrPct.toFixed(1)}% — below 80% target. Focus on converting pending properties to live status.` },
                          lrPct >= 95 && { type: "good",  msg: `Excellent live rate of ${lrPct.toFixed(1)}%. Maintain consistency and support peers with lower rates.` },
                          cmPerDay != null && cmPerDay < 6  && { type: "warn",  msg: `Pace of ${cmPerDay}/day is below the 6/day threshold. Current trajectory may miss month-end targets.` },
                          cmPerDay != null && cmPerDay >= 20 && { type: "good",  msg: `Strong pace of ${cmPerDay}/day — earning maximum pace bonus. Keep the momentum going.` },
                          tc && tc.afterTat > 0 && { type: "warn",  msg: `${tc.afterTat} propert${tc.afterTat === 1 ? "y" : "ies"} listed after TAT deadline. Prioritise on-time listing to improve compliance score.` },
                          tc && tc.afterTat === 0 && tc.inTat > 0 && { type: "good",  msg: `100% TAT compliance — all properties listed within the turnaround deadline.` },
                          sel.pip && { type: "alert", msg: `This member is on PIP. Monitor daily progress closely and provide targeted coaching support.` },
                          notLive != null && notLive > 50 && { type: "warn",  msg: `${notLive} properties are still not live. Investigate blockers: content gaps, approval delays, or OTA-side issues.` },
                          revVals.length >= 3 && (() => {
                            const trend = (revVals[0] ?? 0) - (revVals[2] ?? 0);
                            if (trend > 10) return { type: "good", msg: `Listing count trending upward over the last 3 months (+${trend}). Solid growth trajectory.` };
                            if (trend < -10) return { type: "warn", msg: `Listing count has declined over the last 3 months (${trend}). Review pipeline health and workflow bottlenecks.` };
                            return null;
                          })(),
                        ] as Array<{ type: string; msg: string } | false | null | undefined>)
                          .filter(Boolean)
                          .map((s, i) => {
                            const { type, msg } = s as { type: string; msg: string };
                            const cfg =
                              type === "good"  ? { icon: "✓", color: "#10B981", bg: "#F0FDF4", border: "#BBF7D0" } :
                              type === "alert" ? { icon: "⚠", color: "#DC2626", bg: "#FEF2F2", border: "#FECACA" } :
                                                 { icon: "→", color: "#D97706", bg: "#FFFBEB", border: "#FDE68A" };
                            return (
                              <div key={i} style={{ display: "flex", gap: 10, padding: "9px 12px", background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: 8 }}>
                                <span style={{ fontSize: 12, color: cfg.color, flexShrink: 0, fontWeight: 700 }}>{cfg.icon}</span>
                                <span style={{ fontSize: 11, color: "#374151", lineHeight: 1.5 }}>{msg}</span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                </div>

              </div>
            )}
          </div>
        );
      })()}

    </div>
  );
}
