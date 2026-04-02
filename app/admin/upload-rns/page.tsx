"use client";

import { useState, useRef } from "react";

type TableType = "stay" | "sold";

export default function UploadRnsPage() {
  const [tableType, setTableType]   = useState<TableType>("stay");
  const [file, setFile]             = useState<File | null>(null);
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState<{ ok: boolean; message?: string; error?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setResult(null);

    try {
      const fd = new FormData();
      fd.append("file",  file);
      fd.append("table", tableType);

      const res  = await fetch("/api/upload-rns", { method: "POST", body: fd });
      const data = await res.json();
      setResult(data);
    } catch (err) {
      setResult({ ok: false, error: String(err) });
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setFile(null);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const card: React.CSSProperties = {
    background: "#fff",
    borderRadius: 12,
    border: "1px solid #E8ECF0",
    padding: "28px 32px",
    maxWidth: 560,
    margin: "40px auto",
  };

  const label: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 600,
    color: "#64748B",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };

  const btn = (primary = true): React.CSSProperties => ({
    padding: "10px 22px",
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 13,
    background: primary ? "#1D4ED8" : "#F1F5F9",
    color: primary ? "#fff" : "#64748B",
  });

  return (
    <div style={{ padding: "32px 24px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1E293B", marginBottom: 6 }}>
        Upload RNS Data
      </h1>
      <p style={{ fontSize: 13, color: "#64748B", marginBottom: 24 }}>
        Upload historical Stay or Sold RNs CSV. Rows missing a date or channel are skipped.
      </p>

      <div style={card}>
        <form onSubmit={handleSubmit}>
          {/* Table type selector */}
          <div style={{ marginBottom: 20 }}>
            <span style={label}>Data Type</span>
            <div style={{ display: "flex", gap: 10 }}>
              {(["stay", "sold"] as TableType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTableType(t)}
                  style={{
                    ...btn(tableType === t),
                    flex: 1,
                    opacity: 1,
                  }}
                >
                  {t === "stay" ? "Stay RNS" : "Sold RNS"}
                </button>
              ))}
            </div>
          </div>

          {/* File picker */}
          <div style={{ marginBottom: 24 }}>
            <label style={label} htmlFor="rns-file">CSV File</label>
            <input
              id="rns-file"
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }}
              style={{
                display: "block",
                width: "100%",
                padding: "10px 12px",
                border: "1px solid #E2E8F0",
                borderRadius: 8,
                fontSize: 13,
                color: "#374151",
                background: "#F8FAFC",
              }}
            />
            <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 6 }}>
              Expected columns: Date, Channel, RNs, Rev, Initial Property ID, Final Property ID
            </p>
          </div>

          {/* Submit */}
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button type="submit" disabled={!file || loading} style={btn(true)}>
              {loading ? "Uploading…" : "Upload"}
            </button>
            {(file || result) && (
              <button type="button" onClick={reset} style={btn(false)}>
                Clear
              </button>
            )}
          </div>
        </form>

        {/* Result */}
        {result && (
          <div
            style={{
              marginTop: 20,
              padding: "14px 16px",
              borderRadius: 8,
              background: result.ok ? "#F0FDF4" : "#FEF2F2",
              border: `1px solid ${result.ok ? "#BBF7D0" : "#FECACA"}`,
              fontSize: 13,
              color: result.ok ? "#15803D" : "#DC2626",
              fontWeight: 500,
            }}
          >
            {result.ok ? "✓ " : "✗ "}
            {result.message ?? result.error}
          </div>
        )}
      </div>

      {/* Column guide */}
      <div style={{ ...card, marginTop: 0 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", marginBottom: 12 }}>
          CSV Column Guide
        </h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #E8ECF0", color: "#94A3B8" }}>Accepted Header Names</th>
              <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #E8ECF0", color: "#94A3B8" }}>DB Column</th>
              <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #E8ECF0", color: "#94A3B8" }}>Required</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Date / Stay Date / Sold Date / Booking Date", "checkin", "Yes"],
              ["Channel / OTA", "ota_booking_source_desc", "Yes"],
              ["RNs / Room Nights / Room Nights Sold", "rns", "No (defaults 0)"],
              ["Revenue / Rev", "rev", "No (defaults 0)"],
              ["Initial Property ID / Initial Prop ID / Initial ID", "initial_property_id", "No (defaults empty)"],
              ["Final Property ID / Final Prop ID / Property ID / Final ID", "property_id", "No (defaults empty)"],
            ].map(([headers, col, req]) => (
              <tr key={col}>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid #F1F5F9", color: "#475569" }}>{headers}</td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid #F1F5F9", color: "#1E293B", fontFamily: "monospace" }}>{col}</td>
                <td style={{ padding: "6px 8px", borderBottom: "1px solid #F1F5F9", color: req === "Yes" ? "#DC2626" : "#64748B" }}>{req}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize: 11, color: "#94A3B8", marginTop: 12 }}>
          Date formats accepted: DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
        </p>
      </div>
    </div>
  );
}
