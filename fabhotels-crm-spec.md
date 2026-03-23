# FabHotels OTA Command CRM — Next.js Project Specification

> This document is a complete briefing for Claude Code to scaffold and build this project in Next.js from scratch. All decisions, data structures, UI designs, and business logic have been finalised in a prior session and are documented here.

---

## 1. Project Overview

**Product:** Internal CRM dashboard for the OTA & Listings team at FabHotels  
**Owner:** OTA & Listings Head  
**Purpose:** Track and analyse hotel listing performance across 11 OTAs, monitor daily new listings, RNS (Room Night Sales) production, and measure intern team performance.

**Tech Stack:**
- Framework: **Next.js 14+ (App Router)**
- Styling: **Tailwind CSS**
- Charts: **Recharts**
- Fonts: **Sora** (Google Fonts)
- Data: **Google Sheets** (via CSV/gviz API — public sheet, manual refresh)
- State: React `useState` / `useCallback` / `useMemo`

---

## 2. Business Context

| Area | Description |
|------|-------------|
| Total properties on platform | 1,877 |
| OTAs tracked | 11 (see section 4) |
| Team size | 21 interns across 5 teams |
| Key workflows | Hotel listing on internal portal, OTA listings, GMB listings, post-live process, production tracking |

---

## 3. Team Structure

| Team Lead | Members | Focus Area |
|-----------|---------|------------|
| Praveen | Yash, Gunjan, Vanshika | Post-live ops, content, image management |
| Gourav | Joti, Ajeet, Aman, Vipul, Shrishti | OTA listings ownership |
| Ajay | Gourav, Sajjak, Sadik | Booking.com / listing coordination |
| Jyoti | Karan, Rudra, Mohit, Abhishek, Umesh, Rahul | Content, mapping, Cleartrip/GoMMT/Expedia |
| Salim | Salim, Karan V, Vishal, Ajay Dhama | GMB & compliance |

**OTA Ownership mapping:**
```
Joti        → Akbar Travels
Ajeet       → Yatra
Aman        → Agoda
Vipul       → EaseMyTrip
Shrishti    → Ixigo
Mohit       → Expedia
Gourav      → Booking.com
Sadik       → Booking.com
Rudra       → GoMMT
Karan       → Cleartrip
Abhishek    → Cleartrip
Umesh       → Cleartrip
```

---

## 4. OTAs & Brand Colours

```js
const OTA_COLORS = {
  "GoMMT":         "#E83F6F",
  "Booking.com":   "#003580",
  "Agoda":         "#5C2D91",
  "Expedia":       "#00355F",
  "Cleartrip":     "#E8460A",
  "Yatra":         "#E8232A",
  "Ixigo":         "#FF6B35",
  "Akbar Travels": "#1B4F72",
  "EaseMyTrip":    "#00B9F1",
  "Indigo":        "#6B2FA0",
  "Hotelbeds":     "#00A699",
}
```

---

## 5. Navigation & Layout

### Sidebar (collapsible)
- Dark background `#0F172A`
- Expands to 220px, collapses to 56px icon-only rail
- Toggle button: `←` / `→` at top right of sidebar
- Hover tooltips on icons when collapsed
- Active state: `#1E3A5F` background, `#93C5FD` text, blue dot indicator
- Footer: shows "Data as of [date]" and GSheet connection status

### Pages (sidebar nav items):
| Icon | Label | Route |
|------|-------|-------|
| ▣ | Dashboard | `/` |
| ≡ | Listing Status | `/listings` |
| ◷ | Daily Tracker | `/daily` |
| ◈ | RNS Production | `/rns` |
| ◉ | Team & Interns | `/team` |

### Top bar
- Height: 54px, white background, sticky
- Left: Page title + subtitle (e.g. "Dashboard · Overview · Mar 2026")
- Right: Status pill ("Placeholder · GSheet integration next" or last refresh time)

---

## 6. Dashboard Page (`/`)

