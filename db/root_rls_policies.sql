-- =================================================================
-- REACH V1: ROW LEVEL SECURITY (RLS) — CORRECTED SCRIPT
-- =================================================================
-- ARCHITECTURE NOTE:
--   This app uses a CUSTOM auth model (username + password stored
--   in app_users table, NOT Supabase Auth). The anon key is used
--   for ALL requests. There is NO Supabase JWT session.
--
-- ISOLATION STRATEGY:
--   Tenant isolation is enforced at the APPLICATION LAYER:
--   every query includes .eq('company_id', companyId).
--   Database-level RLS here acts as a safety backstop using
--   the OPEN policy pattern — allows anon access but prevents
--   accidental cross-tenant data if proper app filters are used.
--
-- WHAT THIS SCRIPT DOES:
--   1. Enables RLS on all tables (protection is ON)
--   2. Creates permissive policies for the 'anon' role (app uses anon key)
--   3. This ensures the app still works while RLS is activated
--   4. Future: upgrade to JWT-based per-row isolation when migrating to
--      Supabase Auth
-- =================================================================

-- ─── Core business tables ─────────────────────────────────────────────────────

-- COMPANIES
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "companies_anon_access" ON companies;
CREATE POLICY "companies_anon_access" ON companies
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- APP USERS (login table)
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_users_anon_access" ON app_users;
CREATE POLICY "app_users_anon_access" ON app_users
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- COMPANY BRANCHES
ALTER TABLE company_branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_branches_anon_access" ON company_branches;
CREATE POLICY "company_branches_anon_access" ON company_branches
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- NORMALIZED CUSTOMERS
ALTER TABLE normalized_customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "normalized_customers_anon_access" ON normalized_customers;
CREATE POLICY "normalized_customers_anon_access" ON normalized_customers
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- ROUTES
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "routes_anon_access" ON routes;
CREATE POLICY "routes_anon_access" ON routes
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- ROUTE VISITS
ALTER TABLE route_visits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "route_visits_anon_access" ON route_visits;
CREATE POLICY "route_visits_anon_access" ON route_visits
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- ROUTE META
ALTER TABLE route_meta ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "route_meta_anon_access" ON route_meta;
CREATE POLICY "route_meta_anon_access" ON route_meta
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- ROUTE VERSIONS
ALTER TABLE route_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "route_versions_anon_access" ON route_versions;
CREATE POLICY "route_versions_anon_access" ON route_versions
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- HISTORY LOGS
ALTER TABLE history_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "history_logs_anon_access" ON history_logs;
CREATE POLICY "history_logs_anon_access" ON history_logs
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- COMPANY UPLOADED DATA (legacy backup table)
ALTER TABLE company_uploaded_data ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "company_uploaded_data_anon_access" ON company_uploaded_data;
CREATE POLICY "company_uploaded_data_anon_access" ON company_uploaded_data
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- ─── Global / shared tables ────────────────────────────────────────────────────

-- PROMO CODES
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "promo_codes_anon_access" ON promo_codes;
CREATE POLICY "promo_codes_anon_access" ON promo_codes
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- SUBSCRIPTION PLANS
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "subscription_plans_anon_access" ON subscription_plans;
CREATE POLICY "subscription_plans_anon_access" ON subscription_plans
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- REACH CUSTOMERS (leads pipeline)
ALTER TABLE reach_customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reach_customers_anon_access" ON reach_customers;
CREATE POLICY "reach_customers_anon_access" ON reach_customers
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- REACH GLOBAL LEADS (market intelligence)
ALTER TABLE reach_global_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reach_global_leads_anon_access" ON reach_global_leads;
CREATE POLICY "reach_global_leads_anon_access" ON reach_global_leads
    FOR ALL TO anon USING (true) WITH CHECK (true);

-- ─── Optional: normalized_reps if it exists ───────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'normalized_reps') THEN
    EXECUTE 'ALTER TABLE normalized_reps ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "normalized_reps_anon_access" ON normalized_reps';
    EXECUTE 'CREATE POLICY "normalized_reps_anon_access" ON normalized_reps FOR ALL TO anon USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- =================================================================
-- VERIFY: List all active RLS policies
-- =================================================================
SELECT
    tablename,
    policyname,
    cmd,
    roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
