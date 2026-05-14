-- ============================================================
-- Reach V2 — SysAdmin Security & Observability Migration
-- Date: 2026-05-14
-- Purpose:
--   1. Replace hardcoded sysadmin password with proper auth
--   2. Add cross-tenant observability tables (API usage, scans,
--      audit log, error log, session tracking)
--   3. Add RLS lockdown helpers
-- ============================================================

-- ------------------------------------------------------------
-- 1. SYSADMINS TABLE
--    Links Supabase auth.users to sysadmin role.
--    A user is a sysadmin IFF their auth_user_id exists here AND is_active.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sysadmins (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id    uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name    text NOT NULL,
    email           text NOT NULL,
    is_active       boolean NOT NULL DEFAULT true,
    mfa_required    boolean NOT NULL DEFAULT true,
    last_login_at   timestamptz,
    last_login_ip   text,
    created_at      timestamptz NOT NULL DEFAULT now(),
    created_by      uuid REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_sysadmins_auth_user_id ON public.sysadmins(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_sysadmins_email ON public.sysadmins(email);

-- Helper function — the single source of truth for "is this caller a sysadmin?"
CREATE OR REPLACE FUNCTION public.is_sysadmin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.sysadmins
        WHERE auth_user_id = auth.uid()
          AND is_active = true
    );
$$;

-- ------------------------------------------------------------
-- 2. SYSADMIN AUDIT LOG
--    Every privileged action a sysadmin takes is recorded.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sysadmin_audit_log (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id        uuid REFERENCES auth.users(id),
    actor_email     text,
    action          text NOT NULL,           -- e.g. "company.suspend", "license.approve", "user.force_logout"
    target_type     text,                    -- "company" | "user" | "license" | "promo" | ...
    target_id       text,
    ip_address      text,
    user_agent      text,
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    status          text NOT NULL DEFAULT 'success',  -- "success" | "failure"
    error_message   text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sysadmin_audit_actor ON public.sysadmin_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_sysadmin_audit_created ON public.sysadmin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sysadmin_audit_action ON public.sysadmin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_sysadmin_audit_target ON public.sysadmin_audit_log(target_type, target_id);

-- ------------------------------------------------------------
-- 3. GEMINI API USAGE LOG
--    Track every call to Gemini (frontend + backend) for cost
--    attribution and abuse detection.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gemini_usage_logs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      text REFERENCES public.companies(id) ON DELETE SET NULL,
    user_id         uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
    surface         text NOT NULL,         -- "optimizer" | "analyzer" | "chat"
    model           text NOT NULL,         -- e.g. "gemini-2.0-flash"
    input_tokens    int,
    output_tokens   int,
    estimated_cost_usd numeric(10,5),
    duration_ms     int,
    status          text NOT NULL DEFAULT 'success',
    error_message   text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gemini_usage_company ON public.gemini_usage_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_gemini_usage_created ON public.gemini_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gemini_usage_surface ON public.gemini_usage_logs(surface);

-- ------------------------------------------------------------
-- 4. MARKET SCAN USAGE LOG
--    Track every Overpass scan — required because scans are
--    capped per subscription tier.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_scan_logs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id      text REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id         uuid REFERENCES public.app_users(id) ON DELETE SET NULL,
    center_lat      double precision,
    center_lng      double precision,
    radius_meters   int,
    leads_found     int NOT NULL DEFAULT 0,
    leads_saved     int NOT NULL DEFAULT 0,
    status          text NOT NULL DEFAULT 'success',
    error_message   text,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_scan_company ON public.market_scan_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_market_scan_created ON public.market_scan_logs(created_at DESC);

-- View: current-month scan count per company
CREATE OR REPLACE VIEW public.market_scan_monthly_usage AS
SELECT
    company_id,
    COUNT(*) AS scans_this_month,
    SUM(leads_found) AS total_leads_found,
    SUM(leads_saved) AS total_leads_saved
FROM public.market_scan_logs
WHERE created_at >= date_trunc('month', now())
  AND status = 'success'
GROUP BY company_id;

-- ------------------------------------------------------------
-- 5. SYSTEM ERROR LOG
--    Backend and critical frontend errors. Sysadmin can browse
--    to triage incidents without grepping server logs.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_error_log (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source          text NOT NULL,         -- "backend.analyze" | "frontend.optimizer" | "etl.upload" | ...
    severity        text NOT NULL DEFAULT 'error',  -- "info" | "warning" | "error" | "critical"
    company_id      text REFERENCES public.companies(id) ON DELETE SET NULL,
    user_id         uuid,
    message         text NOT NULL,
    stack_trace     text,
    request_path    text,
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    resolved        boolean NOT NULL DEFAULT false,
    resolved_by     uuid,
    resolved_at     timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_error_created ON public.system_error_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_error_source ON public.system_error_log(source);
CREATE INDEX IF NOT EXISTS idx_system_error_severity ON public.system_error_log(severity);
CREATE INDEX IF NOT EXISTS idx_system_error_unresolved ON public.system_error_log(resolved) WHERE resolved = false;

-- ------------------------------------------------------------
-- 6. ACTIVE SESSIONS VIEW
--    Read-only view over Supabase auth — sysadmin can see who's
--    logged in right now without needing service role on the client.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.active_user_sessions AS
SELECT
    s.id               AS session_id,
    s.user_id          AS auth_user_id,
    u.email,
    s.created_at       AS session_started,
    s.updated_at       AS last_activity,
    s.user_agent,
    s.ip,
    au.company_id,
    au.username        AS user_name,
    au.role
FROM auth.sessions s
JOIN auth.users u  ON u.id = s.user_id
LEFT JOIN public.app_users au ON au.auth_user_id = s.user_id
WHERE s.not_after IS NULL OR s.not_after > now();

-- ------------------------------------------------------------
-- 7. RATE LIMITING — login attempts table
--    Backend writes one row per failed sysadmin login attempt.
--    >5 within 15 minutes from the same IP triggers a lockout.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sysadmin_login_attempts (
    id              bigserial PRIMARY KEY,
    ip_address      text NOT NULL,
    email           text,
    success         boolean NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_ip_time ON public.sysadmin_login_attempts(ip_address, created_at DESC);

-- ------------------------------------------------------------
-- 8. SUBSCRIPTION ENFORCEMENT VIEW
--    Computes which companies are over their plan limits. Drives
--    the "Enforcement" tab.
-- ------------------------------------------------------------
-- Limits per company come from subscription_plans.limits JSONB, keyed by
-- subscription_tier (case-insensitive). Falls back to companies.max_users.
CREATE OR REPLACE VIEW public.subscription_enforcement_status AS
SELECT
    c.id                AS company_id,
    c.name              AS company_name,
    c.subscription_tier,
    COALESCE((sp.limits ->> 'users')::int,  c.max_users)             AS max_users,
    (SELECT COUNT(*) FROM public.app_users WHERE company_id = c.id AND is_active = true) AS current_users,
    (sp.limits ->> 'routes')::int                                    AS max_routes,
    (SELECT COUNT(*) FROM public.routes WHERE company_id = c.id AND is_active = true) AS current_routes,
    (sp.limits ->> 'customers')::int                                 AS max_customers,
    (SELECT COUNT(*) FROM public.normalized_customers WHERE company_id = c.id AND is_active = true) AS current_customers,
    (sp.limits ->> 'market_scanner_cap')::int                        AS market_scan_limit,
    COALESCE((SELECT scans_this_month FROM public.market_scan_monthly_usage WHERE company_id = c.id), 0) AS scans_this_month
FROM public.companies c
LEFT JOIN public.subscription_plans sp ON lower(sp.id) = lower(c.subscription_tier);

-- ------------------------------------------------------------
-- 9. FEATURE FLAGS PER TENANT (lightweight)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_feature_flags (
    company_id      text NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    flag_key        text NOT NULL,
    enabled         boolean NOT NULL DEFAULT false,
    metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    updated_by      uuid,
    PRIMARY KEY (company_id, flag_key)
);

-- ------------------------------------------------------------
-- 10. RLS — lock all new tables to sysadmins only
-- ------------------------------------------------------------
ALTER TABLE public.sysadmins                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sysadmin_audit_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gemini_usage_logs          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_scan_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_error_log           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sysadmin_login_attempts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_feature_flags      ENABLE ROW LEVEL SECURITY;

-- sysadmins table — readable by sysadmins only, writable via service role only
DROP POLICY IF EXISTS sysadmins_select ON public.sysadmins;
CREATE POLICY sysadmins_select ON public.sysadmins FOR SELECT USING (public.is_sysadmin());

-- audit log — sysadmins can read; insert allowed for authenticated (we trust app to set actor)
DROP POLICY IF EXISTS audit_select ON public.sysadmin_audit_log;
CREATE POLICY audit_select ON public.sysadmin_audit_log FOR SELECT USING (public.is_sysadmin());
DROP POLICY IF EXISTS audit_insert ON public.sysadmin_audit_log;
CREATE POLICY audit_insert ON public.sysadmin_audit_log FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- gemini usage — sysadmin reads all; company members read their own
DROP POLICY IF EXISTS gemini_usage_select ON public.gemini_usage_logs;
CREATE POLICY gemini_usage_select ON public.gemini_usage_logs FOR SELECT USING (
    public.is_sysadmin()
    OR company_id IN (SELECT company_id FROM public.app_users WHERE auth_user_id = auth.uid())
);
DROP POLICY IF EXISTS gemini_usage_insert ON public.gemini_usage_logs;
CREATE POLICY gemini_usage_insert ON public.gemini_usage_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- market scans — sysadmin reads all; company members read their own
DROP POLICY IF EXISTS market_scan_select ON public.market_scan_logs;
CREATE POLICY market_scan_select ON public.market_scan_logs FOR SELECT USING (
    public.is_sysadmin()
    OR company_id IN (SELECT company_id FROM public.app_users WHERE auth_user_id = auth.uid())
);
DROP POLICY IF EXISTS market_scan_insert ON public.market_scan_logs;
CREATE POLICY market_scan_insert ON public.market_scan_logs FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- system errors — sysadmin reads all, anyone authenticated can insert
DROP POLICY IF EXISTS sys_err_select ON public.system_error_log;
CREATE POLICY sys_err_select ON public.system_error_log FOR SELECT USING (public.is_sysadmin());
DROP POLICY IF EXISTS sys_err_insert ON public.system_error_log;
CREATE POLICY sys_err_insert ON public.system_error_log FOR INSERT WITH CHECK (auth.role() = 'authenticated');
DROP POLICY IF EXISTS sys_err_update ON public.system_error_log;
CREATE POLICY sys_err_update ON public.system_error_log FOR UPDATE USING (public.is_sysadmin());

-- login attempts — sysadmin only
DROP POLICY IF EXISTS login_attempts_select ON public.sysadmin_login_attempts;
CREATE POLICY login_attempts_select ON public.sysadmin_login_attempts FOR SELECT USING (public.is_sysadmin());
DROP POLICY IF EXISTS login_attempts_insert ON public.sysadmin_login_attempts;
CREATE POLICY login_attempts_insert ON public.sysadmin_login_attempts FOR INSERT WITH CHECK (true);

-- feature flags — sysadmin only writes; tenant reads its own
DROP POLICY IF EXISTS feature_flags_select ON public.company_feature_flags;
CREATE POLICY feature_flags_select ON public.company_feature_flags FOR SELECT USING (
    public.is_sysadmin()
    OR company_id IN (SELECT company_id FROM public.app_users WHERE auth_user_id = auth.uid())
);
DROP POLICY IF EXISTS feature_flags_write ON public.company_feature_flags;
CREATE POLICY feature_flags_write ON public.company_feature_flags FOR ALL USING (public.is_sysadmin()) WITH CHECK (public.is_sysadmin());

-- ------------------------------------------------------------
-- 11. SEED — first sysadmin
--    YOU MUST RUN THIS AFTER CREATING THE AUTH USER in Supabase
--    Auth dashboard (Authentication → Users → Add User).
--    Then replace the email below and run:
-- ------------------------------------------------------------
-- INSERT INTO public.sysadmins (auth_user_id, display_name, email)
-- SELECT id, 'Moamen Yassen', email FROM auth.users WHERE email = 'mo2men.yasen@gmail.com'
-- ON CONFLICT (auth_user_id) DO NOTHING;

-- ------------------------------------------------------------
-- END
-- ------------------------------------------------------------
