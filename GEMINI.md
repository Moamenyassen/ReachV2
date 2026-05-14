# Reach V2 — Project Instructions

## Start Here

Read `REACH_APP_DOCUMENTATION.md` first before answering anything. It contains every screen, database table, API, and navigation route. Do not scan individual source files — use the documentation instead.

## What This App Is

Multi-tenant SaaS for logistics route optimization. React 19 + TypeScript frontend, Supabase database, FastAPI Python backend, Google Gemini AI.

## Key Files (read these, ignore the rest)

- `REACH_APP_DOCUMENTATION.md` — full app reference (screens, DB, APIs, routing)
- `src/types.ts` — all TypeScript types and ViewMode enum
- `src/components/AppContent.tsx` — view dispatcher
- `src/components/index.ts` — all component exports
- `src/config/constants.ts` — app settings

## Do NOT read these (too large, already documented)

- `src/services/supabase.ts` (4555 lines — described in docs)
- `src/App.tsx` (1561 lines — described in docs)
- `src/components/layouts/ModernOSLayout.tsx` (1322 lines)
- `src/components/features/Map/RouteSequenceV2.tsx` (1908 lines)
- `src/components/CompanySettingsModal.tsx` (1590 lines)
- `node_modules/` — never read this
- `package-lock.json` — never read this
- `dist/` — never read this

## Rules for Changes

1. Never modify an existing screen — create `<NameV2>.tsx` for new versions
2. Navigation uses `ViewMode` enum in `src/types.ts` — add new views there
3. After any change, update the Change Log in `REACH_APP_DOCUMENTATION.md`

## Running

```bash
npm run dev       # frontend on http://localhost:3001
source .venv/bin/activate && python3 -m uvicorn server_py.main:app --port 8000 --reload
```
