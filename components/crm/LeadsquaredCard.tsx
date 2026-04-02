"use client";

interface LeadsquaredCardProps {
  title: string;
  children: React.ReactNode;
  accentColor?: string;
}

export default function LeadsquaredCard({ title, children, accentColor = "#2563EB" }: LeadsquaredCardProps) {
  return (
    <div style={{
      background: "#FFFFFF",
      borderRadius: "8px",
      border: `1px solid #E5E7EB`,
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      overflow: "hidden"
    }}>
      <div style={{
        background: accentColor,
        color: "#FFFFFF",
        padding: "12px 16px",
        fontSize: "14px",
        fontWeight: "600"
      }}>
        {title}
      </div>
      <div style={{ padding: "16px" }}>
        {children}
      </div>
    </div>
  );
}