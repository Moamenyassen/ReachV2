-- ============================================================
-- Reach V2 — SysAdmin Role-Based Access Control (RBAC)
-- Date: 2026-05-14
-- Depends on: migration_sysadmin_security_v1.sql
--
-- Adds role + granular permissions to sysadmins, enforces a single
-- owner, and provides helper functions for permission checks.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Extend sysadmins table
-- ------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE sysadmin_role AS ENUM ('owner','admin','support','billing','security');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE public.sysadmins
    ADD COLUMN IF NOT EXISTS role sysadmin_role NOT NULL DEFAULT 'admin',
    ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES public.sysadmins(id),
    ADD COLUMN IF NOT EXISTS invited_at timestamptz NOT NULL DEFAULT now();

-- Enforce: at most ONE owner exists at any time
CREATE UNIQUE INDEX IF NOT EXISTS sysadmins_single_owner
    ON public.sysadmins (role)
    WHERE role = 'owner';

-- ------------------------------------------------------------
-- 2. Permission helper — checks the caller has a specific permission
--    Permissions can be in `permissions` JSONB or inherited from role.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sysadmin_role_defaults(r sysadmin_role)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT CASE r
        WHEN 'owner' THEN '{
            "manage_sysadmins": true, "manage_companies": true, "manage_licenses": true,
            "manage_plans": true, "manage_promos": true, "manage_affiliates": true,
            "force_logout": true, "resolve_errors": true, "set_feature_flags": true,
            "view_audit_log": true, "view_usage": true
        }'::jsonb
        WHEN 'admin' THEN '{
            "manage_sysadmins": false, "manage_companies": true, "manage_licenses": true,
            "manage_plans": true, "manage_promos": true, "manage_affiliates": true,
            "force_logout": true, "resolve_errors": true, "set_feature_flags": true,
            "view_audit_log": true, "view_usage": true
        }'::jsonb
        WHEN 'support' THEN '{
            "manage_sysadmins": false, "manage_companies": false, "manage_licenses": false,
            "manage_plans": false, "manage_promos": false, "manage_affiliates": false,
            "force_logout": false, "resolve_errors": true, "set_feature_flags": false,
            "view_audit_log": true, "view_usage": true
        }'::jsonb
        WHEN 'billing' THEN '{
            "manage_sysadmins": false, "manage_companies": false, "manage_licenses": true,
            "manage_plans": true, "manage_promos": true, "manage_affiliates": true,
            "force_logout": false, "resolve_errors": false, "set_feature_flags": false,
            "view_audit_log": false, "view_usage": true
        }'::jsonb
        WHEN 'security' THEN '{
            "manage_sysadmins": false, "manage_companies": false, "manage_licenses": false,
            "manage_plans": false, "manage_promos": false, "manage_affiliates": false,
            "force_logout": true, "resolve_errors": true, "set_feature_flags": false,
            "view_audit_log": true, "view_usage": true
        }'::jsonb
    END;
$$;

CREATE OR REPLACE FUNCTION public.sysadmin_has_permission(perm text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT COALESCE(
        (
            SELECT
                COALESCE(
                    (s.permissions ->> perm)::boolean,                          -- explicit override
                    (public.sysadmin_role_defaults(s.role) ->> perm)::boolean,  -- role default
                    false
                )
            FROM public.sysadmins s
            WHERE s.auth_user_id = auth.uid()
              AND s.is_active = true
            LIMIT 1
        ),
        false
    );
$$;

-- Convenience: resolve a sysadmin's effective permissions (role defaults + overrides)
CREATE OR REPLACE FUNCTION public.sysadmin_effective_permissions(p_auth_user_id uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT public.sysadmin_role_defaults(s.role) || s.permissions
    FROM public.sysadmins s
    WHERE s.auth_user_id = p_auth_user_id;
$$;

-- ------------------------------------------------------------
-- 3. Trigger — cannot delete or demote the OWNER
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sysadmins_protect_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' AND OLD.role = 'owner' THEN
        RAISE EXCEPTION 'Cannot delete the owner sysadmin. Transfer ownership first.';
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.role = 'owner' AND NEW.role <> 'owner' THEN
        -- Allow only if a new owner is being designated simultaneously
        -- (another row's role being set to 'owner' will throw via unique idx if duplicate)
        IF NOT EXISTS (SELECT 1 FROM public.sysadmins WHERE role = 'owner' AND id <> OLD.id) THEN
            RAISE EXCEPTION 'Cannot demote the owner unless another sysadmin is promoted first.';
        END IF;
    END IF;
    IF TG_OP = 'UPDATE' AND OLD.role = 'owner' AND NEW.is_active = false THEN
        RAISE EXCEPTION 'Cannot deactivate the owner. Transfer ownership first.';
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sysadmins_protect_owner_trg ON public.sysadmins;
CREATE TRIGGER sysadmins_protect_owner_trg
    BEFORE UPDATE OR DELETE ON public.sysadmins
    FOR EACH ROW EXECUTE FUNCTION public.sysadmins_protect_owner();

-- ------------------------------------------------------------
-- 4. RLS — sysadmins with manage_sysadmins permission can read/write the table
-- ------------------------------------------------------------
DROP POLICY IF EXISTS sysadmins_select ON public.sysadmins;
CREATE POLICY sysadmins_select ON public.sysadmins
    FOR SELECT USING (public.is_sysadmin());

DROP POLICY IF EXISTS sysadmins_modify ON public.sysadmins;
CREATE POLICY sysadmins_modify ON public.sysadmins
    FOR ALL
    USING (public.sysadmin_has_permission('manage_sysadmins'))
    WITH CHECK (public.sysadmin_has_permission('manage_sysadmins'));

-- ------------------------------------------------------------
-- 5. Make sure the first sysadmin you create is the OWNER.
--    After running migration v1 seed, run this once to elevate yourself:
-- ------------------------------------------------------------
-- UPDATE public.sysadmins
--    SET role = 'owner'
--  WHERE email = 'mo2men.yasen@gmail.com';
