import Anthropic from "@anthropic-ai/sdk";
import { getSql } from "@/lib/db";
import { OTA_COLORS, RNS_OTAS } from "@/lib/constants";

const DB_TO_OTA: Record<string, string> = {
  MakeMyTrip: "GoMMT",
  Goibibo: "GoMMT",
  MyBiz: "GoMMT",
  "Booking.com": "Booking.com",
  Agoda: "Agoda",
  Expedia: "Expedia",
  Cleartrip: "Cleartrip",
  EaseMyTrip: "EaseMyTrip",
  Yatra: "Yatra",
  Travelguru: "Yatra",
  Ixigo: "Ixigo",
  "Akbar Travels": "Akbar Travels",
};

export type AlertSeverity = "critical" | "high" | "medium";
export type OtaHealth = "healthy" | "watch" | "critical";

export interface TrendPoint {
  date: string;
  label: string;
  total: number;
  values: Record<string, number>;
}

export interface ComparativeTrendPoint {
  day: number;
  label: string;
  current: number;
  lastMonth: number;
  lastYear: number;
  currentCumulative: number;
  lastMonthCumulative: number;
  lastYearCumulative: number;
}

export interface OtaPerformanceRow {
  ota: string;
  color: string;
  live: number;
  notLive: number;
  total: number;
  coveragePct: number;
  currentRn: number;
  previousRn: number;
  currentStayRn: number;
  previousStayRn: number;
  rnDeltaPct: number;
  currentRevenue: number;
  previousRevenue: number;
  revenueDeltaPct: number;
  revenuePerRn: number;
  actualRnSharePct: number;
  expectedRnSharePct: number;
  shareGapPct: number;
  severityScore: number;
  health: OtaHealth;
  primaryIssue: string;
  why: string;
  how: string;
  fix: string;
}

export interface CityPerformanceRow {
  city: string;
  liveProperties: number;
  estimatedRn: number;
  efficiency: number;
  leadOta: string;
  contributionPct: number;
  growthSignal: string;
}

export interface ExecutiveAlert {
  id: string;
  severity: AlertSeverity;
  title: string;
  metric: string;
  what: string;
  why: string;
  how: string;
  fix: string;
}

export interface PortfolioSummary {
  monthLabel: string;
  compareLabel: string;
  activeProperties: number;
  totalProperties: number;
  liveCoveragePct: number;
  mtdRn: number;
  prevMtdRn: number;
  mtdStayRn: number;
  prevMtdStayRn: number;
  rnDeltaPct: number;
  mtdRevenue: number;
  prevMtdRevenue: number;
  revenueDeltaPct: number;
  revenuePerRn: number;
  prevRevenuePerRn: number;
  currentRunRate: number;
  projectedMonthEndRn: number;
  projectedMonthEndRevenue: number;
  momentum7dPct: number;
  riskCount: number;
  mtdListings: number;
}

export interface BenchmarkSummary {
  bestCoverageOta: string;
  worstCoverageOta: string;
  bestMomentumOta: string;
  biggestRiskOta: string;
}

export interface ProductionDashboard2Snapshot {
  generatedAt: string;
  portfolio: PortfolioSummary;
  benchmarkSummary: BenchmarkSummary;
  otaPerformance: OtaPerformanceRow[];
  dailyTrend: TrendPoint[];
  comparisonTrend: ComparativeTrendPoint[];
  cityPerformance: CityPerformanceRow[];
  alerts: ExecutiveAlert[];
}

type ValueRow = { date: string; ota: string; value: number };
type CopilotMessageInput = { role: "user" | "assistant"; content: string };
type DeterministicAnswer = { answer: string; followUps: string[] };

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthLabel(date: Date): string {
  return date.toLocaleString("en-IN", { month: "short", year: "numeric" });
}

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return round((part / whole) * 100, 1);
}

function pctDelta(current: number, previous: number): number {
  if (!previous) return current === 0 ? 0 : 100;
  return round(((current - previous) / previous) * 100, 1);
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function canonicalOta(ota: string): string | null {
  return DB_TO_OTA[ota] ?? (RNS_OTAS.includes(ota) ? ota : null);
}

function buildDaySeries(start: Date, end: Date): TrendPoint[] {
  const points: TrendPoint[] = [];
  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
    points.push({
      date: formatDate(cursor),
      label: `${cursor.getDate()}/${cursor.getMonth() + 1}`,
      total: 0,
      values: Object.fromEntries(RNS_OTAS.map((ota) => [ota, 0])),
    });
  }
  return points;
}

function aggregateRowsByOta(rows: ValueRow[], start: Date, end: Date): Record<string, number> {
  const startKey = formatDate(start);
  const endKey = formatDate(end);
  const totals: Record<string, number> = Object.fromEntries(RNS_OTAS.map((ota) => [ota, 0]));

  for (const row of rows) {
    if (row.date < startKey || row.date > endKey) continue;
    const ota = canonicalOta(row.ota);
    if (!ota) continue;
    totals[ota] += row.value;
  }

  return totals;
}

function aggregateRowsByDate(rows: Array<{ date: string; value: number }>): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const row of rows) {
    totals[row.date] = (totals[row.date] ?? 0) + row.value;
  }
  return totals;
}

