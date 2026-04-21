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
CRON_SECRET=...               # Bearer token for cron endpoints
```

The app uses PostgreSQL only (via `pg` pool). `lib/db.ts` re-exports from `lib/db-postgres.ts`. Use `getSql()` to get a tagged-template SQL function (handles connection pooling, max 10 connections).

## Architecture

### App Router structure (`app/`)
- `/` → Production dashboard (`ClassicProductionDashboard`)
- `/listing-dashboard` → OTA listing status dashboard (main feature)
- `/crm/[propertyId]` → Property CRM detail page
- `/listings`, `/ota`, `/performance`, `/reports`, `/tasks`, `/team`, `/todays-assigned-tasks` → Other feature pages
- `/admin` → Admin panel
- `/login` → Auth

### Auth
JWT-based auth via `lib/auth.ts` + `jose` (HS256). Cookie: `ota_session` (httpOnly, 7-day expiry). `middleware.ts` protects all routes except `/login`, `/api/auth/login`, `/api/sync-*`, `/api/init-db`. API routes also accept Bearer token (verified via `/api/admin/api-keys/verify`).

### Database tables
- `inventory` — Master property list (`property_id`, `fh_status`: Live/SoldOut/etc., `fh_live_date`, city, etc.)
- `ota_listing` — Per-OTA listing status (`property_id`, `ota`, `status`, `sub_status`, `tat`, `tat_error`, `live_date`, `ota_id`, `pre_post`)
- Additional tables: `stay_rns`, `sold_rns`, `ota_metrics`, tasks, team data, audit logs

### `/listing-dashboard` page flow
1. `app/listing-dashboard/page.tsx` renders OTA switcher sidebar (`OTA_LIST_ORDER = ["GoMMT","Booking.com","Agoda",...]`)
2. `selectedOta === "Overview"` → aggregate summary across all OTAs
3. Otherwise renders `<OtaDetailView otaName={selectedOta} />`

### `OtaDetailView.tsx` — the core component
Located at `components/dashboard/OtaDetailView.tsx`. Receives `otaName` prop. Key sections:

**Data sources:**
- `/api/listing-dashboard` — Full aggregate data: `pivot` (ota→subStatus→count), `categories` (per-OTA status counts: live/exception/readyToGoLive/inProcess/tatExhausted), `tatBreakdown`, `tatStats`, `ssStatusPivot`
- `/api/listing-dashboard/not-live` — Paginated property rows (page size 50), supports search + multi-filter

**Three property tabs (`propTab` state):**
- `"notlive"` — Not-live properties table with filters (sub-status, FH status, date ranges, TAT category)
- `"live"` — Live properties table
- `"listing"` — Listing Creation sheet (spreadsheet-style inline editing)

**Overview tile:**
- Collapsible (`ovvExpanded`), tab strip: `"status"` | `"substatus"` (`ovvTab`)
- Status tiles: clickable cards that filter the property list below
- Sub-status tiles: same card style, click filters by that sub-status

**Listing Creation sheet state:**
- `lcRows` / `lcDirty` / `lcSelected` — data, unsaved changes (keyed by `otaListingId`), selection
- `lcDirty[id][field]` — staged edits; yellow highlight indicates dirty cell
- `lcSaveAll()` — POSTs each dirty field to `/api/crm/update-status`; removes from dirty on success
- Bulk bar: select field → set value → Apply → marks rows dirty (does NOT auto-save)

**Sorting:** Client-side via `useMemo` + `nlSortBy`/`nlSortDir` state (not re-fetched from server).

### API routes (`app/api/`)
- `/api/listing-dashboard` — Aggregate stats; `normalize()` canonicalizes sub-status strings from DB
- `/api/listing-dashboard/not-live` — Paginated rows; `DENORM_SS` maps canonical labels back to raw DB values for WHERE clauses
- `/api/crm/update-status` — Single-field update for listing creation sheet
- `/api/sync-ota-listings`, `/api/sync-inventory` — Sync from Google Sheets (gviz CSV API); batch upsert 200 records/query
- `/api/cron/sync-sheets` — Called by Vercel Cron at 11am/3pm/6pm IST; parallelizes both syncs

### Sub-status normalization (critical pattern)
`normalize()` in `listing-dashboard/route.ts` canonicalizes raw DB values:
- `"not live"` / `"others - not live"` → `"Not Live"`
- `"pending at go-mmt"` → `"Pending at GoMMT"`
- `"pending at bdc"` → `"Pending at Booking.com"`
- `"pending at emt"` → `"Pending at EaseMyTrip"`
- `"pending at ota"` → `"Pending at OTA"`
- `"#n/a"` / blank → `"Blank"`

`OtaDetailView.tsx` has an identical `normalizeSs()` for client-side use. `not-live/route.ts` has `DENORM_SS` mapping canonical → raw values for SQL WHERE clauses. **When adding new sub-status handling, update all three.**

### Color/style constants (duplicated — keep in sync)
`SS_COLOR` and `getSSColor()` are defined identically in both `app/listing-dashboard/page.tsx` and `components/dashboard/OtaDetailView.tsx`. Fallback rule: sub-status starting with `"Pending at"` → blue theme; else gray.

`OTA_COLORS`, `OTAS`, `RNS_OTAS`, `CHANNEL_TO_OTA` live in `lib/constants.ts`.

### TAT & `tat_error`
`tat_error` is a flag (0/1) meaning negative TAT (OTA went live before FH). Not auto-computed — comes from sync or manual entry. When `tatError > 0`, use the error color (`T.notLive`) instead of the standard TAT color scale.

TAT color scale (days): ≤15 → gray `#64748B`, ≤30 → amber `#B45309`, ≤90 → orange `#C2410C`, ≤365 → red `#DC2626`, >365 → dark red `#7F1D1D`.

