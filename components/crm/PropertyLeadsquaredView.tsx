"use client";

import { useState } from "react";
import Link from "next/link";

// Fallback OTA colors if constants are not available
const OTA_COLORS = {
  "GoMMT": "#FF6B35",
  "Booking.com": "#003580",
  "Agoda": "#FF5A5F",
  "EaseMyTrip": "#00A699",
  "Cleartrip": "#0077CC",
  "Expedia": "#00AAE4",
  "Yatra": "#FF6900",
  "Akbar Travels": "#8E44AD",
  "Ixigo": "#E74C3C",
};

const OTAS = ["GoMMT", "Booking.com", "Agoda", "EaseMyTrip", "Cleartrip", "Expedia", "Yatra", "Akbar Travels", "Ixigo"];

interface Property {
  id: string;
  name: string;
  city: string;
  fhStatus: string;
  fhLiveDate: string;
}

interface Listing {
  id: number;
  ota: string;
  status: string;
  subStatus: string;
  liveDate: string;
  tat: number;
  tatError: number;
  otaId: string;
  assignedTo: string;
  crmNote: string;
  crmUpdatedAt: string;
  assignedName: string;
  prePost: string;
  listingLink: string;
}

interface Log {
  id: number;
  otaListingId: number;
  action: string;
  field: string;
  oldValue: string;
  newValue: string;
  note: string;
  createdAt: string;
  userName: string;
  userRole: string;
}

interface Task {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  assignedName: string | null;
  createdByName: string | null;
  dueDate: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  live: { bg: "#D1FAE5", color: "#059669" },
  "not live": { bg: "#FEE2E2", color: "#DC2626" },
  "ready to go live": { bg: "#FEF9C3", color: "#854D0E" },
  "content in progress": { bg: "#EEF2FF", color: "#4F46E5" },
  "listing in progress": { bg: "#EEF2FF", color: "#4F46E5" },
  pending: { bg: "#FEF3C7", color: "#D97706" },
  soldout: { bg: "#F3F4F6", color: "#6B7280" },
};

function statusPill(status: string) {
  const s = STATUS_COLORS[status?.toLowerCase()] ?? { bg: "#F1F5F9", color: "#64748B" };
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 700,
      padding: "4px 12px",
      borderRadius: 20,
      background: s.bg,
      color: s.color
    }}>
      {status || "—"}
    </span>
  );
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

interface PropertyLeadsquaredViewProps {
  property: Property;
  listings: Listing[];
  logs: Log[];
  tasks: Task[];
  onOtaChange: (ota: string) => void;
  onAddOta: (ota: string) => void;
  onStatusEdit: (listingId: number, field: string, value: string, note: string) => void;
  activeOta: string | null;
  loading?: boolean;
}