### 6.1 KPI Cards (4 cards, full-width grid)

| Card | Value | Subtitle | Accent |
|------|-------|----------|--------|
| Live on FH Platform | Unique props live | `out of 1,877 total` | `#3B82F6` |
| Pending Action | Count pending | `Across all OTAs` | `#F97316` |
| MTD New Listings | Mar MTD total | `Mar 1–{today} · {days left} days left` | `#8B5CF6` |
| RNS / Day (CM Avg) | Total CM avg | `vs {LM} avg/day` | `#E83F6F` |

Each card has a decorative corner circle using a lighter shade of the accent colour.

---

### 6.2 OTA Live Status Table

**Columns:** OTA · Live % (bar + number) · Live · Not Live · Total  
**Scrollable body** (max-height ~320px), **sticky header**, **pinned TOTAL footer row**  
**Bar colours by live %:**
- ≥ 90% → `#059669` green
- ≥ 70% → `#D97706` amber
- ≥ 40% → `#EA580C` orange
- < 40% → `#DC2626` red

**Data structure:**
```js
{ ota: string, live: number, notLive: number }
// total = live + notLive
```

**Footer:** TOTAL row with aggregate live %, summed live, summed not live, summed total — background `#EEF2FF`, text `#4338CA`

---

### 6.3 New Listings — MTD Table

**Placed beside OTA Status in a 2-column grid**  
**Columns:** OTA · Mar MTD · Feb Same Day · Feb Total  
**Pinned TOTAL footer row**  
Simple clean table — no heatmap, no trend pills.

**Data structure:**
```js
{ ota: string, cmMTD: number, lmSameDay: number, lmTotal: number }
```

---

### 6.4 RNS / Day — MTD Performance Table

**Full-width table below the 2-column section**

**Columns (in this exact order):**
1. OTA
2. LM MTD *(last month same-day avg)*
3. CM MTD *(current month avg so far)*
4. CM vs LM % *(% movement, green ▲ / red ▼ pill)*
5. LM Total *(full last month avg/day)*
6. CM Trend *(projected = cmMTD ÷ days_done × total_days_in_month — shown as green/red pill)*
7. Trend vs LM Total % *(% movement)*

**Pinned TOTAL footer row.**

#### Dynamic Month Pickers (header controls)
Two dropdowns — CM and LM — both independently selectable:

- **CM dropdown** (styled red `#FFF1F2` background): auto-set to current month, marked with ★
- **LM dropdown** (styled grey): auto-set to month before CM, labelled "(auto)". When overridden, highlighted yellow with "↩ auto" reset button
- **Reset all** button appears when either deviates from default
- Changing CM clears LM override (re-snaps to previous month)
- **Days done logic:** if viewing current month → use actual days elapsed; if viewing a past completed month → use full month days for trend calculation

**RNS data structure (keyed by month):**
```js
const RNS_MONTHLY = {
  "Jan-26": {
    "GoMMT":       { lmMTD: 380, cmMTD: 520, lmTotal: 880 },
    "Booking.com": { lmMTD: 170, cmMTD: 210, lmTotal: 398 },
    // ... all RNS OTAs
  },
  "Feb-26": { ... },
  "Mar-26": { ... },
}
// RNS OTAs: GoMMT, Booking.com, Agoda, Expedia, Cleartrip, EaseMyTrip
```

**Auto-detect current month key:**
```js
const autoMonthKey = () => {
  const d = new Date();
  return d.toLocaleString("en-GB", { month:"short", year:"2-digit" })
    .replace(" ", "-")
    .replace(/^(\w)/, c => c.toUpperCase());
  // e.g. "Mar-26"
}
```

---

### 6.5 MoM — New Listings per OTA (L12M Table)

**Full-width horizontal scroll table**  
**Months:** Apr-25 → Mar-26 (12 columns)  
**Current month column** highlighted with blue left border + `#EEF2FF` background + `#4338CA` text