### Google Sheets sync date parsing
`sync-ota-listings` handles four date formats: Excel serial (30000–60000), `d/M/yyyy`, `d-Mon-yyyy`, `M/D/YYYY`, `YYYY-MM-DD`.

### Status Config system
Each OTA has a `statusSubStatusMap: Record<string, { preset: string; postset: string }>` stored in `ota_status_config.sub_statuses` (JSONB). For each OTA status, it maps to a sub-status for Preset and PostSet mode. Sub-status is always auto-derived — never manually edited in Listing Creation or CRM.

- API: `GET/POST/DELETE /api/admin/status-config` — fetch/save per-OTA config. Allowed roles: admin, head, intern.
- API: `GET /api/crm/ota-statuses?ota=X` — returns unique statuses from `ota_listing` for that OTA (used to populate Status Config table rows and Listing Creation status dropdown).
- Agoda default map is hardcoded in the route (`AGODA_DEFAULT_MAP`); others default to `{}`.
- Status Config tab lives on each OTA's detail page (tab key `"config"`) in `OtaDetailView.tsx`.
- Listing Creation: Status = editable dropdown (merged `scOtaStatuses` + `Object.keys(scStatusMap)`). Sub-status = read-only, derived as `scStatusMap[status]?.[preset|postset]`.
- CRM page: same pattern — Status editable, sub-status read-only derived.

### SWC / React hooks rules (critical — caused prod crashes twice)
- Never call `useState` / `React.useState` inside: IIFE blocks, conditional renders, `.map()` callbacks, or inline components defined inside render.
- Never declare `async function foo()` inside `.map()` callbacks — use `const foo = async () => {}` instead.
- Never declare `type Foo = ...` inside a component function body — declare at module scope.
- All hooks must be at the top level of the component function. Move state used in conditional tabs to the component's top-level state.

### Middleware auth / cron (important)
`middleware.ts` `PUBLIC_PATHS` must include any route that is called without a user session:
- `/api/cron/` — Vercel Cron sends `Bearer <CRON_SECRET>` which doesn't match the `ota_*` API key format; the route validates the secret itself.
- `/api/sync-ota-listings` — called from the cron context.
- If a sync route is missing from PUBLIC_PATHS it silently returns 401 and never runs.

### Role access
- Roles in use: `admin`, `head`, `intern`, (others).
- Admin panel pages: accessible to all logged-in users; dangerous API actions (bootstrap-ota, api-keys CRUD) remain admin/head only.
- Status Config save: admin + head + intern allowed.
