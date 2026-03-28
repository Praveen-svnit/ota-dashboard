"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { OTA_COLORS } from "@/lib/constants";

interface DbUser { id: string; name: string; role: string; ota: string | null; teamLead: string | null }
interface DbTeamData {
  groups: Record<string, { tl: DbUser | null; members: DbUser[] }>;
  admins: DbUser[];
}

/* ══════════════════════════════════════════════════════════════
   TEAM DATA
══════════════════════════════════════════════════════════════ */
const OTA_SHORT: Record<string, string> = {
  "GoMMT": "GoMMT", "Booking.com": "BDC", "Agoda": "Agoda",
  "Expedia": "Exp", "Cleartrip": "CT", "Yatra": "Yatra",
  "Ixigo": "Ixigo", "Akbar Travels": "AKT", "EaseMyTrip": "EMT", "Indigo": "Indigo",
};

interface Intern { name: string; otas: string[]; pip?: boolean; new?: boolean; adhoc?: boolean; role?: string; priority?: "P1" | "P2" | "P3" }
interface TeamLead { name: string; otas: string[]; color: string; interns: Intern[] }

const CURRENT_LEADS: TeamLead[] = [
  {
    name: "Jyoti", color: "#E83F6F", otas: ["GoMMT", "Cleartrip", "Expedia", "Indigo"],
    interns: [
      { name: "Rudra",    otas: ["GoMMT"],      priority: "P1" },
      { name: "Mohit",    otas: ["Expedia"],    priority: "P1" },
      { name: "Karan",    otas: ["Cleartrip"],  priority: "P3" },
      { name: "Abhishek", otas: ["Indigo"],     priority: "P2" },
      { name: "Umesh",    otas: [], role: "Ria Travels", priority: "P2" },
      { name: "Rahul",    otas: [],             priority: "P3", pip: true },
    ],
  },
  {
    name: "Gourav", color: "#F59E0B", otas: ["Agoda", "Yatra", "Ixigo", "Akbar Travels", "EaseMyTrip"],
    interns: [
      { name: "Aman",     otas: ["Agoda"],          priority: "P1" },
      { name: "Ajeet",    otas: ["Yatra"],           priority: "P1" },
      { name: "Shrishti", otas: ["Ixigo"],           priority: "P3", pip: true },
      { name: "Joti",     otas: ["Akbar Travels"],   priority: "P1" },
      { name: "Vipul",    otas: ["EaseMyTrip"],      priority: "P1" },
    ],
  },
  {
    name: "Ajay", color: "#10B981", otas: ["Booking.com"],
    interns: [
      { name: "Gaurav Pandey", otas: ["Booking.com"], priority: "P1" },
      { name: "Sadik",         otas: [], pip: true, role: "BDC Content", priority: "P3" },
      { name: "Sajjak",        otas: [], role: "BDC Content",             priority: "P2" },
    ],
  },
  {
    name: "Salim", color: "#8B5CF6", otas: [],
    interns: [
      { name: "Karan",      otas: [], role: "FH Onboarding" },
      { name: "Vishal",     otas: [], role: "FH Listing",              priority: "P1" },
      { name: "Ajay Dhama", otas: [], role: "FH Images and GMB Images", priority: "P1" },
      { name: "Yash",       otas: [], role: "OTA RLD",    priority: "P1" },
      { name: "Gunjan",     otas: [], role: "OTA Images",  priority: "P2" },
      { name: "Vanshika",   otas: [], role: "OTA Images",  priority: "P1" },
    ],
  },
];

const PROPOSED_LEADS: TeamLead[] = [
  {
    name: "Gourav", color: "#F59E0B",
    otas: ["Agoda", "Yatra", "Akbar Travels", "EaseMyTrip", "Booking.com"],
    interns: [
      { name: "Aman",          otas: ["Agoda"],          priority: "P1" },
      { name: "Ajeet",         otas: ["Yatra"],           priority: "P1" },
      { name: "Joti",          otas: ["Akbar Travels"],   priority: "P1" },
      { name: "Vipul",         otas: ["EaseMyTrip"],      priority: "P1" },
      { name: "Gaurav Pandey", otas: ["Booking.com"],     priority: "P1" },
      { name: "Sajjak",        otas: [], role: "BDC Content", priority: "P2" },
    ],
  },
  {
    name: "Abhijeet", color: "#6366F1",
    otas: ["GoMMT", "Expedia", "Indigo", "Cleartrip", "Ixigo"],
    interns: [
      { name: "Rudra",    otas: ["GoMMT"],      priority: "P1" },
      { name: "Mohit",    otas: ["Expedia"],    priority: "P1" },
      { name: "Abhishek", otas: ["Indigo"],     priority: "P2" },
      { name: "Umesh",    otas: [], role: "Ria Travels", priority: "P2" },
      { name: "Jyoti",    otas: ["Cleartrip", "Ixigo"], role: "Sub-TL", priority: "P1" },
      { name: "Karan",    otas: ["Cleartrip"], priority: "P3" },
      { name: "Shrishti", otas: ["Ixigo"],     priority: "P3", pip: true },
      { name: "Vishal",     otas: [], role: "FH Listing",              priority: "P1" },
      { name: "Ajay Dhama", otas: [], role: "FH Images and GMB Images", priority: "P1" },
      { name: "Yash",       otas: [], role: "OTA RLD",    priority: "P1" },
      { name: "Gunjan",     otas: [], role: "OTA Images",  priority: "P2" },
      { name: "Vanshika",   otas: [], role: "OTA Images",  priority: "P1" },
    ],
  },
];