**Rows:**
1. **FH Platform — New Props** *(sticky left, indigo background)* — new properties onboarded on FH platform each month. Blue intensity shading (darker = more onboarded)
2. **One row per OTA** *(sticky OTA name column)* — new listings made live on that OTA that month (raw count, OTA brand colour for the number, no heatmap)
3. **TOTAL footer row** — sum of all OTA new listings per month

**Data structures:**
```js
const L12M_MONTHS = ["Apr-25","May-25",...,"Mar-26"];
const L12M_ONBOARDED = [142, 118, 96, ...]; // index matches month
const L12M_OTA_LIVE = {
  "GoMMT": [98, 82, 60, ...], // new listings per month, not cumulative
  // ... all 11 OTAs
}
```

Footer note: `* Mar-26 is current month (partial data)`

---

### 6.6 Team Summary Strip

**5 columns (one per team lead), full-width**  
Each column has a 3px colour top border, team name, focus area, a key metric value, and member count.  
**Placeholder note:** "Will update after Team page is finalised"  
Team colours: `["#6366F1","#E83F6F","#F59E0B","#10B981","#8B5CF6"]`

---

## 7. Listing Status Page (`/listings`)

> **Not yet designed — to be built in a future session.**

Planned content:
- Full OTA-wise breakdown: Live / Exception / Not Live / Pending (with sub-reasons) / Duplicates / Blanks
- Monthly new listings heatmap table (Apr-25 → Mar-26)
- OTA live rate panel with colour-coded bars

---

## 8. Daily Tracker Page (`/daily`)

> **Not yet designed — to be built in a future session.**

Planned content:
- Bar chart of last 7/14/21 days (toggle)
- OTA-wise daily listing count heatmap (date columns × OTA rows)
- KPIs: Today, Yesterday, MTD, peak day

---

## 9. RNS Production Page (`/rns`)

> **Not yet designed — to be built in a future session.**

Planned content:
- Expanded version of the RNS MTD table from Dashboard
- CM vs LM monthly comparison bars per OTA
- 12-month RNS history heatmap per OTA
- Mini bar charts per OTA

---

## 10. Team & Interns Page (`/team`)

> **Not yet fully designed — to be built in a future session.**

### Confirmed decisions:
- **Intern scoring is based on listings only** — NO RNS, NO quality score
- Score formula: `Props Listed (40%) + Tasks Completed (35%) + OTA-specific Listings (25%)`
- Score badges: Top Performer (≥90), On Track (≥75), Needs Focus (≥55), At Risk (<55)
- Each intern card shows: score ring, Props / Tasks / OTA as 3 separate metrics, OTA badge, badge pill
- Click-through to intern detail page showing daily log + OTA-wise listings bar chart
- "Log Work" modal per intern: Tasks Completed, Properties Listed, OTA Platform, OTA Listings Done

---

## 11. Google Sheets Integration

### Sheet Details
- **Sheet ID:** `1VkFA4keBAT3tG5NkZwmSNRbLZJgx2neOhZ7Zuj2z_98`
- **Visibility:** Public — "Anyone with link can view"

### Tabs
| Tab Name | Content |
|----------|---------|
| `Listing Tracker` | Daily listing activity |
| `Listing Summary` | OTA-wise listing status summary |
| `RN Tracker` | RNS / Room Night data |

### Fetch Method
Use Google Sheets gviz CSV export — **no API key required:**
```
https://docs.google.com/spreadsheets/d/{SHEET_ID}/gviz/tq?tqx=out:csv&sheet={TAB_NAME}
```

