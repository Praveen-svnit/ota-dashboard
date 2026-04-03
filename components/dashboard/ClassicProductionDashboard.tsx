"use client";

import { useState } from "react";
import { useDashboard } from "@/contexts/DashboardContext";
import KPICards from "@/components/dashboard/KPICards";
import RNSTable from "@/components/dashboard/RNSTable";
import MonthWiseTable from "@/components/dashboard/MonthWiseTable";
import PropertyRnsView from "@/components/dashboard/PropertyRnsView";
import CityView from "@/components/dashboard/CityView";
import DodView from "@/components/dashboard/DodView";
import AIInsightsView from "@/components/dashboard/AIInsightsView";

type MainView = "ota" | "city" | "property" | "ai";

export default function ClassicProductionDashboard({
  title = "Production Dashboard",
  padded = true,
}: {
  title?: string;
  padded?: boolean;
}) {
  const { data } = useDashboard();
  const [mainView, setMainView] = useState<MainView>("ota");

  const tabs: { key: MainView; label: string }[] = [
    { key: "ota", label: "OTA View" },
    { key: "city", label: "City View" },
    { key: "property", label: "Property View" },
    { key: "ai", label: "AI Insights" },
  ];

  return (
    <div style={{ padding: padded ? "20px 24px" : 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>{title}</div>

        <div
          style={{
            display: "flex",
            borderRadius: 7,
            border: "1px solid #E2E8F0",
            overflow: "hidden",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setMainView(tab.key)}
              style={{
                padding: "4px 14px",
                border: "none",
                cursor: "pointer",
                background: mainView === tab.key ? "#0F172A" : "#FFFFFF",
                color: mainView === tab.key ? "#FFFFFF" : "#64748B",
                fontFamily: "inherit",
                fontSize: 11,
                fontWeight: 600,
                borderRight: "1px solid #E2E8F0",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {mainView !== "ai" && (
        <KPICards
          fhLiveCount={data.fhLiveCount}
          fhTotalProps={data.fhTotalProps}
          fhSoldOutCount={data.fhSoldOutCount}
          fhOnboardedThisMonth={data.fhOnboardedThisMonth}
          rnsPerDayCmAvg={data.rnsPerDayCmAvg}
          mtdListings={data.mtdListings}
          l12mMonths={data.l12mMonths}
          l12mOnboarded={data.l12mOnboarded}
        />
      )}

      {mainView === "ota" && (
        <>
          <DodView />
          <RNSTable
            rnsLiveMonthly={data.rnsLiveMonthly}
            rnsSoldMonthly={data.rnsSoldMonthly}
            rnsOccupiedMonthly={(data as any).rnsOccupiedMonthly ?? null}
            revLiveMonthly={data.revLiveMonthly}
          />
          <MonthWiseTable
            title="RNS - Month-wise"
            stayData={data.rnsLiveMonthly}
            soldData={data.rnsSoldMonthly}
            occupiedData={(data as any).rnsOccupiedMonthly ?? null}
            revStayData={data.revLiveMonthly}
            accent="#2563EB"
          />
        </>
      )}

      {mainView === "city" && <CityView />}
      {mainView === "property" && <PropertyRnsView />}
      {mainView === "ai" && <AIInsightsView />}
    </div>
  );
}
