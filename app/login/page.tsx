"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const fromParam    = searchParams.get("from");

  // Resolve redirect destination: ?from= > localStorage last path > "/"
  function getRedirectDest(): string {
    if (fromParam && fromParam.startsWith("/") && !fromParam.startsWith("//") && !fromParam.startsWith("/login")) {
      return fromParam;
    }
    try {
      const local = localStorage.getItem("ota_last_path");
      if (local && local.startsWith("/") && !local.startsWith("/login")) return local;
    } catch { /* private browsing */ }
    return "/";
  }
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res  = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Login failed"); return; }
      router.push(getRedirectDest());
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #EFF6FF 0%, #F8FAFC 60%, #F0FDF4 100%)",
    }}>
      <div style={{
        width: 360, background: "#FFF",
        borderRadius: 16, boxShadow: "0 4px 32px rgba(0,0,0,0.08)",
        padding: "36px 32px",
        border: "1px solid #E2E8F0",
      }}>
        {/* Logo / Brand */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: "linear-gradient(135deg, #2563EB, #7C3AED)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, marginBottom: 12,
          }}>▣</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>OTA Command</div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 4 }}>Sign in to your account</div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 5 }}>
              Username
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              style={{
                width: "100%", padding: "9px 12px", borderRadius: 8,
                border: "1px solid #CBD5E1", fontSize: 13, outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#2563EB")}
              onBlur={(e)  => (e.target.style.borderColor = "#CBD5E1")}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#475569", marginBottom: 5 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              style={{
                width: "100%", padding: "9px 12px", borderRadius: 8,
                border: "1px solid #CBD5E1", fontSize: 13, outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#2563EB")}
              onBlur={(e)  => (e.target.style.borderColor = "#CBD5E1")}
            />
          </div>

          {error && (
            <div style={{
              background: "#FEF2F2", border: "1px solid #FECACA",
              color: "#DC2626", borderRadius: 8, padding: "8px 12px",
              fontSize: 12, marginBottom: 14,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            style={{
              width: "100%", padding: "10px", borderRadius: 8,
              background: loading ? "#93C5FD" : "linear-gradient(135deg, #2563EB, #1D4ED8)",
              color: "#FFF", border: "none", fontSize: 13, fontWeight: 700,
              cursor: loading ? "default" : "pointer",
              opacity: (!username || !password) ? 0.6 : 1,
              transition: "opacity 0.15s",
            }}
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <div style={{ marginTop: 20, textAlign: "center", fontSize: 10, color: "#94A3B8" }}>
          Default: admin / admin123
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
