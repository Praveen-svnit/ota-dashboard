"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef } from "react";

interface SidebarProps {
  lastRefreshed: Date | null;
}


export default function Sidebar({ lastRefreshed }: SidebarProps) {
  const pathname  = usePathname();
  const router    = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const [refreshing, setRefreshing] = useState(false);

  const [syncing,   setSyncing]   = useState(false);
  const [syncLog,   setSyncLog]   = useState<string | null>(null);
  const [syncError, setSyncError] = useState(false);
  const [logOpen,   setLogOpen]   = useState(false);
  const [copied,    setCopied]    = useState(false);
  const logRef = useRef<HTMLPreElement>(null);

  async function runRefresh() {
    setRefreshing(true);
    router.refresh();
    setTimeout(() => setRefreshing(false), 1500);
  }

  async function runSync() {
    setSyncing(true);
    setSyncLog(null);
    setSyncError(false);
    try {
      const res  = await fetch("/api/run-sync", { method: "POST" });
      const json = await res.json();
      if (!res.ok || json.error) {
        setSyncLog(json.error ?? "Unknown error");
        setSyncError(true);
      } else {
        setSyncLog(json.log ?? "Sync complete.");
        setSyncError(false);
      }
    } catch (e: unknown) {
      setSyncLog(e instanceof Error ? e.message : "Network error");
      setSyncError(true);
    } finally {
      setSyncing(false);
      setLogOpen(true);
    }
  }

  function copyLog() {
    if (!syncLog) return;
    navigator.clipboard.writeText(syncLog).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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
          background: active ? "#EFF6FF" : "transparent",
          color: active ? "#2563EB" : indent ? "#9CA3AF" : "#64748B",
          textDecoration: "none", fontSize: indent ? 11 : 12,
          fontWeight: active ? 600 : 400,
          justifyContent: collapsed ? "center" : "flex-start",
          transition: "background 0.12s, color 0.12s",
          borderLeft: active && !collapsed ? "3px solid #2563EB" : "3px solid transparent",
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
        fontSize: 9, fontWeight: 700, color: "#B0BAC9",
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
            OTA Command
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
        <NavLink icon="▣" label="Production Dashboard" href="/" />
        <NavLink icon="▤" label="Listing Dashboard"    href="/listing-dashboard" />

        {/* Listings */}
        <SectionHeader label="Listings" />
        <NavLink icon="≡" label="Property Status" href="/listings" />

        {/* Team */}
        <SectionHeader label="Team & Workflow" />
        <NavLink icon="◉" label="Team & Workflow" href="/team" />
        <NavLink icon="◎" label="Performance"     href="/performance" />
        <NavLink icon="◆" label="TL Performance"  href="/tl-performance" />

        {/* Reports */}
        <SectionHeader label="Reports" />
        <NavLink icon="⚠" label="Incomplete Data" href="/incomplete" />
        <NavLink icon="★" label="BDC Genius"       href="/reports/genius" />
        <NavLink icon="✦" label="BDC Hygiene"     href="/reports/hygiene" />
      </nav>

      {/* Footer */}
      <div style={{ padding: collapsed ? "10px 6px" : "10px 10px 14px", borderTop: "1px solid #F1F5F9" }}>

        {/* Sync App button */}
        <button
          onClick={runRefresh}
          disabled={refreshing}
          title="Reload page data from DB"
          style={{
            display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start",
            gap: 7, width: "100%",
            padding: collapsed ? "8px 0" : "8px 10px",
            borderRadius: 7, border: "none", cursor: refreshing ? "default" : "pointer",
            background: refreshing ? "#F1F5F9" : "#F0FDF4",
            color: refreshing ? "#94A3B8" : "#16A34A",
            fontSize: 12, fontWeight: 600,
            opacity: refreshing ? 0.7 : 1,
            transition: "background 0.15s",
            marginBottom: 5,
          }}
        >
          <span style={{ fontSize: 14, animation: refreshing ? "spin 1s linear infinite" : "none" }}>
            {refreshing ? "⟳" : "↻"}
          </span>
          {!collapsed && (refreshing ? "Refreshing…" : "Sync App")}
        </button>

        {/* Sync button */}
        <button
          onClick={runSync}
          disabled={syncing}
          title="Sync all tables from Sheets to DB"
          style={{
            display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "flex-start",
            gap: 7, width: "100%",
            padding: collapsed ? "8px 0" : "8px 10px",
            borderRadius: 7, border: "none", cursor: syncing ? "default" : "pointer",
            background: syncing ? "#F1F5F9" : "#EFF6FF",
            color: syncing ? "#94A3B8" : "#2563EB",
            fontSize: 12, fontWeight: 600,
            opacity: syncing ? 0.7 : 1,
            transition: "background 0.15s",
          }}
        >
          <span style={{ fontSize: 14, animation: syncing ? "spin 1s linear infinite" : "none" }}>
            {syncing ? "⟳" : "⇅"}
          </span>
          {!collapsed && (syncing ? "Syncing…" : "Sync to DB")}
        </button>

        {/* Show logs button — only when a log exists */}
        {!collapsed && syncLog && (
          <button
            onClick={() => setLogOpen(true)}
            style={{
              marginTop: 5, width: "100%", padding: "5px 10px",
              borderRadius: 6, border: "1px solid #E2E8F0",
              background: "#FAFAFA", color: syncError ? "#DC2626" : "#64748B",
              fontSize: 11, cursor: "pointer", textAlign: "left",
              fontWeight: 500,
            }}
          >
            {syncError ? "⚠ View error log" : "✓ View sync log"}
          </button>
        )}

        {!collapsed && (
          <div style={{ marginTop: 6, fontSize: 10, color: "#94A3B8" }}>
            {lastRefreshed
              ? `Updated ${lastRefreshed.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
              : "Not yet loaded"}
          </div>
        )}
      </div>

      {/* Log viewer modal */}
      {logOpen && syncLog && (
        <div
          onClick={() => setLogOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 999,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "flex-end", justifyContent: "flex-start",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              margin: "0 0 0 0",
              width: "min(680px, 96vw)",
              maxHeight: "70vh",
              background: "#0F172A",
              borderRadius: "0 12px 0 0",
              display: "flex", flexDirection: "column",
              boxShadow: "4px -4px 24px rgba(0,0,0,0.4)",
            }}
          >
            {/* Modal header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 14px", borderBottom: "1px solid #1E293B",
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: syncError ? "#F87171" : "#34D399" }}>
                {syncError ? "⚠ Sync Error" : "✓ Sync Complete"} — Log
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={copyLog}
                  style={{
                    padding: "4px 10px", borderRadius: 5,
                    border: "1px solid #334155",
                    background: copied ? "#065F46" : "#1E293B",
                    color: copied ? "#6EE7B7" : "#94A3B8",
                    fontSize: 11, cursor: "pointer", fontWeight: 600,
                  }}
                >
                  {copied ? "✓ Copied" : "Copy"}
                </button>
                <button
                  onClick={() => setLogOpen(false)}
                  style={{
                    padding: "4px 10px", borderRadius: 5,
                    border: "1px solid #334155",
                    background: "#1E293B", color: "#94A3B8",
                    fontSize: 11, cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>
            </div>

            {/* Log content */}
            <pre
              ref={logRef}
              style={{
                margin: 0, padding: "12px 14px",
                overflowY: "auto", flex: 1,
                fontSize: 11, lineHeight: 1.6,
                color: syncError ? "#FCA5A5" : "#CBD5E1",
                fontFamily: "ui-monospace, monospace",
                whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}
            >
              {syncLog}
            </pre>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </aside>
  );
}
