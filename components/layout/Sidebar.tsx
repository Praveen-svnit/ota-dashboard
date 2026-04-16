"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

interface SessionUser { id: string; username: string; name: string; role: string; ota: string | null; }

interface SidebarProps {
  lastRefreshed: Date | null;
}


export default function Sidebar({ lastRefreshed }: SidebarProps) {
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const router       = useRouter();

  const OTA_LIST = ["GoMMT","Booking.com","Agoda","Expedia","Cleartrip","Yatra","Ixigo","Akbar Travels","EaseMyTrip","Indigo","GMB"];
  const OTA_ICONS: Record<string, string> = {
    "GoMMT": "🟥", "Booking.com": "🟦", "Agoda": "🟣", "Expedia": "🔵",
    "Cleartrip": "🟠", "Yatra": "🔴", "Ixigo": "🟧", "Akbar Travels": "🔷",
    "EaseMyTrip": "🩵", "Indigo": "🟪", "GMB": "🟢",
  };
  const isListingDash = pathname === "/listing-dashboard";
  const activeOta = isListingDash ? (searchParams.get("ota") ?? "Overview") : null;
  const [collapsed,  setCollapsed]  = useState(false);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then((r) => r.ok ? r.json() : null).then((d) => d && setSessionUser(d.user));
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  function NavLink({ icon, label, href, indent = false }: { icon: string; label: string; href: string; indent?: boolean }) {
    const active = pathname === href;
    return (
      <Link
        href={href}
        title={collapsed ? label : undefined}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: collapsed ? "9px 0" : indent ? "7px 10px 7px 22px" : "8px 10px",
          borderRadius: 7, marginBottom: 1,
          background: active ? "#5D87FF" : "transparent",
          color: active ? "#FFFFFF" : indent ? "#9CA3AF" : "#64748B",
          textDecoration: "none", fontSize: indent ? 11 : 12,
          fontWeight: active ? 600 : 400,
          justifyContent: collapsed ? "center" : "flex-start",
          transition: "background 0.12s, color 0.12s",
          borderLeft: "none",
        }}
      >
        <span style={{ fontSize: indent ? 12 : 14, flexShrink: 0 }}>{icon}</span>
        {!collapsed && <span style={{ whiteSpace: "nowrap" }}>{label}</span>}
      </Link>
    );
  }

  function SectionHeader({ label }: { label: string }) {
    if (collapsed) return <div style={{ height: 1, background: "#F1F5F9", margin: "8px 4px" }} />;
    return (
      <div style={{
        fontSize: 9, fontWeight: 700, color: "#A0AEC0",
        letterSpacing: "0.1em", textTransform: "uppercase",
        padding: "12px 8px 4px",
      }}>
        {label}
      </div>
    );
  }

  return (
    <aside style={{
      width: collapsed ? 52 : 216,
      minWidth: collapsed ? 52 : 216,
      background: "#FFFFFF",
      borderRight: "1px solid #E8ECF0",
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      position: "sticky",
      top: 0,
      transition: "width 0.2s ease, min-width 0.2s ease",
      overflow: "hidden",
      zIndex: 40,
    }}>

      {/* Brand */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 12px 10px", borderBottom: "1px solid #F1F5F9" }}>
        {!collapsed && (
          <span style={{ color: "#1E293B", fontWeight: 800, fontSize: 13, letterSpacing: "0.01em", whiteSpace: "nowrap" }}>
            OTA Connect
          </span>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? "Expand" : "Collapse"}
          style={{
            background: "none", border: "none",
            color: "#94A3B8", cursor: "pointer",
            fontSize: 13, padding: "3px 5px",
            borderRadius: 4,
            marginLeft: collapsed ? "auto" : 0,
            lineHeight: 1,
          }}
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "6px 8px", overflowY: "auto" }}>

        {/* Dashboards */}
        <SectionHeader label="Dashboards" />
        <NavLink icon="📊" label="Production Dashboard" href="/" />

        {/* CRM */}
        <SectionHeader label="CRM" />
        <NavLink icon="📋" label="Property Tracker" href="/listings" />
        <NavLink icon="🏢" label="Property CRM"     href="/crm" />

        {/* Listing Dashboard — with OTA sub-links */}
        <Link href="/listing-dashboard"
          title={collapsed ? "Listing Dashboard" : undefined}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: collapsed ? "9px 0" : "8px 10px",
            borderRadius: 7, marginBottom: 1,
            background: isListingDash && activeOta === "Overview" ? "#5D87FF" : isListingDash ? "#EEF2FF" : "transparent",
            color: isListingDash && activeOta === "Overview" ? "#FFFFFF" : isListingDash ? "#4F46E5" : "#64748B",
            textDecoration: "none", fontSize: 12,
            fontWeight: isListingDash ? 600 : 400,
            justifyContent: collapsed ? "center" : "flex-start",
            transition: "background 0.12s, color 0.12s",
          }}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>🏠</span>
          {!collapsed && <span style={{ whiteSpace: "nowrap", flex: 1 }}>Listing Dashboard</span>}
        </Link>

        {/* OTA sub-links — shown when not collapsed */}
        {!collapsed && (
          <div style={{ marginBottom: 2 }}>
            {OTA_LIST.map(ota => {
              const isActive = isListingDash && activeOta === ota;
              return (
                <Link key={ota} href={`/listing-dashboard?ota=${encodeURIComponent(ota)}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "5px 10px 5px 26px",
                    borderRadius: 6, marginBottom: 1,
                    background: isActive ? "#5D87FF" : "transparent",
                    color: isActive ? "#FFFFFF" : "#94A3B8",
                    textDecoration: "none", fontSize: 11,
                    fontWeight: isActive ? 700 : 400,
                    transition: "background 0.12s, color 0.12s",
                  }}>
                  <span style={{ fontSize: 10, flexShrink: 0 }}>{OTA_ICONS[ota] ?? "◆"}</span>
                  <span style={{ whiteSpace: "nowrap" }}>{ota}</span>
                </Link>
              );
            })}
          </div>
        )}

        <NavLink icon="✅" label="Tasks"          href="/tasks" />
        <NavLink icon="⚠️" label="Incomplete Data" href="/incomplete" />

        {/* Team */}
        <SectionHeader label="Team & Workflow" />
        <NavLink icon="👥" label="Team"           href="/team" />
        <NavLink icon="📈" label="Team Performance" href="/performance" />

        {/* BDC Reports */}
        <SectionHeader label="BDC Reports" />
        <NavLink icon="📅" label="Today's Tasks"  href="/todays-assigned-tasks" />
        <NavLink icon="⭐" label="BDC Genius"      href="/reports/genius" />
        <NavLink icon="🔍" label="BDC Hygiene"     href="/reports/hygiene" />

        {/* MMT Reports */}
        <SectionHeader label="MMT Reports" />
        <NavLink icon="🧼" label="MMT Hygiene"   href="/reports/mmt-hygiene" />

        {/* Admin */}
        <SectionHeader label="Admin" />
        <NavLink icon="🔄" label="Migration"      href="/admin/migration" />
        <NavLink icon="🔑" label="API Keys"       href="/admin/api-keys" />
      </nav>

      {/* Footer */}
      <div style={{ padding: collapsed ? "10px 6px" : "10px 10px 14px", borderTop: "1px solid #F1F5F9" }}>

        {!collapsed && (
          <div style={{ marginBottom: 8, fontSize: 10, color: "#94A3B8" }}>
            {lastRefreshed
              ? `Updated ${lastRefreshed.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
              : "Not yet loaded"}
          </div>
        )}

        {/* User info + logout */}
        {sessionUser && !collapsed && (
          <div style={{ paddingTop: 8, borderTop: "1px solid #F1F5F9",
            display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#EEF2FF",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 800, color: "#5D87FF", flexShrink: 0 }}>
              {sessionUser.name[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#1E293B",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {sessionUser.name}
              </div>
              <div style={{ fontSize: 9, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {sessionUser.role}{sessionUser.ota ? ` · ${sessionUser.ota}` : ""}
              </div>
            </div>
            <button onClick={handleLogout} title="Sign out"
              style={{ background: "none", border: "none", cursor: "pointer",
                color: "#94A3B8", fontSize: 14, padding: "2px 4px", flexShrink: 0 }}>
              ⏻
            </button>
          </div>
        )}
        {sessionUser && collapsed && (
          <button onClick={handleLogout} title="Sign out"
            style={{ marginTop: 8, width: "100%", background: "none", border: "none",
              cursor: "pointer", color: "#94A3B8", fontSize: 16, padding: "6px 0" }}>
            ⏻
          </button>
        )}
      </div>
    </aside>
  );
}
