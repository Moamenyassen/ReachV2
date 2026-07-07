"""
Security module — authentication, authorization, and audit helpers.

Single source of truth for:
  - Verifying Supabase Auth JWTs on incoming requests
  - Distinguishing regular users from sysadmins
  - Writing to the sysadmin_audit_log and system_error_log tables
  - Rate-limiting login attempts

All FastAPI endpoints should depend on either `require_user` or `require_sysadmin`.
"""
from __future__ import annotations

import os
import time
from datetime import datetime, timezone
from typing import Optional, Dict, Any

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from supabase import Client


# ─────────────────────────────────────────────────────────────────────────────
# JWT verification
# ─────────────────────────────────────────────────────────────────────────────

_bearer = HTTPBearer(auto_error=False)


def _sb_with_user_token(app, token: str) -> Optional[Client]:
    """
    Return a Supabase client whose PostgREST calls forward the user's JWT.
    This makes `auth.uid()` work in RLS policies, so server-side queries
    are evaluated as the calling user (not as the anon role).
    """
    sb: Optional[Client] = getattr(app.state, "supabase", None)
    if sb is None:
        return None
    try:
        sb.postgrest.auth(token)
    except Exception as e:
        print(f"[WARN] could not attach user token to postgrest: {e}")
    return sb

# Cache JWKS client so we don't re-fetch on every request
_jwks_client: Optional["jwt.PyJWKClient"] = None


def _get_jwks_client() -> Optional["jwt.PyJWKClient"]:
    """Lazily build a JWKS client pointed at the Supabase project's well-known endpoint."""
    global _jwks_client
    if _jwks_client is not None:
        return _jwks_client
    url = (os.getenv("SUPABASE_URL") or "").rstrip("/")
    if not url:
        return None
    try:
        _jwks_client = jwt.PyJWKClient(f"{url}/auth/v1/.well-known/jwks.json", cache_keys=True)
    except Exception as e:
        print(f"[WARN] could not build JWKS client: {e}")
        _jwks_client = None
    return _jwks_client


def _verify_jwt(token: str) -> Dict[str, Any]:
    """
    Verify a Supabase Auth JWT.

    Supports BOTH:
      1) Modern asymmetric signing keys (ES256/RS256/EdDSA) — preferred — via JWKS
      2) Legacy HS256 with SUPABASE_JWT_SECRET — fallback for old projects
    """
    last_error: Optional[Exception] = None

    # 1) Modern JWKS verification
    jwks = _get_jwks_client()
    if jwks is not None:
        try:
            signing_key = jwks.get_signing_key_from_jwt(token)
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256", "RS256", "EdDSA"],
                audience="authenticated",
                options={"verify_aud": True},
            )
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired.")
        except jwt.InvalidTokenError as e:
            # Could be a token signed with the legacy HS256 key — try fallback below.
            last_error = e

    # 2) Legacy HS256 fallback (or local dev fallback)
    secret = os.getenv("SUPABASE_JWT_SECRET") or "local-sysadmin-secret-key-fallback"
    try:
        return jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
            options={"verify_aud": True},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired.")
    except jwt.InvalidTokenError as e:
        last_error = e

    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {last_error}")


# ─────────────────────────────────────────────────────────────────────────────
# Dependencies
# ─────────────────────────────────────────────────────────────────────────────

class AuthContext:
    def __init__(self, payload: Dict[str, Any], is_sysadmin: bool = False):
        self.auth_user_id: str = payload.get("sub", "")
        self.email: str = payload.get("email", "")
        self.payload = payload
        self.is_sysadmin = is_sysadmin
        self.sysadmin_id: Optional[str] = None
        self.sysadmin_role: Optional[str] = None
        self.permissions: Dict[str, bool] = {}

    def has(self, perm: str) -> bool:
        return bool(self.permissions.get(perm))


