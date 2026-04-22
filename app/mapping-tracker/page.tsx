"use client";

import { useState, useMemo, useRef } from "react";
import type { MappingRow } from "@/app/api/mapping-tracker/route";

const OTA_LIST = ["GoMMT","Expedia","Cleartrip","Booking.com","Agoda","Yatra","EaseMyTrip","Akbar Travels"];

const STATUS_COLOR = {
  correct:  { bg: "#DCFCE7", text: "#16A34A", label: "✓ Correct"     },
  inactive: { bg: "#FEF9C3", text: "#854D0E", label: "⚠ Inactive"    },
  missing:  { bg: "#FEE2E2", text: "#DC2626", label: "✗ Not Mapped"  },
};

export default function MappingTrackerPage() {
  const [crsPaste,    setCrsPaste]    = useState("");
  const [rows,        setRows]        = useState<MappingRow[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [activeOta,   setActiveOta]   = useState("All");
  const [statusFilter,setStatusFilter]= useState<"all"|"correct"|"inactive"|"missing">("all");
  const [search,      setSearch]      = useState("");
  const [analyzed,    setAnalyzed]    = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load CRS CSV from file
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setCrsPaste((ev.target?.result as string) ?? "");
    reader.readAsText(file);
    e.target.value = "";
  }

  async function runAnalysis() {
    if (!crsPaste.trim()) { setError("Please paste or upload CRS data first."); return; }
    setLoading(true); setError(""); setRows([]);
    try {
      const res  = await fetch("/api/mapping-tracker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ crsCsv: crsPaste }),
      });
      const data = await res.json() as { rows?: MappingRow[]; error?: string };
      if (data.error) { setError(data.error); return; }
      setRows(data.rows ?? []);
      setAnalyzed(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (activeOta !== "All" && r.otaName !== activeOta) return false;
      if (statusFilter !== "all" && r.crsMatch !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!r.fhId.includes(s) && !r.propertyName.toLowerCase().includes(s) &&
            !r.ratePlanCode.toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [rows, activeOta, statusFilter, search]);

  // Summary counts per selected OTA scope
  const scoped = activeOta === "All" ? rows : rows.filter(r => r.otaName === activeOta);
  const total    = scoped.length;
  const correct  = scoped.filter(r => r.crsMatch === "correct").length;
  const inactive = scoped.filter(r => r.crsMatch === "inactive").length;
  const missing  = scoped.filter(r => r.crsMatch === "missing").length;

  // OTA-level summary for the overview grid
  const otaSummary = useMemo(() => {
    const map: Record<string, { total: number; correct: number; inactive: number; missing: number }> = {};
    for (const r of rows) {
      const o = r.otaName;
      map[o] ??= { total: 0, correct: 0, inactive: 0, missing: 0 };
      map[o].total++;
      map[o][r.crsMatch]++;
    }
    return map;
  }, [rows]);

  const pct = (n: number, d: number) => d === 0 ? "—" : `${Math.round((n / d) * 100)}%`;

  return (
    <div style={{ minHeight: "100vh", background: "#F8FAFC", fontFamily: "'Segoe UI', Arial, sans-serif" }}>

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #E2E8F0", padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#0F172A" }}>Mapping Tracker</div>
          <div style={{ fontSize: 12, color: "#64748B", marginTop: 2 }}>Check OTA-wise if channel manager mappings match CRS data</div>
        </div>
        {analyzed && rows.length > 0 && (
          <div style={{ fontSize: 11, color: "#64748B" }}>
            Channel Manager: <strong>{rows.length.toLocaleString()}</strong> mappings across <strong>{Object.keys(otaSummary).length}</strong> OTAs
          </div>
        )}
      </div>

      <div style={{ padding: "20px 28px", display: "flex", flexDirection: "column", gap: 18 }}>

        {/* CRS Upload Panel */}
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Step 1 — Upload CRS Data</div>
              <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>Paste CSV or upload file. Columns: property_id, room_type_id, rate_plan_code, max_occupancy, is_active</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => fileRef.current?.click()}
                style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #7C3AED", background: "#EDE9FE", color: "#7C3AED", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                ⬆ Upload CSV
              </button>
              <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={handleFile} />
              {crsPaste && (
                <button onClick={() => { setCrsPaste(""); setRows([]); setAnalyzed(false); }}
                  style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid #E2E8F0", background: "#fff", color: "#64748B", fontSize: 11, cursor: "pointer" }}>
                  Clear
                </button>
              )}
            </div>
          </div>
          <textarea
            value={crsPaste}
            onChange={e => setCrsPaste(e.target.value)}
            placeholder={"property_id,room_type_id,rate_plan_code,max_occupancy,is_active\n157,1,CP,2,TRUE\n157,1,EP,2,TRUE\n..."}
            rows={5}
            style={{ width: "100%", fontFamily: "monospace", fontSize: 11, padding: "10px 12px", border: "1.5px solid #E2E8F0", borderRadius: 8, outline: "none", resize: "vertical", color: "#1E293B", boxSizing: "border-box", background: crsPaste ? "#FAFFF7" : "#FAFAFA" }}
          />
          {crsPaste && (
            <div style={{ marginTop: 6, fontSize: 10, color: "#059669" }}>
              {crsPaste.trim().split("\n").length - 1} data rows loaded
            </div>
          )}
        </div>

        {/* Analyse button */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={runAnalysis} disabled={loading || !crsPaste.trim()}
            style={{ padding: "10px 28px", borderRadius: 10, border: "none",
              background: loading || !crsPaste.trim() ? "#CBD5E1" : "linear-gradient(135deg,#2563EB,#7C3AED)",
              color: "#fff", fontSize: 13, fontWeight: 700, cursor: loading || !crsPaste.trim() ? "not-allowed" : "pointer",
              boxShadow: crsPaste.trim() && !loading ? "0 2px 10px #2563EB40" : "none" }}>
            {loading ? "Analysing…" : "▶ Run Analysis"}
          </button>
          {loading && <div style={{ fontSize: 12, color: "#64748B" }}>Fetching channel manager data & comparing…</div>}
          {error  && <div style={{ fontSize: 12, color: "#DC2626" }}>⚠ {error}</div>}
        </div>

        {/* Results */}
        {analyzed && rows.length > 0 && (
          <>
            {/* OTA summary cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
              {OTA_LIST.filter(o => otaSummary[o]).map(ota => {
                const s = otaSummary[ota];
                const active = activeOta === ota;
                const pctOk = Math.round((s.correct / s.total) * 100);
                return (
                  <div key={ota} onClick={() => setActiveOta(active ? "All" : ota)}
                    style={{ background: "#fff", borderRadius: 10, border: `2px solid ${active ? "#2563EB" : "#E2E8F0"}`,
                      padding: "12px 14px", cursor: "pointer", transition: "border-color 0.15s",
                      boxShadow: active ? "0 0 0 3px #2563EB20" : "none" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: active ? "#2563EB" : "#374151", marginBottom: 8 }}>{ota}</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: pctOk >= 90 ? "#16A34A" : pctOk >= 70 ? "#D97706" : "#DC2626" }}>{pctOk}%</div>
                    <div style={{ fontSize: 9, color: "#94A3B8", marginTop: 1 }}>correct ({s.correct}/{s.total})</div>
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      {s.missing  > 0 && <span style={{ fontSize: 9, fontWeight: 700, background: "#FEE2E2", color: "#DC2626", borderRadius: 4, padding: "1px 5px" }}>✗ {s.missing}</span>}
                      {s.inactive > 0 && <span style={{ fontSize: 9, fontWeight: 700, background: "#FEF9C3", color: "#854D0E", borderRadius: 4, padding: "1px 5px" }}>⚠ {s.inactive}</span>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary bar */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {([
                { key: "all",      label: "Total",       val: total,    bg: "#F1F5F9", text: "#374151" },
                { key: "correct",  label: "✓ Correct",   val: correct,  bg: "#DCFCE7", text: "#16A34A" },
                { key: "inactive", label: "⚠ Inactive",  val: inactive, bg: "#FEF9C3", text: "#854D0E" },
                { key: "missing",  label: "✗ Not Mapped",val: missing,  bg: "#FEE2E2", text: "#DC2626" },
              ] as const).map(c => (
                <button key={c.key} onClick={() => setStatusFilter(c.key)}
                  style={{ padding: "8px 16px", borderRadius: 8, border: `2px solid ${statusFilter === c.key ? c.text : "transparent"}`,
                    background: c.bg, color: c.text, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  {c.label}: {c.val.toLocaleString()} {c.key !== "all" && total > 0 ? `(${pct(c.val, total)})` : ""}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search FH ID / property / rate plan…"
                style={{ padding: "7px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 11, outline: "none", width: 240 }} />
            </div>

            {/* Table */}
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E2E8F0" }}>
                      {["FH ID","Property Name","OTA","Room Type","Rate Plan","Status"].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>No rows match filters</td></tr>
                    ) : filtered.map((r, i) => {
                      const sc = STATUS_COLOR[r.crsMatch];
                      return (
                        <tr key={i} style={{ borderBottom: "1px solid #F1F5F9", background: i % 2 === 0 ? "#fff" : "#FAFAFA" }}>
                          <td style={{ padding: "8px 14px", fontWeight: 700, color: "#374151", whiteSpace: "nowrap" }}>{r.fhId}</td>
                          <td style={{ padding: "8px 14px", color: "#475569", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.propertyName}</td>
                          <td style={{ padding: "8px 14px", whiteSpace: "nowrap" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, background: "#EEF2FF", color: "#4F46E5", borderRadius: 6, padding: "2px 8px" }}>{r.otaName}</span>
                          </td>
                          <td style={{ padding: "8px 14px", color: "#475569", textAlign: "center" }}>{r.roomTypeId}</td>
                          <td style={{ padding: "8px 14px" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, background: "#F0F9FF", color: "#0369A1", borderRadius: 6, padding: "2px 8px" }}>{r.ratePlanCode}</span>
                          </td>
                          <td style={{ padding: "8px 14px" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.text, borderRadius: 6, padding: "3px 10px", whiteSpace: "nowrap" }}>{sc.label}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {filtered.length > 0 && (
                <div style={{ padding: "8px 14px", background: "#F8FAFC", borderTop: "1px solid #E2E8F0", fontSize: 10, color: "#94A3B8" }}>
                  Showing {filtered.length.toLocaleString()} of {(activeOta === "All" ? rows : rows.filter(r => r.otaName === activeOta)).length.toLocaleString()} rows
                </div>
              )}
            </div>
          </>
        )}

        {analyzed && rows.length === 0 && !loading && (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: 40, textAlign: "center", color: "#9CA3AF" }}>
            No mappings found. Check that the channel manager sheet is accessible.
          </div>
        )}
      </div>
    </div>
  );
}