In Next.js, fetch this **server-side** (in a Route Handler or Server Component) to avoid CORS:
```ts
// app/api/sheets/route.ts
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tab = searchParams.get("tab") || "Listing Tracker";
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}`;
  const res = await fetch(url, { next: { revalidate: 0 } }); // no cache — manual refresh
  const csv = await res.text();
  return new Response(csv, { headers: { "Content-Type": "text/csv" } });
}
```

### Refresh Strategy
- **Manual refresh only** — no auto-polling
- "⟳ Refresh Sheets" button in top bar triggers re-fetch of all 3 tabs
- Show last refreshed timestamp
- Show per-tab status: ✅ Connected / ❌ Error / ⟳ Loading / ○ Not fetched
- Once column structure is confirmed from live sheet, build proper parsed KPI/chart views

### CSV Parser
```ts
const parseCSV = (csv: string) => {
  const lines = csv.trim().split("\n");
  const parseRow = (line: string) => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === "," && !inQuotes) { result.push(current.trim()); current = ""; }
      else { current += ch; }
    }
    result.push(current.trim());
    return result;
  };
  const cols = parseRow(lines[0]).map(c => c.replace(/^"|"$/g, ""));
  const rows = lines.slice(1).map(l => parseRow(l).map(c => c.replace(/^"|"$/g, "")));
  return { cols, rows: rows.filter(r => r.some(c => c !== "")) };
};
```

---

## 12. Design System

### Typography
- Font: **Sora** (Google Fonts) — weights 300, 400, 500, 600, 700, 800
- Base size: 12–14px for table content, 10px for labels, 28–32px for KPI values

### Colours
```
Background:     #F0F4FF  (page)
White surface:  #FFFFFF  (cards/tables)
Border:         #E2E8F0
Subtle bg:      #F8FAFC
Sidebar bg:     #0F172A
Sidebar active: #1E3A5F
Primary:        #6366F1
Text primary:   #0F172A
Text muted:     #64748B
Text faint:     #94A3B8
```

### Reusable Components to build

| Component | Description |
|-----------|-------------|
| `<Bar>` | Progress bar — `value`, `max`, `color`, `h` props |
| `<Pct>` | % movement pill — green ▲ or red ▼, null renders `—` |
| `<TrendPill>` | Projected trend value — green/red based on vs LM Total |
| `<OTABadge>` | Coloured OTA name pill |
| `<Chip>` | Score badge (Top Performer / On Track etc.) |
| `<Th>` | Table header cell — sticky support, center prop |
| `<Td>` | Table data cell — color, bold, center props |
| `<FooterTd>` | Footer total cell — `#EEF2FF` bg, `#4338CA` text |
| `<Sidebar>` | Collapsible sidebar with nav and toggle |
| `<Topbar>` | Sticky top bar with title + right controls |
| `<ScoreRing>` | Conic gradient score ring for intern cards |

### Scrollbars (global CSS)
```css
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: #F1F5F9; }
::-webkit-scrollbar-thumb { background: #C7D2FE; border-radius: 99px; }
```

### Table hover (global CSS)
```css
tbody tr:hover td { background: #FAFBFF !important; }
```

---

## 13. Placeholder Data (seed until GSheet is wired)

Use the following as seed data in a `lib/data.ts` file. Replace with live GSheet data once column structure is confirmed.

### OTA Status
```ts
export const OTA_STATUS = [
  { ota:"GoMMT",         live:1724, notLive:153  },
  { ota:"Booking.com",   live:1258, notLive:619  },
  { ota:"Agoda",         live:1776, notLive:101  },
  { ota:"Expedia",       live:1678, notLive:199  },
  { ota:"Cleartrip",     live:1397, notLive:480  },
  { ota:"Yatra",         live:336,  notLive:1541 },
  { ota:"Ixigo",         live:342,  notLive:1535 },
  { ota:"Akbar Travels", live:758,  notLive:1119 },
  { ota:"EaseMyTrip",    live:966,  notLive:911  },
  { ota:"Indigo",        live:0,    notLive:1877 },
  { ota:"Hotelbeds",     live:0,    notLive:1877 },
];
```

