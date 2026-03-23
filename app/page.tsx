"use client";

import { useState } from "react";
import { useDashboard } from "@/contexts/DashboardContext";
import KPICards from "@/components/dashboard/KPICards";
import RNSTable from "@/components/dashboard/RNSTable";
import MonthWiseTable from "@/components/dashboard/MonthWiseTable";
import PropertyRnsView from "@/components/dashboard/PropertyRnsView";

type MainView = "ota" | "property";

export default function DashboardPage() {
  const { data } = useDashboard();
  const [mainView, setMainView] = useState<MainView>("ota");

  return (
    <div style={{ padding: "20px 24px" }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>Production Dashboard</div>

        {/* OTA View / Property View toggle */}
        <div style={{ display: "flex", borderRadius: 7, border: "1px solid #E2E8F0", overflow: "hidden", fontSize: 11, fontWeight: 600 }}>
          {(["ota", "property"] as MainView[]).map((v) => (
            <button
              key={v}
              onClick={() => setMainView(v)}
              style={{
                padding: "4px 12px", border: "none", cursor: "pointer",
                background: mainView === v ? "#0F172A" : "#FFFFFF",
                color:      mainView === v ? "#FFFFFF" : "#64748B",
                fontFamily: "inherit", fontSize: 11, fontWeight: 600,
              }}
            >
              {v === "ota" ? "OTA View" : "Property View"}
            </button>
          ))}
        </div>
      </div>

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

      {mainView === "ota" ? (
        <>
          <RNSTable rnsLiveMonthly={data.rnsLiveMonthly} rnsSoldMonthly={data.rnsSoldMonthly} revLiveMonthly={data.revLiveMonthly} />
          <MonthWiseTable title="RNS — Month-wise" stayData={data.rnsLiveMonthly} soldData={data.rnsSoldMonthly} revStayData={data.revLiveMonthly} accent="#2563EB" />
        </>
      ) : (
        <PropertyRnsView />
      )}
    </div>
  );
}
