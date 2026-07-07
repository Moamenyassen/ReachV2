# Reach V2 — Roadmap Gemini

> Based on an independent structural audit by Gemini AI.

## 🎯 Strategic Overview
The application currently functions well but suffers from severe architectural monoliths that will block future scalability. This roadmap focuses on resolving technical debt, improving code quality, and laying a strong foundation for future features.

## 🛠️ Phase 1: Taming the Monoliths (Frontend Architecture)
Currently, core files are massive "God objects". Breaking them down is the highest priority.

1. **Deconstruct `supabase.ts` (4,800+ lines)**
   - Create a `src/services/api/` directory.
   - Split into domain-specific modules: `auth.api.ts`, `users.api.ts`, `companies.api.ts`, `routes.api.ts`, `customers.api.ts`.
2. **Deconstruct `App.tsx` (1,700+ lines)**
   - Extract global state (`currentUser`, `currentCompany`, `isDarkMode`) into dedicated React Context providers (e.g., `AuthContext`, `TenantContext`, `ThemeContext`).
   - `App.tsx` should serve only as a clean wrapper for these providers.

## 🚦 Phase 2: Routing & Navigation
1. **Replace `ViewMode` with `react-router-dom`**
   - The current navigation relies on a custom `ViewMode` enum and state switching in `AppContent.tsx`.
   - This breaks native browser behavior (no deep linking, no back button support).
   - **Action:** Install `react-router-dom` v6 and implement a proper route tree (`/dashboard`, `/insights`, `/admin`). Enable lazy loading for route-level code splitting.

## 🐍 Phase 3: Backend Hardening (FastAPI)
1. **Modularize FastAPI Backend**
   - The backend currently lives in two files (`main.py` and `analyzer_service.py`).
   - Introduce an `APIRouter` structure (e.g., `routers/analyze.py`, `routers/sysadmin.py`).
   - Introduce Pydantic models for rigorous request and response validation.
2. **Backend Testing**
   - Add a `tests/` directory and write `pytest` suites to ensure AI integrations and sysadmin endpoints are stable.

## 🧹 Immediate Quick Fixes
1. **TypeScript Compilation Errors**
   - Fix broken imports in the `scripts/` directory (`verify_access.ts`, `verify_fetch.ts`, `verify_import.ts`). They incorrectly import `../services/supabase` instead of `../src/services/supabase`.
2. **Linting and Code Quality**
   - Add ESLint / Prettier scripts to `package.json` to enforce code quality standards.