### MTD Listings
```ts
export const MTD_LISTINGS = [
  { ota:"GoMMT",         cmMTD:50,  lmSameDay:62,  lmTotal:126 },
  { ota:"Booking.com",   cmMTD:20,  lmSameDay:28,  lmTotal:62  },
  { ota:"Agoda",         cmMTD:50,  lmSameDay:70,  lmTotal:154 },
  { ota:"Expedia",       cmMTD:64,  lmSameDay:15,  lmTotal:34  },
  { ota:"Cleartrip",     cmMTD:0,   lmSameDay:98,  lmTotal:279 },
  { ota:"Yatra",         cmMTD:0,   lmSameDay:120, lmTotal:336 },
  { ota:"Ixigo",         cmMTD:212, lmSameDay:45,  lmTotal:130 },
  { ota:"Akbar Travels", cmMTD:204, lmSameDay:197, lmTotal:554 },
  { ota:"EaseMyTrip",    cmMTD:0,   lmSameDay:0,   lmTotal:0   },
  { ota:"Indigo",        cmMTD:0,   lmSameDay:0,   lmTotal:0   },
  { ota:"Hotelbeds",     cmMTD:0,   lmSameDay:0,   lmTotal:0   },
];
```

### RNS Monthly
```ts
export const RNS_MONTHLY: Record<string, Record<string, { lmMTD:number, cmMTD:number, lmTotal:number }>> = {
  "Jan-26": {
    "GoMMT":       { lmMTD:380, cmMTD:520, lmTotal:880 },
    "Booking.com": { lmMTD:170, cmMTD:210, lmTotal:398 },
    "Agoda":       { lmMTD:200, cmMTD:290, lmTotal:480 },
    "Expedia":     { lmMTD:22,  cmMTD:32,  lmTotal:58  },
    "Cleartrip":   { lmMTD:10,  cmMTD:20,  lmTotal:28  },
    "EaseMyTrip":  { lmMTD:2,   cmMTD:4,   lmTotal:5   },
  },
  "Feb-26": {
    "GoMMT":       { lmMTD:410, cmMTD:520, lmTotal:955 },
    "Booking.com": { lmMTD:195, cmMTD:210, lmTotal:455 },
    "Agoda":       { lmMTD:231, cmMTD:290, lmTotal:539 },
    "Expedia":     { lmMTD:29,  cmMTD:32,  lmTotal:68  },
    "Cleartrip":   { lmMTD:14,  cmMTD:20,  lmTotal:33  },
    "EaseMyTrip":  { lmMTD:3,   cmMTD:4,   lmTotal:6   },
  },
  "Mar-26": {
    "GoMMT":       { lmMTD:410, cmMTD:608, lmTotal:955 },
    "Booking.com": { lmMTD:195, cmMTD:226, lmTotal:455 },
    "Agoda":       { lmMTD:231, cmMTD:354, lmTotal:539 },
    "Expedia":     { lmMTD:29,  cmMTD:28,  lmTotal:68  },
    "Cleartrip":   { lmMTD:14,  cmMTD:27,  lmTotal:33  },
    "EaseMyTrip":  { lmMTD:3,   cmMTD:5,   lmTotal:6   },
  },
};
```

### L12M Data
```ts
export const L12M_MONTHS = [
  "Apr-25","May-25","Jun-25","Jul-25","Aug-25","Sep-25",
  "Oct-25","Nov-25","Dec-25","Jan-26","Feb-26","Mar-26"
];
export const L12M_ONBOARDED = [142,118,96,130,154,109,87,163,201,178,245,87];
export const L12M_OTA_LIVE: Record<string, number[]> = {
  "GoMMT":        [98,82,60,88,110,74,52,115,140,120,126,50],
  "Booking.com":  [45,38,30,52,68,44,28,72,88,74,62,20],
  "Agoda":        [110,90,72,100,130,88,60,120,155,138,154,50],
  "Expedia":      [30,24,18,28,40,26,16,35,50,42,34,64],
  "Cleartrip":    [80,66,50,76,95,65,40,90,115,98,279,0],
  "Yatra":        [42,30,22,35,50,32,20,45,60,50,336,0],
  "Ixigo":        [38,28,18,30,44,28,16,40,55,45,130,212],
  "Akbar Travels":[55,44,35,55,75,50,30,60,85,70,554,204],
  "EaseMyTrip":   [0,0,0,0,0,0,0,0,0,0,0,0],
  "Indigo":       [0,0,0,0,0,0,0,0,0,0,0,0],
  "Hotelbeds":    [0,0,0,0,0,0,0,0,0,0,0,0],
};
```

