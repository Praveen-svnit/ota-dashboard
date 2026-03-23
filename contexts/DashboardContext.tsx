"use client";

import { createContext, useContext } from "react";
import { useDashboardData, DashboardData } from "@/hooks/useDashboardData";

interface DashboardContextValue {
  data:          DashboardData;
  isLoading:     boolean;
  lastRefreshed: Date | null;
  refresh:       () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const value = useDashboardData();
  return (
    <DashboardContext.Provider value={value}>
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard(): DashboardContextValue {
  const ctx = useContext(DashboardContext);
  if (!ctx) throw new Error("useDashboard must be used inside DashboardProvider");
  return ctx;
}
