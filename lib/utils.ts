// Auto-detect current month string e.g. "Mar-26"
export const autoMonthKey = (): string => {
  const d = new Date();
  return d
    .toLocaleString("en-GB", { month: "short", year: "2-digit" })
    .replace(" ", "-")
    .replace(/^(\w)/, (c) => c.toUpperCase());
};

// Previous month key from a given month key e.g. "Mar-26" → "Feb-26"
export const prevMonthKey = (key: string): string => {
  const [mon, yr] = key.split("-");
  const d = new Date(Date.parse(`${mon} 20${yr}`));
  d.setMonth(d.getMonth() - 1);
  return d
    .toLocaleString("en-GB", { month: "short", year: "2-digit" })
    .replace(" ", "-")
    .replace(/^(\w)/, (c) => c.toUpperCase());
};

// % movement — returns null if prev is 0
export const pctMove = (cur: number, prev: number): number | null =>
  !prev ? null : Math.round(((cur - prev) / prev) * 100);

// CM Trend projection
export const cmTrend = (achieved: number, daysDone: number, daysTotal: number): number =>
  daysDone > 0 ? Math.round((achieved / daysDone) * daysTotal) : 0;

// Days in a given month key e.g. "Mar-26" → 31
export const daysInMonth = (key: string): number => {
  const [mon, yr] = key.split("-");
  const d = new Date(Date.parse(`${mon} 20${yr}`));
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
};

// Days elapsed in current month (1-based)
export const daysDoneInMonth = (key: string): number => {
  const currentKey = autoMonthKey();
  if (key !== currentKey) return daysInMonth(key); // past month — full count
  return new Date().getDate();
};

// Format number with comma separators
export const fmt = (n: number): string => n.toLocaleString("en-IN");
