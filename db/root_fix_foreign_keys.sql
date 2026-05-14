-- =================================================================
-- FIX: Correct Foreign Key Constraints for Data Upload
-- -----------------------------------------------------------------
-- This script ensures that the normalized tables (reps, routes, customers)
-- strictly reference the 'branches' table via 'branch_id'.
-- This resolves "violates foreign key constraint" errors.
-- =================================================================
-- 1. Fix 'normalized_reps' Foreign Key
-- Error: "insert or update on table "normalized_reps" violates foreign key constraint"
-- Solution: Point branch_id to branches(id)
ALTER TABLE normalized_reps DROP CONSTRAINT IF EXISTS normalized_reps_branch_id_fkey;
ALTER TABLE normalized_reps DROP CONSTRAINT IF EXISTS reps_branch_id_fkey;
-- Check for alt names
ALTER TABLE normalized_reps
ADD CONSTRAINT normalized_reps_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
-- 2. Fix 'routes' Foreign Key
-- Ensure routes also point to branches(id)
ALTER TABLE routes DROP CONSTRAINT IF EXISTS routes_branch_id_fkey;
ALTER TABLE routes DROP CONSTRAINT IF EXISTS normalized_routes_branch_id_fkey;
-- Check for old names
ALTER TABLE routes
ADD CONSTRAINT routes_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
-- 3. Fix 'normalized_customers' Foreign Key
-- Ensure customers point to branches(id)
ALTER TABLE normalized_customers DROP CONSTRAINT IF EXISTS normalized_customers_branch_id_fkey;
ALTER TABLE normalized_customers
ADD CONSTRAINT normalized_customers_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE;
-- 4. Verification
SELECT conname AS constraint_name,
    conrelid::regclass AS table_name,
    confrelid::regclass AS foreign_table_name,
    pg_get_constraintdef(c.oid)
FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
WHERE n.nspname = 'public'
    AND conrelid::regclass::text IN (
        'normalized_reps',
        'routes',
        'normalized_customers'
    )
    AND contype = 'f';