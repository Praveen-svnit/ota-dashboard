# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (hot reload, use for local development)
npm run build      # Production build (required before next start)
npm run start      # Start production server (must build first)
npm run lint       # ESLint check
npm run sync       # Sync OTA listings data from Google Sheets to DB
npm run sync:rns   # Sync RNS property list
```

> **Important**: The app is often running via `next start` (production mode). Code changes require `npm run build` + server restart to take effect. There are two local instances: `C:/Users/cs03778/ota-dashboard/` (primary, git-tracked) and `C:/Users/cs03778/Documents/ota-dashboard/` (mirror). After editing the primary, copy changed files to the mirror with `cp`.

## Environment

Requires a `.env.local` with:
```
DATABASE_URL=postgres://...   # Neon PostgreSQL connection string
```

The app uses PostgreSQL only (via `pg` pool). `lib/db.ts` re-exports from `lib/db-postgres.ts`. Use `getSql()` to get a tagged-template SQL function.

## Architecture

### App Router structure (`app/`)
- `/` → Production dashboard (`ClassicProductionDashboard`)
- `/listing-dashboard` → OTA listing status dashboard (main feature)
- `/crm/[propertyId]` → Property CRM detail page
- `/listings`, `/ota`, `/performance`, `/reports`, `/tasks`, `/team`, `/todays-assigned-tasks` → Other feature pages
- `/admin` → Admin panel
- `/login` → Auth

### API routes (`app/api/`)
All routes are Next.js Route Handlers. Key ones:
- `/api/listing-dashboard` — Main listing dashboard data: `pivot` (ota→subStatus→count), `columns`, `otas`, `stats`, `categories` (per-OTA status counts), `tatBreakdown`, `tatStats`, `ssStatusPivot`
- `/api/sync-ota-listings`, `/api/sync-inventory` — Sync Google Sheets data into DB
- `/api/dashboard-data`, `/api/perf-data`, `/api/city-production` etc. — Other dashboard endpoints
- `/api/cron/*` — Cron job endpoints

### Key components (`components/dashboard/`)
- **`OtaDetailView.tsx`** — The main per-OTA view rendered inside `/listing-dashboard`. Receives `otaName` prop. Contains: Overview tile (collapsible, Status/Sub-status tab strip, clickable filter tiles), Not Live property list, Live property list. Fetches from `/api/listing-dashboard` and `/api/listing-data`.
- **`ClassicProductionDashboard.tsx`** — Root production dashboard
- **`CityView.tsx`**, **`DodView.tsx`**, **`KPICards.tsx`**, etc. — Sub-views used within dashboards

### `/listing-dashboard` page flow
1. Renders OTA switcher sidebar (OTA_LIST_ORDER)
2. `selectedOta === "Overview"` → shows summary across all OTAs
3. Otherwise renders `<OtaDetailView otaName={selectedOta} />`
4. `OtaDetailView` fetches `/api/listing-dashboard` (full data) and `/api/listing-data` (paginated property rows)

### Database tables
- `inventory` — Master property list (`property_id`, `fh_status`: Live/SoldOut/etc., `fh_live_date`, city, etc.)
- `ota_listing` — Per-OTA listing status (`property_id`, `ota`, `status`, `sub_status`, `tat`, `live_date`)
- Additional tables for GMB, hygiene, genius, RNS, tasks, team data

### `sub_status` normalization
`app/api/listing-dashboard/route.ts` has a `normalize()` function that canonicalizes sub-status variants (e.g. `"not live"` → `"Not Live"`, `"pending at go-mmt"` → `"Pending at GoMMT"`). Apply the same logic when adding new sub-status handling.

### Auth
JWT-based auth via `lib/auth.ts` + `jose`. Login at `/login`, protected routes check cookie.
