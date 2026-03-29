"use client";

import { useEffect, useState, Fragment } from "react";
import { OTA_COLORS } from "@/lib/constants";

/* ── Constants ──────────────────────────────────────────────── */
const OTA_SHORT: Record<string, string> = {
  "GoMMT": "GoMMT", "Booking.com": "BDC", "Agoda": "Agoda",
  "Expedia": "Exp", "Cleartrip": "CT", "Yatra": "Yatra",
  "Ixigo": "Ixigo", "Akbar Travels": "AKT", "EaseMyTrip": "EMT", "Indigo": "Indigo",
};

const OTA_LIST = [
  "GoMMT","Booking.com","Agoda","Expedia","Cleartrip",
  "Yatra","Ixigo","Akbar Travels","EaseMyTrip","Indigo",
];

const ROLE_ORDER: Record<string, number> = { admin: 0, head: 1, tl: 2, intern: 3 };
const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  admin:  { bg: "#FEE2E2", color: "#DC2626" },
  head:   { bg: "#F5F3FF", color: "#7C3AED" },
  tl:     { bg: "#FEF3C7", color: "#D97706" },
  intern: { bg: "#D1FAE5", color: "#059669" },
};

const TL_COLORS: Record<string, string> = {
  Jyoti: "#E83F6F", Gourav: "#F59E0B", Ajay: "#10B981",
  Salim: "#8B5CF6", Abhijeet: "#6366F1",
};

const TEAM_MEMBERS = [
  { name: "Rudra",        ota: "GoMMT",        teamLead: "Abhijeet", role: "intern" },
  { name: "Mohit",        ota: "Expedia",       teamLead: "Abhijeet", role: "intern" },
  { name: "Karan",        ota: "Cleartrip",     teamLead: "Jyoti",    role: "intern" },
  { name: "Abhishek",     ota: "Indigo",        teamLead: "Abhijeet", role: "intern" },
  { name: "Umesh",        ota: "",              teamLead: "Abhijeet", role: "intern" },
  { name: "Rahul",        ota: "",              teamLead: "Jyoti",    role: "intern" },
  { name: "Aman",         ota: "Agoda",         teamLead: "Gourav",   role: "intern" },
  { name: "Ajeet",        ota: "Yatra",         teamLead: "Gourav",   role: "intern" },
  { name: "Shrishti",     ota: "Ixigo",         teamLead: "Gourav",   role: "intern" },
  { name: "Joti",         ota: "Akbar Travels", teamLead: "Gourav",   role: "intern" },
  { name: "Vipul",        ota: "EaseMyTrip",    teamLead: "Gourav",   role: "intern" },
  { name: "Gaurav Pandey",ota: "Booking.com",   teamLead: "Ajay",     role: "intern" },
  { name: "Sadik",        ota: "",              teamLead: "Ajay",     role: "intern" },
  { name: "Sajjak",       ota: "",              teamLead: "Gourav",   role: "intern" },
  { name: "Vishal",       ota: "",              teamLead: "Salim",    role: "intern" },
  { name: "Ajay Dhama",   ota: "",              teamLead: "Salim",    role: "intern" },
  { name: "Yash",         ota: "",              teamLead: "Salim",    role: "intern" },
  { name: "Gunjan",       ota: "",              teamLead: "Salim",    role: "intern" },
  { name: "Vanshika",     ota: "",              teamLead: "Salim",    role: "intern" },
  { name: "Jyoti",        ota: "",              teamLead: "",         role: "tl" },
  { name: "Gourav",       ota: "",              teamLead: "",         role: "tl" },
  { name: "Ajay",         ota: "",              teamLead: "",         role: "tl" },
  { name: "Salim",        ota: "",              teamLead: "",         role: "tl" },
  { name: "Abhijeet",     ota: "",              teamLead: "",         role: "tl" },
];

/* ── Types ──────────────────────────────────────────────────── */
interface DbUser { id: string; name: string; role: string; ota: string | null; teamLead: string | null }
interface DbTeamData {
  groups: Record<string, { tl: DbUser | null; members: DbUser[] }>;
  admins: DbUser[];
}
interface UserRow {
  id: string; username: string; name: string; role: string;
  ota: string | null; teamLead: string | null; active: number; createdAt: string;
  email: string | null; phone: string | null; empId: string | null;
}

const EMPTY_FORM = {
  username: "", password: "", name: "", role: "intern",
  ota: "", teamLead: "", email: "", phone: "", empId: "",
};
function autoUsername(n: string) { return n.toLowerCase().replace(/\s+/g, "."); }

