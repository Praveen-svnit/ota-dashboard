"use client";

import { useState } from "react";

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
}

export default function PropertyLeadsquaredView({
  property,
  listings,
  activeOta,
}: PropertyLeadsquaredViewProps) {
  return (
    <div style={{ padding: "20px", background: "#F8FAFC", minHeight: "100vh" }}>
      <h1 style={{ fontSize: "24px", fontWeight: "bold", color: "#1F2937" }}>
        {property.name}
      </h1>
      <p style={{ color: "#6B7280" }}>#{property.id} • {property.city}</p>
      <div style={{ marginTop: "20px" }}>
        <h3 style={{ fontSize: "16px", fontWeight: "600" }}>OTAs:</h3>
        {listings.map((listing) => (
          <div key={listing.id} style={{
            padding: "10px",
            margin: "5px",
            background: "white",
            borderRadius: "6px",
            border: activeOta === listing.ota ? "2px solid #2563EB" : "1px solid #E5E7EB"
          }}>
            {listing.ota}: {listing.status}
          </div>
        ))}
      </div>
    </div>
  );
}