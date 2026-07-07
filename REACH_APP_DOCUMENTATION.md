# Reach V2 — Complete App Documentation

> **Purpose of this file:** Single source of truth for all screens, features, DB tables, and navigation.
> Before any change request, Claude reads this file instead of re-scanning the codebase.
> After completing any change, update the relevant section(s) here.

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Project Structure](#2-project-structure)
3. [Navigation & Routing](#3-navigation--routing)
4. [Screens Reference](#4-screens-reference)
5. [Features & Modules](#5-features--modules)
6. [Database Schema](#6-database-schema)
7. [Backend API](#7-backend-api)
8. [External APIs & Keys](#8-external-apis--keys)
9. [Global State & Context](#9-global-state--context)
10. [User Roles & Permissions](#10-user-roles--permissions)
11. [Subscription Plans & Limits](#11-subscription-plans--limits)
12. [Key Files Index](#12-key-files-index)
13. [Change Log](#13-change-log)

---

## 1. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend framework | React + TypeScript | 19.2 / 5.8 |
| Build tool | Vite | 6.2 |
| Styling | Tailwind CSS | — |
| Animation | Framer Motion | — |
| Icons | Lucide React | — |
| Charts | Recharts | — |
| Maps | Leaflet | — |
| Tables | TanStack Table | — |
| Data fetching | TanStack Query | — |
| Drag & Drop | DnD Kit | — |
| File upload | React Dropzone | — |
| Database & Auth | Supabase (PostgreSQL + Auth + Realtime) | — |
| AI / LLM | Google Gemini 2.0 Flash | — |
| Backend API | FastAPI (Python) | — |
| Testing | Vitest + Playwright | — |

---

## 2. Project Structure

```
ReachV2/
├── src/                          # React/TypeScript frontend
│   ├── App.tsx                   # Root component — all global state (~1560 lines)
│   ├── index.tsx                 # React app entry point
│   ├── types.ts                  # All TypeScript interfaces & enums
│   ├── components/
│   │   ├── AppContent.tsx        # View dispatcher (routes ViewMode → component)
│   │   ├── auth/                 # Login screens
│   │   ├── admin/                # Admin & SysAdmin dashboards
│   │   ├── layouts/              # ModernOSLayout, ClassicLayout, Sidebar
│   │   └── features/             # All feature modules (screens)
│   │       ├── Insights/         # Analytics dashboard
│   │       ├── Map/              # Route map & sequence views
│   │       ├── Reports/          # Detailed reports (7 tabs)
│   │       ├── Optimizer/        # AI route optimizer
│   │       ├── Market/           # Market scanner / lead gen
│   │       ├── Customers/        # Customer management
│   │       ├── Users/            # User management
│   │       ├── Analyzer/         # AI data analyzer
│   │       ├── Pricing/          # Subscription & pricing
│   │       └── Referral/         # Partner program
│   ├── config/
│   │   └── constants.ts          # App settings, translations, i18n
│   └── services/
│       ├── supabase.ts           # All DB queries (~160 KB)
│       └── etlService.ts         # CSV upload / ETL pipeline
├── server_py/                    # FastAPI Python backend
│   ├── main.py                   # API endpoints
│   ├── analyzer_service.py       # Gemini AI analysis logic
│   ├── config.py                 # Config / env vars
│   └── requirements.txt
├── db/                           # SQL migration files
│   ├── schema.sql                # System-level schema (leads, plans, promos)
│   ├── supabase_schema.sql       # Main app schema
│   └── root_*.sql                # Additional migrations
├── index.html                    # HTML shell
├── vite.config.ts
└── REACH_APP_DOCUMENTATION.md    # ← THIS FILE
```

---

## 3. Navigation & Routing

### How routing works

There is **no URL-based router**. Navigation is driven by a `ViewMode` enum stored in React state (App.tsx). The current view is persisted in `localStorage` key `rg_v2_last_view`.

```
App.tsx  →  setView(ViewMode.XXXX)
         →  AppContent.tsx switches on ViewMode and renders the matching screen
```

### ViewMode enum values (all screens)

| ViewMode | Screen rendered | Notes |
|----------|----------------|-------|
| `LOGIN` | `/src/components/auth/Login.tsx` | Default unauthenticated state |
| `SYSADMIN_LOGIN` | `/src/components/auth/SysAdminLogin.tsx` | Hidden sysadmin entry |
| `DASHBOARD` | `features/Map/RouteSequence.tsx` | Main map view after login |
| `ROUTE_SEQUENCE_V2` | `features/Map/RouteSequenceV2.tsx` | Updated map view |
| `LEGACY_INSIGHTS` | `features/Insights/Insights.tsx` | Analytics dashboard v1 |
| `INSIGHTS_V2` | `features/Insights/InsightsV2.tsx` | Analytics dashboard v2 |
| `FULL_SUMMARY` | `features/Reports/DetailedReports.tsx` | 7-tab detailed report |
| `AI_SUGGESTIONS` | `features/Optimizer/AIOptimizer.tsx` | AI route optimizer |
| `MARKET_SCANNER` | `features/Market/MarketScanner.tsx` | Lead gen (legacy) |
| `SCANNER_V2` | `features/Market/ScannerV2.tsx` | Lead gen (active) |
| `CUSTOMERS` | `features/Customers/Customers.tsx` | Customer list & detail |
| `ANALYZE_DATA` | `features/Analyzer/AnalyzeDataModule.tsx` | AI file analyzer |
| `USER_MANAGEMENT` | `features/Users/UserManagement.tsx` | User CRUD |
| `ADMIN_DASHBOARD` | `/src/components/admin/AdminDashboard.tsx` | Data upload + history |
| `SYSADMIN_DASHBOARD` | `/src/components/admin/SysAdminDashboard.tsx` | System-wide controls |
| `PRICING` | `features/Pricing/Pricing.tsx` | Legacy pricing |
| `REACH_PRICING` | `features/Pricing/ReachPricing.tsx` | Active pricing page |
| `REFERRAL_HUB` | `features/Referral/PartnerProgram.tsx` | Affiliate dashboard |
| `LICENSE_SUMMARY` | `/src/components/admin/LicenseSummary.tsx` | License usage |

### Navigation guards (redirects)

| Condition | Redirect to |
|-----------|-------------|
| Not authenticated | `LOGIN` |
| `isSubscriptionLocked === true` | `REACH_PRICING` |
| `isLimbo && licenseRequestStatus === null` | `TenantSetupModal` (modal, no view change) |
| `licenseRequestStatus === 'LICENSE_REQUEST'` | `PendingLicenseScreen` (overlay) |

### UI Layouts

Two layouts are available; toggled by `uiMode` in user preferences:

| Layout | File | Description |
|--------|------|-------------|
| `modern` | `layouts/ModernOSLayout.tsx` | Desktop OS style — draggable windows, dock, sidebar |
| `classic` | `layouts/ClassicLayout.tsx` | Traditional tabbed interface |

Both layouts render the same `AppContent.tsx` internally.

---

## 4. Screens Reference

### 4.1 Login — `src/components/auth/Login.tsx`

**Purpose:** Authenticate user with email + password via Supabase Auth.

**Elements & Buttons:**
- Email input field
- Password input field
- "Sign In" button → calls `supabase.auth.signInWithPassword()`
- Link to pricing / request trial
- Language toggle (EN / AR)

**Post-login flow:** Sets `currentUser`, loads company, then routes to `DASHBOARD` or appropriate guard.

---

### 4.2 Admin Dashboard — `src/components/admin/AdminDashboard.tsx`

**Purpose:** Data upload, upload history management, and user management entry point for company admins.

**Tabs / Sections:**
1. **Upload Data** — CSV/Excel dropzone
   - Drag-and-drop file upload
   - Column mapping UI (`DataUploadConfirmation` modal)
   - Progress stepper (5 steps: branches → reps → routes → customers → visits)
   - Upload button
2. **Upload History** — table of past uploads
   - Columns: date, filename, rows, status, version tag
   - "Restore" button per row → sets `activeVersionId`
   - "Delete" button (admin only)
3. **Users** — shortcut to `USER_MANAGEMENT` view
4. **Settings** → opens `CompanySettingsModal`

**Buttons:**
- Upload / Confirm Upload
- Restore Version
- Delete Version
- Manage Users (navigates)
- Company Settings

---

### 4.3 Insights (v1) — `src/components/features/Insights/Insights.tsx`

**Purpose:** KPI analytics dashboard for route performance.

**Sections:**
- Filter bar: Region → Branch → Route → Week → Day
- KPI cards: total clients, active routes, coverage %, avg distance
- Route Health chart (Recharts bar)
- Alert badges for anomalies
- Refresh button

**Buttons:**
- Apply Filters
- Refresh Data
- Export (CSV)
- Navigate to Detailed Reports

---

### 4.4 Insights V2 — `src/components/features/Insights/InsightsV2.tsx`

**Purpose:** Enhanced analytics with improved UI and additional KPIs.

**Additions over v1:**
- Animated KPI cards (Framer Motion)
- Branch comparison charts
- Route efficiency heatmap
- Trend lines per metric

---

### 4.5 Detailed Reports — `src/components/features/Reports/DetailedReports.tsx`

**Purpose:** Comprehensive 7-tab report for deep analysis.

**Tabs:**
| # | Tab Name | Content |
|---|----------|---------|
| 1 | Data Quality | Missing GPS coords, null fields, validation issues |
| 2 | Hierarchy | Branch → Route → Rep tree visualization |
| 3 | Route Efficiency | Distance, time, client count KPIs per route |
| 4 | User Workload | Per-rep load analysis, balancing suggestions |
| 5 | Weekly Coverage | Day-by-day visit breakdown grid |
| 6 | Visit Frequency | How often each customer is visited |
| 7 | Route Summary | Aggregate metrics, top/bottom routes |

**Buttons:**
- Tab navigation (7 tabs)
- Filter (Region / Branch)
- Export Report (PDF / CSV)
- Back to Dashboard

---

### 4.6 Route Sequence (Map) — `src/components/features/Map/RouteSequence.tsx`

**Purpose:** Interactive map showing route paths, customer pins, and sequence order.

**Elements:**
- Leaflet map (full-screen)
- Customer pins (color-coded by route)
- Route polyline overlays
- Sidebar panel: route list, filter by branch/route
- Customer detail popup on pin click

**Buttons:**
- Toggle satellite / street view
- Filter Routes
- Reset View
- Export Map (screenshot)
- Sequence Editor (opens drag-reorder panel)

---

### 4.7 AI Route Optimizer — `src/components/features/Optimizer/AIOptimizer.tsx`

**Purpose:** Gemini-powered route optimization recommendations.

**Flow:**
1. Select branch / routes to optimize
2. Click "Analyze Routes" → sends data to Gemini
3. View before/after map comparison
4. Accept or reject suggestions
5. Apply changes → writes to DB

**Elements:**
- Before/After map split view (two `RouteSequenceV2` instances)
- Recommendation cards (distance saved, time saved)
- Accept All / Reject All buttons
- Per-route Accept / Reject toggle
- "Apply Changes" confirmation button

---

### 4.8 Market Scanner — `src/components/features/Market/ScannerV2.tsx`

**Purpose:** Identify unassigned customers / leads near existing routes.

**Elements:**
- Map with current customer pins
- Scan radius slider
- "Scan Area" button → calls Google Geolocation API
- Results panel: list of found leads
- Add to Route button per lead
- Export Leads (CSV)

**Limits:** Capped per subscription tier (Starter: 100 scans/mo, Growth: 500, Elite: unlimited).

---

### 4.9 Customers — `src/components/features/Customers/Customers.tsx`

**Purpose:** View and manage customer records.

**Elements:**
- Searchable / filterable table
- Columns: name, code, address, branch, route, rep, GPS, visit schedule
- Row actions: Edit, View on Map, Assign to Route
- Bulk actions: Export, Delete, Move to Route
- Add Customer button (form modal)
- Import CSV shortcut

---

### 4.10 User Management — `src/components/features/Users/UserManagement.tsx`

**Purpose:** CRUD for company users.

**Elements:**
- User table: name, email, role, branch/route assignment, status
- Add User button → form modal (name, email, role, branch)
- Edit User (inline or modal)
- Deactivate / Reactivate toggle
- Reset Password button
- Role selector: ADMIN, MANAGER, SUPERVISOR, USER, DRIVER

---

### 4.11 AI Data Analyzer — `src/components/features/Analyzer/AnalyzeDataModule.tsx`

**Purpose:** Upload any CSV/Excel file and get AI-generated insights via FastAPI + Gemini backend.

**Flow:**
1. Drop file → POST `/analyze` to FastAPI
2. Gemini analyzes headers + sample rows
3. Generates Python KPI computation code
4. Returns: KPI cards, insights, charts, executive summary, follow-up questions
5. User can ask follow-up questions → POST `/chat`

**Elements:**
- File dropzone
- "Analyze" button
- KPI cards grid
- Trend chart + distribution chart (Recharts)
- Insights text cards
- Executive summary section
- Follow-up question chips
- Chat input for custom questions

---

### 4.12 Pricing — `src/components/features/Pricing/ReachPricing.tsx`

**Purpose:** Show subscription plans and allow upgrade.

**Plans displayed:**
| Plan | Users | Routes | Customers | Market Scans |
|------|-------|--------|-----------|--------------|
| Starter | 5 | — | — | 100/mo |
| Growth | 10+ | — | — | 500/mo |
| Elite | Unlimited | Unlimited | Unlimited | Unlimited |

**Buttons:**
- Select Plan
- Apply Promo Code
- Contact Sales (Enterprise)
- Back / Continue

---

### 4.13 Partner / Referral Hub — `src/components/features/Referral/PartnerProgram.tsx`

**Purpose:** Affiliate partner dashboard for tracking referrals and commissions.

**Elements:**
- Referral link generator
- Stats: clicks, signups, conversions, earnings
- Promo code manager
- Payout history table
- "Share Link" button
- "Generate New Code" button

---

### 4.14 SysAdmin Dashboard — `src/components/admin/SysAdminDashboard.tsx`

**Purpose:** System-wide administration (Reach platform operator only).

**Sections:**
- **Companies** — list all tenants, activate/suspend, edit limits
- **Leads** — trial request management
- **Licenses** — license request queue (approve / reject)
- **Plans** — edit subscription plan definitions
- **Promo Codes** — create and manage discount codes
- **Normalized Upload** — upload data on behalf of any company
- **Duplicate Company** — clone a company's configuration

**Buttons:**
- Approve / Reject License
- Edit Company
- Create Promo Code
- Add Plan
- Upload for Company
- Duplicate Company

---

### 4.15 Modals (App-wide)

| Modal | Trigger | Purpose |
|-------|---------|---------|
| `CompanySettingsModal` | Admin → Settings | Branding, currency, feature toggles |
| `CompanyBrandingSettings` | Inside CompanySettingsModal | Logo, colors, white-label |
| `TenantSetupModal` | New company, no ID | Initial company configuration |
| `PendingLicenseScreen` | License requested, not approved | Waiting state with ticket number |
| `DataUploadConfirmation` | After CSV drop | Column mapping confirmation |
| `PasswordChangeModal` | User profile | Change password via Supabase Auth |
| `ConfirmDialog` | Any delete/destructive action | Generic yes/no confirmation |

---

## 5. Features & Modules

### 5.1 ETL Pipeline (CSV Upload)

**File:** `src/services/etlService.ts`

**Steps (in order):**
1. Parse CSV / Excel → detect if normalized or legacy format
2. Auto-detect column mapping via `autoDetectColumnMapping()`
3. User confirms column mapping in `DataUploadConfirmation` modal
4. On confirm → `processNormalizedCSVUpload()`:
   - Backup raw rows → `company_uploaded_data`
   - Upsert branches → `company_branches`
   - Upsert reps → `normalized_reps`
   - Upsert routes → `routes`
   - Upsert customers → `normalized_customers`
   - Insert visit schedule → `route_visits`
5. Create history log → `route_versions`
6. Update `activeVersionId` in company record
7. Roll back all on any failure

---

### 5.2 AI Route Analysis (FastAPI + Gemini)

**Files:** `server_py/main.py`, `server_py/analyzer_service.py`

1. Frontend POSTs file to `POST /analyze`
2. Backend extracts headers + 5 sample rows
3. Sends to Gemini 2.0 Flash with structured prompt
4. Gemini returns Python code to compute KPIs
5. Backend executes code on full DataFrame
6. Returns structured JSON: `{ kpi_cards, insights, charts, executive_summary, follow_up_questions }`
7. Frontend caches result; `/chat` allows follow-up Q&A

---

### 5.3 Real-time Subscriptions (Supabase)

Active realtime listeners in `App.tsx`:
- `app_users` → updates user list on change
- `route_versions` → reflects new uploads
- `companies` → tracks subscription/settings changes

---

### 5.4 Multi-tenancy

- All queries filtered by `company_id`
- RLS policies enforce tenant isolation at DB level
- `x-company-id` header used for backend calls
- SysAdmin bypasses RLS via service role key

---

### 5.5 White-label / Branding

- `BrandThemeContext` provides colors, logo URL, company name
- Overrides applied to sidebar, modals, login page
- Configured in `CompanyBrandingSettings` modal
- Stored in `companies.branding` JSONB column

---

## 6. Database Schema

### 6.1 Main App Tables (`supabase_schema.sql`)

#### `companies`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | text | Company display name |
| `subscription_tier` | text | `starter`, `growth`, `elite` |
| `max_users` | int | Plan limit |
| `max_routes` | int | Plan limit |
| `max_customers` | int | Plan limit |
| `market_scan_limit` | int | Monthly scan cap |
| `active_version_id` | uuid FK → route_versions | Currently active data version |
| `branding` | jsonb | Logo, colors, white-label config |
| `settings` | jsonb | Feature toggles, currency, distance units |
| `created_at` | timestamptz | |

#### `app_users`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `company_id` | uuid FK → companies | |
| `auth_user_id` | uuid FK → auth.users | Supabase Auth link |
| `name` | text | |
| `email` | text | |
| `role` | text | `ADMIN`, `MANAGER`, `SUPERVISOR`, `USER`, `DRIVER` |
| `branch_code` | text | Assigned branch |
| `route_name` | text | Assigned route (optional) |
| `is_active` | boolean | |
| `preferences` | jsonb | Theme, language, layout mode |
| `created_at` | timestamptz | |

#### `route_versions`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `company_id` | uuid FK | |
| `uploaded_at` | timestamptz | |
| `filename` | text | Original upload filename |
| `row_count` | int | |
| `status` | text | `active`, `archived` |
| `tag` | text | Optional label |

#### `company_branches`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `company_id` | uuid FK | |
| `branch_code` | text | Unique per company |
| `branch_name` | text | |
| `region` | text | |
| `version_id` | uuid FK → route_versions | |

#### `normalized_reps`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `company_id` | uuid FK | |
| `rep_code` | text | |
| `rep_name` | text | |
| `branch_code` | text | |
| `version_id` | uuid FK | |

#### `routes`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `company_id` | uuid FK | |
| `route_name` | text | |
| `branch_code` | text | |
| `rep_code` | text | Assigned rep |
| `version_id` | uuid FK | |

#### `normalized_customers`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `company_id` | uuid FK | |
| `client_code` | text | |
| `client_name` | text | |
| `address` | text | |
| `branch_code` | text | |
| `route_name` | text | |
| `latitude` | float | |
| `longitude` | float | |
| `version_id` | uuid FK | |

#### `route_visits`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `company_id` | uuid FK | |
| `customer_id` | uuid FK → normalized_customers | |
| `route_name` | text | |
| `week_number` | int | 1-4 |
| `day_of_week` | text | Mon–Fri |
| `visit_order` | int | Sequence within day |
| `version_id` | uuid FK | |

#### `company_uploaded_data`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `company_id` | uuid FK | |
| `version_id` | uuid FK | |
| `raw_data` | jsonb | Full CSV rows as JSON backup |
| `uploaded_at` | timestamptz | |

#### `customers` (legacy / denormalized)
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `company_id` | uuid FK | |
| `reach_customer_code` | text | Dedup key |
| `client_code` | text | |
| `client_name` | text | |
| `address` | text | |
| `branch_code` | text | |
| `route_name` | text | |
| `latitude` | float | |
| `longitude` | float | |
| `week_number` | int | |
| `day` | text | |
| `sequence` | int | |
| `version_id` | uuid FK | |

---

### 6.2 System Tables (`schema.sql`)

#### `reach_customers` — Trial / lead capture
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `email` | text | |
| `company_name` | text | |
| `phone` | text | |
| `plan_requested` | text | |
| `status` | text | `pending`, `approved`, `rejected` |
| `license_ticket` | text | Shown to user while waiting |
| `created_at` | timestamptz | |

#### `subscription_plans`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `name` | text | `starter`, `growth`, `elite` |
| `max_users` | int | |
| `max_routes` | int | |
| `max_customers` | int | |
| `market_scan_limit` | int | |
| `price_monthly` | numeric | |
| `price_yearly` | numeric | |

#### `promo_codes`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `code` | text | Unique promo code string |
| `discount_pct` | int | 0–100 |
| `affiliate_id` | uuid FK | |
| `max_uses` | int | |
| `current_uses` | int | |
| `expires_at` | timestamptz | |

#### `promo_usage_logs`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `promo_code_id` | uuid FK | |
| `company_id` | uuid FK | |
| `applied_at` | timestamptz | |
| `discount_amount` | numeric | |

#### `system_settings`
| Column | Type | Notes |
|--------|------|-------|
| `key` | text PK | Setting name |
| `value` | jsonb | Setting value |

---

### 6.3 Key Relationships Diagram

```
companies
  ├─→ app_users           (company_id)
  ├─→ route_versions      (company_id)
  │     ├─→ company_branches     (version_id)
  │     ├─→ normalized_reps      (version_id)
  │     ├─→ routes               (version_id)
  │     ├─→ normalized_customers (version_id)
  │     │     └─→ route_visits   (customer_id)
  │     └─→ company_uploaded_data(version_id)
  └─→ customers           (legacy, version_id)

subscription_plans
  └─→ promo_codes         (plan reference)
        └─→ promo_usage_logs
```

---

## 7. Backend API

**Base URL:** `http://localhost:8000` (configurable via env)
**Framework:** FastAPI (Python)
**Files:** `server_py/main.py`, `server_py/analyzer_service.py`

### Endpoints

#### `GET /health`
Returns service status, Gemini API configuration, and Supabase connection state.

**Response:**
```json
{
  "status": "ok",
  "gemini_configured": true,
  "supabase_connected": true
}
```

---

#### `POST /analyze`
Upload a CSV or Excel file for AI analysis.

**Request:** `multipart/form-data` with `file` field.

**Response:**
```json
{
  "domain": "sales_routes",
  "column_mapping": { "ClientName": "customer_name", ... },
  "kpi_cards": [
    { "title": "Total Customers", "value": 1240, "trend": "+5%" }
  ],
  "insights": ["Insight 1...", "Insight 2...", "Insight 3..."],
  "charts": {
    "trend": { "labels": [...], "values": [...] },
    "distribution": { "labels": [...], "values": [...] }
  },
  "executive_summary": "...",
  "follow_up_questions": ["Q1?", "Q2?", "Q3?"]
}
```

**Analysis pipeline:**
1. Extract headers + 5 sample rows
2. POST to Gemini 2.0 Flash with structured prompt
3. Gemini returns Python KPI computation code
4. Execute code on full DataFrame
5. Return structured result (cached in memory)

---

#### `POST /chat`
Ask a follow-up question about the last analyzed file.

**Request:**
```json
{ "question": "Which branch has the lowest efficiency?" }
```

**Response:**
```json
{ "answer": "Branch XYZ has the lowest efficiency at 62%..." }
```

---

## 8. External APIs & Keys

> **Quick rule:** To unlock both broken AI features, add a real `GEMINI_API_KEY` to `.env.local` and `server_py/.env`.

### Summary Table

| API | Key Required? | Working? | Used In |
|-----|:---:|:---:|---------|
| Supabase | ✅ Hardcoded fallback | ✅ Yes | All DB & Auth |
| Gemini (frontend) | ✅ Real key needed | ❌ No | AI Optimizer screen |
| Gemini (backend) | ✅ Real key needed | ❌ No | AI Analyzer screen |
| FastAPI (self-hosted) | No | ✅ Yes | AI Analyzer screen |
| Overpass API (OSM) | No — free | ✅ Yes | Market Scanner |
| Nominatim (OSM) | No — free | ✅ Yes | Add customer from scan |
| CARTO map tiles | No — free | ✅ Yes | All maps |
| OSM tiles | No — free | ✅ Yes | Map alternate layer |
| Google Maps links | No — URL links only | ✅ Yes | Navigate buttons |
| Google Favicon API | No — free | ✅ Yes | Company branding |
| Firebase | Hardcoded (dead code) | N/A | Not imported anywhere |

---

### API Detail Reference

#### A. Supabase
- **Purpose:** Core database, authentication, and real-time pub/sub for the entire app.
- **Env vars:** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- **Fallback:** Both hardcoded in `src/services/supabase.ts` — app connects even without `.env`.
- **File:** `src/services/supabase.ts` (~160 KB, all DB query functions)
- **Covers:** users, companies, routes, customers, branches, visits, history, promo codes, subscription plans, affiliates, real-time subscriptions.

#### B. Google Gemini — Frontend (AI Optimizer)
- **Purpose:** Route efficiency analysis and driver briefing generation inside the AI Route Optimizer screen.
- **Env var:** `GEMINI_API_KEY` in `.env.local` (injected as `process.env.API_KEY` by Vite config)
- **File:** `src/services/geminiService.ts`
- **Model:** `gemini-3-flash-preview`
- **Functions called:**
  - `generateDriverReport()` — short driver briefing (EN + AR) for a route
  - `analyzeEfficiency()` — coach-style efficiency analysis with day-by-day breakdown
- **Fallback:** Returns static placeholder text if key is missing — screen still renders.

#### C. Google Gemini — Backend (AI Data Analyzer)
- **Purpose:** Analyzes any uploaded CSV/Excel file — auto-generates KPI cards, insights, charts, executive summary, and enables follow-up Q&A chat.
- **Env var:** `GEMINI_API_KEY` in `server_py/.env`
- **Files:** `server_py/analyzer_service.py`, `server_py/config.py`
- **Model:** `gemini-2.0-flash`
- **Flow:** Frontend POSTs file → FastAPI → Gemini generates Python code → executes on DataFrame → returns structured JSON.
- **No fallback:** Returns HTTP 503 if key is missing.

#### D. FastAPI Backend (Self-Hosted)
- **Purpose:** Middleware server between the React frontend and Gemini for file analysis. Also caches results to Supabase.
- **Key required:** None — self-hosted.
- **URL:** `http://localhost:8000` (hardcoded in `AnalyzeDataModule.tsx` — needs env var for production)
- **Endpoints:**

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/health` | Status check — returns Gemini config + Supabase connection state |
| `POST` | `/analyze` | Upload file → AI analysis → returns KPIs, insights, charts |
| `POST` | `/chat` | Follow-up Q&A on the last analyzed file |

- **Start command:** `python3 -m uvicorn server_py.main:app --host 0.0.0.0 --port 8000 --reload`

#### E. Overpass API (OpenStreetMap)
- **Purpose:** Finds nearby retail businesses, shops, and stores on the map — this is the data source for the **Market Scanner** lead generation feature.
- **Key required:** None — completely free.
- **Endpoints (with automatic failover):**
  1. `https://lz4.overpass-api.de/api/interpreter`
  2. `https://z.overpass-api.de/api/interpreter`
  3. `https://overpass.kumi.systems/api/interpreter`
- **File:** `src/components/features/Market/MarketScanner.tsx`

#### F. Nominatim (OpenStreetMap Reverse Geocoding)
- **Purpose:** Converts GPS coordinates → readable address (street, district, city, Arabic name). Triggered when saving a lead from the Market Scanner.
- **Key required:** None — completely free.
- **Endpoint:** `https://nominatim.openstreetmap.org/reverse?format=json&lat=...&lon=...`
- **File:** `src/services/supabase.ts` → `reverseGeocode()` (private function inside `addCustomerFromScanner`)

#### G. CARTO Dark Map Tiles
- **Purpose:** Dark-themed map tile layer used as background in all Leaflet maps.
- **Key required:** None — free CDN.
- **URL:** `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png`
- **Used in:** RouteSequence, RouteSequenceV2, MarketScanner, ReachCommandMap (Insights), AIOptimizer

#### H. OpenStreetMap Tiles
- **Purpose:** Standard street map tile layer (lighter theme, alternate option).
- **Key required:** None — free.
- **URL:** `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`
- **Used in:** MapVisualizer, constants.ts map tile options

#### I. Google Maps Navigation Links
- **Purpose:** "Navigate" buttons that open Google Maps turn-by-turn directions to a customer's location in the browser. Not an API — just a URL format. No key needed.
- **URL format:** `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}`
- **Found in:** MarketScanner, ScannerV2, RouteSequenceV2, SysAdminLeads, MapVisualizer

#### J. Google Favicon API
- **Purpose:** Auto-fetches a company logo by entering their website domain in the Company Branding Settings screen.
- **Key required:** None — free Google service.
- **URL:** `https://www.google.com/s2/favicons?domain={domain}&sz=256`
- **File:** `src/components/CompanyBrandingSettings.tsx`

#### K. Firebase (Dead Code — Not Used)
- **Purpose:** Was the original database before migration to Supabase. Fully replaced.
- **Status:** `src/services/firebase.ts` exists with a hardcoded API key but is **not imported anywhere** in the app.
- **Action:** Safe to delete. Do not add new code that uses it.

---

### How to Enable Missing API Features

```bash
# 1. Add real Gemini key to frontend (.env.local)
GEMINI_API_KEY=your_real_gemini_key_here

# 2. Add real Gemini key to backend
echo "GEMINI_API_KEY=your_real_gemini_key_here" > server_py/.env

# 3. Start both servers
npm run dev                                                    # frontend → http://localhost:3001
python3 -m uvicorn server_py.main:app --port 8000 --reload    # backend  → http://localhost:8000
```

---

## 9. Global State & Context

All managed in `src/App.tsx`:

| State variable | Type | Purpose |
|---------------|------|---------|
| `currentUser` | `AppUser \| null` | Logged-in user record |
| `currentCompany` | `Company \| null` | Company/tenant record |
| `allCustomers` | `Customer[]` | Loaded customer records |
| `users` | `AppUser[]` | All company users |
| `uploadHistory` | `RouteVersion[]` | Upload version list |
| `activeVersionId` | `string \| null` | Currently active data version |
| `currentFilters` | `FilterState` | Region / Branch / Route / Week / Day |
| `isDarkMode` | `boolean` | Theme toggle |
| `uiMode` | `'classic' \| 'modern'` | Layout switch |
| `isAiTheme` | `boolean` | Futuristic AI theme overlay |
| `language` | `'en' \| 'ar'` | UI language |
| `isUploading` | `boolean` | Upload in progress flag |
| `uploadOverallProgress` | `number` | 0–100 progress |
| `uploadSteps` | `UploadStep[]` | Per-step status for progress stepper |
| `uploadError` | `string \| null` | Upload error message |
| `isPwdModalOpen` | `boolean` | Password change modal |
| `isCompanySettingsOpen` | `boolean` | Company settings modal |

**Context Providers:**
- `ToastProvider` → `useToast()` — toast notifications
- `ConfirmProvider` → `useConfirm()` — confirmation dialogs
- `BrandThemeContext` → `useBrandTheme()` — white-label colors/logo

---

## 10. User Roles & Permissions

| Role | Can Upload Data | Can Manage Users | Can See All Branches | Can Access SysAdmin |
|------|:-:|:-:|:-:|:-:|
| `ADMIN` | ✅ | ✅ | ✅ | ❌ |
| `MANAGER` | ❌ | ❌ | ✅ (own branches) | ❌ |
| `SUPERVISOR` | ❌ | ❌ | Own branch only | ❌ |
| `USER` | ❌ | ❌ | Own route only | ❌ |
| `DRIVER` | ❌ | ❌ | Own route only | ❌ |
| `SYSADMIN` | ✅ (any company) | ✅ (any company) | ✅ All | ✅ |

SysAdmin is a separate auth flow (`SYSADMIN_LOGIN`) authenticated via env secret, not via regular Supabase Auth.

---

## 11. Subscription Plans & Limits

| Feature | Starter | Growth | Elite |
|---------|---------|--------|-------|
| Max users | 5 | 10+ (configurable) | Unlimited |
| Market scans / month | 100 | 500 | Unlimited |
| Routes | — | — | Unlimited |
| Customers | — | — | Unlimited |
| AI Optimizer | ✅ | ✅ | ✅ |
| Market Scanner | Limited | Extended | Unlimited |
| White-label branding | ❌ | ❌ | ✅ |
| Priority support | ❌ | ❌ | ✅ |

Limits enforced in:
- DB column `companies.max_users`, `companies.market_scan_limit`, etc.
- Frontend checks before allowing actions (upload, invite user, scan)
- `isSubscriptionLocked` flag computed in `App.tsx` when limits exceeded

---

## 12. Key Files Index

| File | Lines | What it does |
|------|-------|-------------|
| `src/App.tsx` | ~1560 | Root component, all global state, auth, subscriptions |
| `src/components/AppContent.tsx` | ~400 | ViewMode → component dispatcher |
| `src/types.ts` | — | All TypeScript interfaces and enums |
| `src/config/constants.ts` | — | App settings, i18n strings |
| `src/services/supabase.ts` | ~160KB | All database query functions |
| `src/services/etlService.ts` | — | CSV upload / ETL pipeline |
| `src/components/layouts/ModernOSLayout.tsx` | — | Desktop OS-style UI shell |
| `src/components/layouts/ClassicLayout.tsx` | — | Traditional tabbed UI shell |
| `src/components/layouts/Sidebar.tsx` | — | Navigation menu (role-based) |
| `src/components/features/Insights/Insights.tsx` | — | Analytics dashboard v1 |
| `src/components/features/Insights/InsightsV2.tsx` | — | Analytics dashboard v2 |
| `src/components/features/Reports/DetailedReports.tsx` | — | 7-tab detailed report |
| `src/components/features/Map/RouteSequence.tsx` | — | Route map (Leaflet) |
| `src/components/features/Map/RouteSequenceV2.tsx` | — | Route map v2 |
| `src/components/features/Optimizer/AIOptimizer.tsx` | — | AI route optimizer |
| `src/components/features/Market/ScannerV2.tsx` | — | Market scanner |
| `src/components/features/Customers/Customers.tsx` | — | Customer management |
| `src/components/features/Users/UserManagement.tsx` | — | User CRUD |
| `src/components/features/Analyzer/AnalyzeDataModule.tsx` | — | AI file analyzer |
| `src/components/features/Pricing/ReachPricing.tsx` | — | Subscription pricing |
| `src/components/features/Referral/PartnerProgram.tsx` | — | Affiliate hub |
| `src/components/admin/AdminDashboard.tsx` | — | Admin upload & history |
| `src/components/admin/SysAdminDashboard.tsx` | — | Platform-level admin |
| `server_py/main.py` | — | FastAPI endpoints |
| `server_py/analyzer_service.py` | — | Gemini AI analysis |
| `db/schema.sql` | — | System tables schema |
| `db/supabase_schema.sql` | — | Main app tables schema |

---

## 13. Change Log

> Update this section whenever a change is made. Format: `[Date] — Description`

| Date | Change | Files affected |
|------|--------|---------------|
| 2026-04-28 | Initial documentation created | This file |
| 2026-04-28 | Full app audit: 0 TypeScript errors in src/, build passes (2948 modules). Both servers verified healthy. Known limitation: `GEMINI_API_KEY=PLACEHOLDER_API_KEY` — AI Optimizer and AI Analyzer won't work until a real key is added. | `src/components/features/Insights/ReachCommandMap.tsx`, `.env.local` |
| 2026-04-28 | Added Section 8: External APIs & Keys — full reference of all 11 APIs, key requirements, working status, files, and setup commands. | `REACH_APP_DOCUMENTATION.md` |

---

| 2026-04-29 | Auth & Onboarding UX overhaul — 20 issues fixed: registration form moved to right panel (mobile visible), splash reduced to 1.5s + tap-to-skip, email placeholder fixed, password rows separated, job role changed to select, ToS checkbox added, ambiguous selector shows readable ID, "Become a Partner" demoted to footer link, PlanInclusions now plan-specific, "Best Value" badge no longer hardcoded, plan features no longer sliced, "Get Contact" renamed "Talk to Sales", min-users tooltip improved, PendingLicenseScreen shows reference number + 24h timeline + support email + fixed scan-line animation | `src/components/auth/Login.tsx`, `src/components/TenantSetupModal.tsx`, `src/components/PendingLicenseScreen.tsx` |

| 2026-04-29 | DB audit: no schema changes required for UX fixes. Fixed 2 code bugs: `is_popular` now reads from `plan.ui_config.isPopular`, currency now uses `detectUserCountry()` instead of hardcoded `'SA'`. Optional migration `db/add_license_ticket.sql` added for proper ticket numbers on license requests. | `src/components/TenantSetupModal.tsx`, `db/add_license_ticket.sql` |

| 2026-04-29 | SysAdmin portal full audit & redesign: (1) Created `SysAdminShared.tsx` — unified design system with `PageHeader`, `StatCard`, `SysCard`, `EmptyState`, `ConfirmModal`, `InlineBanner`, `StatusBadge`, `BTN`, `INPUT_CLS`, `TABLE_CLS`. (2) Overview: real leads count from `getGlobalReachLeads(1,1).count`, health dots tied to live `connectionStatus`, `StatCard`/`SysCard` applied. (3) Customers: removed `adminPass:'123'` defaults, fixed "DB Size" → "Last Upload" column label, replaced password delete modal with `ConfirmModal`, `alert()` → `InlineBanner`. (4) Leads: replaced password-gated "Clear All" and "Delete" overlays with `ConfirmModal`. (5) LicenseRequests: replaced `window.confirm()` reject flow with state-based `ConfirmModal`, removed hardcoded `'123'`/`'sysadmin'` password checks from delete + manage modals, fixed admin password `type="text"` → `type="password"`. (6) Plans: replaced password delete modal with `ConfirmModal`, `alert()` → state banner. (7) Promos: replaced `confirm()` delete with `ConfirmModal`, `alert()` → toast notification. (8) Affiliates: removed hardcoded `usage_count * 50` earnings estimate, `alert()` → `InlineBanner`, applied `PageHeader`. | `src/components/admin/SysAdmin/SysAdminShared.tsx` (new), `SysAdminOverview.tsx`, `SysAdminCustomers.tsx`, `SysAdminLeads.tsx`, `SysAdminLicenseRequests.tsx`, `SysAdminPlans.tsx`, `SysAdminPromos.tsx`, `SysAdminAffiliates.tsx` |
| 2026-05-14 | **PWA deep dive added to ROADMAP.md** — full discussion of the Mobile PWA initiative (item #2 on the roadmap): plain-English explainer, day-in-the-life walkthroughs for rep and supervisor, 4-phase breakdown, stack alignment audit, honest iOS limitations, PWA vs Native vs Capacitor comparison, per-phase cost recap. Phase 1 locked: read-only scope · roles USER/DRIVER/SUPERVISOR · Elite tier gate · `/m/*` routes inside existing app · supervisor schedule viewer included (limited until Phase 2 ships live data) · placeholder icon to be generated. 11-item build list with 10-day timeline. **No code written yet** — awaiting go-ahead. | `ROADMAP.md` |
| 2026-05-14 | **Product roadmap created** (`ROADMAP.md`) — 24-item feature backlog with effort/cost/revenue ratings, monthly cost projections per growth phase, recommended shipping order, and a plain-English glossary (PWA, VRP, VROOM, OR-Tools, Capacitor). Identifies the two existential gaps to close first: (a) replacing Gemini-as-advisor with a real VRP solver in [src/components/features/Optimizer/AIOptimizer.tsx](src/components/features/Optimizer/AIOptimizer.tsx) so the product lives up to its name, and (b) a mobile PWA layer for field reps. Items 1-5 in the shipping order deliver a real route-optimization product on phones with Excel integration in ~3 weeks of work and $0 added recurring cost. | `ROADMAP.md` (new) |
| 2026-05-14 | **SYSADMIN UX & SAFETY POLISH** — capstone of the 2026-05-14 sysadmin/security overhaul. **DB cleanups:** (a) Migration v1 FK types fixed — all `company_id` columns are `text` (matching `companies.id`), not `uuid`. (b) `active_user_sessions` view rewritten — `DISTINCT ON (auth_user_id)` so each user appears as one row regardless of how many browser sessions they have; adds `session_count`, `is_sysadmin`, `is_blocked`. (c) New `blocked_users` view lists banned accounts. (d) `subscription_enforcement_status` view now reads limits from `subscription_plans.limits` JSONB (case-insensitive join) and counts `routes`/`normalized_customers` by `is_active = true` (the schema has no `version_id` columns). **Auth correctness:** backend now verifies Supabase JWTs via **JWKS (ES256/RS256)** — modern asymmetric signing keys — falling back to legacy HS256 only if `SUPABASE_JWT_SECRET` is set. Caller's JWT is forwarded to Supabase via `postgrest.auth(token)` so RLS policies evaluate as the authenticated user. Added `cryptography>=42.0` to requirements. **Owner bootstrap:** one-shot SQL block creates the Supabase Auth user with bcrypt-hashed password (`crypt(... gen_salt('bf'))`), inserts the `auth.identities` record, and promotes them to `OWNER` in `public.sysadmins` — idempotent. **Force logout fix:** the FastAPI `auth.admin.sign_out()` path was failing with "invalid JWT" because that method expects a JWT not a UUID. Replaced with `sysadmin_force_logout(uuid)` — a `SECURITY DEFINER` PL/pgSQL RPC that verifies `sysadmin_has_permission('force_logout')` and deletes from `auth.sessions`. No service-role key required. **Block / Unblock users:** new RPC `sysadmin_set_user_blocked(uuid, boolean)` toggles `auth.users.banned_until` between `'9999-12-31'` and `NULL`; blocking also revokes live sessions. Wired to a new `POST /sysadmin/block-user` endpoint and a `[Block] / [Unblock]` button per row in the Sessions tab. **Smart 2-level nav:** 16 flat tabs collapsed into 6 sections (Overview · Tenants · Growth · Billing · Usage · System) with sub-tab pills shown only when a section has more than one entry. Permission filtering preserved — empty sections vanish. **Licenses tab reordered:** Active Licenses sits to the left and is the default view; Request Queue follows. **Action required:** run in order: `migration_sysadmin_security_v1.sql` (v1, with FK fix), `migration_sysadmin_roles_v2.sql` (v2), `migration_sessions_view_v3.sql` (v3), `migration_force_logout_rpc_v4.sql` (v4), `migration_block_user_v5.sql` (v5). Then set `SUPABASE_URL`, `SUPABASE_KEY` (anon key), and optional `SUPABASE_SERVICE_ROLE_KEY` in `server_py/.env`. JWT verification is automatic via JWKS at `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` — no JWT secret needed. | `db/migration_sysadmin_security_v1.sql` (FK types fixed), `db/migration_sessions_view_v3.sql` (new), `db/migration_force_logout_rpc_v4.sql` (new), `db/migration_block_user_v5.sql` (new), `server_py/security.py` (JWKS), `server_py/sysadmin_routes.py` (force_logout RPC, block endpoint), `server_py/requirements.txt` (cryptography), `server_py/.env`, `src/services/sysadminApi.ts` (blockUser, SysAdmin role/permissions types), `src/components/admin/SysAdminDashboard.tsx` (2-level nav), `src/components/admin/SysAdmin/SysAdminLicenseRequests.tsx` (Active Licenses first), `src/components/admin/SysAdmin/SysAdminObservability.tsx` (session dedup + Block/Unblock buttons) |
| 2026-05-14 | **SYSADMIN RBAC (Roles + Permissions).** Added a proper role-based access control system on top of the `sysadmins` table introduced earlier today. **DB migration `db/migration_sysadmin_roles_v2.sql`**: extends `sysadmins` with `role` (enum: owner/admin/support/billing/security), `permissions` JSONB overrides, `invited_by`, `invited_at`; unique index enforces at most one `owner`; trigger blocks deleting/demoting/deactivating the owner unless ownership is transferred; helper functions `sysadmin_role_defaults(role)`, `sysadmin_has_permission(perm)`, `sysadmin_effective_permissions(auth_user_id)`. RLS on `sysadmins` now permits write only with `manage_sysadmins` permission. **Backend**: `security.py` loads role + effective permissions into `AuthContext` and exposes a `require_permission("...")` Depends factory; every privileged endpoint in `sysadmin_routes.py` migrated from generic sysadmin check to a specific permission gate (`view_usage`, `view_audit_log`, `force_logout`, `resolve_errors`, `set_feature_flags`, `manage_sysadmins`); new endpoints `GET /sysadmin/team`, `POST /sysadmin/team/invite`, `PATCH /sysadmin/team/:id`, `DELETE /sysadmin/team/:id` — invite requires the target to already have a Supabase Auth account; ownership transfer auto-demotes the prior owner to admin. **Frontend**: new `SysAdminTeam.tsx` screen — list, invite, edit (role, per-permission overrides, MFA, active), delete; **`SysAdminDashboard.tsx`** now fetches `verify` once on mount and filters tabs by the caller's effective permissions, shows the operator's name + role badge (👑 crown for owner) in the header; new `services/sysadminApi.ts` exports `SysAdminRole`, `Permission`, `Permissions`, `TeamMember`, `ALL_PERMISSIONS`, full Team CRUD. Permissions are enforced **server-side regardless of UI** — the frontend hides tabs, the backend rejects (403) any direct calls to gated endpoints. | `db/migration_sysadmin_roles_v2.sql` (new), `server_py/security.py`, `server_py/sysadmin_routes.py`, `src/services/sysadminApi.ts`, `src/components/admin/SysAdminDashboard.tsx`, `src/components/admin/SysAdmin/SysAdminTeam.tsx` (new) |
| 2026-05-14 | **SECURITY & SYSADMIN PORTAL EXPANSION.** Critical security fixes + 7 new sysadmin tabs, all DB-backed. **Security:** (a) SysAdmin login moved off hardcoded `'Moamen224!'` client-side credentials onto Supabase Auth + `sysadmins` table check; backend `/sysadmin/verify` enforces role via JWT. (b) Backend CORS locked to allowlist (`CORS_ALLOWED_ORIGINS` env, default `localhost:3001/5173`). (c) `/analyze` and `/chat` now require Bearer JWT; `user_id`/`company_id` derived from JWT (no longer trusted from form). (d) Gemini `exec()` sandboxed — restricted builtins, forbidden-token static scan (os/subprocess/eval/open/etc.), 15s SIGALRM timeout. (e) Removed hardcoded Supabase anon key fallback from `src/services/supabase.ts` and `server_py/main.py` — now fails closed without env vars. (f) `localStorage.rg_v2_user` now stripped of password/token fields via `persistUserSafe()`. (g) Backend `/sysadmin/login` rate-limited: 5 failures / 15 min / IP → lockout (uses `sysadmin_login_attempts` table). **DB migration `db/migration_sysadmin_security_v1.sql`** adds: `sysadmins`, `sysadmin_audit_log`, `gemini_usage_logs`, `market_scan_logs`, `system_error_log`, `sysadmin_login_attempts`, `company_feature_flags`, helper `is_sysadmin()`, and views `active_user_sessions`, `market_scan_monthly_usage`, `subscription_enforcement_status`. RLS locks all new tables to sysadmin reads + tenant inserts. **SysAdmin Portal +7 tabs in `SysAdminObservability.tsx`:** API Usage (Gemini cost/tenant), Scanner Usage, Upload Audit (cross-tenant `route_versions`), Sessions (with force-logout), System Log (errors + audit), Enforcement (limit breaches), Security Center (sysadmin accounts + login attempts). Dashboard tabs grouped into Business / Observability / Security with visual dividers. **Logging hooks:** `geminiService.generateDriverReport`/`analyzeEfficiency` and `ScannerV2.handleScan` now log to the DB via `src/services/usageLogger.ts`. Backend `/analyze` + `/chat` log success/failure to `gemini_usage_logs` and errors to `system_error_log`. **Action required:** (1) Run `db/migration_sysadmin_security_v1.sql` in Supabase. (2) Create a Supabase Auth user for yourself, then run the seed `INSERT INTO sysadmins ...` at bottom of the migration. (3) Set `SUPABASE_JWT_SECRET` in `server_py/.env` (from Supabase → Project Settings → API → JWT Secret). (4) Rotate the leaked Gemini key in Google Cloud Console. | `db/migration_sysadmin_security_v1.sql` (new), `server_py/main.py`, `server_py/security.py` (new), `server_py/sysadmin_routes.py` (new), `server_py/analyzer_service.py`, `server_py/requirements.txt`, `src/services/supabase.ts`, `src/services/sysadminApi.ts` (new), `src/services/usageLogger.ts` (new), `src/services/geminiService.ts`, `src/App.tsx`, `src/components/admin/SysAdminLogin.tsx`, `src/components/admin/SysAdminDashboard.tsx`, `src/components/admin/SysAdmin/SysAdminObservability.tsx` (new), `src/components/features/Market/ScannerV2.tsx`, `.env.local` |

| 2026-04-29 | SysAdmin CRM redesign + design consistency pass: (1) Registration form now collects Company Name — passed to `supabaseSignUp` metadata and `registerGlobalUser`, stored in `reach_customers.company_name` on signup. (2) `SysAdminUsers.tsx` (Reach CRM) full redesign: `PageHeader` + 4 `StatCard`s (total/leads/pending/provisioned), filter tabs, search by name/email/company/country, column layout with company name prominently shown, hardcoded-password delete → `ConfirmModal`, indigo theme replacing pink. (3) `SysAdminLeads.tsx` design consistency: pink → indigo throughout (header, buttons, row highlights, sort icons, checkboxes), `PageHeader` added, table container matches shared style. (4) `SysAdminLicenseRequests.tsx` consistency: replaced all CSS-variable references (`text-muted`, `bg-panel`, `border-main`, `text-brand-primary`) with explicit Tailwind tokens, `PageHeader` added, activation wizard uses indigo accent. | `src/components/auth/Login.tsx`, `src/services/authService.ts`, `src/services/supabase.ts`, `src/components/admin/SysAdmin/SysAdminUsers.tsx`, `SysAdminLeads.tsx`, `SysAdminLicenseRequests.tsx` |

| 2026-04-29 | **Security fix — localStorage session validation:** Deleted users could re-enter the app without logging in because `App.tsx` restored `currentUser` from `localStorage` without verifying the account still exists in the database. Fix: added `isValidatingSession` state + a one-time `useEffect` on mount that calls `supabase.auth.getSession()` and cross-checks the user record in `app_users`; if the record is missing, `handleLogout()` is called automatically. While validating, the existing animated "Verifying Session..." splash screen is shown. Network errors fail-safe (offline users are not logged out). | `src/App.tsx` |

| 2026-04-29 | **Fix: activated users now go to dashboard.** After SysAdmin activates a license, the original registered user's `app_users` record is now updated with the new `company_id` and `role: admin` inside `provisionDemoCompany` (using `lead.linked_user_id`). Session validation in `App.tsx` now fetches fresh `app_users` data on mount and updates `currentUser`/`currentCompany` state — so a returning user gets their new `companyId` without re-login. Added a `'provisioned'` case in the limbo block that shows a congratulations screen ("Your License is Activated!") with a "Go to Dashboard" button instead of showing `TenantSetupModal`. | `src/services/supabase.ts`, `src/App.tsx` |

| 2026-04-29 | **Fix: "Go to Dashboard" now works after license activation.** Root causes: (1) `registerGlobalUser` never sets `auth_user_id` on `app_users`, so the previous session validation queried by `auth_user_id` and got null → triggered logout. Fix: extracted `refreshUserFromDB(userId, email)` helper that queries by ID first, falls back to email — works regardless of whether `auth_user_id` is set. (2) "Go to Dashboard" button called `window.location.reload()` which re-ran session validation and could still fail. Fix: button now calls `refreshUserFromDB` directly, gets the updated `company_id`, sets state, and navigates to `ViewMode.DASHBOARD` in-place — no reload needed. Session validation also now uses `refreshUserFromDB` for both Supabase Auth and legacy auth paths. | `src/App.tsx` |

| 2026-04-29 | **Self-healing for already-provisioned users + email fallback in `provisionDemoCompany`.** Users activated *before* the linkage fix had `app_users.company_id = null` even though `reach_customers.status = 'provisioned'` — so "Go to Dashboard" did nothing. Two changes: (1) `provisionDemoCompany` now resolves the user to link via `linked_user_id` *or* email lookup before updating `app_users`. The standalone admin fallback only fires if neither lookup matches. (2) "Go to Dashboard" button now self-heals: if `app_users.company_id` is still null after refresh, it queries `reach_customers` by email, looks up the matching company by name, and updates the user's `company_id` directly — then navigates. If the heal fails, an explicit error toast is shown instead of an infinite reload loop. | `src/services/supabase.ts`, `src/App.tsx` |

| 2026-04-29 | **RouteSequenceV2 fixes:** (1) Filter dropdown no longer clipped by other content — removed `overflow-hidden` from the gradient border wrapper (it was cutting the dropdown at its parent boundary even though the dropdown had `z-[5000]`). (2) Removed print icon and `window.print()` button from Mission Brief header. (3) Added `InfoTooltip` to all major cards: Efficiency Gauge ("composite score formula + thresholds"), Stops / Distance / Shift stats, Coverage bar, Mission Brief header, Sequence Timeline header, Stop-by-Stop Manifest header, Distance Flow chart header. | `src/components/features/Map/RouteSequenceV2.tsx` |

| 2026-04-29 | **RouteSequenceV2 — portal tooltips + Nearby panel:** (1) Replaced CSS `group-hover` `InfoTooltip` with a `createPortal`-based version that renders at `document.body` with `position:absolute` — never clipped by `overflow-hidden` parents. Tooltip positions itself above the trigger using `getBoundingClientRect()`. (2) `MicroKpi` now accepts `onClick`/`clickable` props — shows a "tap" badge when clickable. (3) Added inline haversine + `nearbyPairs` computation (sorted by distance). (4) Nearby card is now clickable — opens a full modal listing every nearby customer pair with names, route context, and distance badge (meters or km). Modal has header, threshold note, scrollable list, and closest/farthest footer summary. (5) Updated tooltips on Drive, Serving, Nearby cards with more descriptive copy. | `src/components/features/Map/RouteSequenceV2.tsx` |

| 2026-04-29 | **Fix: "Nearby" recalculated as customer-to-depot distance (not customer-to-customer).** Previous logic counted customers near each other. Correct logic: a customer is "nearby" if their distance to the nearest configured branch depot is ≤ `nearbyRadiusMeters` from Company Settings. Uses existing module-level `haversineKm(lat,lng,lat,lng)` — no new dependencies. Nearby panel now shows: customer name, route/day/branch context, distance-from-depot badge, tap-to-focus-on-map, and a warning if no branch location is configured. | `src/components/features/Map/RouteSequenceV2.tsx` |

| 2026-04-29 | **RouteSequenceV2 promoted to live — replaces RouteSequence.** `AppContent.tsx`: both `ViewMode.DASHBOARD` and `ViewMode.ROUTE_SEQUENCE_V2` now render `RouteSequenceV2` (old `RouteSequence` import removed). `ModernOSLayout.tsx`: removed the separate "Route Sequence V2" nav tile; removed `ROUTE_SEQUENCE_V2` from the `under-development` group `memberIds`. The live "Route Sequence" tile (`ViewMode.DASHBOARD`) now opens the V2 experience. Old `RouteSequence.tsx` file kept but no longer referenced. | `src/components/AppContent.tsx`, `src/components/layouts/ModernOSLayout.tsx` |

| 2026-04-29 | **MarketScannerV2 (Under Development):** New screen `MarketScannerV2.tsx` created without modifying the original. Workflow: (1) User picks branch(es) — map auto-fits and shows existing customers as cyan dots. (2) User selects lead types from 11 categories: Retail, Grocery, Supermarket, Mini Market, Hyper Market, Pharmacy, Pet Shops, Clinics, Pet Clinics, Petrol Stations, Hospitals — each with its own Overpass QL fragment, icon, and brand color. (3) User clicks "Scan This Area" — fetches OSM data via Overpass mirrors, classifies each result into one of the selected categories, and renders color-coded markers. (4) **10m duplicate detection:** any lead within 10 meters of a customer gets a red ring + pulsing badge + "Already a customer" warning popup; popup notes which existing customer it overlaps. (5) Results panel: total / new / existing counts, "Hide existing" toggle, CSV export with status column (NEW_LEAD vs EXISTING_CUSTOMER). Wired in `types.ts` (`MARKET_SCANNER_V2`), exported via `components/index.ts`, rendered in `AppContent.tsx`, added to `ModernOSLayout` nav with Radar icon and grouped under `under-development`. | `src/types.ts`, `src/components/index.ts`, `src/components/AppContent.tsx`, `src/components/layouts/ModernOSLayout.tsx`, `src/components/features/Market/MarketScannerV2.tsx` (new) |

| 2026-04-29 | **MarketScannerV2 fixes — branches load + Locate Me.** (1) Branch dropdown was empty because it relied solely on `customer.regionDescription`, which is often blank. Now fetches real branches via `getBranches(companyId)` (same source as RouteSequenceV2). New props `companyId`, `userRole`, `userBranchIds` are passed from `AppContent`; restricted users see only their assigned branches. Customer→branch matching is robust: tries `regionDescription`, `regionCode`, `branch` against the branch's `name_en`, `code`, and `id`. Falls back to deriving branches from customer fields if DB returns empty. (2) Added Locate Me button — floating cyan→blue circular FAB at bottom-right with `LocateFixed` icon, spinner during geolocation, marker drop on the map. Wired through `MapHandler` with `locationfound` / `locationerror` listeners. Uses existing `createUserLocationIcon` from `services/mapIcons`. | `src/components/features/Market/MarketScannerV2.tsx`, `src/components/AppContent.tsx` |

| 2026-04-29 | **MarketScannerV2 — branch dropdown rendered via portal.** The branch dropdown was being covered by other floating panels because its parent container had `z-[20]` which created a stacking context that capped child `z-[5000]` against neighboring `z-[20]` elements. Fix: dropdown now renders via `createPortal` at `document.body` with `position: fixed` and `z-index: 999999`, positioned dynamically using `getBoundingClientRect()` on the trigger button. Repositions on window resize/scroll. Click-outside detection updated to ignore clicks inside the portal-rendered menu (`id="msv2-branch-menu"`). Empty-state copy added when no branches are returned. | `src/components/features/Market/MarketScannerV2.tsx` |

| 2026-04-29 | **MarketScannerV2 — route colors + auto-fit + scan feedback.** (1) Customers are now colored by `routeName` using a 20-color deterministic palette — same route = same color across the map and the popup. Marker size bumped from 5px to 6px with a dark stroke for contrast. (2) New "Routes" legend panel lists every route in scope with its colored dot, name, and customer count; clicking a row toggles that route's visibility on the map (greyed-out + transparent dot when hidden). "Show all" button restores everything. (3) Auto-fit map to scoped customers now runs with an 80ms debounce + `maxZoom: 14` so it doesn't over-zoom on tight clusters and re-runs when the branch selection changes. (4) Scan handler now distinguishes three "no result" cases: no leads found in area, all results already in the list, or plan limit truncation — each with its own actionable message. Customer scope counter shows visible/total + total routes. | `src/components/features/Market/MarketScannerV2.tsx` |

| 2026-04-29 | **MarketScannerV2 — Apply Filter button + DB-side customer fetch.** Customers were not appearing after branch selection because the prop-side filter relied on field-name matches (`regionDescription`/`regionCode`/`branch` ↔ branch's `name_en`/`code`/`id`) that don't always align with stored data. Fix: added an explicit "Apply Filter" button that calls `fetchRouteCustomersNormalized(companyId, { region: selectedBranches })` — same DB-side filter RouteSequenceV2 uses (joins through `routes.company_branches.name_en`). Server-fetched data takes priority over prop data; the prop-side filter remains as a fallback when filter hasn't been applied yet. Button shows three states: idle (Apply Filter, gradient), loading (spinner), applied (Re-fetch, emerald). Selecting a different branch resets the applied state. Empty results show specific messages: company-wide vs single-branch. | `src/components/features/Market/MarketScannerV2.tsx` |

| 2026-04-29 | **MarketScannerV2 — Arabic retail terms, distinct customers, no routes panel.** (1) Retail Overpass query expanded with three additional `nwr` clauses to match by `name`, `name:en`, and `name:ar` for transliterations + Arabic: `bakala`, `baqala`, `baqalah`, `baqaala`, `tamwinat`, `tamouinat`, `tamooinat`, `بقاله`, `بقالة`, `بقال`, `تموينات`, `تموينة`, `تموين`. Tag list also extended to include `variety_store`, `grocery`, `greengrocer`, `deli`. Grocery category got the same Arabic name boost. (2) Customer list now deduplicated by `clientCode` (then `id`, then `lat,lng` fallback) — `route_visits` joins can return the same customer multiple times for different days/weeks; only one marker per unique customer is rendered. (3) Removed the entire "Routes" legend panel (`hiddenRoutes` state, `toggleRoute`, `visibleScopedCustomers`, `routesInScope`) — left side is now branch filter + Apply Filter + Lead Types only. Route-based marker coloring is preserved. | `src/components/features/Market/MarketScannerV2.tsx` |

| 2026-04-29 | **MarketScannerV2 — Locate Me button stays visible.** The locate-me FAB was getting hidden behind tall side panels (Stats + Legend can extend most of the viewport). Fixes: (1) FAB switched from `absolute z-[20]` to `fixed z-[1500]` with bigger size (14×14, 6×6 icon) and stronger shadow so it always sits above any side panel. (2) Both side panels now have `max-h-[calc(100vh-32px)]` (left) / `max-h-[calc(100vh-110px)]` (right) with `overflow-y-auto` — they scroll internally instead of growing into the FAB's footprint. | `src/components/features/Market/MarketScannerV2.tsx` |

| 2026-04-29 | **MarketScannerV2 — fetch ALL customers (not just routed) + distinct counter card.** Apply Filter previously called `fetchRouteCustomersNormalized` which joins through `route_visits` and silently drops customers without a route assignment. Replaced with a direct paginated query against `normalized_customers` (filtered by `branch_id`, `is_active = true`), 1000-row chunks, max 50 pages = 50K customers safety bound. Same row mapping as `fetchCustomers` (joins `company_branches` and `route_visits` for display fields). After Apply Filter, the panel shows a 3-card mini-stat: **Fetched** (raw row count from DB), **Distinct** (unique by `clientCode`/`id`/lat-lng), **Routes** (count of distinct route names) — making it explicit how many real customers belong to the branch. Empty-state message updated. | `src/components/features/Market/MarketScannerV2.tsx` |

| 2026-04-29 | **MarketScannerV2 — FMCG-focused taxonomy + classifier bug fix.** Two issues addressed: (a) "Retail" category was missing FMCG-relevant `shop` tags (frozen_food, dairy, spices, water, coffee, tea, alcohol, beverages, tobacco, confectionery, ice_cream, pasta, food, etc.) and missed many Arabic/transliteration spellings. Retail Overpass query now includes 19 `shop` tags + four name-regex layers (generic, name:en, name:ar) covering bakala/baqala/baqalah/baqqala/tamwinat/tamween + Arabic spellings. (b) The classifier had a fixed priority list — a result tagged `shop=grocery` was always classified as "Grocery", so when the user selected ONLY "Retail / FMCG" those rows were silently dropped. Replaced with a candidate-list approach: every result builds an array of categories it COULD fit into (specific → general), and we pick the first one the user has actually selected. Added 6 new HoReCa categories: **Bakery** (Cake icon), **Butcher** (Beef), **Sweets/Confectionery** (Cookie), **Cafe** (Coffee), **Restaurant** (ChefHat), **Beverages** (CupSoda) — these are major FMCG distribution channels missing from the original list. | `src/components/features/Market/MarketScannerV2.tsx` |

| 2026-04-29 | **MarketScannerV2 — AI-powered lead intelligence.** (1) Channels: every category now belongs to one of 5 channels (Modern Trade, Traditional Trade, HoReCa, Healthcare, Other) shown as collapsible groups in the Lead Types panel. Each channel header has its own color/icon/multi-toggle. Two presets at the top: **⚡ All FMCG** (modern + traditional) and **☕ All HoReCa**. (2) Per-lead AI scoring: every result gets a `qualityScore` (0-100) computed from metadata richness (phone +18, address +12, bilingual +5), channel value (modern_trade 25 → other 10), route fit (in-radius 30 → far 0, duplicate capped at 35), name length bonus, and an `aiTags` array of human-readable insights ("Phone listed", "In existing route radius", "High-value channel"). (3) Suggested route + day: each non-duplicate lead is auto-assigned the route + day of its nearest existing customer — surfaced in the popup as "AI Suggestion: Add to Route X · Day Y". (4) AI Insights panel (right side, purple gradient): radial avg-quality score gauge, top channel + multi-color channel-mix bar, near-route vs new-territory split, best-fit route recommendation, highest-score lead spotlight. (5) Visible leads now sorted by qualityScore desc — best leads always at the top. (6) CSV export expanded with Channel, Quality Score, Suggested Route, Suggested Day, AI Tags columns. | `src/components/features/Market/MarketScannerV2.tsx` |

| 2026-04-29 | **MarketScannerV2 — exclude existing customers entirely (20m + name validation).** Per user requirement, leads matching an existing company customer are no longer flagged-and-shown — they're skipped completely. Two checks: (1) Geographic — distance ≤ 20m (was 10m). (2) Name validation — within a wider 100m radius, if the lead's name matches a customer's name (after normalization). Name normalization strips diacritics (Latin + Arabic), lowercases, removes generic FMCG stop-words (`supermarket`, `mart`, `بقالة`, `تموينات`, etc.) and matches by exact equality OR substring containment in either direction (catches "Tamimi" ↔ "Tamimi Markets"). Cross-language fields are checked too — name_en vs customer.nameAr and vice versa. Stats panel: removed "Existing" red counter; replaced with two-card grid (New Leads / Excluded) + a tooltip explaining the rule. Map legend updated. CSV export drops the duplicate column (no duplicates to export). | `src/components/features/Market/MarketScannerV2.tsx` |

| 2026-04-30 | **MarketScannerV2 — replaced AI Insights with My Leads picklist.** Per user request, the right-side AI Insights panel (avg quality gauge, channel mix, top route, top lead) is gone. New "My Leads" panel: each lead popup now has an "Add to List" / "Remove from List" toggle (green / red); selected leads show in a scrollable list with category icon, name, color-coded quality score, and suggested route. Two CSV exports: "Export All" (all scanned leads, in Stats card) and "Export" (selected leads only, in My Leads card — file `MyLeads_<date>.csv`). Trash button clears the saved list. New state `selectedLeads: Lead[]` + `toggleSelectLead` helper + `handleExportSelected`. `aiInsights` useMemo and unused `Compass` import removed. | `src/components/features/Market/MarketScannerV2.tsx` |

| 2026-04-30 | **MarketScannerV2 — compact one-screen layout.** Re-organized so all controls fit on a single screen without scrolling. Left panel narrowed 340 → 320px; Branch card now puts dropdown + Apply button on the same row (with eye-toggle inline); customer-count stats compacted to a 3-cell mini-row. Lead Types: 3-button quick-preset row (FMCG / HoReCa / All), 4-column grid, channel groups are now **collapsible** — HoReCa, Healthcare, Other collapsed by default; chevron rotates to indicate state. Right panel narrowed 280 → 260px and unified into one card containing Stats / My Leads / Legend separated by hairline dividers; legend itself is collapsible (closed by default). Scan button shrunk h-12 → h-10; Locate Me FAB 14×14 → 11×11; padding/typography reduced throughout (text-[10px] → text-[9px], p-3 → p-2). New state: `collapsedChannels: Set<Channel>`, `legendOpen: boolean`. | `src/components/features/Market/MarketScannerV2.tsx` |

| 2026-05-04 | **MarketScannerV2 — readability bump + AI Insights restored.** Right-column unified card resized 260 → 320px with bigger paddings (p-2 → p-3) and readable typography (7–9px → 9–11px); icons w-3 → w-4; stat tiles gained back text-xl numbers. AI Insights restored as a compact single-row block (avg-quality dial + top-channel label + Near/New micro-tiles + slim channel mix bar + best-fit route line). Lead Type cards enlarged: 4-col → 3-col grid, icon w-3 → w-5, label 7px → 10px, py-1.5 → py-2.5; channel headers bumped to 10px with 3.5px icons. | `src/components/features/Market/MarketScannerV2.tsx` |

| 2026-05-04 | **MarketScannerV2 promoted to live — replaces MarketScanner.** `AppContent.tsx`: `ViewMode.MARKET_SCANNER` and `ViewMode.MARKET_SCANNER_V2` both render `MarketScannerV2` now (old `MarketScanner` import removed). `ModernOSLayout.tsx`: removed the separate "Market Scanner V2" launcher tile; the live "Market Scanner" tile (`ViewMode.MARKET_SCANNER`) now uses the V2 Radar icon + cyan-purple-pink gradient and opens the V2 experience. `MARKET_SCANNER_V2` removed from the `under-development` group `memberIds` (only `INSIGHTS_V2` remains there). Old `MarketScanner.tsx` file kept but no longer referenced. | `src/components/AppContent.tsx`, `src/components/layouts/ModernOSLayout.tsx` |

| 2026-05-04 | **CompanySettingsV2 promoted to live — replaces CompanySettingsModal.** `ModernOSLayout.tsx`: the dashboard "Settings" tile now navigates to `ViewMode.COMPANY_SETTINGS_V2` (cyan-purple-pink gradient, full-screen V2 page) instead of triggering the old modal via `'COMPANY_SETTINGS'` string ID. Removed the standalone "Company Settings V2" tile and removed `COMPANY_SETTINGS_V2` from the `under-development` group `memberIds` (only `INSIGHTS_V2` remains). The legacy modal handler (`onOpenCompanySettings`, `setIsCompanySettingsOpen`) and `CompanySettingsModal.tsx` file are preserved but no longer reachable from the dashboard tile. | `src/components/layouts/ModernOSLayout.tsx` |

| 2026-05-04 | **AIOptimizerV2 — branch + excluded-routes as side-by-side dropdowns.** Replaced the horizontal pill-tab branch selector and the collapsible "Routes in Branch" exclusion panel with two compact dropdowns laid out in a 2-column grid above the KPI strip. **Branch** dropdown shows the active branch name + per-branch suggestion count badge; clicking opens a max-h-72 scrollable list of all branches each with their badge. **Excluded Routes** dropdown's button summarises state ("All routes available · 5 usable" or "{n} excluded · {m} usable") and surfaces a compact "Clear" button when anything is excluded; clicking opens a checkbox-style list (green check = included, red ✗ = excluded), with strike-through on excluded names and a one-line explainer at the top. Mutually-exclusive open behaviour: opening one closes the other. Click-outside handler (`data-dropdown` attribute on each wrapper) collapses both. Old standalone routes panel deleted. State changes: replaced `routesPanelOpen` with `branchDropdownOpen` + `routesDropdownOpen`. | `src/components/features/Optimizer/AIOptimizerV2.tsx` |

| 2026-05-04 | **AIOptimizerV2 — route pins on the proof map.** Replaced the small flat circle markers for day-cluster members with proper teardrop **pin markers** built via Leaflet `divIcon` + inline SVG. Two pre-built icons: `yellowDayPin` (current visit day) and `redDayPin` (suggested visit day) — each is a 22×30 teardrop with the route color, a 1.6px darker outline, a lighter inner dot, and a soft drop-shadow. The pins now visually read as route stops, making the two day-clusters instantly distinguishable on the map. Pin popups got "Stop #N" labels (1-indexed by member order) plus the day name and route. Verified: a sample suggestion renders 44 yellow pins + 28 red pins on the map (one per customer in each respective day's cluster). | `src/components/features/Optimizer/AIOptimizerV2.tsx` |

| 2026-05-04 | **AIOptimizerV2 — map proof scoped to the specific days only.** Per user follow-up: every visual on the proof map now represents *just* the customer's current visit day and the suggested visit day (not the whole route's customers). The data was already day-filtered (`currentRoutePath` and `suggestedRoutePath` both come from per-day `byDay` clusters); this change makes it explicit in the UI: legend reads `Current day: {currentDay}` / `Suggested day: {suggestedDay}` instead of generic route labels, plus a sub-line explainer "Showing only customers visited on each day". Member-dot popups and centroid popups now lead with "Current Visit Day" / "Suggested Visit Day" and show the day name + a calendar icon. Polyline click popups put the day at the top (`Day: Monday`) and append the time savings to the savings line (`−89.5 km · 6h 54m`). Side-panel `RouteBlock`s changed from listing all of a route's days to showing only the recommended day for that side of the comparison. | `src/components/features/Optimizer/AIOptimizerV2.tsx` |

| 2026-05-04 | **AIOptimizerV2 — exact-day recommendation + time savings + day-shift fallback.** Three rolled-up improvements per user feedback: (1) **Exact day** — every route now keeps a per-day cluster (`byDay: Map<dayName, { members, centroid }>`). For each customer, the recommendation finds the SPECIFIC day on the suggested route whose member-cluster centroid is closest to the customer; the customer's current distance is also computed against THEIR assigned day's cluster (more accurate than the route-wide centroid). The Suggestion now carries `currentDay` and `suggestedDay`, and the UI surfaces the specific day pill (e.g. "Monday") instead of a list. (2) **Time savings** — added `timeSavedHours` per suggestion using `(kmSaved × trafficFactor / avgSpeed) × 2` (round-trip detour avoided), with sane defaults `avgSpeed=35 km/h, trafficFactor=1.35`. New `formatHours` helper renders short forms ("6h 54m" / "45 min"). KPI strip now shows **TOTAL SAVINGS = X km · Yh Zm**. Suggestion card shows a small clock pill with hours saved. Detail drawer's stats grid expanded to 3 cells: km saved · time saved · priority badge. (3) **Day-shift competes with route-switch** — for each customer, candidate alternatives now include `DAY_SHIFT` options (same route, every day except the current day) alongside `ROUTE_SWITCH` options, all sorted by distance asc. Whichever wins becomes the recommendation. Suggestion type tagged via `type: 'ROUTE_SWITCH' \| 'DAY_SHIFT'`; new `SwapTypeBadge` component shows it. DAY_SHIFT card layout swaps the From/To pills to compare days only ("Same rep · Route X · Wednesday → Monday") since the route and rep don't change. Detail-drawer info text adapts: DAY_SHIFT reads "Just shifting the visit day saves more than switching reps. Keep the same rep but visit on {newDay} instead of {currentDay}." Result on ALHASSA branch: 99 → 58 sharper suggestions, 1181 km / 91h 7m total savings; example top suggestion saves 89.5 km / 6h 54m by visiting on Monday. | `src/components/features/Optimizer/AIOptimizerV2.tsx` |

| 2026-05-04 | **AIOptimizerV2 — yellow/red color scheme + clickable map lines.** Per user request: current-route visuals are now **yellow** (`#facc15` fill / `#fde047` outline / `#854d0e` deep) and suggested-route visuals are **red** (`#dc2626` / `#ef4444` / `#7f1d1d`). Updated everywhere — route-member dots, centroid halos, connection polylines (yellow dashed for current, red solid for suggested), distance pill labels (yellow with dark text, red with white text), legend dots, suggestion-card "From/To" pills, side-panel RouteBlock variants (`color: 'yellow' \| 'red'`). **Clickable proof:** every polyline and every member/centroid dot now has a `<Popup>` child — clicking the yellow dashed line shows current-assignment details (route name, rep, days, distance from customer); clicking the red solid line shows suggested-assignment details plus the savings line; clicking any dot identifies which route it belongs to. Legend gained a "Click any line for details" hint. Verified: clicking the red polyline opens a popup reading "Suggested Assignment · Route: ABDUL SAFWAN(35999089) · Days: Tuesday, Thursday, Wednesday, Monday, Sunday · Distance from customer: 41.9 km · Savings: −36.6 km closer". | `src/components/features/Optimizer/AIOptimizerV2.tsx` |

| 2026-05-04 | **AIOptimizerV2 — proof map fit fix.** The detail-drawer map was rendering at world zoom (Africa visible) because (1) `allPoints` only contained the customer + suggested-path so bounds were sometimes too narrow, and (2) Leaflet's container had zero size on first render inside the animated drawer, locking it at zoom 1. Fixed: `allPoints` now includes customer + both route centroids + all members of both routes, with a sanity filter that drops `(0,0)`, `NaN`, and out-of-range coords. `FitBounds` is two-phase — invalidates size + fits at 60ms (after the drawer's spring settles) and again at 320ms with `animate:true, maxZoom:14`. The map now reliably zooms to a frame where the user can compare the customer position against both routes. | `src/components/features/Optimizer/AIOptimizerV2.tsx` |

| 2026-05-04 | **AIOptimizerV2 — exclude-routes UI + redesigned proof map + dedupe.** Three improvements in response to user feedback: (1) **Exclude routes UI** — collapsible "Routes in Branch" panel above the filter bar lists every route with a green-include / red-exclude chip toggle. Each `Suggestion` now carries a top-5 `alternatives[]` array sorted by distance asc; when a route is excluded, the visible-suggestions memo recomputes the effective alternative on the fly (falls through to next-best non-excluded), so the live count and KMs reflect the picker. Per-branch state `excludedRoutes: Record<branchId, Set<routeName>>` with a Clear button. KPI cards "Suggestions Found" and "Total Km Savable" now reflect the visible (post-exclusion) values, not the raw analysis count. (2) **Map redesigned for clarity** — drawer now shows BOTH routes' members side-by-side: current route members in red, suggested route members in emerald; large faded centroid circles for each route; customer pin in cyan on top with bigger radius and 3px stroke; two connection polylines (red dashed customer→current, emerald solid customer→suggested); two pill-shaped distance labels (`xx.x km`) rendered as Leaflet `divIcon` Markers at the midpoint of each connection line; floating glass legend overlay at bottom of map showing color key + total km closer. (3) **Dedupe fix** — `fetchRouteCustomersNormalized` returns one row per `route_visit`, so the same customer appeared multiple times. Added a `seenCustomerIds` Set keyed by `id || clientCode || lat,lng` so each customer produces at most one suggestion. Result on ALHASSA branch: 988→988 (analyzed), 400 noisy duplicate-suggestions → 99 unique, 6028→1492.9 km savable. | `src/components/features/Optimizer/AIOptimizerV2.tsx` |

| 2026-05-04 | **AIOptimizerV2 (Under Development) — per-branch optimizer that respects route isolation.** New file `src/components/features/Optimizer/AIOptimizerV2.tsx`. Built from scratch with the user's three rules baked in: (1) **Branch isolation** — analysis runs per-branch, suggestions never cross branches; (2) **Exclude current route from options** — for each customer, we skip their current route and only score *other* routes in the same branch; (3) **Right route · right rep · right day** — the suggested route comes with its own day(s) and rep, surfaced inline. **Algorithm:** for each branch, fetch customers via `fetchRouteCustomersNormalized({ region: [branch.name_en] })` (which hydrates `routeName` and `day`), derive routes purely from those customers (avoids a separate broken `getNormalizedRoutes` join), compute each route's centroid as the mean of its members, then for every customer with a current route, scan all *other* routes in the same branch, pick the one whose centroid is closest to the customer; if `kmSaved = currentDist − bestAltDist > 2km`, surface a suggestion with priority HIGH (≥6km) / MEDIUM / LOW. **UI:** branch pill tabs (counter badge per branch), 4 KPI cards (Customers Analyzed / Routes / Suggestions / Total Km Savable), search + priority + sort filters, suggestion cards (from-route → to-route swap visual, kmSaved badge, mark-as-applied / dismiss / view-on-map quick actions), detail drawer with Leaflet map preview showing the customer + suggested route members + dashed connection line + side panel with two RouteBlocks (current vs suggested). State `appliedIds` / `dismissedIds` are local-only; persistence to `route_visits` left as a follow-up. Wired in `types.ts` (`AI_OPTIMIZER_V2`), exported via `components/index.ts`, rendered in `AppContent.tsx`, added to ModernOSLayout nav with amber-orange-rose gradient and grouped under `under-development` (now contains `INSIGHTS_V2` + `AI_OPTIMIZER_V2`). | `src/types.ts`, `src/components/index.ts`, `src/components/AppContent.tsx`, `src/components/layouts/ModernOSLayout.tsx`, `src/components/features/Optimizer/AIOptimizerV2.tsx` (new) |

| 2026-05-04 | **Reverted ModernOSLayoutV3 + removed Classic layout entirely.** Per user feedback the V3 redesign was rolled back: deleted `src/components/layouts/ModernOSLayoutV3.tsx`. Classic layout fully retired: deleted `src/components/layouts/ClassicLayout.tsx`, removed its export from `src/components/index.ts`, removed the `ClassicLayout` and `ModernOSLayoutV3` imports from `App.tsx` and replaced the layout-mode ternary with a single `<ModernOSLayout />`. Removed the "Switch to Classic" button from the user menu in `ModernOSLayout.tsx`. Removed the "UI Mode (Classic / Modern)" select from the Profile & Branding pane in `CompanySettingsV2.tsx`. The `uiMode` field on `CompanySettings` and `UserPreferences` types is left in place to avoid breaking any persisted records — it's now ignored at render time. | `src/App.tsx`, `src/components/index.ts`, `src/components/layouts/ModernOSLayout.tsx`, `src/components/CompanySettingsV2.tsx` (deleted: `ClassicLayout.tsx`, `ModernOSLayoutV3.tsx`) |

| 2026-05-04 | **(reverted) ModernOSLayoutV3 — totally redesigned launcher with animations.** New file `src/components/layouts/ModernOSLayoutV3.tsx` is a full visual redesign of the home/dashboard launcher. **Background:** Animated aurora — three large gradient blobs (cyan, purple, pink) drift and breathe with `motion.div` + ease-in-out loops; ~22 floating particles with random positions/speeds; subtle 60px grid overlay. **Top bar:** Glassmorphic floating header — brand logo, plan badge with animated pulse dot, glassmorphic user-menu pill with framer-motion entrance and a popover menu (theme/language/Company Settings/Pricing/License/Sign out). **Greeting:** Time-aware ("Good morning/afternoon/evening, {company}") with staggered fade-in and a thin gradient separator. **NebulaTile:** New tile component — magnetic 3D tilt that follows the cursor (`useMotionValue` + spring + `useTransform`), cursor-following radial glow, animated gradient halo behind tile, springy spring-physics entrance with stagger, animated icon (`<AnimatedAppIcon>` adds per-app idle motion: Radar rotates on hover, Optimizer pulses, Route Sequence wobbles, Insights bobs), pulsing emerald dot when hovered. **NebulaFolderTile:** 2×2 mini preview of group members with stagger entrance + count badge. **NebulaFolderOverlay:** Spring modal with members rendered as Tiles. **Routing:** When `view !== DASHBOARD`, renders `<AppContent />` (delegates to existing screens unchanged) plus a floating "← Home" pill top-left so users can return to the launcher. **Toggle:** Wired in `App.tsx` via `localStorage.rg_v2_layout_v3 === '1'` runtime flag — set the flag to opt into V3, otherwise the original ModernOSLayout still renders. Original layout untouched per project rules. | `src/App.tsx`, `src/components/layouts/ModernOSLayoutV3.tsx` (new) |

| 2026-05-04 | **CompanySettingsV2 promoted to live — replaces CompanySettingsModal.** `ModernOSLayout.tsx`: the dashboard "Settings" tile now navigates to `ViewMode.COMPANY_SETTINGS_V2` (cyan-purple-pink gradient, full-screen V2 page) instead of triggering the old modal via `'COMPANY_SETTINGS'` string ID. Removed the standalone "Company Settings V2" tile and removed `COMPANY_SETTINGS_V2` from the `under-development` group `memberIds` (only `INSIGHTS_V2` remains). The legacy modal handler (`onOpenCompanySettings`, `setIsCompanySettingsOpen`) and `CompanySettingsModal.tsx` file are preserved but no longer reachable from the dashboard tile. | `src/components/layouts/ModernOSLayout.tsx` |

| 2026-05-04 | **CompanySettingsV2 (Under Development) — full settings hub redesign.** New screen `CompanySettingsV2.tsx` replaces the legacy modal with a proper full-screen page. Left rail with 10 role-aware tabs covering every company-controllable knob across the app: **Profile & Branding** (name, logo, colors, font, dark mode, UI mode — embeds existing CompanyBrandingSettings), **Localization** (language, country, currency, distance unit, data retention), **Branches & Locations** (CRUD with map coords + CSV import via Papa Parse), **Modules** (master on/off + jump-to-config), **Insights** (route-health thresholds, churn, visit cadence, working days, nearby radius), **AI Optimizer** (speed, service time, traffic factor, working hours, fuel/labor costs, start location, max distance, break time, cost objective, driving distance factor), **Market Scanner** (zoom, timeout, deep scan, keywords, max leads, export format), **Map & Visualization** (default center/zoom/style, traffic, clustering, unassigned, heatmap intensity), **License & Limits 🔒** (sysadmin-only — tier, capacity caps, expiry, status, sysadmin discount, promo code, payment ref), **Danger Zone 🔒** (sysadmin-only — reset to defaults, deactivate/reactivate company). Top-bar search filters tabs by label/description/keywords. Floating "unsaved changes" save bar with Save / Discard / success / error states; uses `updateCompany()` to persist. Role gating: read-only banner for non-admins; sysadmin tabs hidden when `isSysAdmin=false`. Wired in `types.ts` (`COMPANY_SETTINGS_V2`), exported via `components/index.ts`, rendered in `AppContent.tsx`, added to `ModernOSLayout` nav with cyan-purple-pink gradient and grouped under `under-development`. Bug fix during integration: `COUNTRIES_DATA` is `Record<string,string[]>` not an array — used `Object.keys()` for the country dropdown. | `src/types.ts`, `src/components/index.ts`, `src/components/AppContent.tsx`, `src/components/layouts/ModernOSLayout.tsx`, `src/components/CompanySettingsV2.tsx` (new) |

| 2026-05-04 | **Full Arabic translation — RouteSequenceV2, Customers, DetailedReports, FilterSection.** Translated all remaining English UI strings across four screens. RouteSequenceV2: "Dispatch Cockpit", "Route Sequence Intelligence", "Route Filters", "Ready to Dispatch", "Your route. Decoded.", tip text, "Computing optimal path", "Mission Brief", "Stop-by-Stop Manifest", "Sequence Timeline", Depot statuses, coverage bar, micro-KPI labels, distance flow section, nearby-panel. Added `data-reach-screen` to RouteSequenceV2's outermost div. Customers: title, "Distinct Records", search placeholder, Filters/Reset, all 20 column headers, "Empty" cell, "Upload Data", dropdown options. DetailedReports: all 7 tab labels, diagnostic bar texts, added `data-reach-screen`. FilterSection: "All Regions", "Export CSV", added `language` prop. | `src/components/features/Map/RouteSequenceV2.tsx`, `src/components/features/Customers/Customers.tsx`, `src/components/features/Reports/DetailedReports.tsx`, `src/components/features/Reports/FilterSection.tsx` |

| 2026-05-04 | **Light mode improvements — expanded CSS overrides.** Extended V2 screen theming to handle: arbitrary hex dark backgrounds (`[class*="bg-[#0"]`), gray-9x/8x, low-opacity white panels converted to light panel colors, badge/pill backgrounds for all accent colors, ambient glow blobs hidden in light mode, improved input/select styling, ring-white opacity mapped to slate borders. | `src/index.css`, `src/components/features/Reports/DetailedReports.tsx` |

| 2026-05-04 | **DataAssistV2 (Under Development) — AI-powered data analysis wizard.** New screen `src/components/features/DataAssist/DataAssistV2.tsx`. Full wizard flow: (1) **Projects List** — landing grid of saved projects with category filter + search + Delete; new-project CTA. (2) **Step 1 — Source picker** — drop zone for `.xlsx/.xls/.csv` (10 MB / 50k row caps) OR pull from Reach tables (`normalized_customers`, `route_visits`, `history_logs`) respecting RLS via the user's company_id and branch_ids. (3) **Step 2 — Schema confirm** — AI-detected role (dimension/metric/date/identifier/geo) + semantic + sample for every column, editable; right-rail shows Gemini-suggested analyses with checkbox-toggle. (4) **Step 3 — Analyzing** — animated loader. (5) **Step 4 — Results** — KPI strip (rows/cols/missing/insights) + grid of insight cards, each with title, AI narrative, and Recharts (bar/line/pie/kpi). Save dialog asks for name + free-text category (with datalist autocomplete from existing categories) + share-with-company toggle. **Backend** `server_py/data_assist.py` registered as `/data-assist/*` router with 3 endpoints: `profile` (parses file with pandas + openpyxl, returns columns/preview/AI schema/suggested analyses), `analyze` (runs requested analyses with pandas — sum/mean/count/min/max group-by — and asks Gemini to write a narrative for each), `from-reach-table` (Supabase pull + same profile pipeline). Hybrid pipeline: pandas computes truth, Gemini frames it. **Persistence** Supabase table `data_assist_projects` (see `db/data_assist_projects.sql`) stores schema + insights + KPIs JSON; RLS open with anon-key (matches existing convention); auto-touch trigger on updated_at. **Wiring** `ViewMode.DATA_ASSIST_V2` added in `src/types.ts`; tile in `ModernOSLayout` with emerald→cyan→teal gradient grouped under `under-development` (alongside INSIGHTS_V2); rendered in `AppContent.tsx`; bilingual (en/ar) throughout; `data-reach-screen` for light/dark theming. **Setup required after deploy:** (1) run `db/data_assist_projects.sql` in Supabase; (2) restart FastAPI to pick up the new router; (3) `GEMINI_API_KEY` must be set in both `.env.local` and `server_py/.env`. | `src/types.ts`, `src/components/index.ts`, `src/components/AppContent.tsx`, `src/components/layouts/ModernOSLayout.tsx`, `src/components/features/DataAssist/DataAssistV2.tsx` (new), `server_py/main.py`, `server_py/data_assist.py` (new), `db/data_assist_projects.sql` (new) |

| 2026-05-06 | **DataAssistV2 — confirm-type step + curated KPIs per dataset type.** New flow inserts a "Confirm Data Type" step between upload and dashboard. After parsing the file, the user picks one of seven types (Sales / Customers / Inventory / Routes / Financials / Marketing / Generic) and confirms a column mapping (e.g. for Sales: amount, quantity, item, category, customer, invoice, date). The AI auto-detects type + mapping; the user can change either. On confirm, the new endpoint `/data-assist/analyze-by-type` runs a curated preset of KPIs/charts for that type — for **Sales**: Total Sales, Avg Sale Value, Customers Sold (distinct customers), Items Sold (distinct items), Total Quantity, Total Invoices (distinct), Avg Lines per Invoice, Top 10 Items by Sales, Top 10 Customers, Sales by Category, Top 10 Items by Quantity, Quantity by Category, Sales Over Time. Similar curated presets exist for the other six types. **Backend changes** (`server_py/data_assist.py`): added two new aggregations to `_run_analysis` — `nunique` (distinct count) and `rows_per_distinct` (rows ÷ distinct, used for "avg lines per invoice"); fixed line-chart sort to order by index (time) instead of value; bin datetime group-by columns to YYYY-MM-DD so trends aren't fragmented; new `_preset_analyses(type, mapping)` library; `/profile` no longer auto-runs Gemini narratives — it now returns `mapping` + `mappingKeys` and an empty `insights` list (saves the wasted Gemini round-trip); new endpoint `POST /data-assist/analyze-by-type` accepts `dataset_id, dataset_type, mapping, fallback_analyses` and returns `{ insights, kpis, appliedAnalyses }`. Type='other' falls back to the AI-suggested heuristic specs. AI prompt updated to emit a `mapping` object keyed by the chosen type's slot keys. **Frontend changes** (`DataAssistV2.tsx`): added `confirm` mode + state (`confirmType`, `confirmMapping`); new `ConfirmTypeStep` component with type-card grid (each card shows a "Detected" badge if AI picked it) + dynamic mapping form (one dropdown per slot, all dataset columns selectable, `dtype` shown as hint); auto-suggest fills slot guesses on type change via regex on column names + role hints; "Analyze Data" button POSTs to `/analyze-by-type` and routes to the dashboard with the curated insights. The schema/filter/chat code paths are unchanged. | `server_py/data_assist.py`, `src/components/features/DataAssist/DataAssistV2.tsx` |

| 2026-05-06 | **DataAssistV2 — full report redesign with section grouping + per-insight tooltips.** Replaced the flat insights grid with a structured AI-Generated Report layout. Added `ReportHeader` (gradient title block: dataset-type icon, "Sales Insights Report" / "Customers Insights Report" etc., filename, row/col/missing chips, generated date, AI narrative italicized below a divider). Added `ReportView` that splits insights into four labeled sections — **Overview** (all KPIs), **Top Rankings** (bar charts whose title starts with Top/Bottom), **Distribution & Breakdowns** (pie + non-ranking bar), **Trends Over Time** (line, full-width). Each section gets a `ReportSection` header with icon + title + subtitle + gradient divider. Replaced the old combined `InsightCard` with two specialized cards: `BigKpiCard` (large gradient-clipped value with `formatCompact` — 1.2M / 45.3K / locale-formatted; full-precision shown in title attribute on hover; 2-line narrative; warning badge) and `ChartCard` (chart with proper bar value-label sizing, X-axis truncation/rotation when >6 categories, compact Y-axis tick formatting, donut-style pie with right-side legend showing name + value + percentage, time-axis line chart, footer showing the `agg(metric) by groupBy` spec for transparency). Every insight title now has a hover/click `InfoTip` (info icon → 64-char-wide tooltip with explanation). Built `EXPLANATIONS` map keyed by spec id (en + ar) for all curated KPIs across the six dataset types — e.g. "Avg Lines per Invoice → average number of line-items per invoice, computed as total rows ÷ distinct invoices". For non-curated AI/heuristic specs, `explainInsight` falls back to a templated string built from agg + metric + groupBy. Added `formatCompact()` number formatter. Added new lucide imports (`Info`, `TrendingUp`, `Layers`, `Trophy`, `Hash`). Filter rail and chat rail are unchanged. | `src/components/features/DataAssist/DataAssistV2.tsx` |

| 2026-05-06 | **DataAssistV2 — smarter column auto-mapping (drops nonsense AI picks).** Real-world test surfaced bad picks: a sales file with `SalesmanCode (int64)` was auto-assigned as the Amount slot, `TRANSACTION_TYPE` was assigned as the Invoice slot, and `Month_Name (int64)` as the Date slot — even when correct columns (Net_Sales, Invoice_No, Transaction_Date) existed. Now both backend and frontend validate AI's mapping against dtype + name rules and re-fill from a regex library if the AI was wrong. **Backend changes** (`server_py/data_assist.py`): added `_normalize_name()` (splits CamelCase + replaces `_-` with space so `\b` works on `SalesmanCode` → `"Salesman Code"`); added `_validate_mapping()` which drops slots that fail rules — numeric metric slots (amount/quantity/value/spend/conversions) require numeric dtype AND not an ID-like name (no `code/id/key/uuid` suffix, no `salesman/rep/user/employee/owner`), invoice rejects `_type/_status/_class/_kind/_level` columns, date rejects pure-int columns; added `_heuristic_fill_mapping()` which fills empty slots using slot-specific regex patterns ranked specific→general (e.g. `^(net|gross)?\s*(sales|revenue|amount|total)$` first, then broader `\b(net sales|gross sales|sales value|revenue|amount|total amount|line total|grand total)\b`). Both `/profile` and `/from-reach-table` now run validate→fill before returning the mapping; even when Gemini is unavailable, the heuristic fill alone returns a usable mapping. Strengthened the Gemini prompt with explicit "DO NOT pick" examples (e.g. "amount = SalesmanCode is bad because Salesman is a person, not a sale amount"). **Frontend changes** (`DataAssistV2.tsx`): rewrote `autoFillForType` with the same dtype-aware rules — a CamelCase-aware `norm()`, `isNumeric/isDate/idLike/typeLike` predicates, slot-specific regex banks, and a re-validation pass on existing/AI-provided picks (so an obviously wrong slot gets re-suggested even when AI provided it). Test harness verified end-to-end: bad input `{amount: SalesmanCode, invoice: TRANSACTION_TYPE, date: Month_Name}` becomes `{amount: Net_Sales, invoice: Invoice_No, date: Transaction_Date}` with all sensible columns picked. | `server_py/data_assist.py`, `src/components/features/DataAssist/DataAssistV2.tsx` |

| 2026-05-06 | **DataAssistV2 — confident matches now lock automatically (no busywork dropdown).** User feedback: "you're asking me to confirm Category when there's already a column named Category". Each slot now gets a **confidence score** (`exact` / `inferred` / `none`) computed from a curated synonym list per slot. Mapping form is split: slots with `exact` confidence render as compact green "auto-matched" chips (e.g. `✓ Customer → Client_Code` — clickable to convert into a dropdown for editing), while `inferred` and empty slots render as the prominent dropdown card (with "Suggested" or amber "Pick one" badges). The header line summarizes — "All 7 slots auto-matched ✨ You can analyze now" or "5 auto-matched · 2 need a quick check". Synonym lists are intentionally generous (CamelCase + underscore split → lowercased, no special chars, trailing digits stripped) so columns like `Net_Sales`, `Client_Code`, `Invoice_No`, `Transaction_Date`, `MaterialCode1`, `Category` all match their slot synonym and lock as chips. `editingSlots` state tracks slots the user manually flipped from chip → dropdown; resets on type change. Pure frontend change. | `src/components/features/DataAssist/DataAssistV2.tsx` |

| 2026-05-06 | **DataAssistV2 — report dashboard upgrades: floating Ask-AI, card management, formulas, portal tooltips.** Four fixes after user feedback. **(1) Ask-AI rail**: defaults to closed; the rail no longer takes a column when collapsed. Replaced the in-grid "Open Chat" button with a circular floating action button at the bottom-right (`fixed bottom-6 right-6 z-40`, purple→cyan gradient, 56px) showing a message-count badge for unread questions; one click opens the full chat rail (which now occupies a 3-col panel only when open). **(2) Card management**: lifted layout state to `DataAssistV2` — `hiddenCardIds: Set<string>`, `cardSizes: Record<string, 'compact'\|'normal'\|'wide'>`, `cardOrder: string[]`, plus `onCardDelete`/`onCardResize`/`onCardReorder`/`onLayoutReset` handlers. Layout resets when `profile.datasetId` changes. New shared `CardControls` overlay (visible on hover, top-right of every card) with three buttons: 6-dot drag handle (HTML5 drag), resize-cycle (compact → normal → wide), and X delete. Drag-and-drop reordering via `useCardDrag` hook (sets `text/x-reach-card-id` data, computes drop target, calls `onCardReorder(sourceId, targetId)`); drop target gets a green ring while hovering. Sizes apply via Tailwind `col-span` classes — `wide` becomes `lg:col-span-2`. `ReportView` filters out hidden cards and applies a custom-order sort (insights in `cardOrder` keep their relative position, others stay at the end). When any layout customization is active, a "Custom layout · N hidden" banner appears with a "Reset Layout" button. **(3) Calculation formulas**: new `formatFormula(insight)` helper renders the underlying math next to every card — `SUM(Net_Sales)`, `AVG(Net_Sales)`, `DISTINCT(Client_Code)`, `COUNT(rows)`, `COUNT(rows) ÷ DISTINCT(Invoice_No)` (rows-per-distinct), and for charts `SUM(Net_Sales) by MaterialCode1, top 10`. Shown as a `ƒ ...` badge in monospace under the title on `BigKpiCard`, and as a footer line on `ChartCard`. Backend (`server_py/data_assist.py`) now exposes `sort` + `limit` on each insight from `_build_insights` so the frontend can render the "top N"/"bottom N" suffix. **(4) Portal tooltips**: `InfoTip` rewritten to use `createPortal(document.body)` so the tooltip can no longer be clipped by card `overflow-hidden`. Coordinates are computed from the trigger's `getBoundingClientRect()` and clamped to viewport edges — when the trigger is near the bottom edge, the tooltip flips above. `z-[9999]` on the portal ensures it stacks above every other element. Width fixed at 280px. Imports `react-dom`'s `createPortal`. | `src/components/features/DataAssist/DataAssistV2.tsx`, `server_py/data_assist.py` |

| 2026-05-06 | **DataAssistV2 — interactive filters, edit calculation, smooth drag/resize/delete.** Three big upgrades: **(1) Filter rail** is now fast and rich. Server calls debounced 250ms so rapid checkbox clicks coalesce into one `/data-assist/filter` round-trip. In-flight requests are aborted via `AbortController` when a newer one fires, so old responses can't overwrite newer ones. UI is optimistic — `activeFilters` updates instantly so checkboxes feel snappy. Each `FilterGroup` got a per-group search input (auto-shown when >6 values), a "Select all"/"Clear all" toggle, and a scrollable list (max-h-56) so long value-lists don't blow up the rail. Empty search shows a "No matches" placeholder. **(2) Edit Calculation modal**: every card has a pencil icon in its hover toolbar; clicking it opens a modal where the user can change Title, Visualization (kpi/bar/pie/line), Aggregation (sum/avg/count/min/max/distinct/rows÷distinct), Metric column, Group-by column, Sort, and Limit. A live "Formula preview" line at the bottom shows the resulting `ƒ ...` expression as the user edits. On Save → POST to `/data-assist/analyze` with the single spec → in-place replacement of the card (preserving its position in the layout). Numeric-only metric dropdown when agg is sum/mean/min/max; date columns surfaced first when type=line. **(3) Smooth drag/resize/delete**: replaced the rough HTML5 drag with `@dnd-kit/core` + `@dnd-kit/sortable`. Wrapped Dashboard in `<DndContext>` with `PointerSensor` (6px activation distance so quick clicks aren't misread as drags) + `KeyboardSensor`. Each `ReportGrid` is a `<SortableContext>` with `rectSortingStrategy`. Cards use a new `useSortableCard` hook that supplies `setNodeRef`, `style` (transform + transition from dnd-kit), and `dragHandle` props. Wrapped each card in `<motion.div>` with `layout="position"`, spring transition (stiffness 400, damping 30), and `exit={{ opacity: 0, scale: 0.85 }}` — combined with `<AnimatePresence mode="popLayout">` around grid children, this gives smooth fade-out on delete and animated reposition on reorder/resize. New `CardControls` toolbar (top-right, hover-revealed) with a slate-bg + backdrop-blur pill containing 4 buttons: GripVertical drag handle, Pencil edit, Maximize2 resize-cycle (compact↔normal↔wide), and X delete. Replaced inline-SVG icons with proper lucide icons (`GripVertical`, `Pencil`, `Maximize2`). Backend `_build_insights` now also exposes `sort` + `limit` on the returned insight so the frontend formula stays accurate. Imports: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `framer-motion`. | `src/components/features/DataAssist/DataAssistV2.tsx`, `server_py/data_assist.py` |

| 2026-05-06 | **DataAssistV2 — Clean View toggle + click-to-filter on charts.** Two end-user-facing upgrades. **(1) Clean View toggle** in the report header bar (Eye / EyeOff icon, "Clean View" / "Detailed View"). When ON, every card hides: the InfoTip `(i)` icon, the `ƒ formula` mono line, the AI narrative paragraph, the chart-type pill ("BAR" / "PIE"). When OFF (default), the analyst sees everything. The hover toolbar (drag/edit/resize/delete) stays visible in both modes — the toggle is purely about whether the report reads as a presentation or as an analyst's worksheet. State lives in `DataAssistV2`, threaded down to each `BigKpiCard` / `ChartCard`. **(2) Click-to-filter from charts.** Recharts `<Bar>`, `<Pie>` and `<Line activeDot>` now have an `onClick` handler that toggles the clicked datum into `activeFilters[insight.groupBy]`. Cursor-pointer styling appears on hover when filtering is enabled. Filtered values are highlighted: white stroke + full opacity on the active bar/slice, 0.45 opacity on the rest (so the user immediately sees what's excluded). The pie chart's right-side legend rows became clickable buttons too (highlighted in emerald-500/15 + ring when active). Each chart card shows an "X filtered: a, b, c" footer when the chart contributes to active filters, so users can see which clicks landed without scrolling to the filter rail. Header banner now also shows a contextual hint: "Click any bar / slice / point to filter" in detailed mode, "Explanations & formulas hidden" in clean mode. The same debounced/optimistic filter pipeline (250ms + AbortController) is reused for chart clicks — multiple rapid clicks coalesce into one server round-trip. | `src/components/features/DataAssist/DataAssistV2.tsx` |

| 2026-05-06 | **SmartWorkflowsV2 (Under Development) — AI-translated mini-ETL for Excel files.** New screen `src/components/features/SmartWorkflows/SmartWorkflowsV2.tsx` plus backend module `server_py/excel_etl.py`. Lets non-technical users automate repetitive multi-step Excel work (joins, fill-nulls, rename, select) with a one-time AI setup, then deterministic daily runs (no LLM in the hot path). **Two-phase journey**: Phase 1 (Setup) — user uploads sample files and names each as a slot ("prices", "master", "vans"), writes a natural-language prompt, AI translates to a validated workflow JSON, user reviews steps and saves to a Task Library. Phase 2 (Run) — user drops today's files into the named slots, system fuzzy-matches columns and pauses for clarification on any drift (auto-suggests via `difflib.get_close_matches`), then executes step-by-step with a top-10-rows preview + match-rate stats per step ("12,341 of 12,500 matched · 98.7%"), user clicks "Confirm & Next" between each step, finally a base64-encoded xlsx is returned and the browser triggers a download. **Backend** `/etl/translate` (Gemini 2.0 Flash, temperature 0.1, sees the actual column schemas + sample rows from uploaded samples), `/etl/run-init` (uploads daily files, returns drift report + run_id cached for 1h), `/etl/run-step` (executes steps[0..n] on cached frames, returns preview rows + per-step stats), `/etl/run-finalize` (full execution → `pd.ExcelWriter` → base64). Operations are validated via Pydantic discriminated union (`JoinStep` / `FillStep` / `RenameStep` / `SelectStep`); AI cannot emit anything outside the whitelist. Joins coerce both keys to string before merging (so '123' int and '123' string match) and report matched/unmatched counts. **Frontend** wizard with progress bar (Sample Files → Describe Task → Review & Save) for setup; (Upload → Map Columns → Preview → Download) for run. Drift mapping screen shows expected column → dropdown with current columns (top fuzzy match flagged "(suggested)"). Preview tables show top 10 rows in a styled `<table>`. **Persistence**: Supabase table `excel_workflows` (see `db/excel_workflows.sql`) stores `prompt`, `workflow_json`, `input_schemas`, RLS open with anon-key (matches existing convention). **Wiring**: `ViewMode.SMART_WORKFLOWS_V2` in `src/types.ts`; tile in `ModernOSLayout` with violet→fuchsia→indigo gradient grouped under `under-development`; rendered in `AppContent.tsx`; `Workflow` icon from lucide. Bilingual (en/ar) throughout. **Setup required after deploy**: (1) run `db/excel_workflows.sql` in Supabase; (2) restart FastAPI to pick up the new router; (3) `GEMINI_API_KEY` must be set in `server_py/.env`. | `src/types.ts`, `src/components/index.ts`, `src/components/AppContent.tsx`, `src/components/layouts/ModernOSLayout.tsx`, `src/components/features/SmartWorkflows/SmartWorkflowsV2.tsx` (new), `server_py/main.py`, `server_py/excel_etl.py` (new), `db/excel_workflows.sql` (new) |

| 2026-05-06 | **Back-arrow target unified — every app screen now returns to the icon launcher.** User feedback: "back arrow redirects me to insights screen, but it should go to the icon launcher". Every `onBack` / `onClose` callback in `AppContent.tsx` was pointing at `ViewMode.LEGACY_INSIGHTS` (the legacy text-list insights page); they now all point at `ViewMode.DASHBOARD` (the `ModernOSLayout` icon launcher). To make this work, `ModernOSLayout`'s view-sync `useEffect` was extended: when `view === ViewMode.DASHBOARD`, it forces `isHome = true` and persists to localStorage so the layout swaps from the app surface back to the icon-grid home screen. Affected screens: RouteSequenceV2, DetailedReports, AIOptimizerV2, MarketScannerV2, CompanySettingsV2, DataAssistV2, SmartWorkflowsV2, ScannerV2, Pricing, PartnerProgram. Also updated `App.tsx` post-flow redirects (subscription activation, "Login As" admin action) to land users on the icon launcher rather than the legacy insights screen. The two intentional in-page navigations to LEGACY_INSIGHTS remain (the screen render condition itself + AdminDashboard's "Go to Insights" button). | `src/components/AppContent.tsx`, `src/components/layouts/ModernOSLayout.tsx`, `src/App.tsx` |

| 2026-05-06 | **SmartWorkflowsV2 — setup flattened into a single page (no wizard).** Replaced the 3-step setup wizard (samples → prompt → review) with one scrollable form that shows all sections at once: (1) Sample Files, (2) Describe the Task + Generate button, (3) AI-Generated Pipeline (only renders after AI returns), (4) Save (only renders after AI returns). Each section is a `SectionCard` with a numbered badge that flips to a green check when complete. The "Generate Workflow" button lives inside section 2 and toggles to "Regenerate" after the first run. A sticky bottom action bar holds Cancel + "Save to Library" so the primary action is always reachable. Removed the obsolete `SetupStepBar` and `SetupReview` components. Run flow remains step-by-step (intentional — the per-step preview is the data-quality safeguard). | `src/components/features/SmartWorkflows/SmartWorkflowsV2.tsx` |

| 2026-05-06 | **SmartWorkflowsV2 — setup restructured around the user's three-section mental model: Inputs → Directions → Output.** Earlier flatten kept four numbered sections (Sample Files, Describe, Pipeline, Save). Now three big labeled sections matching how the user thinks about the task: **① INPUTS** (sample files), **② DIRECTIONS** (AI prompt + the AI-translated steps shown inline below the prompt — they're the result of the directions, not a separate concept), **③ OUTPUT** (filename / sheet / columns — now an editable form, not a read-only summary, AI pre-fills then the user can change). Output columns is a comma-separated textarea — leaving it empty keeps all columns from the final step. The save details (name / category / share) live in a small inline panel just above the sticky save bar — not a numbered section, since they're metadata not part of the workflow definition. `SectionCard` was extended to accept an optional `label` prop ("INPUTS" / "DIRECTIONS" / "OUTPUT") rendered as a small uppercase tracking-widest hint above the title. | `src/components/features/SmartWorkflows/SmartWorkflowsV2.tsx` |

| 2026-05-06 | **SmartWorkflowsV2 — three big upgrades: file relationships, prompt enhancer, three-way output.** All three sections of setup got smarter. **(1) INPUTS — auto-detected VLookup-style relationships.** Once every slot has a file, the frontend POSTs to a new `/etl/detect-relationships` endpoint. The backend reads each file, then for every (slotA, slotB, columnA, columnB) tuple computes `score = 0.5 * name_similarity + 0.5 * value_overlap` (where overlap = `|setA ∩ setB| / min(|setA|,|setB|)` over the first 2,000 stringified non-null values). Returns the top 3 candidate keys per file pair, but only when `score ≥ 0.55` and `overlap ≥ 0.30`. The new `RelationshipsPanel` renders each detected pair as a horizontal card: leftSlot.column ↔ rightSlot.column, with a `Link2` icon between them. The user can swap to alternate suggestions (each pill shows the overlap %), edit columns via dropdowns of the actual file columns, remove a relationship, or add one manually. Confirmed relationships are passed into `/etl/translate` via a new `relationships` form field, and the AI translate prompt was extended to include a `CONFIRMED RELATIONSHIPS` block so Gemini uses those exact keys when emitting joins. **(2) DIRECTIONS — Enhance Prompt button.** Next to "Generate Steps" there's now an "Enhance Prompt" button. It POSTs the user's draft + the slot/column metadata + confirmed relationships to a new `/etl/enhance-prompt` endpoint. A dedicated Gemini system prompt rewrites the rough text into 3–8 short professional sentences that reference each file by its slot name in backticks (e.g. `` `prices` ``), state explicit join keys (e.g. "Join `prices` with `master` on `Item Code`"), and spell out null-handling and renames as discrete sentences. The polished version appears inline in a violet/fuchsia card with two buttons: "Use this version" (replaces the textarea) or "Dismiss". Only available when files are uploaded (so the AI sees real columns). **(3) OUTPUT — Value | Template | Records selector.** A 3-pill picker at the top of the Output section. **Value** = single-cell aggregation (KPI): user picks `agg_func` (sum/count/avg/min/max) and `agg_column` (datalist of the columns the user already specified). The xlsx contains one cell, but the screen displays the scalar in a giant 6xl tabular-nums hero number. **Template** = branded report: user picks a `template_title`, the xlsx gets a merged title row (violet fill, white bold 14pt), styled header (slate fill, white bold), frozen header (`A4`), and auto-width columns capped at 48 chars based on the first 200 sampled rows. **Records** = raw rows xlsx (the original behaviour, unchanged). Backend `/etl/run-finalize` was extended to handle all three: value mode coerces with `pd.to_numeric(errors="coerce")` then reduces; template mode uses `openpyxl.styles` (Font / PatternFill / Alignment) and `ws.freeze_panes`. Response now includes `output_type`, and for value mode also `scalar_value`, `agg_func`, `agg_column`. The `RunDone` final screen branches on `output_type` — value renders the big number with a Hash icon and skips the rows preview; template adds an amber "TEMPLATE" badge to the success card; records is unchanged. **Wiring**: extended `WorkflowJson` types in the frontend with `OutputType` (`'records'|'value'|'template'`), `AggFunc`, and the new fields. Two new components: `RelationshipsPanel` and `OutputTypePicker`. New lucide icons: `Link2`, `Hash`, `FileText`, `Table2`. Bilingual labels throughout (en/ar). Verified the frontend module loads cleanly via Vite dynamic import; new endpoints validated with `python3 -c 'import ast; ast.parse(...)'`. **Auto-trigger note**: relationship detection fires from a `useEffect` keyed on `slots.map(...).join('|')` so re-uploading or renaming a file re-detects without a button click. **Limitation**: cannot exercise the wizard end-to-end without login credentials in the preview — module-level smoke test only. | `src/components/features/SmartWorkflows/SmartWorkflowsV2.tsx`, `server_py/excel_etl.py` |

| 2026-05-06 | **SmartWorkflows — dropped the `V2` suffix (no V1 exists).** The redesign convention requires a `V2` suffix only when the original screen is being preserved. SmartWorkflows was created fresh — there is no V1 — so the suffix was misleading. Renamed: file `SmartWorkflowsV2.tsx` → `SmartWorkflows.tsx`, component `SmartWorkflowsV2` → `SmartWorkflows`, ViewMode `SMART_WORKFLOWS_V2` → `SMART_WORKFLOWS`, barrel export updated, and references in `AppContent.tsx` + `ModernOSLayout.tsx` updated. Folder `features/SmartWorkflows/` was already correctly named. **DB note**: the new output fields (`output_type`, `agg_func`, `agg_column`, `template_title`) live inside the existing `workflow_json` JSONB column, so **no migration is required** — only the schema doc-comment in `db/excel_workflows.sql` was refreshed. Backend defaults missing `output_type` to `"records"` so rows saved before this change keep working unchanged. | `src/types.ts`, `src/components/index.ts`, `src/components/AppContent.tsx`, `src/components/layouts/ModernOSLayout.tsx`, `src/components/features/SmartWorkflows/SmartWorkflows.tsx` (renamed from `SmartWorkflowsV2.tsx`), `db/excel_workflows.sql` |

| 2026-05-06 | **SmartWorkflows — PDF inputs supported alongside Excel/CSV.** Users can now drop a `.pdf` into any input slot (setup *and* daily-run). Backend uses `pdfplumber` to walk every page and call `page.extract_tables()`. Strategy: the first detected table's first row becomes the canonical header (with a dedup pass that suffixes duplicate column names like `_2`, `_3`); subsequent tables on later pages are appended only when their column count matches — so multi-page invoices, statements, and reports flatten cleanly into one DataFrame. If the PDF has no table grid (e.g. a scanned image, or a "borderless" reportlab table without explicit `GRID` styling) pdfplumber returns zero tables and we raise a clear 400: "no extractable tables found in PDF. PDFs without table grids (e.g. scanned images) need OCR first." Empty rows are skipped; string cells are stripped. Verified live: built a gridded reportlab PDF in a Python harness, fed it through `_read_pdf_tables`, got back a DataFrame with the expected columns and rows. **Wiring**: `_read_pdf_tables()` helper added; `_read_excel_or_csv()` dispatches to it on `.pdf`; unsupported-type message updated to list `.xlsx, .xls, .csv, or .pdf`. **Frontend**: both file-input `accept` attributes (setup `slot-input-*` + run `run-slot-*`) accept `.xlsx,.xls,.csv,.pdf`; helper hint changed to "Click or drop .xlsx / .csv / .pdf" / Arabic equivalent. **Deps**: added `pdfplumber` to `server_py/requirements.txt` (pulls in `pdfminer.six`, `Pillow`, `pypdfium2`, `cryptography` — pure-Python, no Java/Ghostscript needed). **Setup required**: in the project venv, run `python3 -m pip install pdfplumber` and restart FastAPI. | `server_py/excel_etl.py`, `server_py/requirements.txt`, `src/components/features/SmartWorkflows/SmartWorkflows.tsx` |

| 2026-05-07 | **Insights (v1) — single header, branch-name pills on map, clickable Route Health, fixed KPI tooltips.** (1) **Single header**: removed the in-screen `<header>` (Activity icon + "Operations Insights" + refresh button) so only the parent ModernOSLayout app-bar remains. Refresh becomes a small floating pill at top-right of the content area (`absolute top-3 right-4`) with a spinning icon + "Refreshing…" label while `isRefetching`. (2) **Branch-name pills on map** (`ReachCommandMap.tsx`): replaced the icon-only branch marker with an always-visible name pill — emerald gradient pill with a building-icon disc + branch name, matching the cluster-pill style. New signature `createBranchIcon(name)` so each marker shows its own label without needing hover. (3) **Route Health Check is clickable**: the donut and the three status rows (Stable / Under Utilized / Overloaded) accept an `onClick` and open a new `RouteHealthDetailsModal` portal. The modal lazy-fetches details via `fetchRouteHealth(companyId)` (only paid when the user opens it; cached 2 min). Modal features: filter pills with live counts, search across route/branch/region, sortable columns (route name / customer count / efficiency), color-coded status badges, ESC-to-close, click-outside-to-close. Initial filter is prefilled by which row was clicked. (4) **KPI hover tooltips fixed**: `PortalTooltip` was previously broken — it set CSS custom properties `--tooltip-top` / `--tooltip-left` on a *hidden child span*, but CSS variables cascade DOWN, not UP, so the parent's `top: var(...)` always resolved to the unset default and tooltips were invisible. Now positions flow directly through inline `style` on the portal div. Added `max-w-[260px]` so longer tooltips wrap instead of running off-screen. New imports: `X`, `Search`, `ArrowUpDown` from lucide-react, `AnimatePresence` from framer-motion, `fetchRouteHealth` from supabase service. | `src/components/features/Insights/Insights.tsx`, `src/components/features/Insights/ReachCommandMap.tsx` |

| 2026-05-07 | **Insights — Route Health popup wired to the right data source.** The popup table was returning 0 rows because `fetchRouteHealth` queries `normalized_customers` while the dashboard donut reads `company_uploaded_data` (via the `get_dashboard_stats_from_upload` RPC) — two completely different tables. Added new `fetchRouteHealthFromUploads(companyId, branchIds, thresholds)` that mirrors the donut's source: groups `company_uploaded_data` rows by `route_name`, counts distinct `client_code` per route, and buckets each route into stable / under / over using the company's actual `insightsSettings.minClientsPerRoute` (default 80) and `maxClientsPerRoute` (default 120) thresholds. Efficiency is derived inline (linear interpolation across the band, drops as routes overshoot). Modal now passes `branchIds` (for restricted users) + `thresholds` from `insightsSettings` so the per-route list reconciles with the donut totals. Cache key includes branch + thresholds. | `src/services/supabase.ts`, `src/components/features/Insights/Insights.tsx` |

| 2026-05-07 | **Insights map — branch labels deduped, smaller pills, rich popup with stats.** (1) **Common-token stripping**: new `buildDisplayNameMap(names)` helper in `ReachCommandMap.tsx`. If every branch shares a leading or trailing word ("Jeddah Consumer", "Riyadh Consumer", "Madina Consumer" → all end in "Consumer"; "Branch Jeddah", "Branch Makkah" → all start with "Branch"), the shared token is stripped from every label so the pills show just "Jeddah", "Riyadh", "Makkah". Falls back to the original name if stripping would empty the result. Original `branch.name` is preserved for the popup header so the full official name is still visible. (2) **Smaller pill** to reduce overlap: pill padding 5/11 → 3/8, icon disc 24px → 18px, font 11px → 9.5px, iconSize 180×50 → 140×36. Hovered branches now `riseOnHover` with a 2000 z-offset so they pop in front of any neighbors that overlap. (3) **Rich branch popup**: replaced the name-only tooltip with a stats card showing the full branch name + code in the header, a 2-column stats grid (Routes count + distinct Customers count, both sourced from the same `company_uploaded_data` table the dashboard donut uses), and a coords footer. Data flows through a new `fetchBranchStatsFromUploads(companyId, branchIds)` in `supabase.ts` that returns `Record<branchName, { routes, customers }>`; Insights.tsx fetches it via React Query (2 min stale) and passes it down as the new `branchStats` prop. New imports: `Route as RouteIcon`, `Users as UsersIcon` from lucide-react. | `src/components/features/Insights/ReachCommandMap.tsx`, `src/components/features/Insights/Insights.tsx`, `src/services/supabase.ts` |

| 2026-05-07 | **Insights — fixed three real data bugs in the popup fetchers.** (1) **Supabase 1000-row default cap**: `company_uploaded_data` has 45,228 rows for the test company but a single `.select(...)` returned only the first 1000 — all from JEDDAH/TAIF/MAKKAH (clustered at the top of insertion order). Added a generic paginator `fetchAllUploadedRows<T>(companyId, columns, branchNames?)` in `supabase.ts` that pages 1000 rows at a time via `.range(from, from+999)` until exhausted, capped at 200k rows. Both `fetchBranchStatsFromUploads` and `fetchRouteHealthFromUploads` now use it. (2) **Case mismatch** between sources: `company_branches.name_en` returns `"Buraida Consumer"` (mixed case) but `company_uploaded_data.branch_name` is uppercase `"BURAIDA CONSUMER"` — so the previous lookup `branchStats[branch.name]` always missed. Stats are now keyed UPPERCASE; map looks up via `branchStats[upperName] || branchStats[branch.name] || branchStats[branch.code.toUpperCase()]`. (3) **Bad column reference**: `fetchRouteHealthFromUploads` selected `region_description` which does not exist in `company_uploaded_data` — the whole query errored at page 0 and returned 0 rows. Removed the column; falls back to `branch_name` for region display. **Verified live**: branch popup now shows correct routes/customers per branch (matches dashboard donut: 10,679 total customers, 105 routes, 59 stable / 10 under / 36 over). **Perf note**: full pagination takes ~15s for 45k rows — acceptable behind React Query's 2-min cache, but a server-side RPC would be a worthwhile follow-up. | `src/services/supabase.ts`, `src/components/features/Insights/ReachCommandMap.tsx` |

| 2026-05-07 | **Insights — Data Alerts now open detail popups; 3D-floating visual pass.** (1) **Data Alerts clickable**: the "Missing GPS" and "Proximity Issues" `RedFlagCard`s in the right rail now accept `onClick` and open a new `DataAlertsDetailsModal`. The modal accepts a `type: 'gps' \| 'proximity'`, lazy-fetches the underlying rows via React Query, and renders a sortable searchable table (Code / Customer / Branch / Route / District + either Coords or Distance column). Two new fetchers in `supabase.ts`: **`fetchMissingGpsRows(companyId, branchNames?)`** pages through `company_uploaded_data`, returns rows where lat/lng is null or 0, deduped by client_code (verified live: returns **1,422** rows = exact match with the dashboard's "Missing GPS" count); **`fetchProximityIssueRows(companyId, radiusMeters, branchNames?)`** joins to `company_branches` for branch coords, computes Haversine distance from each customer to their branch, returns rows within `radiusMeters` (default from `insightsSettings.nearbyRadiusMeters`, falls back to 100m). Sorted closest-first. Returns 198 rows in the test data — note this is customer-to-branch proximity, while the dashboard donut may show a different number derived from customer-to-customer duplicate detection in the RPC; modal subtitle is precise about what's shown. New types: `DataAlertRow`, `AlertType`. (2) **3D floating pass**: stripped all panel/card borders; replaced with layered drop-shadow + colored ambient glow + inset top-highlight (e.g. `shadow-[0_24px_60px_rgba(0,0,0,0.55),0_8px_22px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.05)]`). Per-color glow on KPI cards (indigo/cyan/emerald/etc) using their hue at low alpha. Hover lift `-translate-y-1` (KPI) / `-translate-y-0.5` (rows) replaces flat scale, so cards feel like they peel off the surface. Modal got the deepest shadow `0_30px_80px`. Section dividers softened to `border-white/[0.04]` to keep hierarchy without boxing. Map outer frame border removed. Common section border classes globally replaced (`border-b border-main` → `border-b border-white/[0.04]`). | `src/components/features/Insights/Insights.tsx`, `src/services/supabase.ts`, `src/components/features/Insights/ReachCommandMap.tsx` |

| 2026-05-07 | **DetailedReportsV2 (Under Development) — full redesign of the 7-tab report screen.** New file `src/components/features/Reports/DetailedReportsV2.tsx`. Original `DetailedReports.tsx` left untouched per V2 redesign rule. **Architecture**: a single React Query fetch via the existing `fetchReportData(companyId, branchIds)` (paginated, deduped, normalized — proven accurate against the dashboard donut), cached **5 min** with 10-min `gcTime`. All 8 reports are pure-JS `useMemo` projections of the same cached dataset — first load takes ~25s for the full 45k-row pagination, but every subsequent report switch + filter change is **instant** (no extra round-trips). **Reports** (8): Branch Overview (NEW — per-branch totals, customers/routes/reps/visits/GPS%), Route Summary, Route Efficiency, User Workload, Data Quality, Visit Frequency, Weekly Coverage. Reports are organized into 4 groups (Overview / Performance / Quality / Coverage) and surfaced via a collapsible left sidebar — much easier to navigate than 7 horizontal tabs. **Filtering**: sticky top bar with global text search + 5 multi-select dropdowns (Branches / Routes / Days / Weeks / Classifications), each with its own search box, "Select all" / "Clear" toggles, scrollable body. Active filters shown as colored removable chips below the bar; "Clear all" button. Filter values are computed from raw data via `useMemo` so they auto-populate. **Click-to-filter**: clicking a Branch / Route / Class cell in any table toggles it into the filters. **KPI strip** above the table: Customers / Routes / Branches / Reps / Visits — recomputes live from filtered raw rows. **Generic DataTable**: per-column sortable, paginated 100 rows/page, density toggle (compact/normal), formatters for number / percent / class-pill / boolean-check. Percent values get a tone color (≥80 emerald, ≥50 amber, else rose). Each report config declares its `searchKeys` so the search box only matches relevant fields. **CSV export** per report (`Download` button) using current visible rows + columns. **Visual language**: matches the new Insights 3D-floating shadows — `shadow-[0_24px_60px_rgba(0,0,0,0.55)…]` on every panel, no borders, gradient KPI tiles with per-color glow, hover-lift on KPI tiles. **Wiring**: `ViewMode.DETAILED_REPORTS_V2` added to `src/types.ts`; barrel export added to `src/components/index.ts`; render branch added to `AppContent.tsx` (line 280); launcher tile added to `ModernOSLayout.tsx` with rose→orange→amber gradient and grouped under `under-development` (now contains INSIGHTS_V2, DATA_ASSIST_V2, SMART_WORKFLOWS, DETAILED_REPORTS_V2). Bilingual (en/ar). | `src/types.ts`, `src/components/index.ts`, `src/components/AppContent.tsx`, `src/components/layouts/ModernOSLayout.tsx`, `src/components/features/Reports/DetailedReportsV2.tsx` (new) |

| 2026-05-07 | **Performance — parallel pagination + minimal columns for all `company_uploaded_data` fetches.** Two big wins applied to both `fetchReportData` (powers DetailedReportsV2) and `fetchAllUploadedRows` (powers Insights popups: route health, branch stats, missing GPS, proximity). (1) **Drop `select('*')`** — replaced with a minimal column list of only the ~15 fields the reports actually use (`id, client_code, customer_name_en, lat, lng, branch_name, branch_code, route_name, rep_code, classification, store_type, district, phone, vat, week_number, day_name`). Skips heavy columns like `address`, `customer_name_ar`, `buyer_id`, `vat`, etc. — cuts payload roughly 4×. (2) **Parallel pagination** — instead of looping pages serially (45 sequential round-trips), we first do a `count: 'exact', head: true` to learn the total, then fire pages in parallel batches of `CONCURRENCY = 8` via `Promise.all`. Reassemble in order, then dedup. **Live benchmarks**: `fetchReportData` 25s → **6.4s** (3.9× faster, same 45,128 rows / 13 branches / 105 routes); `fetchBranchStatsFromUploads` 15s → **2.6s** (5.8× faster, same 13 branches with correct totals). Both functions still return the same shape — no consumer code changes needed. React Query's 5-min cache means subsequent loads are instant. | `src/services/reportService.ts`, `src/services/supabase.ts` |

| 2026-05-07 | **DetailedReportsV2 — drill-down with breadcrumb + filter inheritance.** Added a hierarchical drill engine so the user can pivot from a high-level row into the detail level, with each step inheriting filters from the row that opened it. **Drill chains:** Branch Overview → Route Summary (inherits `branches`); Route Summary / Route Efficiency / Data Quality → Visit Frequency (inherits `routes` + `branches`); User Workload → Visit Frequency (inherits `reps`). Each drillable row gets a chevron icon (›) on the right, and the whole row also accepts double-click. **Breadcrumb** above the table: `Branch Overview ▸ JEDDAH CONSUMER ▸ 621-IBRAHIM …` — each crumb is clickable to pop back to that level (filters inherited along the way are removed automatically). Manual sidebar report switches clear the drill stack to keep state coherent. **New filter dimension**: `reps` Set added to FilterState + raw filter step + new "Reps" multi-select in the filter bar + indigo chip in the chip strip. **DataTable** extension: optional `onDrill` prop renders a chevron header column + per-row chevron button (opacity-30 → 100 on hover) when the active report has a `drillTarget`. New `handleDrill(row)` and `popDrillTo(depth)` functions in the main component manage the drill stack — each `DrillCrumb` records `{fromReportId, toReportId, crumbLabel, added: [{filterKey, value}]}` so popping cleanly reverses the filters that the drill added. Inline hint badge "Double-click row · or ›" shows on reports that support drilling. | `src/components/features/Reports/DetailedReportsV2.tsx` |

| 2026-05-07 | **DetailedReportsV2 — color-coded status badges + new Daily Coverage report.** (1) **Status alerts** in 7 of 9 reports — every row now ends with a color-coded `Health` / `Efficiency` / `Load` / `Grade` / `Cadence` pill so issues pop visually without reading the numbers. Tone semantics: `rose`=critical, `amber`=watch, `cyan`=info, `emerald`=good, `violet`/`slate`=neutral. Pills sort by tone severity (worst-first ascending). New `format: 'status'` column type renders ringed pill; new `format: 'visits'` colors visit counts (≥12 emerald · ≥4 amber · else rose). Specific badge logic per report: Branch Overview (`branchHealthBadge` — LOW LOAD / HIGH LOAD / POOR GPS / WATCH / HEALTHY based on customer count + GPS%); Route Summary (`routeHealthBadge` — UNDER / OVER / BAD GPS / STRONG / STABLE); Route Efficiency (`efficiencyBadge` — LIGHT / OPTIMAL / OVERLOAD / BAD DATA); User Workload (`workloadBadge` — LIGHT / BALANCED / HEAVY / OVERLOADED); Data Quality (`qualityBadge` — CRITICAL / NEEDS WORK / GOOD / EXCELLENT, computed from average of GPS/phone/class/schedule coverage); Visit Frequency (`visitFreqBadge` — RARE / LIGHT / REGULAR / INTENSIVE based on total visits); Weekly + Daily Coverage (`coverageBadge` — GAP / LOW / PARTIAL / STRONG / FULL based on coverage %). Status fields are attached via a `withStatus(computeFn, badgeFn)` HOF so each compute remains pure. (2) **Daily Coverage report** (new — group: Coverage) — per-customer day-of-week presence over Sat/Sun/Mon/Tue/Wed/Thu/Fri (7 check columns), days_covered total, coverage %, and Grade pill. Source: groups raw rows by customer, normalizes `day_name` via 3-char prefix (handles "Saturday" / "SAT" / "sat" interchangeably). Rows sorted ascending by days_covered so the gaps surface first. (3) **Sort + CSV export updates**: status objects sort by tone severity (`toneRank: rose=0 → emerald=4`); CSV export flattens `{tone,label}` to just the label and converts booleans to `YES/NO` so exports stay clean. | `src/components/features/Reports/DetailedReportsV2.tsx` |

| 2026-07-07 | Custom System Admin authentication flow: replaced Supabase Auth dependency in the SysAdmin portal with a custom local JWT signing/verification system backed by the system_users database table and a local JWT secret fallback. | `ROADMAP_GEMINI.md`, `db/migration_system_users.sql`, `server_py/security.py`, `server_py/sysadmin_routes.py`, `src/App.tsx`, `src/components/admin/SysAdmin/SysAdminObservability.tsx`, `src/components/admin/SysAdminLogin.tsx`, `src/components/features/Map/RouteSequenceV2.tsx`, `src/services/sysadminApi.ts` |

| 2026-07-07 | feat: custom sysadmin authentication and local jwt secret fallback | `ROADMAP_GEMINI.md`, `db/migration_system_users.sql`, `server_py/security.py`, `server_py/sysadmin_routes.py`, `src/App.tsx`, `src/components/admin/SysAdmin/SysAdminObservability.tsx`, `src/components/admin/SysAdminLogin.tsx`, `src/components/features/Map/RouteSequenceV2.tsx`, `src/services/sysadminApi.ts` |

| 2026-07-07 | feat: make Users the first tab in System section, rename to Users, and support direct creation with passwords | `src/components/admin/SysAdmin/SysAdminTeam.tsx`, `src/components/admin/SysAdminDashboard.tsx`, `src/services/sysadminApi.ts` |

| 2026-07-07 | feat: give admin role manage_sysadmins privileges by default to manage system users | `db/migration_system_users.sql`, `server_py/security.py` |

| 2026-07-07 | fix: add PATCH and DELETE to CORS allowed methods in main.py | `server_py/main.py` |

| 2026-07-07 | fix: resolve false-positive company deletion error by checking existence instead of delete select row output | `src/services/supabase.ts` |

*Last updated: 2026-07-07*
