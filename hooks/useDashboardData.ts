"use client";

import { useState, useEffect, useCallback } from "react";
import {
  OTA_STATUS, MTD_LISTINGS, L12M_OTA_LIVE, L12M_MONTHS, L12M_ONBOARDED, FH_PLATFORM_LIVE
} from "@/lib/data";
type RNSMonthlyEntry = { lmMTD: number; cmMTD: number; lmTotal: number };
type RNSMonthlyData  = Record<string, Record<string, RNSMonthlyEntry>>;
export type SoldMonthlyData = Record<string, Record<string, { cmMTD: number; lmMTD: number; lmTotal: number }>>;
export type RevMonthlyData  = Record<string, Record<string, { cmMTD: number; lmMTD: number; lmTotal: number }>>;

type RNPDChannelEntry = { cmRNs: number; lmSameDayRNs: number; lmTotalRNs: number };
type RNPDEntry = { cmRNs: number; lmSameDayRNs: number; lmTotalRNs: number; channels?: Record<string, RNPDChannelEntry> };

export interface DashboardData {
  fhLiveCount:          number;
  fhTotalProps:         number;
  fhSoldOutCount:       number;
  fhOnboardedThisMonth: number;
  rnpdLive:          Record<string, RNPDEntry> | null;
  rnsPerDayCmAvg:    number | null;
  rnsLiveMonthly:    RNSMonthlyData | null;
  rnsSoldMonthly:    SoldMonthlyData | null;
  revLiveMonthly:    RevMonthlyData  | null;
  otaStatus:            { ota: string; live: number; notLive: number }[];
  mtdListings:   { ota: string; cmMTD: number; lmSameDay: number; lmTotal: number }[];
  l12mOtaLive:   Record<string, number[]>;
  l12mMonths:    string[];
  l12mOnboarded: number[];
  source:        "sheets" | "partial" | "seed";
  fetchedAt:     string;
  error?:        string;
}

const SEED_DATA: DashboardData = {
  fhLiveCount:          FH_PLATFORM_LIVE,
  fhTotalProps:         1877,
  fhSoldOutCount:       0,
  fhOnboardedThisMonth: 0,
  rnpdLive:          null,
  rnsPerDayCmAvg:    null,
  rnsLiveMonthly:    null,
  rnsSoldMonthly:    null,
  revLiveMonthly:    null,
  otaStatus:      OTA_STATUS,
  mtdListings:   MTD_LISTINGS,
  l12mOtaLive:   L12M_OTA_LIVE,
  l12mMonths:    L12M_MONTHS,
  l12mOnboarded: L12M_ONBOARDED,
  source:        "seed",
  fetchedAt:     new Date().toISOString(),
};

export function useDashboardData() {
  const [data, setData]               = useState<DashboardData>(SEED_DATA);
  const [isLoading, setIsLoading]     = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/dashboard-data");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: DashboardData = await res.json();
      setData(json);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error("[useDashboardData] fetch failed, using seed data", err);
      setData({ ...SEED_DATA, fetchedAt: new Date().toISOString() });
      setLastRefreshed(new Date());
    } finally {
      setIsLoading(false);
    }
  }, []);

  // No auto-fetch — user clicks Fetch button to load stay_rns/sold_rns data

  return { data, isLoading, lastRefreshed, refresh };
}