function portfolioSeverity(row: OtaPerformanceRow, portfolioRevenuePerRn: number): number {
  let score = 0;
  if (row.coveragePct === 0 && row.total > 0) score += 65;
  else if (row.coveragePct < 20) score += 30;
  else if (row.coveragePct < 60) score += 12;

  if (row.rnDeltaPct <= -25) score += 20;
  else if (row.rnDeltaPct <= -10) score += 12;

  if (row.shareGapPct <= -4) score += 14;
  else if (row.shareGapPct <= -2) score += 8;

  if (portfolioRevenuePerRn > 0 && row.revenuePerRn < portfolioRevenuePerRn * 0.85) score += 8;

  return score;
}

function issueForRow(row: OtaPerformanceRow, portfolioRevenuePerRn: number): Pick<OtaPerformanceRow, "primaryIssue" | "why" | "how" | "fix" | "health"> {
  if (row.coveragePct === 0 && row.total > 0) {
    return {
      health: "critical",
      primaryIssue: "Distribution blackout",
      why: `${row.ota} has 0 live listings against ${row.total} tracked properties, so the channel has no active inventory to convert.`,
      how: "The OTA has no live footprint, which pushes its RN share to zero regardless of market demand.",
      fix: `Audit onboarding blockers for ${row.ota}, clear activation dependencies, and move the top pending properties to live first.`,
    };
  }

  if (row.shareGapPct <= -4 && row.rnDeltaPct <= -10) {
    return {
      health: "critical",
      primaryIssue: "Live footprint is not converting",
      why: `${row.ota} is under-indexing by ${Math.abs(row.shareGapPct).toFixed(1)} pts of RN share and is down ${Math.abs(row.rnDeltaPct).toFixed(1)}% vs last month MTD.`,
      how: "Inventory is live, but it is either ranking poorly, yielding weak conversion, or losing visibility against better-performing channels.",
      fix: `Review pricing parity, content health, and rank drivers on ${row.ota}; focus first on the highest-live cities where the conversion leak is largest.`,
    };
  }

  if (portfolioRevenuePerRn > 0 && row.revenuePerRn < portfolioRevenuePerRn * 0.85) {
    return {
      health: "watch",
      primaryIssue: "Yield quality is weak",
      why: `${row.ota} is monetising at ${row.revenuePerRn.toLocaleString("en-IN")} revenue/RN, below the portfolio average of ${portfolioRevenuePerRn.toLocaleString("en-IN")}.`,
      how: "The channel is producing room nights, but at a weaker value mix, which drags revenue productivity.",
      fix: `Tighten discounting, review low-ADR inventory, and push higher-yield properties to the top of ${row.ota}.`,
    };
  }

  if (row.rnDeltaPct <= -10) {
    return {
      health: "watch",
      primaryIssue: "Momentum loss",
      why: `${row.ota} is down ${Math.abs(row.rnDeltaPct).toFixed(1)}% vs last month MTD even though the channel still has live coverage.`,
      how: "Demand capture has slowed relative to the previous month, which usually points to pricing, ranking, or inventory freshness issues.",
      fix: `Check recent demand dips on ${row.ota}, refresh offers, and compare top-contributing cities against last month to isolate where the slowdown started.`,
    };
  }

  return {
    health: "healthy",
    primaryIssue: "Healthy",
    why: `${row.ota} is broadly aligned with its current live footprint and monetisation profile.`,
    how: "The channel is contributing in line with its availability and yield quality.",
    fix: `Maintain supply health and keep monitoring pricing parity and content quality on ${row.ota}.`,
  };
}

function alertFromRow(row: OtaPerformanceRow): ExecutiveAlert | null {
  if (row.health === "healthy") return null;

  return {
    id: `ota-${row.ota}`,
    severity: row.health === "critical" ? "critical" : "high",
    title: `${row.ota}: ${row.primaryIssue}`,
    metric: `${row.currentRn.toLocaleString("en-IN")} RN | ${row.coveragePct.toFixed(1)}% coverage`,
    what: row.primaryIssue === "Distribution blackout"
      ? `${row.ota} currently has no live coverage.`
      : `${row.ota} is under pressure on production quality or momentum.`,
    why: row.why,
    how: row.how,
    fix: row.fix,
  };
}

function otaMatchesQuestion(question: string, ota: string): boolean {
  const aliases: Record<string, string[]> = {
    GoMMT: ["gommt", "mmt", "goibibo", "makemytrip"],
    "Booking.com": ["booking", "bdc", "booking.com"],
    EaseMyTrip: ["easemytrip", "emt"],
    "Akbar Travels": ["akbar", "akt", "akbar travels"],
  };
  const normalized = question.toLowerCase();
  return normalized.includes(ota.toLowerCase()) || (aliases[ota] ?? []).some((alias) => normalized.includes(alias));
}

function resolveQuestion(question: string, history: CopilotMessageInput[]): string {
  const trimmed = question.trim();
  const recentUserQuestions = history.filter((message) => message.role === "user").slice(-2).map((message) => message.content.trim());
  const looksLikeFollowUp = /^(why|how|what|which|and|also|then|fix|compare|show|tell|that|this)\b/i.test(trimmed) || trimmed.split(/\s+/).length <= 5;

  if (!looksLikeFollowUp || recentUserQuestions.length === 0) return trimmed;
  return `${recentUserQuestions.join(" / ")} / ${trimmed}`;
}

function detectIntent(question: string): "overview" | "ota" | "city" | "trend" | "yield" | "action" | "kpi" {
  const q = question.toLowerCase();
  if (/(city|cities|delhi|mumbai|bangalore|pune|goa|kolkata|hyderabad|gurgaon|jaipur|chennai|noida|indore)/.test(q)) return "city";
  if (/(trend|last 7|7 day|7-day|momentum|daily|drop|spike|today|yesterday)/.test(q)) return "trend";
  if (/(revenue|yield|monet|pricing|price|adr)/.test(q)) return "yield";
  if (/(fix|action|recover|improve|next step|next 7 days|plan)/.test(q)) return "action";
  if (/(kpi|card|metric|run rate|projection|coverage)/.test(q)) return "kpi";
  if (/(ota|channel)/.test(q)) return "ota";
  if (snapshotMentionsOta(q)) return "ota";
  return "overview";
}

