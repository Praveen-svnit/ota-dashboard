"use client";

import "./globals.css";
import Sidebar from "@/components/layout/Sidebar";
import { DashboardProvider, useDashboard } from "@/contexts/DashboardContext";
import { usePathname } from "next/navigation";

function AppShell({ children }: { children: React.ReactNode }) {
  const { lastRefreshed } = useDashboard();
  const pathname = usePathname();

  if (pathname === "/login") return <>{children}</>;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F8FAFC" }}>
      <Sidebar lastRefreshed={lastRefreshed} />
      <main style={{ flex: 1, minWidth: 0, overflowY: "auto" }}>
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
