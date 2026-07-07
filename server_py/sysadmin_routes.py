"""
SysAdmin-only API endpoints. All require a valid sysadmin JWT.

Mounted under /sysadmin/* in main.py.
"""
from __future__ import annotations

import os
import jwt
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from .security import (
    AuthContext,
    log_sysadmin_action,
    require_sysadmin,
    require_permission,
    require_user,
    record_login_attempt,
    is_ip_locked,
    _client_ip,
    _ROLE_DEFAULTS,
    _resolve_permissions,
)

router = APIRouter(prefix="/sysadmin", tags=["sysadmin"])


# ─────────────────────────────────────────────────────────────────────────────
# Status check — does this caller's JWT belong to a sysadmin?
# Used by the SysAdmin login screen to verify the user after signing in.
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/verify")
def verify_sysadmin(request: Request, ctx: AuthContext = Depends(require_user)):
    sb = getattr(request.app.state, "supabase", None)
    ip = _client_ip(request)

    if ip and is_ip_locked(sb, ip):
        record_login_attempt(sb, ip=ip, email=ctx.email, success=False)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts. Try again in 15 minutes.",
        )

    if sb is None:
        raise HTTPException(status_code=503, detail="DB unavailable.")

    try:
        res = (
            sb.table("system_users")
            .select("id,display_name,is_active,mfa_required")
            .eq("id", ctx.auth_user_id)
            .single()
            .execute()
        )
        row = getattr(res, "data", None)
    except Exception:
        row = None

    if not row or not row.get("is_active"):
        record_login_attempt(sb, ip=ip, email=ctx.email, success=False)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a sysadmin.")

    record_login_attempt(sb, ip=ip, email=ctx.email, success=True)

    # Best-effort update of last_login_at / ip
    try:
        sb.table("system_users").update({
            "last_login_at": datetime.now(timezone.utc).isoformat(),
            "last_login_ip": ip,
        }).eq("id", ctx.auth_user_id).execute()
    except Exception:
        pass

    log_sysadmin_action(
        sb, actor=AuthContext(ctx.payload, is_sysadmin=True),
        action="sysadmin.login", request=request,
    )

    # Fetch full role + permissions for the client UI to gate its tabs
    try:
        full = (
            sb.table("system_users")
            .select("id,display_name,role,permissions,mfa_required")
            .eq("id", ctx.auth_user_id)
            .single()
            .execute()
        ).data or {}
    except Exception:
        full = {}
    effective = _resolve_permissions(full.get("role") or "admin", full.get("permissions") or {})

    return {
        "is_sysadmin": True,
        "sysadmin_id": full.get("id"),
        "display_name": full.get("display_name") or row.get("display_name"),
        "mfa_required": full.get("mfa_required") if full else row.get("mfa_required"),
        "role": full.get("role") or "admin",
        "permissions": effective,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Observability dashboards — read endpoints
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/usage/gemini")
def gemini_usage(
    request: Request,
    days: int = 30,
    ctx: AuthContext = Depends(require_permission("view_usage")),
):
    sb = request.app.state.supabase
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    res = (
        sb.table("gemini_usage_logs")
        .select("*")
        .gte("created_at", cutoff)
        .order("created_at", desc=True)
        .limit(2000)
        .execute()
    )
    return {"rows": res.data or []}


@router.get("/usage/scans")
def scan_usage(
    request: Request,
    days: int = 30,
    ctx: AuthContext = Depends(require_permission("view_usage")),
):
    sb = request.app.state.supabase
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    res = (
        sb.table("market_scan_logs")
        .select("*")
        .gte("created_at", cutoff)
        .order("created_at", desc=True)
        .limit(2000)
        .execute()
    )
    return {"rows": res.data or []}


@router.get("/audit")
def audit_log(
    request: Request,
    days: int = 30,
    ctx: AuthContext = Depends(require_permission("view_audit_log")),
):
    sb = request.app.state.supabase
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    res = (
        sb.table("sysadmin_audit_log")
        .select("*")
        .gte("created_at", cutoff)
        .order("created_at", desc=True)
        .limit(2000)
        .execute()
    )
    return {"rows": res.data or []}


@router.get("/errors")
def errors_log(
    request: Request,
    days: int = 7,
    unresolved_only: bool = False,
    ctx: AuthContext = Depends(require_sysadmin),
):
    sb = request.app.state.supabase
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    q = sb.table("system_error_log").select("*").gte("created_at", cutoff)
    if unresolved_only:
        q = q.eq("resolved", False)
    res = q.order("created_at", desc=True).limit(1000).execute()
    return {"rows": res.data or []}


@router.get("/enforcement")
def enforcement_status(
    request: Request, ctx: AuthContext = Depends(require_sysadmin)
):
    sb = request.app.state.supabase
    res = sb.table("subscription_enforcement_status").select("*").execute()
    return {"rows": res.data or []}


@router.get("/sessions")
def active_sessions(
    request: Request, ctx: AuthContext = Depends(require_sysadmin)
):
    sb = request.app.state.supabase
    res = sb.table("active_user_sessions").select("*").limit(500).execute()
    return {"rows": res.data or []}


# ─────────────────────────────────────────────────────────────────────────────
# Privileged actions
# ─────────────────────────────────────────────────────────────────────────────
class ForceLogoutRequest(BaseModel):
    auth_user_id: str


@router.post("/force-logout")
def force_logout(
    body: ForceLogoutRequest,
    request: Request,
    ctx: AuthContext = Depends(require_permission("force_logout")),
):
    """
    Revoke all live sessions for the target user via the SECURITY DEFINER
    RPC. Runs as the calling user (RLS aware) — no service-role key needed.
    """
    sb = request.app.state.supabase
    try:
        # Forward the caller's JWT so auth.uid() resolves to them inside the RPC.
        # require_user already called _sb_with_user_token on app.state.supabase.
        result = sb.rpc("sysadmin_force_logout", {"target_auth_user_id": body.auth_user_id}).execute()
        revoked = getattr(result, "data", 0) or 0
        # The audit-log row is inserted by the RPC itself; we still log here too
        # so failures from outside the RPC show up.
        log_sysadmin_action(
            sb, actor=ctx, action="user.force_logout",
            target_type="auth_user", target_id=body.auth_user_id,
            metadata={"sessions_revoked": revoked},
            request=request, status_val="success",
        )
        return {"ok": True, "sessions_revoked": revoked}
    except Exception as e:
        msg = str(e)
        log_sysadmin_action(
            sb, actor=ctx, action="user.force_logout",
            target_type="auth_user", target_id=body.auth_user_id,
            request=request, status_val="failure", error_message=msg,
        )
        raise HTTPException(status_code=500, detail=f"Force logout failed: {msg}")


class BlockUserRequest(BaseModel):
    auth_user_id: str
    block: bool


@router.post("/block-user")
def block_user(
    body: BlockUserRequest,
    request: Request,
    ctx: AuthContext = Depends(require_permission("force_logout")),
):
    """Block (or unblock) a user from signing in. Implemented via SQL RPC."""
    sb = request.app.state.supabase
    try:
        result = sb.rpc("sysadmin_set_user_blocked", {
            "target_auth_user_id": body.auth_user_id,
            "block": body.block,
        }).execute()
        data = getattr(result, "data", None) or {}
        log_sysadmin_action(
            sb, actor=ctx,
            action="user.block" if body.block else "user.unblock",
            target_type="auth_user", target_id=body.auth_user_id,
            metadata=data, request=request, status_val="success",
        )
        return {"ok": True, **data}
    except Exception as e:
        msg = str(e)
        log_sysadmin_action(
            sb, actor=ctx,
            action="user.block" if body.block else "user.unblock",
            target_type="auth_user", target_id=body.auth_user_id,
            request=request, status_val="failure", error_message=msg,
        )
        raise HTTPException(status_code=500, detail=msg)


class ResolveErrorRequest(BaseModel):
    error_id: str


@router.post("/errors/resolve")
def resolve_error(
    body: ResolveErrorRequest,
    request: Request,
    ctx: AuthContext = Depends(require_permission("resolve_errors")),
):
    sb = request.app.state.supabase
    sb.table("system_error_log").update({
        "resolved": True,
        "resolved_by": ctx.auth_user_id,
        "resolved_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", body.error_id).execute()
    log_sysadmin_action(
        sb, actor=ctx, action="error.resolve",
        target_type="system_error", target_id=body.error_id, request=request,
    )
    return {"ok": True}


class FeatureFlagRequest(BaseModel):
    company_id: str
    flag_key: str
    enabled: bool
    metadata: Optional[Dict[str, Any]] = None


@router.post("/feature-flag")
def set_feature_flag(
    body: FeatureFlagRequest,
    request: Request,
    ctx: AuthContext = Depends(require_permission("set_feature_flags")),
):
    sb = request.app.state.supabase
    sb.table("company_feature_flags").upsert({
        "company_id": body.company_id,
        "flag_key": body.flag_key,
        "enabled": body.enabled,
        "metadata": body.metadata or {},
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": ctx.auth_user_id,
    }).execute()
    log_sysadmin_action(
        sb, actor=ctx, action="feature_flag.set",
        target_type="company", target_id=body.company_id,
        metadata={"flag": body.flag_key, "enabled": body.enabled},
        request=request,
    )
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# Team management — owner-and-admin-with-manage_sysadmins only
# ─────────────────────────────────────────────────────────────────────────────
_VALID_ROLES = {"owner", "admin", "support", "billing", "security"}


@router.get("/team")
def list_team(
    request: Request,
    ctx: AuthContext = Depends(require_permission("manage_sysadmins")),
):
    sb = request.app.state.supabase
    res = (
        sb.table("system_users")
        .select("id,display_name,email,role,permissions,is_active,mfa_required,last_login_at,last_login_ip,created_at,invited_by,invited_at")
        .order("created_at", desc=False)
        .execute()
    )
    rows = res.data or []
    # Enrich with effective permissions
    for r in rows:
        r["auth_user_id"] = r["id"] # client compatibility
        r["effective_permissions"] = _resolve_permissions(r.get("role"), r.get("permissions") or {})
    return {"rows": rows, "role_defaults": _ROLE_DEFAULTS}


class InviteRequest(BaseModel):
    email: str
    display_name: str
    role: str
    password: Optional[str] = "Moamen224!"
    permissions: Optional[Dict[str, bool]] = None


@router.post("/team/invite")
def invite_sysadmin(
    body: InviteRequest,
    request: Request,
    ctx: AuthContext = Depends(require_permission("manage_sysadmins")),
):
    sb = request.app.state.supabase
    if body.role not in _VALID_ROLES:
        raise HTTPException(status_code=422, detail=f"Invalid role. Must be one of {sorted(_VALID_ROLES)}")
    if body.role == "owner":
        raise HTTPException(status_code=400, detail="Cannot invite as owner. Transfer ownership instead.")

    try:
        # Create the system user using our custom RPC which hashes the password securely
        res = sb.rpc("create_system_user", {
            "p_email": body.email,
            "p_password": body.password or "Moamen224!",
            "p_display_name": body.display_name,
            "p_role": body.role,
            "p_permissions": body.permissions or {}
        }).execute()
        
        data = getattr(res, "data", None) or {}
        if not data.get("success"):
            raise HTTPException(status_code=400, detail=data.get("error", "Failed to create system user."))
    except Exception as e:
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=f"Insert failed: {e}")

    log_sysadmin_action(
        sb, actor=ctx, action="sysadmin.invite",
        target_type="sysadmin_email", target_id=body.email,
        metadata={"role": body.role}, request=request,
    )
    return {"ok": True}


class UpdateTeamRequest(BaseModel):
    role: Optional[str] = None
    permissions: Optional[Dict[str, bool]] = None
    is_active: Optional[bool] = None
    mfa_required: Optional[bool] = None
    display_name: Optional[str] = None


@router.patch("/team/{sysadmin_id}")
def update_sysadmin(
    sysadmin_id: str,
    body: UpdateTeamRequest,
    request: Request,
    ctx: AuthContext = Depends(require_permission("manage_sysadmins")),
):
    sb = request.app.state.supabase
    if body.role is not None and body.role not in _VALID_ROLES:
        raise HTTPException(status_code=422, detail=f"Invalid role")

    # Only the owner can promote someone to owner (transfer of ownership).
    if body.role == "owner" and ctx.sysadmin_role != "owner":
        raise HTTPException(status_code=403, detail="Only the current owner can transfer ownership.")

    update: Dict[str, Any] = {}
    if body.role is not None:        update["role"] = body.role
    if body.permissions is not None: update["permissions"] = body.permissions
    if body.is_active is not None:   update["is_active"] = body.is_active
    if body.mfa_required is not None: update["mfa_required"] = body.mfa_required
    if body.display_name is not None: update["display_name"] = body.display_name

    if not update:
        raise HTTPException(status_code=400, detail="No fields to update.")

    # If promoting someone to owner, demote current owner to admin in the same
    # transaction (best-effort — Postgres trigger prevents accidental owner loss).
    if body.role == "owner":
        try:
            sb.table("system_users").update({"role": "admin"}).eq("role", "owner").neq("id", sysadmin_id).execute()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to demote prior owner: {e}")

    try:
        sb.table("system_users").update(update).eq("id", sysadmin_id).execute()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Update failed: {e}")

    log_sysadmin_action(
        sb, actor=ctx, action="sysadmin.update",
        target_type="sysadmin", target_id=sysadmin_id,
        metadata=update, request=request,
    )
    return {"ok": True}


@router.delete("/team/{sysadmin_id}")
def delete_sysadmin(
    sysadmin_id: str,
    request: Request,
    ctx: AuthContext = Depends(require_permission("manage_sysadmins")),
):
    sb = request.app.state.supabase
    # Prevent self-deletion
    if sysadmin_id == ctx.sysadmin_id:
        raise HTTPException(status_code=400, detail="You cannot remove yourself.")
    try:
        sb.table("system_users").delete().eq("id", sysadmin_id).execute()
    except Exception as e:
        # The owner-protection trigger will raise on deleting the owner.
        raise HTTPException(status_code=400, detail=str(e))

    log_sysadmin_action(
        sb, actor=ctx, action="sysadmin.delete",
        target_type="sysadmin", target_id=sysadmin_id, request=request,
    )
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# Custom System User Login & Backend observables proxy routes
# ─────────────────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
def login_sysadmin(body: LoginRequest, request: Request):
    sb = request.app.state.supabase
    if sb is None:
        raise HTTPException(status_code=503, detail="DB unavailable.")

    ip = _client_ip(request)
    if ip and is_ip_locked(sb, ip):
        record_login_attempt(sb, ip=ip, email=body.email, success=False)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts. Try again in 15 minutes.",
        )

    try:
        res = sb.rpc("verify_system_user_password", {
            "p_email": body.email,
            "p_password": body.password
        }).execute()
        data = getattr(res, "data", None) or {}
    except Exception as e:
        record_login_attempt(sb, ip=ip, email=body.email, success=False)
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

    if not data.get("valid"):
        record_login_attempt(sb, ip=ip, email=body.email, success=False)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    # Success
    record_login_attempt(sb, ip=ip, email=body.email, success=True)

    try:
        sb.table("system_users").update({
            "last_login_at": datetime.now(timezone.utc).isoformat(),
            "last_login_ip": ip,
        }).eq("id", data["id"]).execute()
    except Exception:
        pass

    secret = os.getenv("SUPABASE_JWT_SECRET") or "local-sysadmin-secret-key-fallback"

    payload = {
        "sub": data["id"],
        "email": data["email"],
        "role": "authenticated",
        "aud": "authenticated",
        "is_sysadmin": True,
        "exp": datetime.now(timezone.utc) + timedelta(hours=24)
    }

    token = jwt.encode(payload, secret, algorithm="HS256")

    log_sysadmin_action(
        sb, actor=AuthContext(payload, is_sysadmin=True),
        action="sysadmin.login", request=request,
    )

    return {
        "token": token,
        "sysadmin_id": data["id"],
        "display_name": data["display_name"],
        "mfa_required": data["mfa_required"],
        "role": data["role"],
        "permissions": _resolve_permissions(data["role"], data["permissions"] or {})
    }


@router.get("/attempts")
def get_login_attempts(
    request: Request,
    limit: int = 200,
    ctx: AuthContext = Depends(require_sysadmin),
):
    sb = request.app.state.supabase
    cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    res = (
        sb.table("sysadmin_login_attempts")
        .select("*")
        .gte("created_at", cutoff)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return {"rows": res.data or []}


@router.get("/route-versions")
def get_route_versions(
    request: Request,
    limit: int = 500,
    ctx: AuthContext = Depends(require_sysadmin),
):
    sb = request.app.state.supabase
    res = (
        sb.table("route_versions")
        .select("id,company_id,uploaded_at,filename,row_count,status,tag")
        .order("uploaded_at", desc=True)
        .limit(limit)
        .execute()
    )
    return {"rows": res.data or []}