export default function PropertyLeadsquaredView({
  property,
  listings,
  logs,
  tasks,
  onOtaChange,
  onAddOta,
  onStatusEdit,
  activeOta,
  loading = false,
}: PropertyLeadsquaredViewProps) {
  const [editing, setEditing] = useState<{ id: number; field: string } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editNote, setEditNote] = useState("");
  const [noteErr, setNoteErr] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addOtaOpen, setAddOtaOpen] = useState(false);

  const isPropertyView = activeOta === "__property__";
  const activeListing = isPropertyView ? null : listings.find((l) => l.ota === activeOta) ?? null;

  const handleSave = async () => {
    if (!editNote.trim()) {
      setNoteErr(true);
      return;
    }
    setNoteErr(false);
    setSaving(true);

    if (editing && activeListing) {
      await onStatusEdit(activeListing.id, editing.field, editValue, editNote.trim());
    }

    setSaving(false);
    setEditing(null);
    setEditNote("");
  };

  if (loading) {
    return (
      <div style={{
        padding: 40,
        textAlign: "center",
        color: "#94A3B8",
        fontSize: 14
      }}>
        Loading…
      </div>
    );
  }

  return (
    <div style={{
      padding: "20px 24px",
      background: "#F8FAFC",
      minHeight: "100vh",
      fontFamily: "'Inter', sans-serif"
    }}>

      {/* Header Section - Leadsquared Style */}
      <div style={{
        background: "#FFFFFF",
        borderRadius: "8px",
        padding: "20px",
        marginBottom: "20px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "16px"
        }}>
          <div>
            <Link href="/crm" style={{
              fontSize: "12px",
              color: "#64748B",
              textDecoration: "none",
              fontWeight: 500,
              marginBottom: "8px",
              display: "block"
            }}>
              ← Back to CRM
            </Link>
            <h1 style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "#1F2937",
              margin: "4px 0"
            }}>
              {property.name}
            </h1>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginTop: "8px"
            }}>
              <span style={{
                fontSize: "12px",
                color: "#6B7280",
                background: "#F3F4F6",
                padding: "4px 8px",
                borderRadius: "4px"
              }}>
                #{property.id}
              </span>
              {property.city && (
                <span style={{
                  fontSize: "12px",
                  color: "#6B7280"
                }}>
                  • {property.city}
                </span>
              )}
              {statusPill(property.fhStatus)}
            </div>
          </div>

          <div style={{
            textAlign: "right"
          }}>
            <div style={{
              fontSize: "12px",
              color: "#6B7280",
              marginBottom: "4px"
            }}>
              FH Live Date
            </div>
            <div style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#374151"
            }}>
              {property.fhLiveDate ? new Date(property.fhLiveDate).toLocaleDateString() : "—"}
            </div>
          </div>
        </div>

        {/* OTA Tabs - Leadsquared Style */}
        <div style={{
          display: "flex",
          gap: "4px",
          flexWrap: "wrap",
          borderBottom: "1px solid #E5E7EB",
          paddingBottom: "12px"
        }}>
          <button
            onClick={() => onOtaChange("__property__")}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "none",
              background: isPropertyView ? "#2563EB" : "#F9FAFB",
              color: isPropertyView ? "#FFFFFF" : "#6B7280",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            Property Overview
          </button>

          {listings.map((listing) => {
            const color = OTA_COLORS[listing.ota] ?? "#6B7280";
            const active = activeOta === listing.ota;
            return (
              <button
                key={listing.ota}
                onClick={() => onOtaChange(listing.ota)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "none",
                  background: active ? color : "#F9FAFB",
                  color: active ? "#FFFFFF" : "#6B7280",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                {listing.ota}
              </button>
            );
          })}

          {/* Add OTA Button */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setAddOtaOpen(!addOtaOpen)}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "1px dashed #D1D5DB",
                background: "#FFFFFF",
                color: "#6B7280",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              + Add OTA
            </button>

            {addOtaOpen && (
              <div style={{
                position: "absolute",
                top: "100%",
                left: 0,
                zIndex: 50,
                background: "#FFFFFF",
                border: "1px solid #E5E7EB",
                borderRadius: "6px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                minWidth: "120px",
                marginTop: "4px"
              }}>
                {OTAS.filter(ota => !listings.some(l => l.ota === ota)).map(ota => (
                  <button
                    key={ota}
                    onClick={() => {
                      onAddOta(ota);
                      setAddOtaOpen(false);
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      textAlign: "left",
                      padding: "8px 12px",
                      border: "none",
                      background: "none",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: OTA_COLORS[ota] ?? "#374151",
                      cursor: "pointer",
                      transition: "background 0.2s"
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#F9FAFB")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                  >
                    {ota}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "1fr 350px",
        gap: "20px"
      }}>

        {/* Left Column - OTA Details */}
        <div>
          {isPropertyView ? (
            /* Property Overview */
            <div style={{
              background: "#FFFFFF",
              borderRadius: "8px",
              padding: "20px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
            }}>
              <h3 style={{
                fontSize: "16px",
                fontWeight: 600,
                color: "#374151",
                marginBottom: "16px"
              }}>
                All OTA Overview
              </h3>

              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                gap: "12px"
              }}>
                {listings.map((listing) => {
                  const color = OTA_COLORS[listing.ota] ?? "#6B7280";
                  const statusColor = STATUS_COLORS[listing.status?.toLowerCase()] ?? { bg: "#F3F4F6", color: "#6B7280" };

                  return (
                    <div
                      key={listing.ota}
                      onClick={() => onOtaChange(listing.ota)}
                      style={{
                        background: "#FFFFFF",
                        border: `1px solid ${color}30`,
                        borderRadius: "8px",
                        padding: "16px",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-2px)";
                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "none";
                        e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.05)";
                      }}
                    >
                      <div style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: color,
                        marginBottom: "8px"
                      }}>
                        {listing.ota}
                      </div>

                      <div style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        padding: "4px 8px",
                        borderRadius: "12px",
                        background: statusColor.bg,
                        color: statusColor.color,
                        display: "inline-block",
                        marginBottom: "8px"
                      }}>
                        {listing.status || "—"}
                      </div>

                      {listing.subStatus && (
                        <div style={{
                          fontSize: "10px",
                          color: "#6B7280",
                          marginBottom: "4px"
                        }}>
                          {listing.subStatus}
                        </div>
                      )}

                      {listing.liveDate && (
                        <div style={{
                          fontSize: "10px",
                          color: "#9CA3AF"
                        }}>
                          Live: {new Date(listing.liveDate).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : activeListing ? (
            /* OTA Detail View */
            <div style={{
              background: "#FFFFFF",
              borderRadius: "8px",
              padding: "20px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
            }}>
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "20px",
                paddingBottom: "16px",
                borderBottom: "1px solid #E5E7EB"
              }}>
                <div>
                  <h3 style={{
                    fontSize: "18px",
                    fontWeight: 600,
                    color: OTA_COLORS[activeListing.ota] ?? "#374151",
                    marginBottom: "4px"
                  }}>
                    {activeListing.ota}
                  </h3>
                  {activeListing.otaId && (
                    <div style={{
                      fontSize: "12px",
                      color: "#6B7280",
                      fontFamily: "monospace"
                    }}>
                      ID: {activeListing.otaId}
                    </div>
                  )}
                </div>

                <div style={{
                  fontSize: "11px",
                  color: "#9CA3AF"
                }}>
                  {activeListing.crmUpdatedAt
                    ? `Updated ${relativeTime(activeListing.crmUpdatedAt)}`
                    : "Not yet updated in CRM"}
                </div>
              </div>

              {/* Status Fields */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "20px",
                marginBottom: "20px"
              }}>
                <div>
                  <label style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#374151",
                    marginBottom: "6px"
                  }}>
                    STATUS
                  </label>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}>
                    {statusPill(activeListing.status)}
                    <button
                      onClick={() => {
                        setEditing({ id: activeListing.id, field: "status" });
                        setEditValue(activeListing.status);
                        setEditNote("");
                        setNoteErr(false);
                      }}
                      style={{
                        fontSize: "12px",
                        color: "#9CA3AF",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "4px"
                      }}
                    >
                      ✎
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#374151",
                    marginBottom: "6px"
                  }}>
                    SUB-STATUS
                  </label>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}>
                    <span style={{
                      fontSize: "12px",
                      color: "#6B7280"
                    }}>
                      {activeListing.subStatus || "—"}
                    </span>
                    <button
                      onClick={() => {
                        setEditing({ id: activeListing.id, field: "subStatus" });
                        setEditValue(activeListing.subStatus);
                        setEditNote("");
                        setNoteErr(false);
                      }}
                      style={{
                        fontSize: "12px",
                        color: "#9CA3AF",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "4px"
                      }}
                    >
                      ✎
                    </button>
                  </div>
                </div>
              </div>

              {/* Additional Fields */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "20px",
                marginBottom: "20px"
              }}>
                <div>
                  <label style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#374151",
                    marginBottom: "6px"
                  }}>
                    FH LIVE DATE
                  </label>
                  <div style={{
                    fontSize: "12px",
                    color: "#6B7280"
                  }}>
                    {activeListing.liveDate ? new Date(activeListing.liveDate).toLocaleDateString() : "—"}
                  </div>
                </div>

                <div>
                  <label style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#374151",
                    marginBottom: "6px"
                  }}>
                    TAT
                  </label>
                  <div style={{
                    fontSize: "12px",
                    color: "#6B7280",
                    fontWeight: 600
                  }}>
                    {activeListing.tat}d
                  </div>
                </div>
              </div>

              {/* OTA ID and Listing Link */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "20px",
                marginBottom: "20px"
              }}>
                <div>
                  <label style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#374151",
                    marginBottom: "6px"
                  }}>
                    OTA ID
                  </label>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}>
                    <span style={{
                      fontSize: "12px",
                      color: "#6B7280"
                    }}>
                      {activeListing.otaId || "—"}
                    </span>
                    <button
                      style={{
                        fontSize: "12px",
                        color: "#9CA3AF",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "4px"
                      }}
                    >
                      ✎
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#374151",
                    marginBottom: "6px"
                  }}>
                    LISTING LINK
                  </label>
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}>
                    <span style={{
                      fontSize: "12px",
                      color: "#6B7280"
                    }}>
                      {activeListing.listingLink || "—"}
                    </span>
                    <button
                      style={{
                        fontSize: "12px",
                        color: "#9CA3AF",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "4px"
                      }}
                    >
                      ✎
                    </button>
                  </div>
                </div>
              </div>

              {/* Notes Section */}
              <div>
                <label style={{
                  display: "block",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#374151",
                  marginBottom: "6px"
                }}>
                  ADD NOTE
                </label>
                <div style={{
                  display: "flex",
                  gap: "8px"
                }}>
                  <input
                    type="text"
                    placeholder="Add a note..."
                    style={{
                      flex: 1,
                      padding: "8px 12px",
                      borderRadius: "6px",
                      border: "1px solid #D1D5DB",
                      fontSize: "12px"
                    }}
                  />
                  <button style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: "none",
                    background: "#2563EB",
                    color: "#FFFFFF",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}>
                    Add
                  </button>
                </div>
              </div>

              {/* Edit Modal */}
              {editing && (
                <div style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: "rgba(0,0,0,0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1000
                }}>
                  <div style={{
                    background: "#FFFFFF",
                    borderRadius: "8px",
                    padding: "20px",
                    width: "400px",
                    maxWidth: "90vw"
                  }}>
                    <h4 style={{
                      fontSize: "16px",
                      fontWeight: 600,
                      marginBottom: "16px"
                    }}>
                      Edit {editing.field}
                    </h4>

                    <input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: "6px",
                        border: "1px solid #D1D5DB",
                        fontSize: "14px",
                        marginBottom: "12px"
                      }}
                    />

                    <textarea
                      value={editNote}
                      onChange={(e) => {
                        setEditNote(e.target.value);
                        setNoteErr(false);
                      }}
                      placeholder="Reason for change (required)"
                      style={{
                        width: "100%",
                        height: "80px",
                        padding: "8px 12px",
                        borderRadius: "6px",
                        border: `1px solid ${noteErr ? "#EF4444" : "#D1D5DB"}`,
                        fontSize: "14px",
                        marginBottom: "12px",
                        resize: "vertical"
                      }}
                    />

                    {noteErr && (
                      <div style={{
                        color: "#EF4444",
                        fontSize: "12px",
                        marginBottom: "12px"
                      }}>
                        Note is required
                      </div>
                    )}

                    <div style={{
                      display: "flex",
                      gap: "8px",
                      justifyContent: "flex-end"
                    }}>
                      <button
                        onClick={() => {
                          setEditing(null);
                          setEditNote("");
                          setNoteErr(false);
                        }}
                        style={{
                          padding: "8px 16px",
                          borderRadius: "6px",
                          border: "1px solid #D1D5DB",
                          background: "#FFFFFF",
                          color: "#374151",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer"
                        }}
                      >
                        Cancel
                      </button>

                      <button
                        onClick={handleSave}
                        disabled={saving}
                        style={{
                          padding: "8px 16px",
                          borderRadius: "6px",
                          border: "none",
                          background: "#2563EB",
                          color: "#FFFFFF",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                          opacity: saving ? 0.7 : 1
                        }}
                      >
                        {saving ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* Right Column - Activity Log */}
        <div>
          <div style={{
            background: "#FFFFFF",
            borderRadius: "8px",
            padding: "20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
          }}>
            <h3 style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "#374151",
              marginBottom: "16px"
            }}>
              Activity Log
            </h3>

            <div style={{
              maxHeight: "400px",
              overflowY: "auto"
            }}>
              {logs.slice(0, 10).map((log) => (
                <div
                  key={log.id}
                  style={{
                    padding: "12px",
                    borderLeft: "3px solid #2563EB",
                    background: "#F9FAFB",
                    marginBottom: "8px",
                    borderRadius: "0 4px 4px 0"
                  }}
                >
                  <div style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "#374151",
                    marginBottom: "4px"
                  }}>
                    {log.userName} ({log.userRole})
                  </div>

                  <div style={{
                    fontSize: "11px",
                    color: "#6B7280",
                    marginBottom: "4px"
                  }}>
                    {log.field}: {log.oldValue || "—"} → {log.newValue || "—"}
                  </div>

                  {log.note && (
                    <div style={{
                      fontSize: "11px",
                      color: "#4B5563",
                      fontStyle: "italic",
                      marginBottom: "4px"
                    }}>
                      Note: {log.note}
                    </div>
                  )}

                  <div style={{
                    fontSize: "10px",
                    color: "#9CA3AF"
                  }}>
                    {relativeTime(log.createdAt)}
                  </div>
                </div>
              ))}

              {logs.length === 0 && (
                <div style={{
                  textAlign: "center",
                  color: "#9CA3AF",
                  fontSize: "12px",
                  padding: "20px"
                }}>
                  No activity yet
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}