function snapshotMentionsOta(question: string): boolean {
  return RNS_OTAS.some((ota) => otaMatchesQuestion(question, ota));
}

function buildDeterministicContext(snapshot: ProductionDashboard2Snapshot, question: string, history: CopilotMessageInput[]): DeterministicAnswer {
  const resolvedQuestion = resolveQuestion(question, history);
  const intent = detectIntent(resolvedQuestion);
  const focusedOtas = snapshot.otaPerformance.filter((row) => otaMatchesQuestion(resolvedQuestion, row.ota));
  const riskyOtas = snapshot.otaPerformance.filter((row) => row.health !== "healthy");
  const fallbackOtas = focusedOtas.length > 0 ? focusedOtas : riskyOtas.slice(0, 3);
  const focusedCities = snapshot.cityPerformance.filter((row) => resolvedQuestion.toLowerCase().includes(row.city.toLowerCase()));
  const cityNeedsSupport = /(support|weak|bottom|lag|underperform|need help|needs help|needs support)/.test(resolvedQuestion.toLowerCase());
  const rankedCities = cityNeedsSupport
    ? [...snapshot.cityPerformance].sort((a, b) => a.efficiency - b.efficiency)
    : snapshot.cityPerformance;
  const topCities = focusedCities.length > 0 ? focusedCities : rankedCities.slice(0, 3);
  const bestOta = [...snapshot.otaPerformance].sort((a, b) => b.currentRn - a.currentRn)[0];
  const worstOta = fallbackOtas[0] ?? snapshot.otaPerformance[0];
  const worstTrendDay = [...snapshot.dailyTrend].sort((a, b) => a.total - b.total)[0];
  const bestTrendDay = [...snapshot.dailyTrend].sort((a, b) => b.total - a.total)[0];

  let directAnswer = `Portfolio sold RN is ${snapshot.portfolio.mtdRn.toLocaleString("en-IN")} for ${snapshot.portfolio.monthLabel}, ${snapshot.portfolio.rnDeltaPct > 0 ? "up" : "down"} ${Math.abs(snapshot.portfolio.rnDeltaPct).toFixed(1)}% vs ${snapshot.portfolio.compareLabel}.`;
  let whatWentWrong = fallbackOtas.map((row) => `- ${row.ota}: ${row.primaryIssue}. Sold RN ${row.currentRn.toLocaleString("en-IN")}, coverage ${row.coveragePct.toFixed(1)}%, RN share gap ${row.shareGapPct.toFixed(1)} pts.`).join("\n");
  let whyWentWrong = fallbackOtas.map((row) => `- ${row.ota}: ${row.why}`).join("\n");
  let howWentWrong = fallbackOtas.map((row) => `- ${row.ota}: ${row.how}`).join("\n");
  let howToFix = fallbackOtas.map((row, index) => `${index + 1}. ${row.fix}`).join("\n");
  let followUps = [
    "Which OTA has the highest live coverage but still weak sold RN share?",
    "Show me the strongest recovery opportunities for the next 7 days.",
    "Which cities are contributing most to the weakest OTA?",
  ];

  if (intent === "city") {
    directAnswer = cityNeedsSupport
      ? `${topCities[0]?.city ?? "The weakest city"} needs the most support right now, with only ${topCities[0]?.efficiency.toFixed(2) ?? "0.00"} estimated RN per live property.`
      : `City concentration is led by ${topCities[0]?.city ?? "the top city"} with an estimated ${topCities[0]?.estimatedRn.toLocaleString("en-IN") ?? 0} RN over the last 30 days.`;
    whatWentWrong = topCities.map((row) => `- ${row.city}: ${row.growthSignal}. Est. ${row.estimatedRn.toLocaleString("en-IN")} RN, ${row.efficiency.toFixed(2)} RN per live property, lead OTA ${row.leadOta}.`).join("\n");
    whyWentWrong = topCities.map((row) => `- ${row.city}: performance is being shaped by ${row.liveProperties.toLocaleString("en-IN")} live OTA listings and ${row.contributionPct.toFixed(1)}% of city contribution.`).join("\n");
    howWentWrong = topCities.map((row) => `- ${row.city}: the city’s live footprint is translating into ${row.efficiency.toFixed(2)} RN per live property, which is ${row.growthSignal.toLowerCase()}.`).join("\n");
    howToFix = topCities.map((row, index) => `${index + 1}. ${row.growthSignal === "Needs support" || cityNeedsSupport ? `Improve conversion and supply freshness in ${row.city}, starting with ${row.leadOta}.` : `Protect ${row.city} momentum and scale the high-performing ${row.leadOta} inventory.`}`).join("\n");
    followUps = [
      "Which OTA is strongest inside the top city?",
      "Which cities need support even though they have enough live inventory?",
      "Give me a city-by-city recovery plan for the bottom 3 cities.",
    ];
  } else if (intent === "trend") {
    const last7 = snapshot.dailyTrend.slice(-7).reduce((sum, point) => sum + point.total, 0);
    const previous7 = snapshot.dailyTrend.slice(-14, -7).reduce((sum, point) => sum + point.total, 0);
    directAnswer = `The strongest recent signal is a ${snapshot.portfolio.momentum7dPct > 0 ? "gain" : "drop"} of ${Math.abs(snapshot.portfolio.momentum7dPct).toFixed(1)}% in the last 7 days (${last7.toLocaleString("en-IN")} RN vs ${previous7.toLocaleString("en-IN")}).`;
    whatWentWrong = `- Weakest day: ${worstTrendDay.label} with ${worstTrendDay.total.toLocaleString("en-IN")} sold RN.\n- Strongest day: ${bestTrendDay.label} with ${bestTrendDay.total.toLocaleString("en-IN")} sold RN.\n- Current biggest portfolio drag: ${worstOta.ota} at ${worstOta.currentRn.toLocaleString("en-IN")} sold RN.`;
    whyWentWrong = `- The daily curve is reacting most to the OTAs already flagged in risk mode, especially ${worstOta.ota}.\n- Portfolio run rate is ${snapshot.portfolio.currentRunRate.toFixed(1)} sold RN/day, so weak recent days quickly reduce month-end projection.`;
    howWentWrong = `- The decline is visible in the day-on-day sold RN trend, not just in monthly aggregates.\n- Once the weaker OTAs lose conversion momentum, the month-end projection falls to ${snapshot.portfolio.projectedMonthEndRn.toLocaleString("en-IN")} sold RN.`;
    howToFix = `1. Recover the top-risk OTA first: ${worstOta.fix}\n2. Use the strongest city/OTA combinations to recover near-term sold RN.\n3. Track the next 3 days against the ${snapshot.portfolio.currentRunRate.toFixed(1)} RN/day baseline.`;
    followUps = [
      "Which OTA contributed most to the last 7-day drop?",
      "Compare the last 7 days with the previous 7 by OTA.",
      "What daily sold RN target do we need to beat the projection?",
    ];
  } else if (intent === "yield") {
    const weakYield = [...snapshot.otaPerformance].sort((a, b) => a.revenuePerRn - b.revenuePerRn).slice(0, 3);
    directAnswer = `Portfolio revenue productivity is ₹${snapshot.portfolio.revenuePerRn.toLocaleString("en-IN")} per stay RN, based on ${snapshot.portfolio.mtdStayRn.toLocaleString("en-IN")} stay RN and ₹${snapshot.portfolio.mtdRevenue.toLocaleString("en-IN")} revenue.`;
    whatWentWrong = weakYield.map((row) => `- ${row.ota}: ₹${row.revenuePerRn.toLocaleString("en-IN")} per stay RN, revenue delta ${row.revenueDeltaPct.toFixed(1)}%.`).join("\n");
    whyWentWrong = weakYield.map((row) => `- ${row.ota}: ${row.why}`).join("\n");
    howWentWrong = weakYield.map((row) => `- ${row.ota}: yield quality is being dragged even when some room nights are still coming through.`).join("\n");
    howToFix = weakYield.map((row, index) => `${index + 1}. ${row.fix}`).join("\n");
    followUps = [
      "Which OTA has the best revenue per stay RN?",
      "Compare stay RN and revenue delta by OTA.",
      "Which low-yield OTA also has enough live coverage to fix quickly?",
    ];
  } else if (intent === "action") {
    directAnswer = `The fastest recovery path is to work the highest-risk OTAs with enough live footprint to move quickly, starting with ${worstOta.ota}.`;
    whatWentWrong = riskyOtas.slice(0, 3).map((row) => `- ${row.ota}: ${row.primaryIssue}.`).join("\n");
    whyWentWrong = riskyOtas.slice(0, 3).map((row) => `- ${row.ota}: ${row.why}`).join("\n");
    howWentWrong = riskyOtas.slice(0, 3).map((row) => `- ${row.ota}: ${row.how}`).join("\n");
    howToFix = riskyOtas.slice(0, 4).map((row, index) => `${index + 1}. ${row.fix}`).join("\n");
    followUps = [
      "Rank the OTAs by fix priority and potential impact.",
      "Which city should we target first for the highest-risk OTA?",
      "What can we recover in the next 7 days if we fix the top 2 OTAs?",
    ];
  } else if (intent === "kpi") {
    directAnswer = `The KPI cards now separate sold RN from stay revenue so the math is consistent: sold RN drives momentum and projection, while revenue per RN uses stay RN as the denominator.`;
    whatWentWrong = `- Earlier, revenue was being divided by sold RN, which mixed stay and sold date logic.\n- Local date formatting also risked shifting month boundaries by one day in IST.`;
    whyWentWrong = `- Sold RN comes from RnsSold, while revenue comes from RnsStay CICO.\n- ISO formatting at UTC midnight can turn 2026-03-01 into 2026-02-28 in Asia/Calcutta.`;
    howWentWrong = `- That mismatch could overstate or understate revenue productivity.\n- It also polluted MTD window boundaries for KPI calculations.`;
    howToFix = `1. Use local YYYY-MM-DD formatting for query boundaries.\n2. Keep sold RN KPIs on RnsSold.\n3. Keep revenue and revenue/RN on RnsStay CICO.\n4. Label the cards explicitly so the metric family is clear.`;
    followUps = [
      "List every KPI card and show the exact query logic behind it.",
      "Show me the current sold RN vs stay RN difference for this month.",
      "Which KPI is most sensitive to month-boundary errors?",
    ];
  } else if (intent === "ota" && focusedOtas.length > 0) {
    const row = focusedOtas[0];
    directAnswer = `${row.ota} currently has ${row.currentRn.toLocaleString("en-IN")} sold RN, ${row.coveragePct.toFixed(1)}% listing coverage, and ₹${row.revenuePerRn.toLocaleString("en-IN")} revenue per stay RN.`;
    whatWentWrong = `- ${row.ota}: ${row.primaryIssue}. RN delta ${row.rnDeltaPct.toFixed(1)}%, share gap ${row.shareGapPct.toFixed(1)} pts.`;
    whyWentWrong = `- ${row.why}`;
    howWentWrong = `- ${row.how}`;
    howToFix = `1. ${row.fix}`;
    followUps = [
      `Compare ${row.ota} with the best-performing OTA.`,
      `Which cities matter most for ${row.ota}?`,
      `What recovery target should ${row.ota} hit over the next 7 days?`,
    ];
  } else if (intent === "ota") {
    directAnswer = `${worstOta.ota} is hurting the portfolio most right now: ${worstOta.currentRn.toLocaleString("en-IN")} sold RN, ${worstOta.coveragePct.toFixed(1)}% coverage, and ${worstOta.primaryIssue.toLowerCase()}.`;
  }

  const answer = [
    `Question: ${question}`,
    "",
    "## Direct Answer",
    directAnswer,
    "",
    "## What Went Wrong",
    whatWentWrong,
    "",
    "## Why It Went Wrong",
    whyWentWrong,
    "",
    "## How It Went Wrong",
    howWentWrong,
    "",
    "## How To Fix",
    howToFix,
    "",
    "## What Is Going Right",
    bestOta ? `- ${bestOta.ota} is the current sold RN leader with ${bestOta.currentRn.toLocaleString("en-IN")} sold RN and ₹${bestOta.revenuePerRn.toLocaleString("en-IN")} revenue per stay RN.` : "- No standout positive outlier detected.",
  ].join("\n");

  return { answer, followUps };
}