def require_user(
    request: Request,
    creds: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> AuthContext:
    """Any authenticated Supabase user."""
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token.")
    payload = _verify_jwt(creds.credentials)
    request.state.auth_user_id = payload.get("sub")
    request.state.user_jwt = creds.credentials
    # Forward the user's JWT to the supabase client so RLS evaluates as them
    # only if we are using a real SUPABASE_JWT_SECRET.
    if os.getenv("SUPABASE_JWT_SECRET"):
        _sb_with_user_token(request.app, creds.credentials)
    return AuthContext(payload)


# Defaults must mirror db/migration_sysadmin_roles_v2.sql -> sysadmin_role_defaults()
_ROLE_DEFAULTS: Dict[str, Dict[str, bool]] = {
    "owner": {
        "manage_sysadmins": True, "manage_companies": True, "manage_licenses": True,
        "manage_plans": True, "manage_promos": True, "manage_affiliates": True,
        "force_logout": True, "resolve_errors": True, "set_feature_flags": True,
        "view_audit_log": True, "view_usage": True,
    },
    "admin": {
        "manage_sysadmins": False, "manage_companies": True, "manage_licenses": True,
        "manage_plans": True, "manage_promos": True, "manage_affiliates": True,
        "force_logout": True, "resolve_errors": True, "set_feature_flags": True,
        "view_audit_log": True, "view_usage": True,
    },
    "support": {
        "manage_sysadmins": False, "manage_companies": False, "manage_licenses": False,
        "manage_plans": False, "manage_promos": False, "manage_affiliates": False,
        "force_logout": False, "resolve_errors": True, "set_feature_flags": False,
        "view_audit_log": True, "view_usage": True,
    },
    "billing": {
        "manage_sysadmins": False, "manage_companies": False, "manage_licenses": True,
        "manage_plans": True, "manage_promos": True, "manage_affiliates": True,
        "force_logout": False, "resolve_errors": False, "set_feature_flags": False,
        "view_audit_log": False, "view_usage": True,
    },
    "security": {
        "manage_sysadmins": False, "manage_companies": False, "manage_licenses": False,
        "manage_plans": False, "manage_promos": False, "manage_affiliates": False,
        "force_logout": True, "resolve_errors": True, "set_feature_flags": False,
        "view_audit_log": True, "view_usage": True,
    },
}


def _resolve_permissions(role: Optional[str], overrides: Optional[Dict[str, Any]]) -> Dict[str, bool]:
    base = dict(_ROLE_DEFAULTS.get(role or "admin", {}))
    if overrides:
        for k, v in overrides.items():
            if isinstance(v, bool):
                base[k] = v
    return base


def require_sysadmin(
    request: Request,
    ctx: AuthContext = Depends(require_user),
) -> AuthContext:
    """Verified sysadmin only. Loads role + effective permissions into ctx."""
    sb: Optional[Client] = getattr(request.app.state, "supabase", None)
    if sb is None:
        raise HTTPException(status_code=503, detail="DB unavailable; cannot verify sysadmin role.")
    try:
        res = (
            sb.table("system_users")
            .select("id,is_active,role,permissions")
            .eq("id", ctx.auth_user_id)
            .single()
            .execute()
        )
        row = getattr(res, "data", None)
    except Exception:
        row = None
    if not row or not row.get("is_active"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Sysadmin privileges required.")
    ctx.is_sysadmin = True
    ctx.sysadmin_id = row.get("id")
    ctx.sysadmin_role = row.get("role") or "admin"
    ctx.permissions = _resolve_permissions(ctx.sysadmin_role, row.get("permissions") or {})
    return ctx


def require_permission(perm: str):
    """Dependency factory — enforces a specific permission on top of sysadmin."""
    def _dep(ctx: AuthContext = Depends(require_sysadmin)) -> AuthContext:
        if not ctx.has(perm):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permission: {perm}",
            )
        return ctx
    return _dep


# ─────────────────────────────────────────────────────────────────────────────
# Logging helpers
# ─────────────────────────────────────────────────────────────────────────────

def log_sysadmin_action(
    sb: Optional[Client],
    *,
    actor: AuthContext,
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    status_val: str = "success",
    error_message: Optional[str] = None,
    request: Optional[Request] = None,
) -> None:
    if sb is None:
        return
    try:
        sb.table("sysadmin_audit_log").insert({
            "actor_id": actor.auth_user_id,
            "actor_email": actor.email,
            "action": action,
            "target_type": target_type,
            "target_id": str(target_id) if target_id else None,
            "ip_address": _client_ip(request) if request else None,
            "user_agent": request.headers.get("user-agent") if request else None,
            "metadata": metadata or {},
            "status": status_val,
            "error_message": error_message,
        }).execute()
    except Exception as e:
        print(f"[WARN] audit log failed: {e}")


def log_system_error(
    sb: Optional[Client],
    *,
    source: str,
    message: str,
    severity: str = "error",
    company_id: Optional[str] = None,
    user_id: Optional[str] = None,
    stack_trace: Optional[str] = None,
    request_path: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    if sb is None:
        return
    try:
        sb.table("system_error_log").insert({
            "source": source,
            "severity": severity,
            "company_id": company_id,
            "user_id": user_id,
            "message": message[:8000],
            "stack_trace": (stack_trace or "")[:16000],
            "request_path": request_path,
            "metadata": metadata or {},
        }).execute()
    except Exception as e:
        print(f"[WARN] system_error_log failed: {e}")


def log_gemini_usage(
    sb: Optional[Client],
    *,
    company_id: Optional[str],
    user_id: Optional[str],
    surface: str,
    model: str,
    input_tokens: Optional[int] = None,
    output_tokens: Optional[int] = None,
    duration_ms: Optional[int] = None,
    status_val: str = "success",
    error_message: Optional[str] = None,
) -> None:
    if sb is None:
        return
    # Approximate cost — Gemini 2.0 Flash pricing (rough): $0.000125 / 1k input,
    # $0.000375 / 1k output. Adjust as Google updates pricing.
    est = 0.0
    if input_tokens:
        est += (input_tokens / 1000.0) * 0.000125
    if output_tokens:
        est += (output_tokens / 1000.0) * 0.000375
    try:
        sb.table("gemini_usage_logs").insert({
            "company_id": company_id,
            "user_id": user_id,
            "surface": surface,
            "model": model,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "estimated_cost_usd": round(est, 5),
            "duration_ms": duration_ms,
            "status": status_val,
            "error_message": error_message,
        }).execute()
    except Exception as e:
        print(f"[WARN] gemini_usage_logs failed: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Rate limit — sysadmin login attempts (5 failures / 15 min / IP = lockout)
# ─────────────────────────────────────────────────────────────────────────────

def record_login_attempt(sb: Optional[Client], *, ip: str, email: Optional[str], success: bool) -> None:
    if sb is None:
        return
    try:
        sb.table("sysadmin_login_attempts").insert({
            "ip_address": ip, "email": email, "success": success,
        }).execute()
    except Exception as e:
        print(f"[WARN] login attempts log failed: {e}")


def is_ip_locked(sb: Optional[Client], ip: str) -> bool:
    if sb is None or not ip:
        return False
    try:
        # Failed attempts in last 15 minutes
        from datetime import timedelta
        cutoff = (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat()
        res = (
            sb.table("sysadmin_login_attempts")
            .select("id", count="exact")
            .eq("ip_address", ip)
            .eq("success", False)
            .gte("created_at", cutoff)
            .execute()
        )
        return (getattr(res, "count", 0) or 0) >= 5
    except Exception:
        return False


def _client_ip(request: Optional[Request]) -> Optional[str]:
    if request is None:
        return None
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else None