/* ══════════════════════════════════════════════════════════════
   MINI COMPONENTS
══════════════════════════════════════════════════════════════ */
function Avatar({ name, color, size = 28, fontSize = 10 }: { name: string; color: string; size?: number; fontSize?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: "50%", background: color, color: "#FFF", fontSize, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, letterSpacing: 0 }}>
      {name[0].toUpperCase()}
    </span>
  );
}

function OtaPill({ ota }: { ota: string }) {
  const color = OTA_COLORS[ota] ?? "#64748B";
  return (
    <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: color + "18", color, border: `1px solid ${color}35` }}>
      {OTA_SHORT[ota] ?? ota}
    </span>
  );
}

function Badge({ label, color, bg, border }: { label: string; color: string; bg: string; border: string }) {
  return <span style={{ fontSize: 8, fontWeight: 700, padding: "1px 5px", borderRadius: 10, color, background: bg, border: `1px solid ${border}` }}>{label}</span>;
}

function TeamCard({ lead, isProposed = false }: { lead: TeamLead; isProposed?: boolean }) {
  return (
    <div style={{ background: "#FFF", borderRadius: 14, overflow: "hidden", border: isProposed ? `1.5px dashed ${lead.color}60` : "1px solid #E2E8F0", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      {/* TL header strip */}
      <div style={{ background: `linear-gradient(135deg, ${lead.color}18 0%, ${lead.color}08 100%)`, borderBottom: `1px solid ${lead.color}20`, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: isProposed && lead.name === "New TL" ? "transparent" : lead.color, color: isProposed && lead.name === "New TL" ? lead.color : "#FFF", border: isProposed && lead.name === "New TL" ? `2px dashed ${lead.color}` : "none", fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: lead.name === "New TL" ? "none" : `0 3px 8px ${lead.color}50`, flexShrink: 0 }}>
          {lead.name[0]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{lead.name}</span>
            <span style={{ fontSize: 8, fontWeight: 700, color: "#FFF", background: lead.color, borderRadius: 4, padding: "1px 5px", letterSpacing: "0.05em" }}>TL</span>
            {isProposed && lead.name === "New TL" && (
              <span style={{ fontSize: 8, fontWeight: 700, color: "#6366F1", background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 4, padding: "1px 5px" }}>TBD</span>
            )}
          </div>
          {lead.otas.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 4 }}>
              {lead.otas.map((ota) => <OtaPill key={ota} ota={ota} />)}
            </div>
          ) : (
            <span style={{ fontSize: 10, color: "#94A3B8", fontStyle: "italic" }}>GMB / Ops</span>
          )}
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, color: lead.color, background: lead.color + "18", border: `1px solid ${lead.color}30`, borderRadius: 20, padding: "2px 8px", flexShrink: 0 }}>
          {lead.interns.length}
        </span>
      </div>

      {/* Intern list */}
      <div style={{ padding: "8px 14px 10px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {lead.interns.map((intern, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 8, background: "#F8FAFC" }}>
              <Avatar name={intern.name} color={lead.color + "99"} size={24} fontSize={9} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#1E293B" }}>{intern.name}</span>
                  {intern.priority === "P1" && <Badge label="P1" color="#16A34A" bg="#DCFCE7" border="#86EFAC" />}
                  {intern.priority === "P2" && <Badge label="P2" color="#D97706" bg="#FEF3C7" border="#FCD34D" />}
                  {intern.priority === "P3" && <Badge label="P3" color="#DC2626" bg="#FEE2E2" border="#FCA5A5" />}
                  {intern.pip   && <Badge label="PIP"     color="#EF4444" bg="#FEF2F2" border="#FECACA" />}
                  {intern.adhoc && <Badge label="Ad-Hoc"  color="#6366F1" bg="#EEF2FF" border="#C7D2FE" />}
                  {intern.new   && <Badge label="New"     color="#10B981" bg="#D1FAE5" border="#A7F3D0" />}
                </div>
              </div>
              <div style={{ flexShrink: 0 }}>
                {intern.role ? (
                  <span style={{ fontSize: 9, fontWeight: 600, color: "#6366F1", background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 6, padding: "2px 7px" }}>
                    {intern.role}
                  </span>
                ) : intern.otas.length > 0 ? (
                  <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                    {intern.otas.map((ota) => <OtaPill key={ota} ota={ota} />)}
                  </div>
                ) : (
                  <span style={{ fontSize: 9, color: "#94A3B8" }}>All OTAs</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   PAGE
══════════════════════════════════════════════════════════════ */
const TL_COLORS: Record<string, string> = {
  "Gourav": "#F59E0B", "Abhijeet": "#6366F1", "Jyoti": "#E83F6F",
  "Ajay": "#10B981", "Salim": "#8B5CF6",
};

export default function TeamPage() {
  const [dbTeam, setDbTeam] = useState<DbTeamData | null>(null);
  const [view, setView]     = useState<"live" | "structure">("live");

  useEffect(() => {
    fetch("/api/team").then(r => r.json()).then(setDbTeam);
  }, []);

  const proposedTotal = PROPOSED_LEADS.reduce((n, t) => n + t.interns.length, 0);
  const liveTotal = dbTeam ? Object.values(dbTeam.groups).reduce((n, g) => n + g.members.length, 0) : 0;

  return (
    <div style={{ padding: "20px 24px", background: "#F8FAFC", minHeight: "100vh" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>Team</div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
            {view === "live" ? `${liveTotal} active members` : `${proposedTotal} members in structure`}
          </div>
        </div>
        <Link href="/crm/users" style={{
          fontSize: 12, fontWeight: 600, color: "#6366F1",
          background: "#EEF2FF", border: "1px solid #C7D2FE",
          borderRadius: 8, padding: "7px 14px", textDecoration: "none",
        }}>
          👤 Manage Users
        </Link>
      </div>

      {/* Tab strip */}
      <div style={{
        display: "flex", gap: 2, marginBottom: 20,
        background: "#F1F5F9", borderRadius: 10, padding: 4, width: "fit-content",
      }}>
        {([["live","Live (DB)"],["structure","Structure"]] as [string,string][]).map(([v, l]) => (
          <button key={v} onClick={() => setView(v as "live" | "structure")} style={{
            padding: "7px 22px", borderRadius: 7, fontSize: 12, fontWeight: 600,
            border: "none", cursor: "pointer",
            background: view === v ? "#0F172A" : "transparent",
            color: view === v ? "#FFFFFF" : "#64748B",
            transition: "background 0.15s, color 0.15s",
          }}>{l}</button>
        ))}
      </div>

      {/* Live DB view */}
      {view === "live" && (
        dbTeam === null ? (
          <div style={{ color: "#94A3B8", fontSize: 12, padding: 20 }}>Loading…</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
            {Object.entries(dbTeam.groups).map(([tlName, group]) => {
              const color = TL_COLORS[tlName] ?? "#64748B";
              return (
                <div key={tlName} style={{ background: "#FFF", borderRadius: 14, border: "1px solid #E2E8F0", overflow: "hidden" }}>
                  {/* TL header */}
                  <div style={{ background: `linear-gradient(135deg, ${color}18, ${color}08)`, borderBottom: `1px solid ${color}20`, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: color, color: "#FFF", fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {tlName[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{tlName}</span>
                        <span style={{ fontSize: 8, fontWeight: 700, color: "#FFF", background: color, borderRadius: 4, padding: "1px 5px" }}>
                          {group.tl?.role?.toUpperCase() ?? "TL"}
                        </span>
                      </div>
                      <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>{group.members.length} members</div>
                    </div>
                  </div>
                  {/* Members */}
                  <div style={{ padding: "8px 14px 10px" }}>
                    {group.members.length === 0 ? (
                      <div style={{ fontSize: 11, color: "#CBD5E1", padding: "8px 0" }}>No members assigned yet</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {group.members.map((m) => (
                          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 8, background: "#F8FAFC" }}>
                            <div style={{ width: 24, height: 24, borderRadius: "50%", background: color + "99", color: "#FFF", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {m.name[0]}
                            </div>
                            <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "#1E293B" }}>{m.name}</span>
                            {m.ota && (
                              <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                                background: (OTA_COLORS[m.ota] ?? "#64748B") + "18",
                                color: OTA_COLORS[m.ota] ?? "#64748B",
                                border: `1px solid ${(OTA_COLORS[m.ota] ?? "#64748B")}35` }}>
                                {m.ota === "Booking.com" ? "BDC" : m.ota === "Akbar Travels" ? "AKT" : m.ota === "EaseMyTrip" ? "EMT" : m.ota}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Static structure view */}
      {view === "structure" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {PROPOSED_LEADS.map((lead) => <TeamCard key={lead.name} lead={lead} isProposed />)}
        </div>
      )}
    </div>
  );
}