export async function buildProductionDashboard2Snapshot(): Promise<ProductionDashboard2Snapshot> {
  const sql = getSql();
  const now = new Date();

  const [latestSoldDateRow] = await sql`SELECT MAX(date)::text AS "maxDate" FROM sold_rns`;
  const latestSoldDate = (latestSoldDateRow as { maxDate: string | null }).maxDate
    ? new Date(`${(latestSoldDateRow as { maxDate: string }).maxDate}T00:00:00`)
    : now;
  const comparisonEnd = latestSoldDate < now ? latestSoldDate : now;
  const currentMonthStart = startOfMonth(now);
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousSameDayEnd = new Date(previousMonthStart);
  previousSameDayEnd.setDate(Math.min(now.getDate() - 1, endOfMonth(previousMonthStart).getDate()));
  const comparisonCurrentMonthStart = startOfMonth(comparisonEnd);
  const comparisonPreviousMonthStart = new Date(comparisonEnd.getFullYear(), comparisonEnd.getMonth() - 1, 1);
  const comparisonPreviousMonthEnd = new Date(comparisonPreviousMonthStart);
  comparisonPreviousMonthEnd.setDate(Math.min(comparisonEnd.getDate(), endOfMonth(comparisonPreviousMonthStart).getDate()));
  const comparisonLastYearMonthStart = new Date(comparisonEnd.getFullYear() - 1, comparisonEnd.getMonth(), 1);
  const comparisonLastYearEnd = new Date(comparisonLastYearMonthStart);
  comparisonLastYearEnd.setDate(Math.min(comparisonEnd.getDate(), endOfMonth(comparisonLastYearMonthStart).getDate()));
  const last30Start = addDays(now, -29);
  const previous7Start = addDays(now, -13);
  const previous7End = addDays(now, -7);
  const recentWindowStart = previousMonthStart < last30Start ? previousMonthStart : last30Start;

  const [
    [activeRow],
    [totalRow],
    otaStatusRows,
    soldRows,
    stayRnRows,
    revenueRows,
    [mtdListingRow],
    currentComparisonRows,
    lastMonthComparisonRows,
    lastYearComparisonRows,
  ] = await Promise.all([
    sql`SELECT COUNT(*) AS n FROM inventory WHERE LOWER(fh_status) IN ('live','soldout')`,
    sql`SELECT COUNT(*) AS n FROM inventory`,
    sql`
      SELECT ota,
        SUM(CASE WHEN LOWER(sub_status) = 'live' THEN 1 ELSE 0 END) AS live,
        COUNT(*) AS total
      FROM ota_listing
      WHERE ota = ANY(${RNS_OTAS})
      GROUP BY ota
    `,
    sql`
      SELECT date::text AS date, channel AS ota, SUM(rns) AS value
      FROM sold_rns
      WHERE date >= ${formatDate(recentWindowStart)}::date AND date <= ${formatDate(now)}::date
      GROUP BY date, channel
    `,
    sql`
      SELECT date::text AS date, channel AS ota, SUM(rns) AS value
      FROM stay_rns
      WHERE date >= ${formatDate(previousMonthStart)}::date AND date <= ${formatDate(now)}::date
        AND UPPER(status) = 'CICO'
      GROUP BY date, channel
    `,
    sql`
      SELECT date::text AS date, channel AS ota, SUM(revenue) AS value
      FROM stay_rns
      WHERE date >= ${formatDate(previousMonthStart)}::date AND date <= ${formatDate(now)}::date
        AND UPPER(status) = 'CICO'
      GROUP BY date, channel
    `,
    sql`
      SELECT COUNT(*) AS n FROM ota_listing
      WHERE live_date IS NOT NULL AND live_date::date >= ${formatDate(currentMonthStart)}::date
    `,
    sql`
      SELECT date::text AS date, SUM(rns) AS value
      FROM sold_rns
      WHERE date >= ${formatDate(comparisonCurrentMonthStart)}::date AND date <= ${formatDate(comparisonEnd)}::date
      GROUP BY date
    `,
    sql`
      SELECT date::text AS date, SUM(rns) AS value
      FROM sold_rns
      WHERE date >= ${formatDate(comparisonPreviousMonthStart)}::date AND date <= ${formatDate(comparisonPreviousMonthEnd)}::date
      GROUP BY date
    `,
    sql`
      SELECT date::text AS date, SUM(rns) AS value
      FROM sold_rns
      WHERE date >= ${formatDate(comparisonLastYearMonthStart)}::date AND date <= ${formatDate(comparisonLastYearEnd)}::date
      GROUP BY date
    `,
  ]);

  const activeProperties  = Number((activeRow as { n: unknown }).n);
  const totalProperties   = Number((totalRow as { n: unknown }).n);
  const mtdListingCount   = Number((mtdListingRow as { n: unknown }).n);

  const typedOtaStatusRows = (otaStatusRows as Array<{ ota: string; live: unknown; total: unknown }>).map((r) => ({
    ota: r.ota, live: Number(r.live), total: Number(r.total),
  }));
  const typedSoldRows        = soldRows        as ValueRow[];
  const typedStayRnRows      = stayRnRows      as ValueRow[];
  const typedRevenueRows     = revenueRows     as ValueRow[];
  const typedCurrentComp     = currentComparisonRows    as Array<{ date: string; value: number }>;
  const typedLastMonthComp   = lastMonthComparisonRows  as Array<{ date: string; value: number }>;
  const typedLastYearComp    = lastYearComparisonRows   as Array<{ date: string; value: number }>;

  const currentRnByOta = aggregateRowsByOta(typedSoldRows, currentMonthStart, now);
  const previousRnByOta = aggregateRowsByOta(typedSoldRows, previousMonthStart, previousSameDayEnd);
  const currentStayRnByOta = aggregateRowsByOta(typedStayRnRows, currentMonthStart, now);
  const previousStayRnByOta = aggregateRowsByOta(typedStayRnRows, previousMonthStart, previousSameDayEnd);
  const currentRevenueByOta = aggregateRowsByOta(typedRevenueRows, currentMonthStart, now);
  const previousRevenueByOta = aggregateRowsByOta(typedRevenueRows, previousMonthStart, previousSameDayEnd);

  const dailyTrend = buildDaySeries(last30Start, now);
  const dailyPointMap = new Map(dailyTrend.map((point) => [point.date, point]));

  for (const row of typedSoldRows) {
    const ota = canonicalOta(row.ota);
    if (!ota || row.date < formatDate(last30Start)) continue;
    const point = dailyPointMap.get(row.date);
    if (!point) continue;
    point.values[ota] += row.value;
    point.total += row.value;
  }

  const currentComparisonMap = aggregateRowsByDate(typedCurrentComp);
  const lastMonthComparisonMap = aggregateRowsByDate(typedLastMonthComp);
  const lastYearComparisonMap = aggregateRowsByDate(typedLastYearComp);
  const comparisonTrend: ComparativeTrendPoint[] = [];
  let currentRunning = 0;
  let lastMonthRunning = 0;
  let lastYearRunning = 0;

  for (let day = 1; day <= comparisonEnd.getDate(); day++) {
    const currentDateKey = formatDate(new Date(comparisonCurrentMonthStart.getFullYear(), comparisonCurrentMonthStart.getMonth(), day));
    const lastMonthDateKey = day <= endOfMonth(comparisonPreviousMonthStart).getDate()
      ? formatDate(new Date(comparisonPreviousMonthStart.getFullYear(), comparisonPreviousMonthStart.getMonth(), day))
      : null;
    const lastYearDateKey = day <= endOfMonth(comparisonLastYearMonthStart).getDate()
      ? formatDate(new Date(comparisonLastYearMonthStart.getFullYear(), comparisonLastYearMonthStart.getMonth(), day))
      : null;

    const currentValue = currentComparisonMap[currentDateKey] ?? 0;
    const lastMonthValue = lastMonthDateKey ? (lastMonthComparisonMap[lastMonthDateKey] ?? 0) : 0;
    const lastYearValue = lastYearDateKey ? (lastYearComparisonMap[lastYearDateKey] ?? 0) : 0;

    currentRunning += currentValue;
    lastMonthRunning += lastMonthValue;
    lastYearRunning += lastYearValue;

    comparisonTrend.push({
      day,
      label: `${day}`,
      current: currentValue,
      lastMonth: lastMonthValue,
      lastYear: lastYearValue,
      currentCumulative: currentRunning,
      lastMonthCumulative: lastMonthRunning,
      lastYearCumulative: lastYearRunning,
    });
  }

  const totalCurrentRn = Object.values(currentRnByOta).reduce((sum, value) => sum + value, 0);
  const totalPreviousRn = Object.values(previousRnByOta).reduce((sum, value) => sum + value, 0);
  const totalCurrentStayRn = Object.values(currentStayRnByOta).reduce((sum, value) => sum + value, 0);
  const totalPreviousStayRn = Object.values(previousStayRnByOta).reduce((sum, value) => sum + value, 0);
  const totalCurrentRevenue = Object.values(currentRevenueByOta).reduce((sum, value) => sum + value, 0);
  const totalPreviousRevenue = Object.values(previousRevenueByOta).reduce((sum, value) => sum + value, 0);
  const totalLiveListings = typedOtaStatusRows.reduce((sum, row) => sum + row.live, 0);
  const elapsedDays = Math.max(now.getDate() - 1, 1);
  const portfolioRevenuePerRn = totalCurrentStayRn > 0 ? round(totalCurrentRevenue / totalCurrentStayRn, 0) : 0;

  const otaPerformance = typedOtaStatusRows
    .map((row) => {
      const currentRn = currentRnByOta[row.ota] ?? 0;
      const previousRn = previousRnByOta[row.ota] ?? 0;
      const currentStayRn = currentStayRnByOta[row.ota] ?? 0;
      const previousStayRn = previousStayRnByOta[row.ota] ?? 0;
      const currentRevenue = currentRevenueByOta[row.ota] ?? 0;
      const previousRevenue = previousRevenueByOta[row.ota] ?? 0;
      const coveragePct = pct(row.live, row.total);
      const actualRnSharePct = pct(currentRn, totalCurrentRn);
      const expectedRnSharePct = pct(row.live, totalLiveListings);
      const revenuePerRn = currentStayRn > 0 ? round(currentRevenue / currentStayRn, 0) : 0;

      const baseRow: OtaPerformanceRow = {
        ota: row.ota,
        color: OTA_COLORS[row.ota] ?? "#2563EB",
        live: row.live,
        notLive: row.total - row.live,
        total: row.total,
        coveragePct,
        currentRn,
        previousRn,
        currentStayRn,
        previousStayRn,
        rnDeltaPct: pctDelta(currentRn, previousRn),
        currentRevenue: round(currentRevenue, 0),
        previousRevenue: round(previousRevenue, 0),
        revenueDeltaPct: pctDelta(currentRevenue, previousRevenue),
        revenuePerRn,
        actualRnSharePct,
        expectedRnSharePct,
        shareGapPct: round(actualRnSharePct - expectedRnSharePct, 1),
        severityScore: 0,
        health: "healthy",
        primaryIssue: "",
        why: "",
        how: "",
        fix: "",
      };

      const severityScore = portfolioSeverity(baseRow, portfolioRevenuePerRn);
      const issue = issueForRow(baseRow, portfolioRevenuePerRn);

      return {
        ...baseRow,
        severityScore,
        ...issue,
      };
    })
    .sort((a, b) => b.severityScore - a.severityScore || b.currentRn - a.currentRn);

  const alerts = otaPerformance
    .map((row) => alertFromRow(row))
    .filter((alert): alert is ExecutiveAlert => Boolean(alert));

  const last7Total = dailyTrend.slice(-7).reduce((sum, point) => sum + point.total, 0);
  const previous7Total = dailyTrend
    .filter((point) => point.date >= formatDate(previous7Start) && point.date <= formatDate(previous7End))
    .reduce((sum, point) => sum + point.total, 0);
  const momentum7dPct = pctDelta(last7Total, previous7Total);

  if (momentum7dPct <= -10) {
    alerts.unshift({
      id: "portfolio-momentum",
      severity: "high",
      title: "Portfolio momentum has softened in the last 7 days",
      metric: `${last7Total.toLocaleString("en-IN")} RN vs ${previous7Total.toLocaleString("en-IN")} RN`,
      what: "Last-7-day portfolio production is below the prior 7-day window.",
      why: `The portfolio is down ${Math.abs(momentum7dPct).toFixed(1)}% on recent momentum, which signals a short-term slowdown even before month-end closes.`,
      how: "The slowdown compounds quickly because fewer daily room nights reduce run rate and final month-end projection.",
      fix: "Prioritise the weakest OTAs with strong live coverage first, then review pricing and supply freshness in the top-contributing cities.",
    });
  }

  const cityLiveRows = (await sql`
    SELECT inv.city, ol.ota, COUNT(*) AS cnt
    FROM ota_listing ol
    JOIN inventory inv ON inv.property_id = ol.property_id
    WHERE LOWER(ol.sub_status) = 'live' AND inv.city IS NOT NULL AND inv.city != ''
    GROUP BY inv.city, ol.ota
  `) as Array<{ city: string; ota: string; cnt: number }>;

  const otaLast30Totals = dailyTrend.reduce((acc, point) => {
    for (const ota of RNS_OTAS) acc[ota] = (acc[ota] ?? 0) + point.values[ota];
    return acc;
  }, {} as Record<string, number>);

  const cityOtaCounts: Record<string, Record<string, number>> = {};
  const cityLiveCounts: Record<string, number> = {};
  const otaLiveTotalsByCityMap: Record<string, number> = {};

  for (const row of cityLiveRows) {
    if (!cityOtaCounts[row.city]) cityOtaCounts[row.city] = {};
    cityOtaCounts[row.city][row.ota] = (cityOtaCounts[row.city][row.ota] ?? 0) + row.cnt;
    cityLiveCounts[row.city] = (cityLiveCounts[row.city] ?? 0) + row.cnt;
    otaLiveTotalsByCityMap[row.ota] = (otaLiveTotalsByCityMap[row.ota] ?? 0) + row.cnt;
  }

  const totalCityRn = Object.values(otaLast30Totals).reduce((sum, value) => sum + value, 0);

  const cityPerformanceRaw = Object.entries(cityOtaCounts)
    .map(([city, otaCounts]) => {
      let estimatedRn = 0;
      let leadOta = "GoMMT";
      let leadOtaRn = -1;

      for (const ota of RNS_OTAS) {
        const cityCount = otaCounts[ota] ?? 0;
        const otaTotalLive = otaLiveTotalsByCityMap[ota] ?? 0;
        const otaShare = otaTotalLive > 0 ? cityCount / otaTotalLive : 0;
        const otaEstimatedRn = round((otaLast30Totals[ota] ?? 0) * otaShare, 0);
        estimatedRn += otaEstimatedRn;
        if (otaEstimatedRn > leadOtaRn) {
          leadOtaRn = otaEstimatedRn;
          leadOta = ota;
        }
      }

      const liveProperties = cityLiveCounts[city] ?? 0;
      const efficiency = liveProperties > 0 ? round(estimatedRn / liveProperties, 2) : 0;
      const contributionPct = pct(estimatedRn, totalCityRn);

      return {
        city,
        liveProperties,
        estimatedRn,
        efficiency,
        leadOta,
        contributionPct,
        growthSignal: "Stable" as CityPerformanceRow["growthSignal"],
      };
    })
    .sort((a, b) => b.estimatedRn - a.estimatedRn);

  const avgCityEfficiency = cityPerformanceRaw.length > 0
    ? cityPerformanceRaw.reduce((sum, row) => sum + row.efficiency, 0) / cityPerformanceRaw.length
    : 0;

  const cityPerformance = cityPerformanceRaw
    .map((row) => ({
      ...row,
      growthSignal:
        row.efficiency >= avgCityEfficiency * 1.03 ? "High efficiency" :
        row.efficiency <= avgCityEfficiency * 0.97 ? "Needs support" :
        "Stable",
    }))
    .slice(0, 10);

  const portfolioSummary: PortfolioSummary = {
    monthLabel: monthLabel(currentMonthStart),
    compareLabel: monthLabel(previousMonthStart),
    activeProperties,
    totalProperties,
    liveCoveragePct: pct(totalLiveListings, typedOtaStatusRows.reduce((sum, row) => sum + row.total, 0)),
    mtdRn: totalCurrentRn,
    prevMtdRn: totalPreviousRn,
    mtdStayRn: totalCurrentStayRn,
    prevMtdStayRn: totalPreviousStayRn,
    rnDeltaPct: pctDelta(totalCurrentRn, totalPreviousRn),
    mtdRevenue: round(totalCurrentRevenue, 0),
    prevMtdRevenue: round(totalPreviousRevenue, 0),
    revenueDeltaPct: pctDelta(totalCurrentRevenue, totalPreviousRevenue),
    revenuePerRn: portfolioRevenuePerRn,
    prevRevenuePerRn: totalPreviousStayRn > 0 ? round(totalPreviousRevenue / totalPreviousStayRn, 0) : 0,
    currentRunRate: round(totalCurrentRn / elapsedDays, 1),
    projectedMonthEndRn: round((totalCurrentRn / elapsedDays) * endOfMonth(now).getDate(), 0),
    projectedMonthEndRevenue: round((totalCurrentRevenue / elapsedDays) * endOfMonth(now).getDate(), 0),
    momentum7dPct,
    riskCount: otaPerformance.filter((row) => row.health !== "healthy").length,
    mtdListings: mtdListingCount,
  };

  const benchmarkSummary: BenchmarkSummary = {
    bestCoverageOta: [...otaPerformance].sort((a, b) => b.coveragePct - a.coveragePct)[0]?.ota ?? "GoMMT",
    worstCoverageOta: [...otaPerformance].sort((a, b) => a.coveragePct - b.coveragePct)[0]?.ota ?? "Ixigo",
    bestMomentumOta: [...otaPerformance].sort((a, b) => b.rnDeltaPct - a.rnDeltaPct)[0]?.ota ?? "GoMMT",
    biggestRiskOta: otaPerformance[0]?.ota ?? "Ixigo",
  };

  return {
    generatedAt: now.toISOString(),
    portfolio: portfolioSummary,
    benchmarkSummary,
    otaPerformance,
    dailyTrend,
    comparisonTrend,
    cityPerformance,
    alerts: alerts.slice(0, 6),
  };
}

