import { RNS_MONTHLY } from "@/lib/data";
import { RNS_OTAS } from "@/lib/constants";
import PerformanceTable from "./PerformanceTable";

type MonthlyData = Record<string, Record<string, { lmMTD: number; cmMTD: number; lmTotal: number }>>;

interface Props {
  rnsLiveMonthly?:  MonthlyData | null;
  rnsSoldMonthly?:  MonthlyData | null;
  revLiveMonthly?:  MonthlyData | null;
}

export default function RNSTable({ rnsLiveMonthly, rnsSoldMonthly, revLiveMonthly }: Props) {
  const rnsData = rnsLiveMonthly ?? RNS_MONTHLY;
  return (
    <PerformanceTable
      title="OTA Performance"
      rnsMonthly={rnsData}
      rnsSoldMonthly={rnsSoldMonthly ?? null}
      revMonthly={revLiveMonthly ?? null}
      otas={RNS_OTAS}
    />
  );
}
