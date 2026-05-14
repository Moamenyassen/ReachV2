-- =================================================================
-- FIX: Add Missing Unique Constraints for UPSERT Operations
-- -----------------------------------------------------------------
-- This script adds the necessary UNIQUE constraints required by the 
-- ETL service's ON CONFLICT clauses.
-- =================================================================
-- 1. Branches Table (Fixes "Failed to upsert branches" error)
-- Code expects: onConflict: 'code, company_id'
DROP INDEX IF EXISTS idx_branches_code_company;
CREATE UNIQUE INDEX IF NOT EXISTS branches_code_company_idx ON public.branches (code, company_id);
-- 2. Reps Table
-- Code expects: onConflict: 'company_id, user_code'
DROP INDEX IF EXISTS idx_normalized_reps_user_company;
CREATE UNIQUE INDEX IF NOT EXISTS normalized_reps_user_company_idx ON public.normalized_reps (company_id, user_code);
-- 3. Routes Table
-- Code expects: onConflict: 'name, branch_id'
-- Note: Routes are unique by Name within a Branch
DROP INDEX IF EXISTS idx_routes_name_branch;
CREATE UNIQUE INDEX IF NOT EXISTS routes_name_branch_idx ON public.routes (name, branch_id);
-- 4. Customers Table (Normalized)
-- Code expects: onConflict: 'client_code, branch_id'
DROP INDEX IF EXISTS idx_normalized_customers_client_branch;
CREATE UNIQUE INDEX IF NOT EXISTS normalized_customers_client_branch_idx ON public.normalized_customers (client_code, branch_id);
-- 5. Route Visits Table (Schedule)
-- Code expects: onConflict: 'route_id, customer_id, week_number, day_name'
DROP INDEX IF EXISTS idx_route_visits_unique_schedule;
CREATE UNIQUE INDEX IF NOT EXISTS route_visits_unique_schedule_idx ON public.route_visits (route_id, customer_id, week_number, day_name);
-- 6. Verification
-- (Optional) Verify constraints exist
SELECT schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN (
        'branches',
        'normalized_reps',
        'routes',
        'normalized_customers',
        'route_visits'
    )
    AND indexname LIKE '%_idx';