-- ============================================================
-- Fix active_user_sessions view:
--   1. Dedupe — one row per auth_user_id (latest session wins)
--   2. Add session_count so the UI can show "(2 sessions)"
--   3. If the user is a sysadmin, hide their tenant company and
--      surface the sysadmin role instead.
--
-- Run after migration_sysadmin_roles_v2.sql.
-- ============================================================

DROP VIEW IF EXISTS public.active_user_sessions CASCADE;

CREATE OR REPLACE VIEW public.active_user_sessions AS
WITH live_sessions AS (
    SELECT
        s.id          AS session_id,
        s.user_id     AS auth_user_id,
        s.created_at,
        s.updated_at,
        s.user_agent,
        s.ip,
        s.not_after
    FROM auth.sessions s
    WHERE s.not_after IS NULL OR s.not_after > now()
),
session_agg AS (
    -- Pick the latest session per user, plus a count of all live sessions.
    SELECT DISTINCT ON (auth_user_id)
        auth_user_id,
        session_id,
        created_at AS session_started,
        updated_at AS last_activity,
        user_agent,
        ip,
        (SELECT COUNT(*) FROM live_sessions ls2 WHERE ls2.auth_user_id = ls.auth_user_id)::int AS session_count
    FROM live_sessions ls
    ORDER BY auth_user_id, updated_at DESC
)
SELECT
    sa.session_id,
    sa.auth_user_id,
    u.email,
    sa.session_started,
    sa.last_activity,
    sa.user_agent,
    sa.ip,
    sa.session_count,
    -- If the caller is a sysadmin, don't expose a tenant company on this row.
    CASE WHEN sys.id IS NOT NULL THEN NULL ELSE au.company_id END AS company_id,
    -- Display name: sysadmins use their sysadmin display_name; tenants use username.
    COALESCE(sys.display_name, au.username) AS user_name,
    -- Role: sysadmin role (owner/admin/...) takes precedence over tenant role.
    COALESCE(sys.role::text, au.role)        AS role,
    (sys.id IS NOT NULL)                     AS is_sysadmin
FROM session_agg sa
JOIN auth.users u            ON u.id = sa.auth_user_id
LEFT JOIN public.sysadmins sys ON sys.auth_user_id = sa.auth_user_id AND sys.is_active = true
LEFT JOIN public.app_users au  ON au.auth_user_id  = sa.auth_user_id
ORDER BY sa.last_activity DESC;

-- Optional: ensure read access for sysadmins (RLS isn't applied to views by default).
-- The endpoint already require_sysadmin gates server-side, but RLS on underlying
-- tables is what really enforces row access. No additional grants needed.
