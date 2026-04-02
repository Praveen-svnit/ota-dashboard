"use client";

import LeadsquaredCard from "@/components/crm/LeadsquaredCard";

export default function TestPage() {
  return (
    <div style={{ padding: "20px", background: "#F8FAFC", minHeight: "100vh" }}>
      <h1 style={{ marginBottom: "20px" }}>Test Leadsquared UI</h1>
      <LeadsquaredCard title="Test Card" accentColor="#059669">
        <p>This is a test card with Leadsquared styling.</p>
        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
          <button style={{
            padding: "8px 16px",
            background: "#2563EB",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer"
          }}>
            Primary Button
          </button>
          <button style={{
            padding: "8px 16px",
            background: "white",
            color: "#374151",
            border: "1px solid #D1D5DB",
            borderRadius: "4px",
            cursor: "pointer"
          }}>
            Secondary Button
          </button>
        </div>
      </LeadsquaredCard>
    </div>
  );
}