# Reach V2 — Project Instructions for AI

## Read This First

All app documentation is in **`REACH_APP_DOCUMENTATION.md`** at the project root.  
Before answering any question or making any change, read that file. It contains:
- Every screen and its file path
- All ViewMode routing
- Full database schema
- All external APIs and keys
- User roles and permissions

Do NOT scan the full codebase — use the documentation file instead to save context.

## Key Rules

1. **Never modify original screen files.** For new features, create `<NameV2>.tsx`, add a new `ViewMode`, and wire it in `ModernOSLayout.tsx` under the `under-development` group.
2. **Edit files directly** in `/Users/moamen/Desktop/ReachV2/` — no git worktrees or copies.
3. **After every change**, update the Change Log table at the bottom of `REACH_APP_DOCUMENTATION.md`.
4. **Navigation** is driven by the `ViewMode` enum in `src/types.ts`. All screen switching goes through `setView()` in `App.tsx`.

## Tech Stack (short version)

- Frontend: React 19 + TypeScript + Vite + Tailwind (CDN)
- Database: Supabase (PostgreSQL + Auth + Realtime)
- Maps: Leaflet + CARTO tiles (no Google Maps API key needed)
- AI: Google Gemini 2.0 Flash (needs real `GEMINI_API_KEY` in `.env.local`)
- Backend: FastAPI Python on port 8000

## Running the App

```bash
npm run dev          # frontend → http://localhost:3001
source .venv/bin/activate && python3 -m uvicorn server_py.main:app --port 8000 --reload
```