export async function generateProductionDashboard2Answer(
  question: string,
  history: CopilotMessageInput[] = []
): Promise<{ answer: string; mode: "deterministic" | "anthropic"; snapshot: ProductionDashboard2Snapshot; followUps: string[]; }> {
  const snapshot = await buildProductionDashboard2Snapshot();
  const fallback = buildDeterministicContext(snapshot, question, history);

  if (!process.env.ANTHROPIC_API_KEY) {
    return { answer: fallback.answer, mode: "deterministic", snapshot, followUps: fallback.followUps };
  }

  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1800,
      system: [
        "You are an executive OTA analytics copilot for FabHotels.",
        "Answer using the live snapshot provided.",
        "Always include these sections exactly: What Went Wrong, Why It Went Wrong, How It Went Wrong, How To Fix.",
        "Use specific numbers from the snapshot, pay attention to the user question and recent conversation, and avoid repeating the same answer for different asks.",
      ].join(" "),
      messages: [
        ...history.slice(-6).map((message) => ({
          role: message.role,
          content: message.content,
        })),
        {
          role: "user",
          content: `Question: ${question}\n\nLive snapshot:\n${JSON.stringify(snapshot, null, 2)}`,
        },
      ],
    });

    const answer = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    return {
      answer: answer || fallback.answer,
      mode: answer ? "anthropic" : "deterministic",
      snapshot,
      followUps: fallback.followUps,
    };
  } catch {
    return { answer: fallback.answer, mode: "deterministic", snapshot, followUps: fallback.followUps };
  }
}
