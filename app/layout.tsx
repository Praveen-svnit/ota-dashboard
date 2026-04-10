"use client";

import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import GlobalDashboardTaskShell from "@/components/tasks/GlobalDashboardTaskShell";
import { DashboardProvider, useDashboard } from "@/contexts/DashboardContext";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

function AppShell({ children }: { children: React.ReactNode }) {
  const { lastRefreshed } = useDashboard();
  const pathname = usePathname();

  if (pathname === "/login") return <>{children}</>;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F2F6FA" }}>
      <Suspense fallback={<div style={{ width: 216, minWidth: 216, background: "#fff", borderRight: "1px solid #E8ECF0" }} />}>
        <Sidebar lastRefreshed={lastRefreshed} />
      </Suspense>
      <main style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
        <GlobalDashboardTaskShell />
        {children}
      </main>
    </div>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>FabHotels OTA Command</title>
        <meta name="description" content="OTA & Listings CRM Dashboard" />
      </head>
      <body>
        <DashboardProvider>
          <AppShell>{children}</AppShell>
        </DashboardProvider>
      </body>
    </html>
  );
}
