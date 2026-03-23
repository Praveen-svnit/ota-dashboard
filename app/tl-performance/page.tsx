"use client";

import { useEffect, useState } from "react";


/* ── OTAs not yet formally signed — excluded from portfolio live rate ─────── */
const UNSIGNED_OTAS = new Set(["Ixigo", "Akbar Travels"]);

/* ── Team structure ─────────────────────────────────────────────────────── */
interface Member { name: string; ota?: string; role?: string }
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
      { name: "Rahul",    role: "Ad-Hoc"   },
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
      { name: "Sadik",         role: "Ad-Hoc"     },
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



/* ── TL Score (out of 5, 0.5 steps) ────────────────────────────────────────
   3 dimensions:
   1. Portfolio Live Rate   → base   0–3 pts  (primary: portfolio coverage)
   2. TAT Compliance %      → qual   0–1 pt   (quality: % live in time)
   3. Avg / Day / Member    → pace   0–1 pt   (productivity: team output)
   ────────────────────────────────────────────────────────────────────────── */
function computeTLScore(
  portfolioLiveRate: number | null,
  inTatPct: number | null,
  totalPerDay: number | null,
): number {
  let base = 0;
  if (portfolioLiveRate != null) {
    if      (portfolioLiveRate >= 85) base = 3.0;
    else if (portfolioLiveRate >= 75) base = 2.5;
    else if (portfolioLiveRate >= 65) base = 2.0;
    else if (portfolioLiveRate >= 55) base = 1.5;
    else if (portfolioLiveRate >= 45) base = 1.0;
    else if (portfolioLiveRate >= 30) base = 0.5;
  }

  let qual = 0;
  if (inTatPct != null) {
    if      (inTatPct >= 80) qual = 1.5;
    else if (inTatPct >= 65) qual = 1.0;
    else if (inTatPct >= 50) qual = 0.5;
  }

  let pace = 0;
  if (totalPerDay !== null) {
    if      (totalPerDay >= 20) pace = 1.5;
    else if (totalPerDay >= 12) pace = 1.0;
    else if (totalPerDay >= 6)  pace = 0.5;
  }

  return Math.min(5, Math.round((base + qual + pace) * 2) / 2);
}

function scoreMeta(score: number): { color: string; bg: string } {
  if (score >= 4.5) return { color: "#6366F1", bg: "#EEF2FF" };
  if (score >= 3.5) return { color: "#10B981", bg: "#D1FAE5" };
  if (score >= 2.5) return { color: "#F59E0B", bg: "#FFF7ED" };
  if (score >= 1.0) return { color: "#F97316", bg: "#FFF7ED" };
  return               { color: "#EF4444", bg: "#FEF2F2" };
}

/* ── Cell style helpers ─────────────────────────────────────────────────── */
const TD: React.CSSProperties = { padding: "8px 14px", whiteSpace: "nowrap", verticalAlign: "middle" };
const TH_BASE: React.CSSProperties = {
  padding: "9px 14px", fontSize: 9, fontWeight: 700, color: "#94A3B8",
  background: "#F8FAFC", borderBottom: "1px solid #E2E8F0",
  whiteSpace: "nowrap", letterSpacing: "0.06em", textTransform: "uppercase",
};

