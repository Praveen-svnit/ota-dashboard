"use client";

import { useEffect, useState } from "react";
import { OTA_COLORS } from "@/lib/constants";

interface CityData {
  cities: string[];
  dates: string[];
  cityOtaDayRns: Record<string, Record<string, Record<string, number>>>;
  otas: string[];
}

const ACCENT = "#2563EB";

export default function CityView() {
  const [data,       setData]       = useState<CityData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [search,     setSearch]     = useState("");
  const [selectedOta, setSelectedOta] = useState("all");

  useEffect(() => {
    fetch("/api/city-production")
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setData(d); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toISOString().split("T")[0];

  // Dates reversed: latest first
  const dates = data ? [...data.dates].reverse() : [];

  const filteredCities = data?.cities.filter((c) =>
    !search || c.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  function getCityDayRns(city: string, date: string): number {
    if (!data) return 0;
    if (selectedOta === "all") {
      return data.otas.reduce((sum, ota) => sum + (data.cityOtaDayRns[city]?.[ota]?.[date] ?? 0), 0);
    }
    return data.cityOtaDayRns[city]?.[selectedOta]?.[date] ?? 0;
  }

  const colTotals = dates.map((date) =>
    filteredCities.reduce((sum, city) => sum + getCityDayRns(city, date), 0)
  );

  const otaColor = selectedOta !== "all" ? (OTA_COLORS[selectedOta] ?? ACCENT) : ACCENT;

  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>Day-on-Day Production — Last 30 Days</span>
          <span style={{ fontSize: 10, color: "#94A3B8", marginLeft: 8 }}>city wise · estimated from live property share</span>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {/* OTA filter */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            <button
              onClick={() => setSelectedOta("all")}
              style={{
                fontSize: 9, fontWeight: 700, padding: "3px 10px", borderRadius: 20, cursor: "pointer",
                background: selectedOta === "all" ? "#0F172A" : "#F8FAFC",
                color:      selectedOta === "all" ? "#FFFFFF"  : "#64748B",
                border:     `1px solid ${selectedOta === "all" ? "#0F172A" : "#E2E8F0"}`,
              }}
            >
              All OTAs
            </button>
            {data?.otas.map((ota) => {
              const color  = OTA_COLORS[ota] ?? "#64748B";
              const active = selectedOta === ota;
              return (
                <button key={ota} onClick={() => setSelectedOta(ota)} style={{
                  fontSize: 9, fontWeight: 700, padding: "3px 9px", borderRadius: 20, cursor: "pointer",
                  background: active ? color + "20" : "#F8FAFC",
                  color:      active ? color : "#94A3B8",
                  border:     `1px solid ${active ? color + "50" : "#E2E8F0"}`,
                }}>
                  {ota === "Booking.com" ? "BDC" : ota === "Akbar Travels" ? "AKT" : ota === "EaseMyTrip" ? "EMT" : ota}
                </button>
              );
            })}
          </div>

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter city…"
            style={{ padding: "4px 10px", borderRadius: 7, border: "1px solid #E2E8F0", fontSize: 11, outline: "none", width: 140 }}
          />
        </div>
      </div>

      {loading && <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 12 }}>Loading…</div>}
      {error   && <div style={{ padding: 40, textAlign: "center", color: "#DC2626", fontSize: 12 }}>⚠ {error}</div>}

      {data && !loading && (
        <div style={{ overflowX: "auto", maxHeight: "72vh", overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
              <tr style={{ background: "#F8FAFC" }}>
                <th style={{
                  padding: "9px 14px", fontSize: 10, fontWeight: 700, color: "#94A3B8",
                  textAlign: "left", whiteSpace: "nowrap", borderBottom: "1px solid #E2E8F0",
                  minWidth: 150, position: "sticky", left: 0, background: "#F8FAFC", zIndex: 3,
                }}>
                  City
                </th>
                {dates.map((date) => {
                  const d       = new Date(date);
                  const label   = `${d.getDate()}/${d.getMonth() + 1}`;
                  const isToday = date === today;
                  return (
                    <th key={date} style={{
                      padding: "9px 8px", fontSize: 10, fontWeight: 700,
                      color:      isToday ? otaColor : "#94A3B8",
                      textAlign:  "center", whiteSpace: "nowrap",
                      borderBottom: "1px solid #E2E8F0",
                      background: isToday ? otaColor + "08" : "#F8FAFC",
                      minWidth: 46,
                    }}>
                      {label}{isToday ? " ★" : ""}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filteredCities.length === 0 ? (
                <tr><td colSpan={31} style={{ padding: 40, textAlign: "center", color: "#94A3B8" }}>No cities found</td></tr>
              ) : filteredCities.map((city, ri) => (
                <tr key={city} style={{ borderTop: "1px solid #F1F5F9", background: ri % 2 === 0 ? "#FFFFFF" : "#FAFAFA" }}>
                  <td style={{
                    padding: "8px 14px", fontWeight: 500, color: "#334155", whiteSpace: "nowrap",
                    position: "sticky", left: 0, background: ri % 2 === 0 ? "#FFFFFF" : "#FAFAFA", zIndex: 1,
                    borderRight: "1px solid #F1F5F9",
                  }}>
                    {city}
                  </td>
                  {dates.map((date) => {
                    const val     = getCityDayRns(city, date);
                    const isToday = date === today;
                    return (
                      <td key={date} style={{
                        padding: "8px 8px", textAlign: "center",
                        background: isToday ? otaColor + "05" : "transparent",
                      }}>
                        <span style={{
                          fontWeight: isToday ? 700 : 400,
                          color: val === 0 ? "#CBD5E1" : isToday ? otaColor : "#374151",
                        }}>
                          {val === 0 ? "—" : val.toLocaleString()}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid #E2E8F0", background: "#F8FAFC" }}>
                <td style={{
                  padding: "9px 14px", fontWeight: 700, color: "#0F172A", fontSize: 12,
                  position: "sticky", left: 0, background: "#F8FAFC", zIndex: 1,
                }}>
                  TOTAL
                </td>
                {colTotals.map((t, i) => {
                  const isToday = dates[i] === today;
                  return (
                    <td key={i} style={{
                      padding: "9px 8px", textAlign: "center",
                      background: isToday ? otaColor + "10" : "transparent",
                    }}>
                      <span style={{ fontWeight: 800, color: isToday ? otaColor : "#0F172A", fontSize: 12 }}>
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
