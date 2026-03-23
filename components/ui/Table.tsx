import React from "react";

interface ThProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sticky?: boolean;
  center?: boolean;
  children?: React.ReactNode;
}

export function Th({ sticky, center, children, style, ...props }: ThProps) {
  return (
    <th
      style={{
        padding: "8px 12px",
        fontSize: 11,
        fontWeight: 600,
        color: "#64748B",
        textAlign: center ? "center" : "left",
        background: "#F8FAFC",
        borderBottom: "1px solid #E2E8F0",
        whiteSpace: "nowrap",
        position: sticky ? "sticky" : undefined,
        top: sticky ? 0 : undefined,
        zIndex: sticky ? 2 : undefined,
        ...style,
      }}
      {...props}
    >
      {children}
    </th>
  );
}

interface TdProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  color?: string;
  bold?: boolean;
  center?: boolean;
  children?: React.ReactNode;
}

export function Td({ color, bold, center, children, style, ...props }: TdProps) {
  return (
    <td
      style={{
        padding: "8px 12px",
        fontSize: 12,
        color: color ?? "#0F172A",
        fontWeight: bold ? 600 : 400,
        textAlign: center ? "center" : "left",
        borderBottom: "1px solid #F1F5F9",
        whiteSpace: "nowrap",
        ...style,
      }}
      {...props}
    >
      {children}
    </td>
  );
}

interface FooterTdProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  center?: boolean;
  children?: React.ReactNode;
}

export function FooterTd({ center, children, style, ...props }: FooterTdProps) {
  return (
    <td
      style={{
        padding: "8px 12px",
        fontSize: 12,
        fontWeight: 700,
        color: "#4338CA",
        background: "#EEF2FF",
        textAlign: center ? "center" : "left",
        whiteSpace: "nowrap",
        borderTop: "2px solid #C7D2FE",
        ...style,
      }}
      {...props}
    >
      {children}
    </td>
  );
}
