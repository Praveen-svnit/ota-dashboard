"use client";

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
}

interface PropertyLeadsquaredViewProps {
  property: Property;
  listings: Listing[];
  activeOta: string | null;
  onOtaChange: (ota: string) => void;
}

export default function PropertyLeadsquaredView({
  property,
  listings,
  activeOta,
  onOtaChange,
}: PropertyLeadsquaredViewProps) {
  return (
    <div style={{
      padding: "20px 24px",
      background: "#F8FAFC",
      minHeight: "100vh",
      fontFamily: "'Inter', sans-serif"
    }}>
      {/* Header Section */}
      <div style={{
        background: "#FFFFFF",
        borderRadius: "8px",
        padding: "20px",
        marginBottom: "20px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
      }}>
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

          <span style={{
            fontSize: "10px",
            fontWeight: 700,
            padding: "4px 12px",
            borderRadius: "20px",
            background: property.fhStatus?.toLowerCase() === "live" ? "#D1FAE5" : "#FEE2E2",
            color: property.fhStatus?.toLowerCase() === "live" ? "#059669" : "#DC2626"
          }}>
            {property.fhStatus || "—"}
          </span>
        </div>

        <div style={{
          fontSize: "12px",
          color: "#6B7280",
          marginTop: "8px"
        }}>
          FH Live: {property.fhLiveDate ? new Date(property.fhLiveDate).toLocaleDateString() : "—"}
        </div>
      </div>

      {/* OTA Tabs */}
      <div style={{
        background: "#FFFFFF",
        borderRadius: "8px",
        padding: "16px",
        marginBottom: "20px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
      }}>
        <h3 style={{
          fontSize: "16px",
          fontWeight: 600,
          color: "#374151",
          marginBottom: "12px"
        }}>
          OTA Channels
        </h3>

        <div style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap"
        }}>
          {/* Property Overview Tab */}
          <button
            onClick={() => onOtaChange("__property__")}
            style={{
              padding: "8px 16px",
              borderRadius: "6px",
              border: "none",
              background: activeOta === "__property__" ? "#2563EB" : "#F9FAFB",
              color: activeOta === "__property__" ? "#FFFFFF" : "#6B7280",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            Overview
          </button>

          {/* OTA Tabs */}
          {listings.map((listing) => (
            <button
              key={listing.ota}
              onClick={() => onOtaChange(listing.ota)}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "none",
                background: activeOta === listing.ota ? "#059669" : "#F9FAFB",
                color: activeOta === listing.ota ? "#FFFFFF" : "#6B7280",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              {listing.ota}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      {activeOta === "__property__" ? (
        /* Property Overview */
        <div style={{
          background: "#FFFFFF",
          borderRadius: "8px",
          padding: "20px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
        }}>
          <h3 style={{
            fontSize: "18px",
            fontWeight: 600,
            color: "#374151",
            marginBottom: "16px"
          }}>
            Property Overview
          </h3>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "16px"
          }}>
            {listings.map((listing) => (
              <div key={listing.ota} style={{
                background: "#F9FAFB",
                borderRadius: "8px",
                padding: "16px",
                border: "1px solid #E5E7EB"
              }}>
                <div style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "#374151",
                  marginBottom: "8px"
                }}>
                  {listing.ota}
                </div>

                <div style={{
                  fontSize: "12px",
                  padding: "4px 8px",
                  borderRadius: "12px",
                  background: listing.status?.toLowerCase() === "live" ? "#D1FAE5" : "#FEE2E2",
                  color: listing.status?.toLowerCase() === "live" ? "#059669" : "#DC2626",
                  display: "inline-block",
                  fontWeight: 600
                }}>
                  {listing.status || "—"}
                </div>

                {listing.subStatus && (
                  <div style={{
                    fontSize: "11px",
                    color: "#6B7280",
                    marginTop: "4px"
                  }}>
                    {listing.subStatus}
                  </div>
                )}

                {listing.liveDate && (
                  <div style={{
                    fontSize: "11px",
                    color: "#9CA3AF",
                    marginTop: "4px"
                  }}>
                    Live: {new Date(listing.liveDate).toLocaleDateString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* OTA Detail View */
        <div style={{
          background: "#FFFFFF",
          borderRadius: "8px",
          padding: "20px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
        }}>
          <h3 style={{
            fontSize: "18px",
            fontWeight: 600,
            color: "#374151",
            marginBottom: "16px"
          }}>
            {activeOta} Details
          </h3>

          {listings
            .filter(listing => listing.ota === activeOta)
            .map((listing) => (
              <div key={listing.ota}>
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
                      fontSize: "12px",
                      padding: "4px 12px",
                      borderRadius: "12px",
                      background: listing.status?.toLowerCase() === "live" ? "#D1FAE5" : "#FEE2E2",
                      color: listing.status?.toLowerCase() === "live" ? "#059669" : "#DC2626",
                      display: "inline-block",
                      fontWeight: 600
                    }}>
                      {listing.status || "—"}
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
                      fontSize: "12px",
                      color: "#6B7280"
                    }}>
                      {listing.subStatus || "—"}
                    </div>
                  </div>
                </div>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "20px"
                }}>
                  <div>
                    <label style={{
                      display: "block",
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "#374151",
                      marginBottom: "6px"
                    }}>
                      LIVE DATE
                    </label>
                    <div style={{
                      fontSize: "12px",
                      color: "#6B7280"
                    }}>
                      {listing.liveDate ? new Date(listing.liveDate).toLocaleDateString() : "—"}
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
                      OTA ID
                    </label>
                    <div style={{
                      fontSize: "12px",
                      color: "#6B7280"
                    }}>
                      {listing.otaId || "—"}
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}