/* ── Page ───────────────────────────────────────────────────────────────── */
export default function TLPerformancePage() {
  const [mtdData,  setMtdData]  = useState<MtdListing[]>([]);
  const [otaLive,         setOtaLive]         = useState<Record<string, number>>({});
  const [adjustedOtaLive, setAdjustedOtaLive] = useState<Record<string, number>>({});
  const [fhLive,    setFhLive]    = useState<number>(0);
  const [otaTat,    setOtaTat]    = useState<Record<string, number | null>>({});
  const [tatCounts, setTatCounts] = useState<Record<string, { inTat: number; afterTat: number; avgTat: number | null }>>({});
  const [loading,   setLoading]   = useState(true);
  const [showFormula, setShowFormula] = useState(false);

  useEffect(() => {
    let done = 0;
    const tryFinish = () => { if (++done === 2) setLoading(false); };

    fetch("/api/dashboard-data")
      .then((r) => r.json())
      .then((dash) => { if (dash.mtdListings) setMtdData(dash.mtdListings); })
      .catch(console.error)
      .finally(tryFinish);

    fetch("/api/perf-data")
      .then((r) => r.json())
      .then((p) => {
        if (p.otaLive)         setOtaLive(p.otaLive);
        if (p.adjustedOtaLive) setAdjustedOtaLive(p.adjustedOtaLive);
        if (p.fhLive)          setFhLive(p.fhLive);
        if (p.tatByOta)   setOtaTat(p.tatByOta);
        if (p.tatCounts)  setTatCounts(p.tatCounts);
      })
      .catch(console.error)
      .finally(tryFinish);
  }, []);

  const mtdByOta  = Object.fromEntries(mtdData.map((m) => [m.ota, m]));
  const daysDone  = new Date().getDate();

  /* ── Build per-TL aggregates ─────────────────────────────────────────── */
  const tlRows = TEAMS.filter((t) => t.type === "ota").map((team) => {
    const otaMembers = team.members.filter((m) => m.ota);

    const liveRates: number[] = [];
    let totalLive     = 0;
    let totalNotLive  = 0;
    let totalMtd      = 0;
    let totalInTat    = 0;
    let totalAfterTat = 0;
    const tatAvgs: number[] = [];

    for (const m of otaMembers) {
      const live = (adjustedOtaLive[m.ota!] ?? otaLive[m.ota!]) ?? 0;
      const isUnsigned = UNSIGNED_OTAS.has(m.ota!);
      if (fhLive > 0 && !isUnsigned) {
        liveRates.push((live / fhLive) * 100);
        totalLive    += live;
        totalNotLive += Math.max(0, fhLive - live);
      }
      const mtd = mtdByOta[m.ota!];
      if (mtd) totalMtd += mtd.cmMTD;
      const tc = tatCounts[m.ota!];
      if (tc) {
        totalInTat    += tc.inTat;
        totalAfterTat += tc.afterTat;
        if (tc.avgTat != null) tatAvgs.push(tc.avgTat);
      }
    }

    const portfolioLiveRate = liveRates.length
      ? liveRates.reduce((s, v) => s + v, 0) / liveRates.length
      : null;

    const totalPerDay  = daysDone > 0 ? +(totalMtd / daysDone).toFixed(1) : null;
    const avgPerMember = otaMembers.length > 0 && totalPerDay != null
      ? +(totalPerDay / otaMembers.length).toFixed(1)
      : null;

    const notLive = fhLive > 0 ? totalNotLive : null;

    // Avg TAT from live listings only (via tatCounts.avgTat)
    const avgTat = tatAvgs.length
      ? Math.round(tatAvgs.reduce((s, v) => s + v, 0) / tatAvgs.length)
      : null;

    // TAT compliance: % of live listings done within 15 days
    const totalTatDone = totalInTat + totalAfterTat;
    const inTatPct = totalTatDone > 0 ? (totalInTat / totalTatDone) * 100 : null;

    const score = computeTLScore(portfolioLiveRate, inTatPct, totalPerDay);

    return {
      team,
      otaMembers,
      portfolioLiveRate,
      totalPerDay,
      avgPerMember,
      totalLive: liveRates.length > 0 ? totalLive : null,
      notLive,
      totalMtd,
      avgTat,
      totalInTat,
      totalAfterTat,
      inTatPct,
      score,
    };
  });

  /* ── Rank TLs by score ───────────────────────────────────────────────── */
  const ranked = [...tlRows].sort((a, b) => b.score - a.score);

  return (
    <div style={{ padding: "24px 28px", background: "#F8FAFC", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: "#0F172A" }}>TL Performance</span>
        <span style={{
          fontSize: 10, fontWeight: 700, color: "#8B5CF6",
          background: "#F5F3FF", border: "1px solid #DDD6FE",
          borderRadius: 20, padding: "2px 10px",
        }}>
          {TEAMS.filter((t) => t.type === "ota").length} Team Leads · Portfolio View
        </span>
        {loading && <span style={{ fontSize: 10, color: "#94A3B8", marginLeft: "auto" }}>Loading…</span>}
      </div>

      {/* ── TL Scoring Formula ────────────────────────────────────────────── */}
      <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 10, marginBottom: 16, overflow: "hidden" }}>
        <button onClick={() => setShowFormula(o => !o)} style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "9px 14px", background: "none", border: "none", cursor: "pointer",
          fontSize: 11, fontWeight: 700, color: "#0F172A",
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#8B5CF6", background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 20, padding: "2px 8px", letterSpacing: "0.04em" }}>TL SCORING FORMULA</span>
            Score / 5 · 0.5 steps · Live Rate (max 3) + TAT Compliance (max 1.5) + Total Per Day CM (max 1.5)
          </span>
          <span style={{ color: "#94A3B8", fontSize: 12 }}>{showFormula ? "▲" : "▼"}</span>
        </button>
        {showFormula && (
          <div style={{ borderTop: "1px solid #F1F5F9", padding: "12px 16px 14px", background: "#FAFBFF" }}>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#8B5CF6", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Portfolio Live Rate → Base (max 3)</div>
                <table style={{ borderCollapse: "collapse", fontSize: 10 }}>
                  <thead><tr>{["Live Rate", "Base"].map(h => <th key={h} style={{ padding: "3px 10px", background: "#F5F3FF", color: "#8B5CF6", fontWeight: 700, fontSize: 9, textAlign: "left", border: "1px solid #DDD6FE" }}>{h}</th>)}</tr></thead>
                  <tbody>{[["≥ 85%","3.0"],["≥ 75%","2.5"],["≥ 65%","2.0"],["≥ 55%","1.5"],["≥ 45%","1.0"],["≥ 30%","0.5"],["< 30%","0"]].map(([lr, b]) => (
                    <tr key={lr}><td style={{ padding: "3px 10px", border: "1px solid #F1F5F9", color: "#374151" }}>{lr}</td><td style={{ padding: "3px 10px", border: "1px solid #F1F5F9", fontWeight: 700, color: "#8B5CF6", textAlign: "center" }}>{b}</td></tr>
                  ))}</tbody>
                </table>
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#10B981", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>TAT Compliance % → Quality (max +1.5)</div>
                <table style={{ borderCollapse: "collapse", fontSize: 10 }}>
                  <thead><tr>{["In-TAT %", "Bonus"].map(h => <th key={h} style={{ padding: "3px 10px", background: "#D1FAE5", color: "#10B981", fontWeight: 700, fontSize: 9, textAlign: "left", border: "1px solid #6EE7B7" }}>{h}</th>)}</tr></thead>
                  <tbody>{[["≥ 80%","+1.5"],["≥ 65%","+1.0"],["≥ 50%","+0.5"],["< 50%","+0"]].map(([pct, b]) => (
                    <tr key={pct}><td style={{ padding: "3px 10px", border: "1px solid #F1F5F9", color: "#374151" }}>{pct}</td><td style={{ padding: "3px 10px", border: "1px solid #F1F5F9", fontWeight: 700, color: "#10B981", textAlign: "center" }}>{b}</td></tr>
                  ))}</tbody>
                </table>
              </div>
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: "#F59E0B", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Total Per Day (CM) → Pace (max +1.5)</div>
                <table style={{ borderCollapse: "collapse", fontSize: 10 }}>
                  <thead><tr>{["Per Day (team)", "Bonus"].map(h => <th key={h} style={{ padding: "3px 10px", background: "#FEF3C7", color: "#F59E0B", fontWeight: 700, fontSize: 9, textAlign: "left", border: "1px solid #FDE68A" }}>{h}</th>)}</tr></thead>
                  <tbody>{[["≥ 20/day","+1.5"],["≥ 12/day","+1.0"],["≥ 6/day","+0.5"],["< 6/day","+0"]].map(([pd, b]) => (
                    <tr key={pd}><td style={{ padding: "3px 10px", border: "1px solid #F1F5F9", color: "#374151" }}>{pd}</td><td style={{ padding: "3px 10px", border: "1px solid #F1F5F9", fontWeight: 700, color: "#F59E0B", textAlign: "center" }}>{b}</td></tr>
                  ))}</tbody>
                </table>
              </div>
              <div style={{ alignSelf: "flex-end", fontSize: 10, color: "#94A3B8", maxWidth: 220, lineHeight: 1.6 }}>
                <b style={{ color: "#64748B" }}>Note:</b> Final score = Base + Quality + Pace, capped at 5.0 and rounded to nearest 0.5.<br />
                Max possible = 3 + 1.5 + 1.5 = 6 (capped at 5).<br />
                TAT Compliance = In TAT ÷ (In TAT + After TAT) × 100.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── TL Summary Table ──────────────────────────────────────────────── */}
      <div style={{
        background: "#FFF", border: "1px solid #E2E8F0",
        borderRadius: 12, overflow: "hidden",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}>
        <div style={{ padding: "9px 14px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#0F172A" }}>Team Lead Summary</span>
          <span style={{ fontSize: 9, color: "#94A3B8" }}>Portfolio metrics aggregated across each TL&apos;s OTA-assigned members</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ ...TH_BASE, textAlign: "left" }}>Rank</th>
                <th style={{ ...TH_BASE, textAlign: "left" }}>Team Lead</th>
                <th style={{ ...TH_BASE, textAlign: "left" }}>Members</th>
                <th style={{ ...TH_BASE, textAlign: "center" }}>Portfolio Live Rate</th>
                <th style={{ ...TH_BASE, textAlign: "center" }}>Total Per Day (CM)</th>
                <th style={{ ...TH_BASE, textAlign: "center" }}>Avg / Day / Member</th>
                <th style={{ ...TH_BASE, textAlign: "center" }}>Total Live</th>
                <th style={{ ...TH_BASE, textAlign: "center", color: "#10B981" }}>In TAT</th>
                <th style={{ ...TH_BASE, textAlign: "center", color: "#EF4444" }}>After TAT</th>
                <th style={{ ...TH_BASE, textAlign: "center" }}>Not Live</th>
                <th style={{ ...TH_BASE, textAlign: "center" }}>Avg TAT (days)</th>
                <th style={{ ...TH_BASE, textAlign: "center" }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((row, rank) => {
                const { team, otaMembers, portfolioLiveRate, totalPerDay, avgPerMember, totalLive, notLive, totalMtd, avgTat, totalInTat, totalAfterTat, inTatPct, score } = row;
                const perf        = scoreMeta(score);
                const lrColor     = portfolioLiveRate == null ? "#CBD5E1"
                  : portfolioLiveRate >= 95 ? "#6366F1"
                  : portfolioLiveRate >= 75 ? "#10B981"
                  : portfolioLiveRate >= 50 ? "#F59E0B"
                  : "#EF4444";
                return (
                  <tr key={team.name} style={{ borderBottom: rank < ranked.length - 1 ? "1px solid #F1F5F9" : "none" }}>

                    {/* Rank */}
                    <td style={{ ...TD, textAlign: "center", width: 48 }}>
                      <span style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 26, height: 26, borderRadius: "50%",
                        background: rank === 0 ? "#FEF3C7" : rank === 1 ? "#F1F5F9" : rank === 2 ? "#FEF0E8" : "#F8FAFC",
                        color: rank === 0 ? "#B45309" : rank === 1 ? "#475569" : rank === 2 ? "#92400E" : "#94A3B8",
                        fontWeight: 800, fontSize: 11,
                      }}>
                        {rank + 1}
                      </span>
                    </td>

                    {/* Team Lead */}
                    <td style={{ ...TD, borderLeft: `3px solid ${team.color}`, background: team.color + "07" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{
                          width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                          background: team.color, color: "#FFF", fontSize: 10, fontWeight: 800,
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          boxShadow: `0 2px 5px ${team.color}50`,
                        }}>{team.name[0]}</span>
                        <div>
                          <div style={{ fontWeight: 700, color: "#0F172A", fontSize: 12 }}>{team.name}</div>
                          <div style={{ fontSize: 8, fontWeight: 700, color: team.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                            {otaMembers.length} OTA member{otaMembers.length !== 1 ? "s" : ""}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Members */}
                    <td style={{ ...TD }}>
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 220 }}>
                        {otaMembers.map((m) => (
                          <span key={m.name} style={{
                            fontSize: 9, fontWeight: 600, padding: "2px 7px",
                            borderRadius: 20, background: team.color + "15",
                            color: team.color, border: `1px solid ${team.color}30`,
                            whiteSpace: "nowrap",
                          }}>{m.name}</span>
                        ))}
                      </div>
                    </td>

                    {/* Portfolio Live Rate */}
                    <td style={{ ...TD, textAlign: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: loading || portfolioLiveRate == null ? "#CBD5E1" : lrColor }}>
                        {loading ? "—" : portfolioLiveRate != null ? portfolioLiveRate.toFixed(1) + "%" : "—"}
                      </span>
                      {!loading && portfolioLiveRate != null && fhLive > 0 && (
                        <div style={{ fontSize: 8, color: "#94A3B8", marginTop: 1 }}>
                          {(() => {
                            const signedCnt = otaMembers.filter(m => !UNSIGNED_OTAS.has(m.ota!)).length;
                            const unsignedCnt = otaMembers.length - signedCnt;
                            return unsignedCnt > 0
                              ? `avg of ${signedCnt} OTAs · ${unsignedCnt} unsigned excl.`
                              : `avg of ${signedCnt} OTAs`;
                          })()}
                        </div>
                      )}
                    </td>

                    {/* Total Per Day (CM) */}
                    <td style={{ ...TD, textAlign: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: loading ? "#CBD5E1" : team.color }}>
                        {loading ? "—" : (totalPerDay ?? "—")}
                      </span>
                      {!loading && totalMtd > 0 && (
                        <div style={{ fontSize: 8, color: "#94A3B8", marginTop: 1 }}>{totalMtd} in {daysDone}d</div>
                      )}
                    </td>

                    {/* Avg / Day / Member */}
                    <td style={{ ...TD, textAlign: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: loading ? "#CBD5E1" : "#374151" }}>
                        {loading ? "—" : (avgPerMember ?? "—")}
                      </span>
                    </td>

                    {/* Total Live */}
                    <td style={{ ...TD, textAlign: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: loading || totalLive == null ? "#CBD5E1" : "#6366F1" }}>
                        {loading || totalLive == null ? "—" : totalLive}
                      </span>
                    </td>

                    {/* In TAT */}
                    <td style={{ ...TD, textAlign: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: loading ? "#CBD5E1" : "#10B981" }}>
                        {loading ? "—" : totalInTat}
                      </span>
                      {!loading && inTatPct != null && (
                        <div style={{ fontSize: 8, color: "#10B981", marginTop: 1, fontWeight: 700 }}>{inTatPct.toFixed(0)}% compliance</div>
                      )}
                    </td>

                    {/* After TAT */}
                    <td style={{ ...TD, textAlign: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: loading ? "#CBD5E1" : totalAfterTat > 0 ? "#EF4444" : "#94A3B8" }}>
                        {loading ? "—" : totalAfterTat}
                      </span>
                    </td>

                    {/* Not Live */}
                    <td style={{ ...TD, textAlign: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: loading || notLive == null ? "#CBD5E1" : "#EF4444" }}>
                        {loading || notLive == null ? "—" : notLive}
                      </span>
                    </td>

                    {/* Avg TAT */}
                    <td style={{ ...TD, textAlign: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 800, color: loading || avgTat == null ? "#CBD5E1" : avgTat <= 7 ? "#10B981" : avgTat <= 14 ? "#F59E0B" : "#EF4444" }}>
                        {loading || avgTat == null ? "—" : avgTat}
                      </span>
                      {!loading && avgTat != null && (
                        <div style={{ fontSize: 8, color: "#94A3B8", marginTop: 1 }}>days avg</div>
                      )}
                    </td>

                    {/* Score */}
                    <td style={{ ...TD, textAlign: "center" }}>
                      {loading
                        ? <span style={{ color: "#CBD5E1" }}>—</span>
                        : (
                          <span style={{
                            fontSize: 12, fontWeight: 800, padding: "4px 14px", borderRadius: 20,
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
              })}
            </tbody>
          </table>
        </div>
      </div>


    </div>
  );
}
