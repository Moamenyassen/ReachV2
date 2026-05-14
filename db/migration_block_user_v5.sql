-- ============================================================
-- Block / unblock users from signing in.
-- Uses Supabase Auth's built-in `auth.users.banned_until` column —
-- GoTrue rejects sign-ins when banned_until is in the future.
--
-- "Blocked"   → banned_until = '9999-12-31' (effectively forever)
-- "Unblocked" → banned_until = NULL
--
-- Also revokes any live sessions when blocking, so the user is
-- kicked out immediately.
-- ============================================================

CREATE OR REPLACE FUNCTION public.sysadmin_set_user_blocked(
    target_auth_user_id uuid,
    block boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    sessions_revoked int := 0;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;
    IF NOT public.sysadmin_has_permission('force_logout') THEN
        -- "block user" is treated as a stricter form of force_logout,
        -- so we gate it on the same permission.
        RAISE EXCEPTION 'Missing permission: force_logout';
    END IF;
    IF target_auth_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot block yourself.';
    END IF;

    -- Prevent blocking the OWNER sysadmin (mirrors the demote/delete protections)
    IF EXISTS (
        SELECT 1 FROM public.sysadmins
        WHERE auth_user_id = target_auth_user_id
          AND role = 'owner'
    ) THEN
        RAISE EXCEPTION 'Cannot block the owner sysadmin.';
    END IF;

    IF block THEN
        UPDATE auth.users
           SET banned_until = '9999-12-31 23:59:59+00'::timestamptz,
               updated_at   = now()
         WHERE id = target_auth_user_id;

        DELETE FROM auth.sessions WHERE user_id = target_auth_user_id;
        GET DIAGNOSTICS sessions_revoked = ROW_COUNT;
    ELSE
        UPDATE auth.users
           SET banned_until = NULL,
               updated_at   = now()
         WHERE id = target_auth_user_id;
    END IF;

    -- Audit
    BEGIN
        INSERT INTO public.sysadmin_audit_log (
            actor_id, actor_email, action, target_type, target_id, metadata, status
        )
        SELECT auth.uid(),
               (SELECT email FROM auth.users WHERE id = auth.uid()),
               CASE WHEN block THEN 'user.block' ELSE 'user.unblock' END,
               'auth_user', target_auth_user_id::text,
               jsonb_build_object('sessions_revoked', sessions_revoked),
               'success';
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    RETURN jsonb_build_object(
        'ok', true,
        'blocked', block,
        'sessions_revoked', sessions_revoked
    );
END;
$$;

REVOKE ALL ON FUNCTION public.sysadmin_set_user_blocked(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.sysadmin_set_user_blocked(uuid, boolean) TO authenticated;


-- ============================================================
-- Update active_user_sessions view to include `is_blocked` so the
-- UI can show the Block/Unblock state. Also extend `live_sessions`
-- with a LEFT JOIN to auth.users for the banned_until check.
-- ============================================================
DROP VIEW IF EXISTS public.active_user_sessions CASCADE;

CREATE OR REPLACE VIEW public.active_user_sessions AS
WITH live_sessions AS (
    SELECT
        s.id AS session_id, s.user_id AS auth_user_id,
        s.created_at, s.updated_at, s.user_agent, s.ip, s.not_after
    FROM auth.sessions s
    WHERE s.not_after IS NULL OR s.not_after > now()
),
session_agg AS (
    SELECT DISTINCT ON (auth_user_id)
        auth_user_id, session_id,
        created_at AS session_started, updated_at AS last_activity,
        user_agent, ip,
        (SELECT COUNT(*) FROM live_sessions ls2 WHERE ls2.auth_user_id = ls.auth_user_id)::int AS session_count
    FROM live_sessions ls
    ORDER BY auth_user_id, updated_at DESC
)
SELECT
    sa.session_id, sa.auth_user_id, u.email,
    sa.session_started, sa.last_activity, sa.user_agent, sa.ip, sa.session_count,
    CASE WHEN sys.id IS NOT NULL THEN NULL ELSE au.company_id END AS company_id,
    COALESCE(sys.display_name, au.username)  AS user_name,
    COALESCE(sys.role::text, au.role)        AS role,
    (sys.id IS NOT NULL)                     AS is_sysadmin,
    (u.banned_until IS NOT NULL AND u.banned_until > now()) AS is_blocked
FROM session_agg sa
JOIN auth.users u            ON u.id = sa.auth_user_id
LEFT JOIN public.sysadmins sys ON sys.auth_user_id = sa.auth_user_id AND sys.is_active = true
LEFT JOIN public.app_users au  ON au.auth_user_id  = sa.auth_user_id
ORDER BY sa.last_activity DESC;


-- ============================================================
-- Convenience: list all blocked users (so the UI can show a list
-- even when they have no live sessions).
-- ============================================================
CREATE OR REPLACE VIEW public.blocked_users AS
SELECT
    u.id           AS auth_user_id,
    u.email,
    u.banned_until AS blocked_until,
    u.updated_at,
    CASE WHEN sys.id IS NOT NULL THEN NULL ELSE au.company_id END AS company_id,
    COALESCE(sys.display_name, au.username) AS user_name,
    (sys.id IS NOT NULL) AS is_sysadmin
FROM auth.users u
LEFT JOIN public.sysadmins sys ON sys.auth_user_id = u.id
LEFT JOIN public.app_users au  ON au.auth_user_id  = u.id
WHERE u.banned_until IS NOT NULL
  AND u.banned_until > now()
ORDER BY u.updated_at DESC;
