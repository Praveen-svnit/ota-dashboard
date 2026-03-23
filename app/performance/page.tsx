"use client";

import { useEffect, useState } from "react";
import L12MTable from "@/components/dashboard/L12MTable";

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
      { name: "Rahul",    role: "Ad-Hoc", pip: true, adhoc: true },
    ],
  },
  {
    name: "Gourav", color: "#F59E0B", type: "ota",
    members: [
      { name: "Aman",     ota: "Agoda"        },
      { name: "Ajeet",    ota: "Yatra"         },
      { name: "Shrishti", ota: "Ixigo"         },
      { name: "Joti",     ota: "Akbar Travels" },
      { name: "Vipul",    ota: "EaseMyTrip"    },
    ],
  },
  {
    name: "Ajay", color: "#10B981", type: "ota",
    members: [
      { name: "Gaurav Pandey", ota: "Booking.com" },
      { name: "Sadik",         role: "Ad-Hoc", pip: true, adhoc: true },
    ],
  },
  {
    name: "Salim", color: "#8B5CF6", type: "ops",
    members: [
      { name: "Karan",      role: "FH Onboarding Coordination"   },
      { name: "Vishal",     role: "OTAs Post Live & FH Listings" },
      { name: "Ajay Dhama", role: "OTAs Post Live & FH Listings" },
      { name: "Yash",       role: "OTAs Post Live & FH Listings" },
      { name: "Gunjan",     role: "OTAs Post Live & FH Listings" },
      { name: "Vanshika",   role: "OTAs Post Live & FH Listings" },
      { name: "Sajjak",     role: "GMB" },
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
  const [fhLive,       setFhLive]       = useState<number>(0);
  const [dod,          setDod]          = useState<{ labels: string[]; byOta: Record<string, number[]> }>({ labels: [], byOta: {} });
  const [loading,      setLoading]      = useState(true);
  const [activeTeam,   setActiveTeam]   = useState("all");
  const [showL3mDetail,  setShowL3mDetail]  = useState(false);
  const [showFormula,    setShowFormula]    = useState(false);

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

  const visibleTeams = TEAMS.filter((t) => activeTeam === "all" || t.name === activeTeam);

  return (
    <div style={{ padding: "24px 28px", background: "#F8FAFC", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>Team Performance</span>
        <span style={{
          fontSize: 10, fontWeight: 700, color: "#6366F1",
          background: "#EEF2FF", border: "1px solid #C7D2FE",
          borderRadius: 20, padding: "2px 10px",
        }}>
          {TEAMS.reduce((n, t) => n + t.members.length, 0)} members · {TEAMS.length} teams
        </span>
        {loading && <span style={{ fontSize: 10, color: "#94A3B8", marginLeft: "auto" }}>Loading…</span>}
      </div>

      {/* Scoring formula reference */}
      {(() => {
        const open = showFormula;
        const setOpen = setShowFormula;
        return (
          <div style={{
            background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 10,
            marginBottom: 16, overflow: "hidden",
          }}>
            <button onClick={() => setOpen((o) => !o)} style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "9px 14px", background: "none", border: "none", cursor: "pointer",
              fontSize: 11, fontWeight: 700, color: "#0F172A",
            }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  fontSize: 9, fontWeight: 700, color: "#6366F1",
                  background: "#EEF2FF", border: "1px solid #C7D2FE",
                  borderRadius: 20, padding: "2px 8px", letterSpacing: "0.04em",
                }}>SCORING FORMULA</span>
                Score / 5 · 0.5 steps · Based on Live Rate + Per Day (CM) pace
              </span>
              <span style={{ color: "#94A3B8", fontSize: 12 }}>{open ? "▲" : "▼"}</span>
            </button>
            {open && (
              <div style={{ borderTop: "1px solid #F1F5F9", padding: "12px 16px 14px", background: "#FAFBFF" }}>
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
                      Per Day (CM) → Pace Bonus (max +3, capped at 5 total)
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

                  {/* Color bands */}
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

                  {/* Note */}
                  <div style={{ alignSelf: "flex-end", fontSize: 10, color: "#94A3B8", maxWidth: 220, lineHeight: 1.6 }}>
                    <b style={{ color: "#64748B" }}>Note:</b> Final score = Base + Bonus, capped at 5.0 and rounded to nearest 0.5.<br />
                    High pace (≥ 20/day) rewards effort even with low live rate (e.g. large pending pipeline).
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Team filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {["all", ...TEAMS.map((t) => t.name)].map((t) => {
          const team  = TEAMS.find((x) => x.name === t);
          const color = team?.color ?? "#6366F1";
          const active = activeTeam === t;
          return (
            <button key={t} onClick={() => setActiveTeam(t)} style={{
              padding: "4px 14px", borderRadius: 20, fontSize: 10, fontWeight: 700,
              cursor: "pointer", border: `1px solid ${color}40`,
              background: active ? color : color + "18",
              color: active ? "#FFF" : color,
              transition: "all 0.15s",
            }}>
              {t === "all" ? "All Teams" : t}
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
                <th style={{ ...TH_BASE, textAlign: "left" }}>TL</th>
                <th style={{ ...TH_BASE, textAlign: "left" }}>Member</th>
                <th style={{ ...TH_BASE, textAlign: "left" }}>OTA</th>
                <th style={{ ...TH_BASE, textAlign: "center" }}>Live Rate</th>
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
                  .filter((m) => m.ota || !m.adhoc)
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
                    <tr key={`${team.name}-${member.name}`} style={{ borderBottom: rowBorder }}>

                      {/* TL */}
                      <td style={{
                        ...TD,
                        borderLeft: `3px solid ${team.color}`,
                        borderRight: "1px solid #F1F5F9",
                        background: team.color + "07",
                        minWidth: 100,
                      }}>
                        {i === 0 && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{
                              width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                              background: team.color, color: "#FFF", fontSize: 9, fontWeight: 800,
                              display: "inline-flex", alignItems: "center", justifyContent: "center",
                              boxShadow: `0 2px 5px ${team.color}50`,
                            }}>{team.name[0]}</span>
                            <div>
                              <div style={{ fontWeight: 700, color: "#0F172A", fontSize: 11 }}>{team.name}</div>
                              <div style={{ fontSize: 8, fontWeight: 700, color: team.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>TL</div>
                            </div>
                          </div>
                        )}
                      </td>

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

                      {/* Per Day (CM) */}
                      <td style={{ ...TD, textAlign: "center" }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: loading ? "#CBD5E1" : otaColor }}>
                          {!hasOta || loading ? "—" : (cmPerDay ?? "—")}
                        </span>
                        {hasOta && !loading && mtd && (
                          <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 1 }}>{mtd.cmMTD} in {daysDone}d</div>
                        )}
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

      {/* ── MoM Listing Tracker ─────────────────────────────────────────── */}
      {(() => {
        const now      = new Date();
        const cmLabel  = now.toLocaleString("en-IN", { month: "short" }) + " MTD";
        const lmDate   = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lmLabel  = lmDate.toLocaleString("en-IN", { month: "short" });

        const totals = mtdData.reduce(
          (acc, r) => ({ cmMTD: acc.cmMTD + r.cmMTD, lmSameDay: acc.lmSameDay + r.lmSameDay, lmTotal: acc.lmTotal + r.lmTotal }),
          { cmMTD: 0, lmSameDay: 0, lmTotal: 0 }
        );

        return (
          <div style={{
            background: "#FFF", border: "1px solid #E2E8F0",
            borderRadius: 12, overflow: "hidden",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            marginBottom: 16,
          }}>
            <div style={{ padding: "9px 14px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#0F172A" }}>MoM Listing Tracker</span>
              <span style={{ fontSize: 9, color: "#94A3B8" }}>New OTA listings · current vs last month</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ ...TH_BASE, textAlign: "left" }}>OTA</th>
                    <th style={{ ...TH_BASE, textAlign: "left" }}>Intern</th>
                    <th style={{ ...TH_BASE, textAlign: "center", color: "#6366F1", background: "#EEF2FF" }}>{cmLabel}</th>
                    <th style={{ ...TH_BASE, textAlign: "center" }}>{lmLabel} Same Day</th>
                    <th style={{ ...TH_BASE, textAlign: "center" }}>{lmLabel} Total</th>
                    <th style={{ ...TH_BASE, textAlign: "center" }}>vs LM</th>
                  </tr>
                </thead>
                <tbody>
                  {mtdData.map((row, i) => {
                    const otaColor  = OTA_COLORS[row.ota] ?? "#64748B";
                    const intern    = OTA_INTERN[row.ota];
                    const team      = TEAMS.find(t => t.members.some(m => m.ota === row.ota));
                    const diff      = row.cmMTD - row.lmSameDay;
                    const diffColor = diff > 0 ? "#16A34A" : diff < 0 ? "#EF4444" : "#94A3B8";
                    const isLast    = i === mtdData.length - 1;
                    return (
                      <tr key={row.ota} style={{ borderBottom: isLast ? "2px solid #E2E8F0" : "1px solid #F1F5F9" }}>
                        <td style={{ ...TD, borderLeft: `3px solid ${otaColor}` }}>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: otaColor + "18", color: otaColor, border: `1px solid ${otaColor}35` }}>
                            {row.ota}
                          </span>
                        </td>
                        <td style={{ ...TD }}>
                          {intern && team ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <span style={{ width: 18, height: 18, borderRadius: "50%", flexShrink: 0, background: team.color + "20", color: team.color, fontSize: 8, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{intern[0]}</span>
                              <span style={{ fontSize: 11, fontWeight: 600, color: "#1E293B" }}>{intern}</span>
                            </div>
                          ) : <span style={{ color: "#CBD5E1" }}>—</span>}
                        </td>
                        <td style={{ ...TD, textAlign: "center", background: "#F8F9FF" }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: "#6366F1" }}>
                            {loading ? "—" : row.cmMTD}
                          </span>
                        </td>
                        <td style={{ ...TD, textAlign: "center" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
                            {loading ? "—" : row.lmSameDay}
                          </span>
                        </td>
                        <td style={{ ...TD, textAlign: "center" }}>
                          <span style={{ fontSize: 12, color: "#64748B" }}>
                            {loading ? "—" : row.lmTotal}
                          </span>
                        </td>
                        <td style={{ ...TD, textAlign: "center" }}>
                          {!loading && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: diffColor }}>
                              {diff === 0 ? "=" : diff > 0 ? `+${diff}` : diff}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: "#F8FAFC", borderTop: "2px solid #E2E8F0" }}>
                    <td style={{ ...TD, fontWeight: 800, fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em" }} colSpan={2}>Total</td>
                    <td style={{ ...TD, textAlign: "center", background: "#EEF2FF" }}>
                      <span style={{ fontSize: 14, fontWeight: 900, color: "#6366F1" }}>{loading ? "—" : totals.cmMTD}</span>
                    </td>
                    <td style={{ ...TD, textAlign: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: "#374151" }}>{loading ? "—" : totals.lmSameDay}</span>
                    </td>
                    <td style={{ ...TD, textAlign: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>{loading ? "—" : totals.lmTotal}</span>
                    </td>
                    <td style={{ ...TD, textAlign: "center" }}>
                      {!loading && (() => {
                        const d = totals.cmMTD - totals.lmSameDay;
                        return <span style={{ fontSize: 12, fontWeight: 800, color: d > 0 ? "#16A34A" : d < 0 ? "#EF4444" : "#94A3B8" }}>{d === 0 ? "=" : d > 0 ? `+${d}` : d}</span>;
                      })()}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ── DoD Listings — Last 15 Days ────────────────────────────────── */}
      <div style={{
        background: "#FFF", border: "1px solid #E2E8F0",
        borderRadius: 12, overflow: "hidden",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        marginTop: 16,
      }}>
        <div style={{ padding: "9px 14px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#0F172A" }}>Daily Listings — Last 15 Days</span>
          <span style={{ fontSize: 9, color: "#94A3B8" }}>From OTA live-date columns in Listing Tracker</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ ...TH_BASE, textAlign: "left", position: "sticky", left: 0, zIndex: 2, background: "#F8FAFC", minWidth: 80 }}>TL</th>
                <th style={{ ...TH_BASE, textAlign: "left", position: "sticky", left: 80, zIndex: 2, background: "#F8FAFC", minWidth: 90 }}>Member</th>
                <th style={{ ...TH_BASE, textAlign: "left", minWidth: 80 }}>OTA</th>
                {dod.labels.map((lbl, i) => {
                  const isToday = i === dod.labels.length - 1;
                  return (
                    <th key={lbl} style={{
                      ...TH_BASE, textAlign: "center", minWidth: 36, padding: "8px 6px",
                      background: isToday ? "#EEF2FF" : "#F8FAFC",
                      color:      isToday ? "#6366F1"  : "#94A3B8",
                      borderBottom: isToday ? "2px solid #6366F1" : "1px solid #E2E8F0",
                    }}>{lbl}</th>
                  );
                })}
                <th style={{ ...TH_BASE, textAlign: "center", background: "#F0FDF4", color: "#16A34A", minWidth: 50 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {visibleTeams.map((team) =>
                team.members.filter((m) => m.ota).map((member, i) => {
                  const counts   = dod.byOta[member.ota!] ?? Array(15).fill(0);
                  const rowTotal = counts.reduce((s, v) => s + v, 0);
                  const maxVal   = Math.max(...counts, 1);
                  const otaColor = OTA_COLORS[member.ota!] ?? "#64748B";
                  const isLast   = i === team.members.filter((m) => m.ota).length - 1;
                  return (
                    <tr key={`dod-${team.name}-${member.name}`} style={{ borderBottom: isLast ? "2px solid #E2E8F0" : "1px solid #F8FAFC" }}>
                      <td style={{ ...TD, position: "sticky", left: 0, background: team.color + "07", borderLeft: `3px solid ${team.color}`, fontSize: 10, fontWeight: 700, color: team.color, minWidth: 80 }}>
                        {i === 0 ? team.name : ""}
                      </td>
                      <td style={{ ...TD, position: "sticky", left: 80, background: "#FFF", fontWeight: 600, color: "#1E293B", fontSize: 11, minWidth: 90 }}>
                        {member.name}
                      </td>
                      <td style={{ ...TD }}>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: otaColor + "18", color: otaColor, border: `1px solid ${otaColor}35` }}>
                          {member.ota}
                        </span>
                      </td>
                      {counts.map((cnt, di) => {
                        const isToday  = di === counts.length - 1;
                        const intensity = cnt > 0 ? Math.round((cnt / maxVal) * 100) : 0;
                        const bg = cnt === 0
                          ? (isToday ? "#EEF2FF" : "transparent")
                          : `${otaColor}${Math.max(18, intensity).toString(16).padStart(2, "0")}`;
                        return (
                          <td key={di} style={{
                            ...TD, textAlign: "center", padding: "6px 4px",
                            background: bg,
                            borderLeft: isToday ? "1px solid #C7D2FE" : undefined,
                            borderRight: isToday ? "1px solid #C7D2FE" : undefined,
                          }}>
                            <span style={{ fontSize: 11, fontWeight: cnt > 0 ? 700 : 400, color: cnt > 0 ? (isToday ? "#6366F1" : otaColor) : "#CBD5E1" }}>
                              {loading ? "—" : cnt || "·"}
                            </span>
                          </td>
                        );
                      })}
                      <td style={{ ...TD, textAlign: "center", background: "#F0FDF4" }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: rowTotal > 0 ? "#16A34A" : "#CBD5E1" }}>
                          {loading ? "—" : rowTotal}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── L12M Listings — Intern Level ───────────────────────────────── */}
      {l12m.months.length > 0 && (() => {
        const cmIdx   = l12m.months.length - 1;
        const cmMonth = l12m.months[cmIdx];
        return (
          <div style={{
            background: "#FFF", border: "1px solid #E2E8F0",
            borderRadius: 12, overflow: "hidden",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            marginTop: 16,
          }}>
            <div style={{ padding: "9px 14px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#0F172A" }}>L12M Listings — Intern Level</span>
              <span style={{ fontSize: 9, color: "#94A3B8" }}>Monthly OTA listings per member · <span style={{ color: "#6366F1", fontWeight: 700 }}>{cmMonth}</span> = current month (partial)</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11 }}>
                <thead>
                  <tr>
                    <th style={{ ...TH_BASE, textAlign: "left", position: "sticky", left: 0, zIndex: 2, background: "#F8FAFC", minWidth: 80 }}>TL</th>
                    <th style={{ ...TH_BASE, textAlign: "left", position: "sticky", left: 80, zIndex: 2, background: "#F8FAFC", minWidth: 90 }}>Member</th>
                    <th style={{ ...TH_BASE, textAlign: "left", minWidth: 80 }}>OTA</th>
                    {l12m.months.map((mo, mi) => {
                      const isCm = mi === cmIdx;
                      return (
                        <th key={mo} style={{
                          ...TH_BASE, textAlign: "center", minWidth: 46, padding: "8px 6px",
                          background:   isCm ? "#EEF2FF" : "#F8FAFC",
                          color:        isCm ? "#6366F1"  : "#94A3B8",
                          borderLeft:   isCm ? "2px solid #C7D2FE" : undefined,
                          borderRight:  isCm ? "2px solid #C7D2FE" : undefined,
                          borderBottom: isCm ? "2px solid #6366F1" : "1px solid #E2E8F0",
                        }}>{mo}</th>
                      );
                    })}
                    <th style={{ ...TH_BASE, textAlign: "center", background: "#F0FDF4", color: "#16A34A", minWidth: 50 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTeams.map((team) =>
                    team.members.filter((m) => m.ota).map((member, i) => {
                      const vals     = l12m.byOta[member.ota!] ?? Array(l12m.months.length).fill(0);
                      const rowTotal = vals.reduce((s, v) => s + v, 0);
                      const maxVal   = Math.max(...vals, 1);
                      const otaColor = OTA_COLORS[member.ota!] ?? "#64748B";
                      const isLast   = i === team.members.filter((m) => m.ota).length - 1;
                      return (
                        <tr key={`l12m-${team.name}-${member.name}`} style={{ borderBottom: isLast ? "2px solid #E2E8F0" : "1px solid #F8FAFC" }}>
                          <td style={{ ...TD, position: "sticky", left: 0, background: team.color + "07", borderLeft: `3px solid ${team.color}`, fontSize: 10, fontWeight: 700, color: team.color, minWidth: 80 }}>
                            {i === 0 ? team.name : ""}
                          </td>
                          <td style={{ ...TD, position: "sticky", left: 80, background: "#FFF", fontWeight: 600, color: "#1E293B", fontSize: 11, minWidth: 90 }}>
                            {member.name}
                          </td>
                          <td style={{ ...TD }}>
                            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: otaColor + "18", color: otaColor, border: `1px solid ${otaColor}35` }}>
                              {member.ota}
                            </span>
                          </td>
                          {vals.map((cnt, mi) => {
                            const isCm      = mi === cmIdx;
                            const intensity = cnt > 0 ? Math.round((cnt / maxVal) * 80) + 20 : 0;
                            const hexAlpha  = intensity.toString(16).padStart(2, "0");
                            const bg = cnt === 0 ? (isCm ? "#EEF2FF" : "transparent") : `${otaColor}${hexAlpha}`;
                            return (
                              <td key={mi} style={{
                                ...TD, textAlign: "center", padding: "6px 6px",
                                background: bg,
                                borderLeft:  isCm ? "2px solid #C7D2FE" : undefined,
                                borderRight: isCm ? "2px solid #C7D2FE" : undefined,
                              }}>
                                <span style={{ fontSize: 11, fontWeight: cnt > 0 ? 700 : 400, color: cnt > 0 ? (isCm ? "#6366F1" : otaColor) : "#CBD5E1" }}>
                                  {loading ? "—" : cnt || "·"}
                                </span>
                              </td>
                            );
                          })}
                          <td style={{ ...TD, textAlign: "center", background: "#F0FDF4" }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: rowTotal > 0 ? "#16A34A" : "#CBD5E1" }}>
                              {loading ? "—" : rowTotal}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ── MoM Listing Tracker (L12M by OTA) ──────────────────────────────── */}
      {l12m.months.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <L12MTable
            l12mMonths={l12m.months}
            l12mOnboarded={l12mOnboarded}
            l12mOtaLive={l12m.byOta}
            internMap={Object.fromEntries(
              TEAMS.flatMap(t => t.members.filter(m => m.ota).map(m => [m.ota!, { name: m.name, color: t.color }]))
            )}
          />
        </div>
      )}

    </div>
  );
}
