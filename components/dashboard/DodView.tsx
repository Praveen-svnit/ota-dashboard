"use client";

import { useEffect, useState } from "react";
import { OTA_COLORS } from "@/lib/constants";

interface DayRow { date: string; [ota: string]: number | string }
interface DodData { days: DayRow[]; otas: string[] }

const OTAS = ["GoMMT", "Booking.com", "Agoda", "Expedia", "Cleartrip", "EaseMyTrip", "Yatra", "Ixigo", "Akbar Travels"];
const ACCENT = "#2563EB";

export default function DodView() {
  const [data,    setData]    = useState<DodData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dod-data")
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setData(d); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toISOString().split("T")[0];

  // Reverse days so latest date is on the left
  const days = data ? [...data.days].reverse() : [];

  // Column totals per day
  const colTotals = days.map((day) =>
    OTAS.reduce((sum, ota) => sum + Number(day[ota] ?? 0), 0)
  );

  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Day-on-Day Production — Last 30 Days</span>
        <span style={{ fontSize: 10, color: "#94A3B8" }}>room nights sold per day · OTA wise</span>
      </div>

      {loading && <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 12 }}>Loading…</div>}
      {error   && <div style={{ padding: 40, textAlign: "center", color: "#DC2626", fontSize: 12 }}>⚠ {error}</div>}

      {data && !loading && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr style={{ background: "#F8FAFC" }}>
                <th style={{
                  padding: "9px 14px", fontSize: 10, fontWeight: 700, color: "#94A3B8",
                  textAlign: "left", whiteSpace: "nowrap", borderBottom: "1px solid #E2E8F0", minWidth: 130,
                }}>
                  OTA
                </th>
                {days.map((day) => {
                  const d      = new Date(day.date);
                  const label  = `${d.getDate()}/${d.getMonth() + 1}`;
                  const isToday = day.date === today;
                  return (
                    <th key={day.date} style={{
                      padding: "9px 8px", fontSize: 10, fontWeight: 700,
                      color:      isToday ? ACCENT : "#94A3B8",
                      textAlign:  "center", whiteSpace: "nowrap",
                      borderBottom: "1px solid #E2E8F0",
                      background: isToday ? ACCENT + "08" : "#F8FAFC",
                      minWidth: 46,
                    }}>
                      {label}{isToday ? " ★" : ""}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {OTAS.map((ota, ri) => {
                const color = OTA_COLORS[ota] ?? "#64748B";
                return (
                  <tr key={ota} style={{ borderTop: "1px solid #F1F5F9", background: ri % 2 === 0 ? "#FFFFFF" : "#FAFAFA" }}>
                    <td style={{ padding: "8px 14px", fontWeight: 500, color: "#334155", whiteSpace: "nowrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                        {ota}
                      </span>
                    </td>
                    {days.map((day) => {
                      const val     = Number(day[ota] ?? 0);
                      const isToday = day.date === today;
                      return (
                        <td key={day.date} style={{
                          padding: "8px 8px", textAlign: "center",
                          background: isToday ? ACCENT + "05" : "transparent",
                        }}>
                          <span style={{
                            fontWeight: isToday ? 700 : 400,
                            color: val === 0 ? "#CBD5E1" : isToday ? ACCENT : "#374151",
                          }}>
                            {val === 0 ? "—" : val.toLocaleString()}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid #E2E8F0", background: "#F8FAFC" }}>
                <td style={{ padding: "9px 14px", fontWeight: 700, color: "#0F172A", fontSize: 12 }}>TOTAL</td>
                {colTotals.map((t, i) => {
                  const isToday = days[i]?.date === today;
                  return (
                    <td key={i} style={{
                      padding: "9px 8px", textAlign: "center",
                      background: isToday ? ACCENT + "10" : "transparent",
                    }}>
                      <span style={{ fontWeight: 800, color: isToday ? ACCENT : "#0F172A", fontSize: 12 }}>
                        {t === 0 ? "—" : t.toLocaleString()}
                      </span>
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
