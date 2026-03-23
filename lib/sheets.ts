import { SHEET_ID } from "@/lib/constants";

export const parseCSV = (csv: string): { cols: string[]; rows: string[][] } => {
  const lines = csv.trim().split("\n");
  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };
  const cols = parseRow(lines[0]).map((c) => c.replace(/^"|"$/g, ""));
  const rows = lines
    .slice(1)
    .map((l) => parseRow(l).map((c) => c.replace(/^"|"$/g, "")))
    .filter((r) => r.some((c) => c !== ""));
  return { cols, rows };
};

export const fetchSheet = async (tab: string): Promise<string> => {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch sheet "${tab}": ${res.status}`);
  return res.text();
};
