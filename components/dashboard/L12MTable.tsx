import { L12M_MONTHS, L12M_ONBOARDED, L12M_OTA_LIVE } from "@/lib/data";
import { OTAS, OTA_COLORS } from "@/lib/constants";
import { autoMonthKey, fmt } from "@/lib/utils";

interface Props {
  l12mMonths?:    string[];
  l12mOnboarded?: number[];
  l12mOtaLive?:   Record<string, number[]>;
  internMap?:     Record<string, { name: string; color: string }>;
}

export default function L12MTable({
  l12mMonths    = L12M_MONTHS,
  l12mOnboarded = L12M_ONBOARDED,
  l12mOtaLive   = L12M_OTA_LIVE,
  internMap,
}: Props) {
  const CURRENT_MONTH = autoMonthKey();
  const displayMonths = [...l12mMonths].reverse();
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: "1px solid #E2E8F0",
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 24,
      }}
    >
      <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #F1F5F9" }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#0F172A" }}>
          MoM Listing Tracker
        </span>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", minWidth: "100%" }}>
          <thead>
            <tr>
              <th
                style={{
                  padding: "8px 14px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#64748B",
                  background: "#F8FAFC",
                  borderBottom: "1px solid #E2E8F0",
                  textAlign: "left",
                  position: "sticky",
                  left: 0,
                  zIndex: 3,
                  whiteSpace: "nowrap",
                  minWidth: 130,
                }}
              >
                OTA
              </th>
              {internMap && (
                <th style={{
                  padding: "8px 12px", fontSize: 11, fontWeight: 600, color: "#64748B",
                  background: "#F8FAFC", borderBottom: "1px solid #E2E8F0",
                  textAlign: "left", position: "sticky", left: 130, zIndex: 3,
                  whiteSpace: "nowrap", minWidth: 100, borderRight: "1px solid #E2E8F0",
                }}>
                  Intern
                </th>
              )}
              {displayMonths.map((m) => {
                const isCurrent = m === CURRENT_MONTH;
                return (
                  <th
                    key={m}
                    style={{
                      padding: "8px 10px",
                      fontSize: 11,
                      fontWeight: 600,
                      color: isCurrent ? "#4338CA" : "#64748B",
                      background: isCurrent ? "#EEF2FF" : "#F8FAFC",
                      borderBottom: isCurrent ? "2px solid #6366F1" : "1px solid #E2E8F0",
                      borderLeft: isCurrent ? "2px solid #6366F1" : undefined,
                      textAlign: "center",
                      whiteSpace: "nowrap",
                      minWidth: 72,
                    }}
                  >
                    {m}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* FH Live row */}
            <tr>
              <td
                style={{
                  padding: "8px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#3730A3",
                  background: "#EEF2FF",
                  borderBottom: "1px solid #C7D2FE",
                  position: "sticky",
                  left: 0,
                  zIndex: 1,
                  whiteSpace: "nowrap",
                }}
              >
                FH Live
              </td>
              {internMap && (
                <td style={{
                  padding: "8px 12px", fontSize: 11, background: "#EEF2FF",
                  borderBottom: "1px solid #C7D2FE", position: "sticky", left: 130,
                  zIndex: 1, borderRight: "1px solid #E2E8F0",
                }} />
              )}
              {displayMonths.map((m) => {
                const i = l12mMonths.indexOf(m);
                const val = l12mOnboarded[i] ?? 0;
                const isCurrent = m === CURRENT_MONTH;
                return (
                  <td
                    key={m}
                    className="cm-cell"
                    style={{
                      padding: "8px 10px",
                      fontSize: 12,
                      fontWeight: 700,
                      textAlign: "center",
                      background: isCurrent ? "#E0E7FF" : "#EEF2FF",
                      color: "#3730A3",
                      borderBottom: "1px solid #C7D2FE",
                      borderLeft: isCurrent ? "2px solid #6366F1" : undefined,
                    }}
                  >
                    {fmt(val)}
                  </td>
                );
              })}
            </tr>

            {/* OTA rows */}
            {OTAS.map((ota) => {
              const vals    = l12mOtaLive[ota] ?? [];
              const intern  = internMap?.[ota];
              return (
                <tr key={ota}>
                  <td
                    style={{
                      padding: "8px 14px",
                      fontSize: 12,
                      color: "#0F172A",
                      borderBottom: "1px solid #F1F5F9",
                      position: "sticky",
                      left: 0,
                      background: "#FFFFFF",
                      zIndex: 1,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: OTA_COLORS[ota] ?? "#64748B", flexShrink: 0 }} />
                      {ota}
                    </span>
                  </td>
                  {internMap && (
                    <td style={{
                      padding: "8px 12px", fontSize: 11, borderBottom: "1px solid #F1F5F9",
                      position: "sticky", left: 130, background: "#FFFFFF", zIndex: 1,
                      whiteSpace: "nowrap", borderRight: "1px solid #E2E8F0",
                    }}>
                      {intern ? (
                        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ width: 16, height: 16, borderRadius: "50%", flexShrink: 0, background: intern.color + "20", color: intern.color, fontSize: 8, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{intern.name[0]}</span>
                          <span style={{ fontWeight: 600, color: "#1E293B" }}>{intern.name}</span>
                        </span>
                      ) : <span style={{ color: "#CBD5E1" }}>—</span>}
                    </td>
                  )}
                  {displayMonths.map((m) => {
                    const i = l12mMonths.indexOf(m);
                    const isCurrent = m === CURRENT_MONTH;
                    const val = vals[i] ?? 0;
                    return (
                      <td
                        key={m}
                        className={isCurrent ? "cm-cell" : undefined}
                        style={{
                          padding: "8px 10px",
                          fontSize: 12,
                          fontWeight: val > 0 ? 600 : 400,
                          color: val > 0 ? OTA_COLORS[ota] ?? "#0F172A" : "#94A3B8",
                          textAlign: "center",
                          background: isCurrent ? "#EEF2FF" : undefined,
                          borderBottom: "1px solid #F1F5F9",
                          borderLeft: isCurrent ? "2px solid #6366F1" : undefined,
                        }}
                      >
                        {val > 0 ? fmt(val) : "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>

          {/* TOTAL footer */}
          <tfoot>
            <tr>
              <td
                style={{
                  padding: "8px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#4338CA",
                  background: "#EEF2FF",
                  position: "sticky",
                  left: 0,
                  zIndex: 1,
                  borderTop: "2px solid #C7D2FE",
                  whiteSpace: "nowrap",
                }}
              >
                TOTAL
              </td>
              {internMap && (
                <td style={{
                  padding: "8px 12px", background: "#EEF2FF", position: "sticky",
                  left: 130, zIndex: 1, borderTop: "2px solid #C7D2FE",
                  borderRight: "1px solid #E2E8F0",
                }} />
              )}
              {displayMonths.map((m) => {
                const i = l12mMonths.indexOf(m);
                const isCurrent = m === CURRENT_MONTH;
                const total = OTAS.reduce((s, ota) => s + (l12mOtaLive[ota]?.[i] ?? 0), 0);
                return (
                  <td
                    key={m}
                    className="cm-cell"
                    style={{
                      padding: "8px 10px",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#4338CA",
                      background: "#EEF2FF",
                      textAlign: "center",
                      borderTop: "2px solid #C7D2FE",
                      borderLeft: isCurrent ? "2px solid #6366F1" : undefined,
                    }}
                  >
                    {fmt(total)}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      <div style={{ padding: "8px 16px", fontSize: 10, color: "#94A3B8", borderTop: "1px solid #F1F5F9" }}>
        * {CURRENT_MONTH} is current month (partial data)
      </div>
    </div>
  );
}
