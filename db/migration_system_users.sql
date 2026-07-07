-- =================================================================
-- SYSTEM USERS MIGRATION — CUSTOM AUTH MODEL
-- =================================================================
-- This script creates a dedicated system_users table and custom auth
-- functions to authenticate sysadmins separately from Supabase Auth users.
-- =================================================================

-- 0. Enable pgcrypto for password hashing/verification
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 0b. Drop foreign key constraint on sysadmin_audit_log(actor_id) since system_users are not in auth.users
DO $$
DECLARE
    r_const record;
BEGIN
    FOR r_const IN 
        SELECT tc.constraint_name 
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        WHERE tc.table_schema = 'public' 
          AND tc.table_name = 'sysadmin_audit_log' 
          AND tc.constraint_type = 'FOREIGN KEY'
          AND kcu.column_name = 'actor_id'
    LOOP
        EXECUTE 'ALTER TABLE public.sysadmin_audit_log DROP CONSTRAINT IF EXISTS ' || r_const.constraint_name;
    END LOOP;
END $$;

-- 1. Create system_users table
CREATE TABLE IF NOT EXISTS public.system_users (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email           text NOT NULL UNIQUE,
    password_hash   text NOT NULL,
    display_name    text NOT NULL,
    role            text NOT NULL CHECK (role IN ('owner', 'admin', 'support', 'billing', 'security')),
    permissions     jsonb NOT NULL DEFAULT '{}'::jsonb,
    is_active       boolean NOT NULL DEFAULT true,
    mfa_required    boolean NOT NULL DEFAULT false,
    last_login_at   timestamp with time zone,
    last_login_ip   text,
    invited_by      uuid,
    invited_at      timestamp with time zone,
    created_at      timestamp with time zone DEFAULT now()
);

-- Ensure columns exist in case the table was already created
ALTER TABLE public.system_users ADD COLUMN IF NOT EXISTS invited_by uuid;
ALTER TABLE public.system_users ADD COLUMN IF NOT EXISTS invited_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_system_users_email ON public.system_users(email);

-- 2. Create verify_system_user_password RPC
CREATE OR REPLACE FUNCTION public.verify_system_user_password(p_email text, p_password text)
RETURNS jsonb AS $$
DECLARE
    r_user record;
BEGIN
    SELECT * INTO r_user FROM public.system_users WHERE email = LOWER(TRIM(p_email)) AND is_active = true;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('valid', false);
    END IF;

    -- Verify password hash using pgcrypto's crypt
    IF r_user.password_hash = crypt(p_password, r_user.password_hash) THEN
        RETURN jsonb_build_object(
            'valid', true,
            'id', r_user.id,
            'email', r_user.email,
            'display_name', r_user.display_name,
            'role', r_user.role,
            'permissions', r_user.permissions,
            'mfa_required', r_user.mfa_required
        );
    ELSE
        RETURN jsonb_build_object('valid', false);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2b. Create create_system_user RPC
CREATE OR REPLACE FUNCTION public.create_system_user(
    p_email text,
    p_password text,
    p_display_name text,
    p_role text,
    p_permissions jsonb
) RETURNS jsonb AS $$
DECLARE
    v_id uuid;
BEGIN
    INSERT INTO public.system_users (email, password_hash, display_name, role, permissions)
    VALUES (
        LOWER(TRIM(p_email)),
        crypt(p_password, gen_salt('bf')),
        p_display_name,
        p_role,
        p_permissions
    )
    RETURNING id INTO v_id;

    RETURN jsonb_build_object('success', true, 'id', v_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Redefine is_sysadmin helper function
-- Rewriting in-place so all downstream RLS rules on other tables target system_users automatically.
CREATE OR REPLACE FUNCTION public.is_sysadmin()
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.system_users
        WHERE id = auth.uid() AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Disable RLS on system_users and other sysadmin tables to allow backend queries (running as anon) without JWT signature verification issues
ALTER TABLE public.system_users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sysadmin_audit_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.sysadmin_login_attempts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_error_log DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_feature_flags DISABLE ROW LEVEL SECURITY;

-- 5. Seed initial system users
-- Owner (dot spelling): mo2men.yasen@gmail.com / Moamen224!
INSERT INTO public.system_users (email, password_hash, display_name, role, permissions, is_active)
VALUES (
    'mo2men.yasen@gmail.com',
    crypt('Moamen224!', gen_salt('bf')),
    'Moamen Yassen',
    'owner',
    '{"manage_sysadmins": true, "manage_companies": true, "manage_licenses": true, "manage_plans": true, "manage_promos": true, "manage_affiliates": true, "force_logout": true, "resolve_errors": true, "set_feature_flags": true, "view_audit_log": true, "view_usage": true}'::jsonb,
    true
)
ON CONFLICT (email) DO NOTHING;

-- Owner (underscore spelling): mo2men_yasen@gmail.com / Moamen224!
INSERT INTO public.system_users (email, password_hash, display_name, role, permissions, is_active)
VALUES (
    'mo2men_yasen@gmail.com',
    crypt('Moamen224!', gen_salt('bf')),
    'Moamen Yassen',
    'owner',
    '{"manage_sysadmins": true, "manage_companies": true, "manage_licenses": true, "manage_plans": true, "manage_promos": true, "manage_affiliates": true, "force_logout": true, "resolve_errors": true, "set_feature_flags": true, "view_audit_log": true, "view_usage": true}'::jsonb,
    true
)
ON CONFLICT (email) DO NOTHING;

-- Support user: support@reach.ai / Moamen224!
INSERT INTO public.system_users (email, password_hash, display_name, role, permissions, is_active)
VALUES (
    'support@reach.ai',
    crypt('Moamen224!', gen_salt('bf')),
    'Reach Support',
    'support',
    '{"manage_sysadmins": false, "manage_companies": false, "manage_licenses": false, "manage_plans": false, "manage_promos": false, "manage_affiliates": false, "force_logout": false, "resolve_errors": true, "set_feature_flags": false, "view_audit_log": true, "view_usage": true}'::jsonb,
    true
)
ON CONFLICT (email) DO NOTHING;
