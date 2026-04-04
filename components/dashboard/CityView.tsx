"use client";

import { useEffect, useRef, useState } from "react";
import { OTA_COLORS } from "@/lib/constants";

interface CityData {
  cities: string[];
  dates: string[];
  cityOtaDayRns: Record<string, Record<string, Record<string, number>>>;
  otas: string[];
}

const ACCENT = "#2563EB";

type ViewType = "occupied" | "stay" | "sold";
const VIEW_LABELS: Record<ViewType, string> = {
  sold:     "Sold",
  stay:     "Stay (Checkin)",
  occupied: "Stay (Occupied)",
};

// Generate last 12 months as options
function getMonthOptions() {
  const options: { value: string; label: string }[] = [
    { value: "", label: "Last 30 Days" },
  ];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-IN", { month: "short", year: "numeric" });
    options.push({ value, label });
  }
  return options;
}

const MONTH_OPTIONS = getMonthOptions();

/* ── Multi-select dropdown ── */
interface MultiSelectProps {
  label: string;
  all: string[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
  renderLabel?: (v: string) => string;
  width?: number;
}

function MultiSelect({ label, all, selected, onChange, renderLabel, width = 180 }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const allSelected  = selected.size === 0 || selected.size === all.length;
  const displayLabel = allSelected
    ? `All ${label}`
    : selected.size === 1
      ? (renderLabel ? renderLabel([...selected][0]) : [...selected][0])
      : `${selected.size} ${label}`;

  function toggleAll() {
    onChange(new Set()); // empty = all
  }

  function toggle(v: string) {
    const next = new Set(selected);
    if (next.has(v)) {
      next.delete(v);
      if (next.size === 0) onChange(new Set()); // all selected
      else onChange(next);
    } else {
      next.add(v);
      if (next.size === all.length) onChange(new Set()); // all selected
      else onChange(next);
    }
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer",
          border: "1px solid #E2E8F0", borderRadius: 7, fontFamily: "inherit",
          background: allSelected ? "#F8FAFC" : ACCENT + "10",
          color:      allSelected ? "#64748B" : ACCENT,
          display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
        }}
      >
        {displayLabel}
        <span style={{ fontSize: 9, opacity: 0.6 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 50,
          background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 8,
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)", minWidth: width, maxHeight: 260,
          overflowY: "auto",
        }}>
          {/* All option */}
          <label style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "7px 12px", cursor: "pointer", fontSize: 11, fontWeight: 700,
            borderBottom: "1px solid #F1F5F9", color: "#0F172A",
          }}>
            <input
              type="checkbox" checked={allSelected}
              onChange={toggleAll}
              style={{ accentColor: ACCENT, width: 13, height: 13 }}
            />
            All {label}
          </label>
          {all.map(v => {
            const checked = selected.size === 0 || selected.has(v);
            return (
              <label key={v} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 12px", cursor: "pointer", fontSize: 11,
                color: "#374151",
              }}>
                <input
                  type="checkbox" checked={checked}
                  onChange={() => toggle(v)}
                  style={{ accentColor: ACCENT, width: 13, height: 13 }}
                />
                {renderLabel ? renderLabel(v) : v}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function CityView() {
  const [data,         setData]         = useState<CityData | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);
  const [view,         setView]         = useState<ViewType>("occupied");
  const [selectedOtas, setSelectedOtas] = useState<Set<string>>(new Set());
  const [selectedCities, setSelectedCities] = useState<Set<string>>(new Set());
  const [selectedMonth, setSelectedMonth] = useState("");

  useEffect(() => {
    setLoading(true);
    setData(null);
    const params = new URLSearchParams({ type: view });
    if (selectedMonth) params.set("month", selectedMonth);
    fetch(`/api/city-production?${params}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setData(d); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [view, selectedMonth]);

  const today = new Date().toISOString().split("T")[0];

  // Dates reversed: latest first
  const dates = data ? [...data.dates].reverse() : [];

  const filteredCities = data?.cities.filter((c) =>
    selectedCities.size === 0 || selectedCities.has(c)
  ) ?? [];

  // Active OTAs for computation
  const activeOtas = data
    ? (selectedOtas.size === 0 ? data.otas : data.otas.filter(o => selectedOtas.has(o)))
    : [];

  function getCityDayRns(city: string, date: string): number {
    if (!data) return 0;
    return activeOtas.reduce((sum, ota) => sum + (data.cityOtaDayRns[city]?.[ota]?.[date] ?? 0), 0);
  }

  const colTotals = dates.map((date) =>
    filteredCities.reduce((sum, city) => sum + getCityDayRns(city, date), 0)
  );

  // Accent color — blue if multi/all OTAs, else OTA color
  const singleOta  = selectedOtas.size === 1 ? [...selectedOtas][0] : null;
  const accentColor = singleOta ? (OTA_COLORS[singleOta] ?? ACCENT) : ACCENT;

  const otaShortName = (ota: string) =>
    ota === "Booking.com" ? "BDC" : ota === "Akbar Travels" ? "AKT" : ota === "EaseMyTrip" ? "EMT" : ota;

  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 12, overflow: "hidden", marginBottom: 24 }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
            Day-on-Day Production — {selectedMonth ? MONTH_OPTIONS.find((o) => o.value === selectedMonth)?.label : "Last 30 Days"}
          </span>
          <span style={{ fontSize: 10, color: "#94A3B8", marginLeft: 8 }}>city wise · estimated from live property share</span>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* View tab strip */}
          <div style={{ display: "flex", background: "#F1F5F9", borderRadius: 8, padding: 3, gap: 2 }}>
            {(["sold", "stay", "occupied"] as ViewType[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                style={{
                  padding: "4px 12px", fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer",
                  borderRadius: 6, transition: "all 0.15s", whiteSpace: "nowrap", fontFamily: "inherit",
                  background: view === v ? "#FFFFFF" : "transparent",
                  color:      view === v ? ACCENT : "#64748B",
                  boxShadow:  view === v ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                }}
              >
                {VIEW_LABELS[v]}
              </button>
            ))}
          </div>

          {/* OTA multi-select */}
          {data && (
            <MultiSelect
              label="OTAs"
              all={data.otas}
              selected={selectedOtas}
              onChange={setSelectedOtas}
              renderLabel={otaShortName}
              width={180}
            />
          )}

          {/* City multi-select */}
          {data && (
            <MultiSelect
              label="Cities"
              all={data.cities}
              selected={selectedCities}
              onChange={setSelectedCities}
              width={200}
            />
          )}

          {/* Month select */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ padding: "4px 10px", borderRadius: 7, border: "1px solid #E2E8F0", fontSize: 11, background: "#FFF", color: "#374151", cursor: "pointer" }}
          >
            {MONTH_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
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
                      color:      isToday ? accentColor : "#94A3B8",
                      textAlign:  "center", whiteSpace: "nowrap",
                      borderBottom: "1px solid #E2E8F0",
                      background: isToday ? accentColor + "08" : "#F8FAFC",
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
                        background: isToday ? accentColor + "05" : "transparent",
                      }}>
                        <span style={{
                          fontWeight: isToday ? 700 : 400,
                          color: val === 0 ? "#CBD5E1" : isToday ? accentColor : "#374151",
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
                      background: isToday ? accentColor + "10" : "transparent",
                    }}>
                      <span style={{ fontWeight: 800, color: isToday ? accentColor : "#0F172A", fontSize: 12 }}>
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
