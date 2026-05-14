-- ============================================================
-- Force-logout RPC — revoke all live sessions for a target user
-- without needing the Supabase service-role key.
--
-- Caller must:
--   1. Be authenticated (auth.uid() not null)
--   2. Be a sysadmin with the `force_logout` permission
--
-- Runs as SECURITY DEFINER so it can touch auth.sessions.
-- ============================================================

CREATE OR REPLACE FUNCTION public.sysadmin_force_logout(target_auth_user_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
    deleted int;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated.';
    END IF;

    IF NOT public.sysadmin_has_permission('force_logout') THEN
        RAISE EXCEPTION 'Missing permission: force_logout';
    END IF;

    -- Defensive: don't let a sysadmin accidentally lock themselves out.
    -- (You can still logout via the UI / browser tab.)
    IF target_auth_user_id = auth.uid() THEN
        RAISE EXCEPTION 'Cannot force-logout yourself. Use the Logout button.';
    END IF;

    DELETE FROM auth.sessions WHERE user_id = target_auth_user_id;
    GET DIAGNOSTICS deleted = ROW_COUNT;

    -- Best-effort audit log entry (don't fail if this errors)
    BEGIN
        INSERT INTO public.sysadmin_audit_log (
            actor_id, actor_email, action, target_type, target_id,
            metadata, status
        )
        SELECT
            auth.uid(),
            (SELECT email FROM auth.users WHERE id = auth.uid()),
            'user.force_logout',
            'auth_user',
            target_auth_user_id::text,
            jsonb_build_object('sessions_revoked', deleted),
            'success';
    EXCEPTION WHEN OTHERS THEN
        -- swallow; the revocation itself succeeded
        NULL;
    END;

    RETURN deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.sysadmin_force_logout(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.sysadmin_force_logout(uuid) TO authenticated;