/* ── Workflow data ───────────────────────────────────────────── */
const TEAM_REGISTRY: Record<string, { color: string; role: "lead" | "intern" | "external" }> = {
  "Jyoti":  { color: "#E83F6F", role: "lead" }, "Gourav": { color: "#F59E0B", role: "lead" },
  "Ajay":   { color: "#10B981", role: "lead" }, "Salim":  { color: "#8B5CF6", role: "lead" },
  "Rudra":      { color: "#E83F6F", role: "intern" }, "Mohit":    { color: "#E83F6F", role: "intern" },
  "Karan (CT)": { color: "#E83F6F", role: "intern" }, "Abhishek": { color: "#E83F6F", role: "intern" },
  "Umesh":      { color: "#E83F6F", role: "intern" }, "Rahul":    { color: "#E83F6F", role: "intern" },
  "Aman":     { color: "#F59E0B", role: "intern" }, "Ajeet":    { color: "#F59E0B", role: "intern" },
  "Shrishti": { color: "#F59E0B", role: "intern" }, "Joti":     { color: "#F59E0B", role: "intern" },
  "Vipul":    { color: "#F59E0B", role: "intern" },
  "Gaurav Pandey": { color: "#10B981", role: "intern" }, "Sadik": { color: "#10B981", role: "intern" }, "Sajjak": { color: "#10B981", role: "intern" },
  "Karan":      { color: "#8B5CF6", role: "intern" }, "Vishal":     { color: "#8B5CF6", role: "intern" },
  "Ajay Dhama": { color: "#8B5CF6", role: "intern" }, "Yash":       { color: "#8B5CF6", role: "intern" },
  "Gunjan":     { color: "#8B5CF6", role: "intern" }, "Vanshika":   { color: "#8B5CF6", role: "intern" },
  "Supply Team": { color: "#0EA5E9", role: "external" }, "Revenue Team": { color: "#F97316", role: "external" },
  "Legal Team":  { color: "#6B7280", role: "external" }, "Finance Team": { color: "#14B8A6", role: "external" },
  "Photoshoot Team": { color: "#EC4899", role: "external" },
};
interface WorkflowStep { id: number; title: string; desc?: string; owners: string[]; track?: "A" | "B" }
interface WorkflowPhase { id: string; label: string; icon: string; color: string; bg: string; steps: WorkflowStep[] }
const WORKFLOW: WorkflowPhase[] = [
  { id: "onboarding", label: "Onboarding", icon: "①", color: "#6366F1", bg: "#EEF2FF", steps: [
    { id: 1, title: "Property Onboarding Form Submitted", desc: "Supply team fills in all property details — name, location, room types, contracts, and supporting documents.", owners: ["Supply Team"] },
    { id: 2, title: "Form Review — Revenue & Legal", desc: "Revenue team validates commercial terms; Legal team verifies contracts and compliance.", owners: ["Revenue Team", "Legal Team"] },
    { id: 3, title: "Final Approval — Property Good to Go", desc: "All stakeholders aligned. Property is approved and handed over to the Listing team.", owners: ["Revenue Team", "Legal Team"] },
  ]},
  { id: "listing-prep", label: "Listing Prep", icon: "②", color: "#8B5CF6", bg: "#F3E8FF", steps: [
    { id: 4, title: "Form Audit & Verification", desc: "Karan (FH Onboarding) reviews and audits all submitted forms for completeness and accuracy.", owners: ["Salim", "Karan"] },
    { id: 5, title: "Contract Details Entered to Tracking Sheet", owners: ["Karan"] },
    { id: 6, title: "Details Shared with Finance Team", owners: ["Karan", "Finance Team"] },
    { id: 7, title: "Listing Details Handed to Listing Team", owners: ["Salim", "Karan", "Vishal", "Ajay Dhama", "Yash", "Gunjan", "Vanshika"] },
  ]},
  { id: "fh-shell", label: "FH Shell", icon: "③", color: "#0EA5E9", bg: "#E0F2FE", steps: [
    { id: 8, title: "Property Shell Created on FH Platform", desc: "FH Listing team builds the property shell — room types, amenities, pricing structure, and content.", owners: ["Vishal", "Ajay Dhama", "Yash", "Gunjan", "Vanshika"] },
    { id: 9, title: "Property Goes Live on FH", desc: "Shell is reviewed and published. OTA listing and Photoshoot tracks begin in parallel.", owners: ["Vishal", "Ajay Dhama", "Yash", "Gunjan", "Vanshika"] },
  ]},
  { id: "ota-listing", label: "OTA Listing", icon: "④", color: "#F59E0B", bg: "#FFF7ED", steps: [
    { id: 10, title: "OTA Stakeholders Raise Listing Requests", owners: ["Jyoti", "Rudra", "Mohit", "Karan (CT)", "Abhishek", "Gourav", "Aman", "Ajeet", "Shrishti", "Joti", "Vipul", "Ajay", "Gaurav Pandey", "Sajjak"] },
    { id: 11, title: "Property Listed & Live on OTAs", owners: ["Rudra", "Mohit", "Karan (CT)", "Abhishek", "Aman", "Ajeet", "Shrishti", "Joti", "Vipul", "Gaurav Pandey", "Sajjak"] },
    { id: 12, title: "OTA Mapping — All Platforms", owners: ["Rudra", "Mohit", "Karan (CT)", "Abhishek", "Aman", "Ajeet", "Shrishti", "Joti", "Vipul", "Gaurav Pandey", "Sajjak"] },
  ]},
  { id: "post-live", label: "Post Live", icon: "⑤", color: "#10B981", bg: "#D1FAE5", steps: [
    { id: 13, title: "Ops Visit — Room Level Data Captured", track: "A", owners: ["Salim", "Vishal", "Ajay Dhama", "Yash", "Gunjan", "Vanshika"] },
    { id: 14, title: "RLD Updated on FH Web / App Portal", track: "A", owners: ["Vishal", "Ajay Dhama", "Yash", "Gunjan", "Vanshika"] },
    { id: 15, title: "RLD Updated on OTA Portals", track: "A", owners: ["Vishal", "Ajay Dhama", "Yash", "Gunjan", "Vanshika"] },
    { id: 16, title: "Photoshoot Conducted at Property", track: "B", owners: ["Photoshoot Team"] },
    { id: 17, title: "Photos Processed & Uploaded to FH Portal", track: "B", owners: ["Vishal", "Ajay Dhama", "Yash", "Gunjan", "Vanshika"] },
    { id: 18, title: "Photos Updated on OTA Portals", track: "B", owners: ["Vishal", "Ajay Dhama", "Yash", "Gunjan", "Vanshika"] },
  ]},
];
function MemberChip({ name }: { name: string }) {
  const m = TEAM_REGISTRY[name];
  const color = m?.color ?? "#64748B";
  const isExt = m?.role === "external";
  const isLead = m?.role === "lead";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px 2px 3px", borderRadius: 20, background: color + "15", border: `1px solid ${color}35`, fontSize: 10, fontWeight: 600, color, whiteSpace: "nowrap" }}>
      <span style={{ width: 14, height: 14, borderRadius: "50%", background: isExt ? "transparent" : color, color: isExt ? color : "#FFF", border: isExt ? `1.5px dashed ${color}` : "none", fontSize: 7, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{name[0]}</span>
      {name}
      {isLead && <span style={{ fontSize: 6, opacity: 0.55, letterSpacing: "0.04em", textTransform: "uppercase" }}>TL</span>}
      {isExt  && <span style={{ fontSize: 6, opacity: 0.55, letterSpacing: "0.04em", textTransform: "uppercase" }}>EXT</span>}
    </span>
  );
}
function StepCard({ step, color, bg, isLast }: { step: WorkflowStep; color: string; bg: string; isLast: boolean }) {
  const [open, setOpen] = useState(false);
  const hasDesc = !!step.desc;
  return (
    <div style={{ display: "flex", gap: 0 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 26, flexShrink: 0 }}>
        <div style={{ width: 20, height: 20, borderRadius: "50%", background: color, color: "#FFF", fontSize: 8, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 2px 6px ${color}55`, flexShrink: 0, zIndex: 1 }}>{step.id}</div>
        {!isLast && <div style={{ width: 1.5, flex: 1, minHeight: 8, background: `linear-gradient(${color}60, ${color}10)`, marginTop: 3 }} />}
      </div>
      <div style={{ flex: 1, marginBottom: isLast ? 0 : 8, marginLeft: 8, border: `1px solid ${color}22`, borderLeft: `3px solid ${color}`, borderRadius: 8, overflow: "hidden", background: "#FAFBFF" }}>
        <div style={{ padding: "7px 10px", background: open ? bg : "#FAFBFF", cursor: hasDesc ? "pointer" : "default", transition: "background 0.15s" }} onClick={() => hasDesc && setOpen((o) => !o)}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#0F172A", lineHeight: 1.4 }}>{step.title}</span>
            {hasDesc && <span style={{ fontSize: 9, color, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>{open ? "▲" : "▼"}</span>}
          </div>
          {step.owners.length > 0 && <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 5 }}>{step.owners.map((o) => <MemberChip key={o} name={o} />)}</div>}
        </div>
        {open && step.desc && <div style={{ padding: "7px 10px", borderTop: `1px solid ${color}18`, background: bg }}><p style={{ margin: 0, fontSize: 11, color: "#475569", lineHeight: 1.65 }}>{step.desc}</p></div>}
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────── */
export default function TeamPage() {
  const [view, setView] = useState<"manage" | "structure" | "workflow">("manage");
  const [activePhase, setActivePhase] = useState("all");

  /* ── Team Structure state ── */
  const [dbTeam, setDbTeam] = useState<DbTeamData | null>(null);

  /* ── Manage Users state ── */
  const [users,    setUsers]    = useState<UserRow[]>([]);
  const [uLoading, setULoading] = useState(false);
  const [uError,   setUError]   = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState(EMPTY_FORM);
  const [saving,   setSaving]   = useState(false);
  const [formErr,  setFormErr]  = useState("");
  const [resetId,  setResetId]  = useState<string | null>(null);
  const [resetPw,  setResetPw]  = useState("");
  // Edit user
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", empId: "", role: "", ota: "", teamLead: "" });
  const [editSaving, setEditSaving] = useState(false);
  // Change TL inline
  const [changingTL, setChangingTL] = useState<string | null>(null); // user id

  /* ── Load data ── */
  useEffect(() => {
    fetch("/api/team").then(r => r.json()).then(setDbTeam);
  }, []);

  function loadUsers() {
    setULoading(true);
    setUError("");
    fetch("/api/crm/users")
      .then(async r => {
        if (r.status === 403) throw new Error("Admin access required");
        if (!r.ok) throw new Error(`Server error (${r.status})`);
        return r.json();
      })
      .then(d => setUsers(d.users ?? []))
      .catch(e => setUError(e.message))
      .finally(() => setULoading(false));
  }

  useEffect(() => { loadUsers(); }, []);

  /* ── Active TLs derived from users ── */
  const activeTLs = users.filter(u => (u.role === "tl" || u.role === "head") && u.active);

  /* ── Actions ── */
  async function createUser() {
    setFormErr("");
    if (!form.username || !form.password || !form.name || !form.email || !form.phone) {
      setFormErr("Username, password, name, email, and phone are required");
      return;
    }
    setSaving(true);
    const res  = await fetch("/api/crm/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setFormErr(json.error ?? "Error"); return; }
    setShowForm(false); setForm(EMPTY_FORM); loadUsers();
  }

  async function toggleActive(u: UserRow) {
    await fetch("/api/crm/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: u.id, active: u.active ? 0 : 1 }) });
    loadUsers();
  }

  async function resetPassword() {
    if (!resetPw.trim() || !resetId) return;
    await fetch("/api/crm/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: resetId, password: resetPw }) });
    setResetId(null); setResetPw("");
  }

  async function saveEdit() {
    if (!editUser) return;
    setEditSaving(true);
    await fetch("/api/crm/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editUser.id, ...editForm }),
    });
    setEditSaving(false);
    setEditUser(null);
    loadUsers();
  }

  async function changeTL(userId: string, newTL: string) {
    await fetch("/api/crm/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: userId, teamLead: newTL || null }) });
    setChangingTL(null);
    loadUsers();
  }

  /* ── Sorted users: admin → head → tl → intern ── */
  const sortedUsers = [...users].sort((a, b) => {
    const ro = (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9);
    if (ro !== 0) return ro;
    return a.name.localeCompare(b.name);
  });

  const TH = { padding: "9px 12px", fontSize: 10, fontWeight: 700, color: "#64748B", background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", textAlign: "left" as const, whiteSpace: "nowrap" as const };
  const TD = { padding: "9px 12px", fontSize: 12, borderBottom: "1px solid #F1F5F9", verticalAlign: "middle" as const };

  const liveTotal = dbTeam ? Object.values(dbTeam.groups).reduce((n, g) => n + g.members.length, 0) : 0;

  return (
    <div style={{ padding: "20px 24px", background: "#F8FAFC", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>Team</div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>
            {view === "manage" ? `${users.length} users` : view === "structure" ? `${liveTotal} active members` : `${WORKFLOW.reduce((n, p) => n + p.steps.length, 0)} steps · ${WORKFLOW.length} phases`}
          </div>
        </div>

        {/* Tab strip */}
        <div style={{ display: "flex", gap: 2, background: "#F1F5F9", borderRadius: 10, padding: 4 }}>
          {([["manage", "Manage Users"], ["structure", "Team Structure"], ["workflow", "Workflow"]] as [string, string][]).map(([v, l]) => (
            <button key={v} onClick={() => setView(v as "manage" | "structure" | "workflow")} style={{
              padding: "7px 22px", borderRadius: 7, fontSize: 12, fontWeight: 600,
              border: "none", cursor: "pointer",
              background: view === v ? "#0F172A" : "transparent",
              color: view === v ? "#FFFFFF" : "#64748B",
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* ══ MANAGE USERS ══ */}
      {view === "manage" && (
        <div>
          {uError && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", borderRadius: 8, padding: "10px 14px", fontSize: 12, marginBottom: 16 }}>{uError}</div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
            <button onClick={() => setShowForm(s => !s)} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#2563EB,#1D4ED8)", color: "#FFF", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {showForm ? "Cancel" : "+ Add User"}
            </button>
          </div>

          {/* Add user form */}
          {showForm && (
            <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A", marginBottom: 12 }}>New User</div>

              {/* Quick pick */}
              <div style={{ marginBottom: 14, padding: "10px 14px", background: "#F8FAFC", borderRadius: 9, border: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", marginBottom: 6 }}>Quick Pick from Team</div>
                <select defaultValue="" onChange={e => {
                  const m = TEAM_MEMBERS.find(x => x.name === e.target.value);
                  if (m) setForm(p => ({ ...p, name: m.name, ota: m.ota, teamLead: m.teamLead, role: m.role, username: autoUsername(m.name) }));
                }} style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #CBD5E1", fontSize: 12, background: "#FFF" }}>
                  <option value="">— Select existing team member —</option>
                  {TEAM_MEMBERS.map(m => (
                    <option key={m.name} value={m.name}>
                      {m.name} {m.ota ? `(${m.ota})` : ""} — {m.role === "tl" ? "Team Lead" : `TL: ${m.teamLead}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Row 1: Username, Password, Full Name */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                {[
                  { label: "Username *",  key: "username", type: "text"     },
                  { label: "Password *",  key: "password", type: "password" },
                  { label: "Full Name *", key: "name",     type: "text"     },
                ].map(({ label, key, type }) => (
                  <div key={key} style={{ flex: "1 1 150px" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 4 }}>{label}</div>
                    <input type={type} value={(form as Record<string, string>)[key]}
                      onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #CBD5E1", fontSize: 12, boxSizing: "border-box" }} />
                  </div>
                ))}
              </div>

              {/* Row 2: Email, Phone, Emp ID */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                {[
                  { label: "Email *",  key: "email", type: "email" },
                  { label: "Phone *",  key: "phone", type: "tel"   },
                  { label: "Emp ID",   key: "empId", type: "text"  },
                ].map(({ label, key, type }) => (
                  <div key={key} style={{ flex: "1 1 150px" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 4 }}>{label}</div>
                    <input type={type} value={(form as Record<string, string>)[key]}
                      onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                      placeholder={key === "empId" ? "optional" : ""}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #CBD5E1", fontSize: 12, boxSizing: "border-box" }} />
                  </div>
                ))}
              </div>

              {/* Row 3: Role, OTA, Team Lead */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 120px" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Role *</div>
                  <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #CBD5E1", fontSize: 12, background: "#FFF", boxSizing: "border-box" as const }}>
                    <option value="intern">Intern</option>
                    <option value="tl">Team Lead (TL)</option>
                    <option value="head">Head</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {(form.role === "intern" || form.role === "tl") && (
                  <div style={{ flex: "1 1 150px" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Assigned OTA</div>
                    <select value={form.ota} onChange={e => setForm(p => ({ ...p, ota: e.target.value }))}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #CBD5E1", fontSize: 12, background: "#FFF", boxSizing: "border-box" as const }}>
                      <option value="">— Select OTA —</option>
                      {OTA_LIST.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                )}
                {form.role === "intern" && (
                  <div style={{ flex: "1 1 150px" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Team Lead</div>
                    <select value={form.teamLead} onChange={e => setForm(p => ({ ...p, teamLead: e.target.value }))}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #CBD5E1", fontSize: 12, background: "#FFF", boxSizing: "border-box" as const }}>
                      <option value="">— Select TL —</option>
                      {activeTLs.map(t => <option key={t.id} value={t.name}>{t.name} ({t.role})</option>)}
                    </select>
                  </div>
                )}
              </div>

              {formErr && <div style={{ color: "#DC2626", fontSize: 12, marginTop: 10 }}>{formErr}</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button onClick={createUser} disabled={saving} style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: "#2563EB", color: "#FFF", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  {saving ? "Saving…" : "Create User"}
                </button>
                <button onClick={() => { setShowForm(false); setFormErr(""); setForm(EMPTY_FORM); }} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFF", fontSize: 12, cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          )}

          {/* Users table */}
          <div style={{ background: "#FFF", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
            {uLoading ? (
              <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>Loading…</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Name / Contact", "Username", "Emp ID", "Role", "OTA", "Team Lead", "Status", "Joined", "Actions"].map(h => (
                        <th key={h} style={TH}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedUsers.map((u, i) => {
                      const rc = ROLE_COLORS[u.role] ?? { bg: "#F1F5F9", color: "#64748B" };
                      const prevRole = i > 0 ? sortedUsers[i - 1].role : null;
                      const isNewGroup = prevRole !== u.role;
                      return (
                        <Fragment key={u.id}>
                          {isNewGroup && (
                            <tr>
                              <td colSpan={9} style={{ padding: "6px 12px 4px", fontSize: 9, fontWeight: 800, color: rc.color, background: rc.bg + "80", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                                {u.role === "admin" ? "Admins" : u.role === "head" ? "Heads" : u.role === "tl" ? "Team Leads" : "Interns"}
                              </td>
                            </tr>
                          )}
                          <tr style={{ opacity: u.active ? 1 : 0.5 }}>
                            <td style={TD}>
                              <div style={{ fontWeight: 600, color: "#1E293B" }}>{u.name}</div>
                              {(u.email || u.phone) && (
                                <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>
                                  {u.email && <span>{u.email}</span>}
                                  {u.email && u.phone && <span> · </span>}
                                  {u.phone && <span>{u.phone}</span>}
                                </div>
                              )}
                            </td>
                            <td style={{ ...TD, color: "#64748B" }}>{u.username}</td>
                            <td style={{ ...TD, color: "#64748B", fontSize: 11 }}>{u.empId || "—"}</td>
                            <td style={TD}>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20, background: rc.bg, color: rc.color }}>
                                {u.role === "tl" ? "TL" : u.role.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ ...TD, color: "#64748B" }}>{u.ota || "—"}</td>
                            <td style={TD}>
                              {u.role === "intern" ? (
                                changingTL === u.id ? (
                                  <select
                                    defaultValue={u.teamLead ?? ""}
                                    autoFocus
                                    onBlur={() => setChangingTL(null)}
                                    onChange={e => changeTL(u.id, e.target.value)}
                                    style={{ fontSize: 11, padding: "4px 8px", borderRadius: 6, border: "1px solid #CBD5E1", background: "#FFF", cursor: "pointer" }}
                                  >
                                    <option value="">— None —</option>
                                    {activeTLs.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                  </select>
                                ) : (
                                  <button onClick={() => setChangingTL(u.id)} title="Click to change TL" style={{
                                    fontSize: 11, color: u.teamLead ? "#1E293B" : "#94A3B8",
                                    background: "transparent", border: "1px dashed #CBD5E1",
                                    borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontWeight: u.teamLead ? 600 : 400,
                                  }}>
                                    {u.teamLead || "Assign TL"} ✎
                                  </button>
                                )
                              ) : (
                                <span style={{ fontSize: 11, color: "#94A3B8" }}>—</span>
                              )}
                            </td>
                            <td style={TD}>
                              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: u.active ? "#D1FAE5" : "#F1F5F9", color: u.active ? "#059669" : "#94A3B8" }}>
                                {u.active ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td style={{ ...TD, color: "#94A3B8", fontSize: 11 }}>
                              {new Date(u.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}
                            </td>
                            <td style={TD}>
                              <div style={{ display: "flex", gap: 6 }}>
                                <button onClick={() => { setEditUser(u); setEditForm({ name: u.name, email: u.email ?? "", phone: u.phone ?? "", empId: u.empId ?? "", role: u.role, ota: u.ota ?? "", teamLead: u.teamLead ?? "" }); }} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#0F172A", cursor: "pointer", fontWeight: 600 }}>Edit</button>
                                <button onClick={() => { setResetId(u.id); setResetPw(""); }} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#6366F1", cursor: "pointer", fontWeight: 600 }}>Reset PW</button>
                                <button onClick={() => toggleActive(u)} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6, border: "1px solid #E2E8F0", background: "#F8FAFC", color: u.active ? "#DC2626" : "#059669", cursor: "pointer", fontWeight: 600 }}>
                                  {u.active ? "Deactivate" : "Activate"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ TEAM STRUCTURE ══ */}
      {view === "structure" && (
        dbTeam === null ? (
          <div style={{ color: "#94A3B8", fontSize: 12, padding: 20 }}>Loading…</div>
        ) : (
          <div>
            {/* Heads + Admins */}
            {dbTeam.admins.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: "#7C3AED", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
                  Admins &amp; Heads
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {dbTeam.admins.map(u => {
                    const rc = ROLE_COLORS[u.role] ?? { bg: "#F1F5F9", color: "#64748B" };
                    return (
                      <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#FFF", borderRadius: 10, border: "1px solid #E2E8F0", padding: "10px 14px" }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: rc.color, color: "#FFF", fontSize: 13, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{u.name[0]}</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>{u.name}</div>
                          <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 7px", borderRadius: 20, background: rc.bg, color: rc.color }}>{u.role.toUpperCase()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TL Groups */}
            <div style={{ fontSize: 10, fontWeight: 800, color: "#D97706", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>
              Teams
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {Object.entries(dbTeam.groups).map(([tlName, group]) => {
                const color = TL_COLORS[tlName] ?? "#64748B";
                return (
                  <div key={tlName} style={{ background: "#FFF", borderRadius: 14, border: "1px solid #E2E8F0", overflow: "hidden" }}>
                    <div style={{ background: `linear-gradient(135deg, ${color}18, ${color}08)`, borderBottom: `1px solid ${color}20`, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: color, color: "#FFF", fontSize: 14, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{tlName[0]}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: "#0F172A" }}>{tlName}</span>
                          <span style={{ fontSize: 8, fontWeight: 700, color: "#FFF", background: color, borderRadius: 4, padding: "1px 5px" }}>{(group.tl?.role ?? "TL").toUpperCase()}</span>
                        </div>
                        <div style={{ fontSize: 10, color: "#94A3B8", marginTop: 2 }}>{group.members.length} members</div>
                      </div>
                    </div>
                    <div style={{ padding: "8px 14px 10px" }}>
                      {group.members.length === 0 ? (
                        <div style={{ fontSize: 11, color: "#CBD5E1", padding: "8px 0" }}>No members assigned yet</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          {group.members.map((m) => (
                            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 8, background: "#F8FAFC" }}>
                              <div style={{ width: 24, height: 24, borderRadius: "50%", background: color + "99", color: "#FFF", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{m.name[0]}</div>
                              <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "#1E293B" }}>{m.name}</span>
                              {m.ota && (
                                <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: (OTA_COLORS[m.ota] ?? "#64748B") + "18", color: OTA_COLORS[m.ota] ?? "#64748B", border: `1px solid ${(OTA_COLORS[m.ota] ?? "#64748B")}35` }}>
                                  {OTA_SHORT[m.ota] ?? m.ota}
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
          </div>
        )
      )}

      {/* Edit user modal */}
      {editUser && (
        <div onClick={() => setEditUser(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#FFF", borderRadius: 14, padding: 24, width: 480, boxShadow: "0 8px 32px rgba(0,0,0,0.14)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 16 }}>Edit — {editUser.name}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Row 1 */}
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Full Name</div>
                  <input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #CBD5E1", fontSize: 12, boxSizing: "border-box" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Role</div>
                  <select value={editForm.role} onChange={e => setEditForm(p => ({ ...p, role: e.target.value }))}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #CBD5E1", fontSize: 12, background: "#FFF", boxSizing: "border-box" as const }}>
                    <option value="intern">Intern</option>
                    <option value="tl">Team Lead (TL)</option>
                    <option value="head">Head</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </div>
              {/* Row 2 */}
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Email</div>
                  <input type="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #CBD5E1", fontSize: 12, boxSizing: "border-box" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Phone</div>
                  <input type="tel" value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #CBD5E1", fontSize: 12, boxSizing: "border-box" }} />
                </div>
              </div>
              {/* Row 3 */}
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Emp ID</div>
                  <input value={editForm.empId} onChange={e => setEditForm(p => ({ ...p, empId: e.target.value }))}
                    placeholder="optional"
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #CBD5E1", fontSize: 12, boxSizing: "border-box" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Assigned OTA</div>
                  <select value={editForm.ota} onChange={e => setEditForm(p => ({ ...p, ota: e.target.value }))}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #CBD5E1", fontSize: 12, background: "#FFF", boxSizing: "border-box" as const }}>
                    <option value="">— None —</option>
                    {OTA_LIST.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
              {/* Team Lead */}
              {editForm.role === "intern" && (
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Team Lead</div>
                  <select value={editForm.teamLead} onChange={e => setEditForm(p => ({ ...p, teamLead: e.target.value }))}
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #CBD5E1", fontSize: 12, background: "#FFF", boxSizing: "border-box" as const }}>
                    <option value="">— None —</option>
                    {activeTLs.map(t => <option key={t.id} value={t.name}>{t.name} ({t.role})</option>)}
                  </select>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
              <button onClick={saveEdit} disabled={editSaving} style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", background: "#2563EB", color: "#FFF", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: editSaving ? 0.6 : 1 }}>
                {editSaving ? "Saving…" : "Save Changes"}
              </button>
              <button onClick={() => setEditUser(null)} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFF", fontSize: 13, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ WORKFLOW ══ */}
      {view === "workflow" && (
        <div style={{ padding: "4px 0" }}>
          {/* Phase progress bar */}
          <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", marginBottom: 14, height: 5, gap: 2 }}>
            {WORKFLOW.map((ph) => (
              <div key={ph.id} title={ph.label}
                style={{ flex: ph.steps.length, background: activePhase === "all" || activePhase === ph.id ? ph.color : ph.color + "30", cursor: "pointer", transition: "background 0.2s" }}
                onClick={() => setActivePhase(activePhase === ph.id ? "all" : ph.id)} />
            ))}
          </div>
          {/* Phase filter pills */}
          <div style={{ display: "flex", gap: 6, marginBottom: 18, flexWrap: "wrap" }}>
            <button onClick={() => setActivePhase("all")} style={{ padding: "4px 12px", borderRadius: 20, fontSize: 10, fontWeight: 700, cursor: "pointer", border: "1px solid #C7D2FE", background: activePhase === "all" ? "#6366F1" : "#EEF2FF", color: activePhase === "all" ? "#FFF" : "#6366F1", transition: "all 0.15s" }}>All phases</button>
            {WORKFLOW.map((ph) => (
              <button key={ph.id} onClick={() => setActivePhase(activePhase === ph.id ? "all" : ph.id)} style={{ padding: "4px 12px", borderRadius: 20, fontSize: 10, fontWeight: 700, cursor: "pointer", border: `1px solid ${ph.color}50`, background: activePhase === ph.id ? ph.color : ph.bg, color: activePhase === ph.id ? "#FFF" : ph.color, transition: "all 0.15s" }}>
                {ph.icon} {ph.label}
              </button>
            ))}
          </div>
          {/* Phases */}
          {WORKFLOW.filter((ph) => activePhase === "all" || activePhase === ph.id).map((phase, phIdx, arr) => {
            const nonParallel = phase.steps.filter((s) => !s.track);
            const trackA      = phase.steps.filter((s) => s.track === "A");
            const trackB      = phase.steps.filter((s) => s.track === "B");
            const hasParallel = trackA.length > 0 && trackB.length > 0;
            const isLastPhase = phIdx === arr.length - 1;
            return (
              <div key={phase.id} style={{ marginBottom: isLastPhase ? 0 : 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", background: phase.bg, border: `1px solid ${phase.color}35`, borderRadius: 20 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: phase.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: phase.color }}>{phase.label}</span>
                    <span style={{ fontSize: 9, color: phase.color, opacity: 0.55 }}>{phase.steps.length} steps</span>
                  </div>
                  <div style={{ flex: 1, height: 1, background: `${phase.color}18` }} />
                </div>
                <div style={{ paddingLeft: 4 }}>
                  {nonParallel.map((step, i) => (
                    <StepCard key={step.id} step={step} color={phase.color} bg={phase.bg} isLast={i === nonParallel.length - 1 && !hasParallel} />
                  ))}
                  {hasParallel && (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <div style={{ flex: 1, height: 1, background: `${phase.color}25` }} />
                        <span style={{ fontSize: 8, fontWeight: 700, color: phase.color, background: phase.bg, border: `1px solid ${phase.color}35`, borderRadius: 20, padding: "2px 10px", letterSpacing: "0.06em" }}>PARALLEL TRACKS</span>
                        <div style={{ flex: 1, height: 1, background: `${phase.color}25` }} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <div style={{ fontSize: 8, fontWeight: 700, color: "#0EA5E9", background: "#E0F2FE", border: "1px solid #BAE6FD", borderRadius: 20, padding: "2px 10px", display: "inline-flex", gap: 5, marginBottom: 8, letterSpacing: "0.04em" }}>◈ TRACK A · Room Level Data</div>
                          {trackA.map((step, i) => <StepCard key={step.id} step={step} color="#0EA5E9" bg="#E0F2FE" isLast={i === trackA.length - 1} />)}
                        </div>
                        <div>
                          <div style={{ fontSize: 8, fontWeight: 700, color: "#EC4899", background: "#FCE7F3", border: "1px solid #FBCFE8", borderRadius: 20, padding: "2px 10px", display: "inline-flex", gap: 5, marginBottom: 8, letterSpacing: "0.04em" }}>◈ TRACK B · Photoshoot</div>
                          {trackB.map((step, i) => <StepCard key={step.id} step={step} color="#EC4899" bg="#FCE7F3" isLast={i === trackB.length - 1} />)}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reset password modal */}
      {resetId && (
        <div onClick={() => setResetId(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#FFF", borderRadius: 12, padding: 24, width: 320, boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 14 }}>Reset Password</div>
            <input type="password" value={resetPw} onChange={e => setResetPw(e.target.value)} placeholder="New password"
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13, boxSizing: "border-box", marginBottom: 14 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={resetPassword} disabled={!resetPw.trim()} style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none", background: "#2563EB", color: "#FFF", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: !resetPw.trim() ? 0.5 : 1 }}>Update</button>
              <button onClick={() => setResetId(null)} style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#FFF", fontSize: 13, cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