---

## 14. Helpers / Utilities (`lib/utils.ts`)

```ts
// Auto-detect current month string e.g. "Mar-26"
export const autoMonthKey = () => {
  const d = new Date();
  return d.toLocaleString("en-GB", { month:"short", year:"2-digit" })
    .replace(" ", "-").replace(/^(\w)/, c => c.toUpperCase());
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
```

---

## 15. Folder Structure

```
fabhotels-crm/
├── app/
│   ├── layout.tsx              # Root layout with sidebar + topbar
│   ├── page.tsx                # Dashboard
│   ├── listings/page.tsx       # Listing Status (TBD)
│   ├── daily/page.tsx          # Daily Tracker (TBD)
│   ├── rns/page.tsx            # RNS Production (TBD)
│   ├── team/
│   │   ├── page.tsx            # Team overview / intern grid
│   │   └── [id]/page.tsx       # Intern detail page
│   └── api/
│       └── sheets/route.ts     # Server-side Google Sheets proxy
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   └── Topbar.tsx
│   ├── ui/
│   │   ├── Bar.tsx
│   │   ├── Pct.tsx
│   │   ├── TrendPill.tsx
│   │   ├── OTABadge.tsx
│   │   ├── Chip.tsx
│   │   ├── ScoreRing.tsx
│   │   └── Table.tsx           # Th, Td, FooterTd
│   └── dashboard/
│       ├── KPICards.tsx
│       ├── OTAStatusTable.tsx
│       ├── MTDListingsTable.tsx
│       ├── RNSTable.tsx        # Includes dynamic CM/LM pickers
│       ├── L12MTable.tsx
│       └── TeamSummary.tsx
├── lib/
│   ├── data.ts                 # All placeholder seed data
│   ├── utils.ts                # autoMonthKey, pctMove, cmTrend, daysInMonth
│   ├── sheets.ts               # fetchSheet(), parseCSV()
│   └── constants.ts            # OTA_COLORS, OTAS array, TEAM_COLORS
├── hooks/
│   └── useSheets.ts            # Client hook for manual refresh of all 3 tabs
└── public/
```

---

## 16. Pages Still To Design (future sessions)

The following pages have **not been designed yet**. Claude Code should scaffold them as empty pages with a "Coming Soon" placeholder:

- `/listings` — Listing Status
- `/daily` — Daily Tracker
- `/rns` — RNS Production (full page, not just the dashboard table)
- `/team` — Team & Interns (intern scoring logic is confirmed, UI not finalised)

These will be spec'd in follow-up sessions in claude.ai and the spec document will be updated.

---

## 17. Current Working Prototype

A fully working React JSX prototype of the Dashboard has been built in claude.ai artifacts. The file `fabhotels-crm.jsx` contains the complete single-file prototype and can be used as a reference implementation for all Dashboard components. Claude Code should use it as the visual and logic reference when building the Next.js version.

---

## 18. Outstanding Decisions

| Item | Status |
|------|--------|
| Google Sheet column structure | Pending — sheet is public but column names not yet confirmed |
| GSheet → parsed KPI mapping | Pending — depends on column names from live sheet |
| Team & Interns page UI | Pending design session |
| Listing Status page | Pending design session |
| Daily Tracker page | Pending design session |
| RNS Production full page | Pending design session |
| Authentication / access control | Not scoped — internal tool |
| Deployment | Not scoped — internal tool |
