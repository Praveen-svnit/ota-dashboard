"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const OTA_LIST = ["GoMMT","Booking.com","Agoda","Expedia","Cleartrip","Yatra","Ixigo","Akbar Travels","EaseMyTrip","Indigo"];
const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  admin:  { bg: "#FEE2E2", color: "#DC2626" },
  tl:     { bg: "#FEF3C7", color: "#D97706" },
  intern: { bg: "#D1FAE5", color: "#059669" },
};

interface User {
  id: string; username: string; name: string; role: string;
  ota: string | null; teamLead: string | null; active: number; createdAt: string;
}

const EMPTY_FORM = { username: "", password: "", name: "", role: "intern", ota: "", teamLead: "" };

export default function UsersPage() {
  const [users,   setUsers]   = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState(EMPTY_FORM);
  const [saving,   setSaving]   = useState(false);
  const [formErr,  setFormErr]  = useState("");

  const [resetId,  setResetId]  = useState<string | null>(null);
  const [resetPw,  setResetPw]  = useState("");

  function load() {
    setLoading(true);
    fetch("/api/crm/users")
      .then((r) => { if (r.status === 403) throw new Error("Admin access required"); return r.json(); })
      .then((d) => setUsers(d.users ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function createUser() {
    setFormErr("");
    if (!form.username || !form.password || !form.name) {
      setFormErr("Username, password, and name are required");
      return;
    }
    setSaving(true);
    const res  = await fetch("/api/crm/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setFormErr(json.error ?? "Error"); return; }
    setShowForm(false);
    setForm(EMPTY_FORM);
    load();
  }

  async function toggleActive(user: User) {
    await fetch("/api/crm/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: user.id, active: user.active ? 0 : 1 }),
    });
    load();
  }

  async function resetPassword() {
    if (!resetPw.trim() || !resetId) return;
    await fetch("/api/crm/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: resetId, password: resetPw }),
    });
    setResetId(null);
    setResetPw("");
  }

  const TH = { padding: "9px 12px", fontSize: 10, fontWeight: 700, color: "#64748B",
    background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", textAlign: "left" as const, whiteSpace: "nowrap" as const };
  const TD = { padding: "9px 12px", fontSize: 12, borderBottom: "1px solid #F1F5F9", verticalAlign: "middle" as const };

  return (
    <div style={{ padding: "20px 24px", background: "#F8FAFC", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <Link href="/crm" style={{ fontSize: 12, color: "#64748B", textDecoration: "none" }}>← CRM</Link>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A", marginTop: 6 }}>User Management</div>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ padding: "9px 18px", borderRadius: 8, border: "none",
            background: "linear-gradient(135deg,#2563EB,#1D4ED8)", color: "#FFF",
            fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
          + Add User
        </button>
      </div>

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626",
          borderRadius: 8, padding: "10px 14px", fontSize: 12, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Add User form */}
      {showForm && (
        <div style={{ background: "#FFF", border: "1px solid #E2E8F0", borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 16 }}>New User</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {[
              { label: "Username", key: "username", type: "text" },
              { label: "Password", key: "password", type: "password" },
              { label: "Full Name", key: "name", type: "text" },
            ].map(({ label, key, type }) => (
              <div key={key} style={{ flex: "1 1 160px" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 4 }}>{label}</div>
                <input type={type} value={(form as Record<string, string>)[key]}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 7,
                    border: "1px solid #CBD5E1", fontSize: 12, boxSizing: "border-box" }} />
              </div>
            ))}
            <div style={{ flex: "1 1 120px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Role</div>
              <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 7,
                  border: "1px solid #CBD5E1", fontSize: 12, background: "#FFF", boxSizing: "border-box" as const }}>
                <option value="intern">Intern</option>
                <option value="tl">Team Lead</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {form.role === "intern" && (
              <div style={{ flex: "1 1 150px" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Assigned OTA</div>
                <select value={form.ota} onChange={(e) => setForm((p) => ({ ...p, ota: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 7,
                    border: "1px solid #CBD5E1", fontSize: 12, background: "#FFF", boxSizing: "border-box" as const }}>
                  <option value="">— Select OTA —</option>
                  {OTA_LIST.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            )}
          </div>
          {formErr && <div style={{ color: "#DC2626", fontSize: 12, marginTop: 10 }}>{formErr}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button onClick={createUser} disabled={saving}
              style={{ padding: "8px 20px", borderRadius: 8, border: "none",
                background: "#2563EB", color: "#FFF", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {saving ? "Saving…" : "Create User"}
            </button>
            <button onClick={() => { setShowForm(false); setFormErr(""); setForm(EMPTY_FORM); }}
              style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #E2E8F0",
                background: "#FFF", fontSize: 12, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Users table */}
      <div style={{ background: "#FFF", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>Loading…</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Name", "Username", "Role", "OTA", "Team Lead", "Status", "Joined", "Actions"].map((h) => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const rc = ROLE_COLORS[u.role] ?? { bg: "#F1F5F9", color: "#64748B" };
                return (
                  <tr key={u.id} style={{ opacity: u.active ? 1 : 0.5 }}>
                    <td style={TD}><span style={{ fontWeight: 600, color: "#1E293B" }}>{u.name}</span></td>
                    <td style={{ ...TD, color: "#64748B" }}>{u.username}</td>
                    <td style={TD}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 9px", borderRadius: 20,
                        background: rc.bg, color: rc.color }}>
                        {u.role.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ ...TD, color: "#64748B" }}>{u.ota || "—"}</td>
                    <td style={{ ...TD, color: "#64748B" }}>{u.teamLead || "—"}</td>
                    <td style={TD}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                        background: u.active ? "#D1FAE5" : "#F1F5F9",
                        color: u.active ? "#059669" : "#94A3B8" }}>
                        {u.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ ...TD, color: "#94A3B8", fontSize: 11 }}>
                      {new Date(u.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })}
                    </td>
                    <td style={TD}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => { setResetId(u.id); setResetPw(""); }}
                          style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6,
                            border: "1px solid #E2E8F0", background: "#F8FAFC",
                            color: "#6366F1", cursor: "pointer", fontWeight: 600 }}>
                          Reset PW
                        </button>
                        <button onClick={() => toggleActive(u)}
                          style={{ fontSize: 10, padding: "4px 10px", borderRadius: 6,
                            border: "1px solid #E2E8F0", background: "#F8FAFC",
                            color: u.active ? "#DC2626" : "#059669", cursor: "pointer", fontWeight: 600 }}>
                          {u.active ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Reset password modal */}
      {resetId && (
        <div onClick={() => setResetId(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "#FFF", borderRadius: 12, padding: 24, width: 320,
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", marginBottom: 14 }}>Reset Password</div>
            <input type="password" value={resetPw} onChange={(e) => setResetPw(e.target.value)}
              placeholder="New password"
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8,
                border: "1px solid #CBD5E1", fontSize: 13, boxSizing: "border-box", marginBottom: 14 }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={resetPassword} disabled={!resetPw.trim()}
                style={{ flex: 1, padding: "9px", borderRadius: 8, border: "none",
                  background: "#2563EB", color: "#FFF", fontSize: 13, fontWeight: 700,
                  cursor: "pointer", opacity: !resetPw.trim() ? 0.5 : 1 }}>
                Update
              </button>
              <button onClick={() => setResetId(null)}
                style={{ padding: "9px 16px", borderRadius: 8, border: "1px solid #E2E8F0",
                  background: "#FFF", fontSize: 13, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
