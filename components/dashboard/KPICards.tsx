import { MTD_LISTINGS, RNS_MONTHLY, FH_PLATFORM_LIVE, L12M_MONTHS, L12M_ONBOARDED } from "@/lib/data";
import { RNS_OTAS } from "@/lib/constants";
import { autoMonthKey, daysInMonth, daysDoneInMonth, fmt } from "@/lib/utils";


function KPICard({
  label,
  value,
  subtitle,
  accent,
}: {
  label: string;
  value: string;
  subtitle: string;
  accent: string;
}) {
  return (
    <div
      style={{
        background: accent + "18",
        border: `1px solid ${accent}30`,
        borderRadius: 12,
        padding: "20px 20px 16px",
        flex: 1,
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 500, color: "#64748B", marginBottom: 8, letterSpacing: "0.03em" }}>
        {label}
      </div>
      <div style={{ fontSize: 30, fontWeight: 800, color: accent, lineHeight: 1.1, marginBottom: 6 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: "#94A3B8" }}>{subtitle}</div>
    </div>
  );
}

function KPICardSplit({
  label,
  stats,
  accent,
}: {
  label: string;
  stats: { key: string; value: string; color: string }[];
  accent: string;
}) {
  return (
    <div
      style={{
        background: accent + "18",
        border: `1px solid ${accent}30`,
        borderRadius: 12,
        padding: "20px 20px 16px",
        flex: 1,
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 500, color: "#64748B", marginBottom: 14, letterSpacing: "0.03em" }}>
          {label}
        </div>
        <div style={{ display: "flex", gap: 0 }}>
          {stats.map((s, i) => (
            <div key={s.key} style={{
              flex: 1,
              paddingRight: i < stats.length - 1 ? 12 : 0,
              marginRight: i < stats.length - 1 ? 12 : 0,
              borderRight: i < stats.length - 1 ? "1px solid #E2E8F0" : "none",
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                {s.key}
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: s.color, lineHeight: 1.1 }}>
                {s.value}
              </div>
            </div>
          ))}
        </div>
    </div>
  );
}

interface Props {
  fhLiveCount?:          number;
  fhTotalProps?:         number;
  fhSoldOutCount?:       number;
  fhOnboardedThisMonth?: number;
  rnsPerDayCmAvg?:       number | null;
  mtdListings?:          { ota: string; cmMTD: number }[];
  l12mMonths?:           string[];
  l12mOnboarded?:        number[];
}

export default function KPICards({
  fhLiveCount          = FH_PLATFORM_LIVE,
  fhTotalProps         = 1877,
  fhSoldOutCount       = 0,
  fhOnboardedThisMonth = 0,
  rnsPerDayCmAvg       = null,
  mtdListings          = MTD_LISTINGS,
  l12mMonths           = L12M_MONTHS,
  l12mOnboarded        = L12M_ONBOARDED,
}: Props) {
  const cmKey = autoMonthKey();
  const totalDays = daysInMonth(cmKey);
  const daysDone = daysDoneInMonth(cmKey);
  const daysLeft = totalDays - daysDone;
  const d1Days = Math.max(daysDone - 1, 1);

  const totalMTD = mtdListings.reduce((s, r) => s + r.cmMTD, 0);

  // Fallback: derive RNS/day from seed data if live value not available
  const rnsData  = RNS_MONTHLY[cmKey] ?? {};
  const seedRNS  = RNS_OTAS.reduce((s, ota) => s + (rnsData[ota]?.cmMTD ?? 0), 0);
  const seedAvg  = d1Days > 0 ? Math.round(seedRNS / d1Days) : 0;
  const avgRNSDay = rnsPerDayCmAvg ?? seedAvg;

  const listingsPerDay = daysDone > 0 ? Math.round(totalMTD / daysDone) : 0;

  // L12M onboarded: last full month (index 10 = second-to-last)
  const lmOnboarded = l12mOnboarded.length >= 2 ? l12mOnboarded[l12mOnboarded.length - 2] : null;

  const cards = [
    {
      label: "RNS / Day (CM Avg)",
      value: fmt(avgRNSDay),
      subtitle: `Stay nights ÷ D-1 (${d1Days} days) · ${cmKey}`,
      accent: "#E83F6F",
    },
  ];

  return (
    <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
      <KPICardSplit
        label="Total Live Props"
        accent="#10B981"
        stats={[
          { key: "Live",     value: fmt(fhLiveCount),                      color: "#10B981" },
          { key: "Sold Out", value: fmt(fhSoldOutCount),                   color: "#F59E0B" },
          { key: "Total",    value: fmt(fhLiveCount + fhSoldOutCount),      color: "#0F172A" },
        ]}
      />
      {cards.map((c) => (
        <KPICard key={c.label} {...c} />
      ))}
    </div>
  );
}
