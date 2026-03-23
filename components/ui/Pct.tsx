interface PctProps {
  value: number | null;
}

export default function Pct({ value }: PctProps) {
  if (value === null) {
    return <span style={{ color: "#94A3B8", fontSize: 11 }}>—</span>;
  }
  const positive = value >= 0;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 2,
        fontSize: 11,
        fontWeight: 600,
        color: positive ? "#059669" : "#DC2626",
        background: positive ? "#ECFDF5" : "#FEF2F2",
        borderRadius: 99,
        padding: "2px 7px",
        whiteSpace: "nowrap",
      }}
    >
      {positive ? "▲" : "▼"} {Math.abs(value)}%
    </span>
  );
}
