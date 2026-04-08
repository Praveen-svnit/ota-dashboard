"use client";

import { useEffect, useState } from "react";

interface ApiKey {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  last_used: string | null;
  revoked: boolean;
}

export default function ApiKeysPage() {
  const [keys, setKeys]           = useState<ApiKey[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName]     = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied]       = useState(false);
  const [revoking, setRevoking]   = useState<string | null>(null);

  async function loadKeys() {
    setLoading(true);
    const res = await fetch("/api/admin/api-keys");
    if (res.ok) {
      const data = await res.json() as { keys: ApiKey[] };
      setKeys(data.keys);
    }
    setLoading(false);
  }

  useEffect(() => { loadKeys(); }, []);

  async function handleGenerate() {
    if (!newName.trim()) return;
    setGenerating(true);
    const res = await fetch("/api/admin/api-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.ok) {
      const data = await res.json() as { key: string };
      setGeneratedKey(data.key);
      loadKeys();
    }
    setGenerating(false);
  }

  async function handleRevoke(id: string) {
    setRevoking(id);
    await fetch(`/api/admin/api-keys?id=${id}`, { method: "DELETE" });
    await loadKeys();
    setRevoking(null);
  }

  function handleCopy() {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function closeModal() {
    setShowModal(false);
    setNewName("");
    setGeneratedKey(null);
    setCopied(false);
  }

  function fmt(ts: string | null) {
    if (!ts) return "—";
    return new Date(ts).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div style={{ padding: "28px 32px", maxWidth: 860, fontFamily: "system-ui, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#0F172A" }}>API Keys</div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 3 }}>
            Share a key with external apps to access your data without logging in.
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{ padding: "8px 18px", background: "#5D87FF", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
        >
          + Generate Key
        </button>
      </div>

      <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" }}>
              {["Name", "Created", "Last Used", "Status", ""].map(h => (
                <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#94A3B8" }}>Loading…</td></tr>
            ) : keys.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#94A3B8" }}>No keys yet. Generate one to get started.</td></tr>
            ) : keys.map(k => (
              <tr key={k.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                <td style={{ padding: "12px 16px", fontWeight: 600, color: "#1E293B" }}>{k.name}</td>
                <td style={{ padding: "12px 16px", color: "#64748B" }}>{fmt(k.created_at)}</td>
                <td style={{ padding: "12px 16px", color: "#64748B" }}>{fmt(k.last_used)}</td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{
                    display: "inline-block", padding: "2px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: k.revoked ? "#FEE2E2" : "#DCFCE7",
                    color: k.revoked ? "#DC2626" : "#16A34A",
                  }}>
                    {k.revoked ? "Revoked" : "Active"}
                  </span>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  {!k.revoked && (
                    <button
                      onClick={() => handleRevoke(k.id)}
                      disabled={revoking === k.id}
                      style={{ padding: "4px 12px", background: "none", border: "1px solid #FCA5A5", color: "#DC2626", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                    >
                      {revoking === k.id ? "Revoking…" : "Revoke"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16, padding: "12px 16px", background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 8, fontSize: 12, color: "#92400E" }}>
        <strong>How to use:</strong> Add <code style={{ background: "#FEF3C7", padding: "1px 5px", borderRadius: 4 }}>Authorization: Bearer YOUR_KEY</code> to any API request.
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, width: 420, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            {!generatedKey ? (
              <>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", marginBottom: 6 }}>Generate New API Key</div>
                <div style={{ fontSize: 12, color: "#64748B", marginBottom: 18 }}>Give this key a name so you remember what it&apos;s for.</div>
                <input
                  autoFocus
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleGenerate()}
                  placeholder="e.g. MMT PHP App"
                  style={{ width: "100%", padding: "9px 12px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box" }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
                  <button onClick={closeModal} style={{ padding: "8px 16px", background: "#F1F5F9", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#475569" }}>Cancel</button>
                  <button
                    onClick={handleGenerate}
                    disabled={generating || !newName.trim()}
                    style={{ padding: "8px 18px", background: "#5D87FF", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: generating || !newName.trim() ? 0.6 : 1 }}
                  >
                    {generating ? "Generating…" : "Generate"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#0F172A", marginBottom: 6 }}>Your API Key</div>
                <div style={{ fontSize: 12, color: "#DC2626", fontWeight: 600, marginBottom: 14 }}>⚠ Copy this now — it will never be shown again.</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <code style={{ flex: 1, background: "#F1F5F9", padding: "10px 12px", borderRadius: 8, fontSize: 11, wordBreak: "break-all", color: "#1E293B", border: "1px solid #E2E8F0" }}>
                    {generatedKey}
                  </code>
                  <button
                    onClick={handleCopy}
                    style={{ padding: "10px 14px", background: copied ? "#DCFCE7" : "#5D87FF", color: copied ? "#16A34A" : "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
                  >
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div style={{ marginTop: 14, padding: "10px 12px", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, fontSize: 11, color: "#166534" }}>
                  Use it like this:<br />
                  <code>Authorization: Bearer {generatedKey.slice(0, 20)}…</code>
                </div>
                <button onClick={closeModal} style={{ marginTop: 16, width: "100%", padding: "9px", background: "#F1F5F9", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer", color: "#475569" }}>Done</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
