import os
import json
import time
import uuid
import traceback
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
from supabase import create_client, Client
from google.genai import errors as genai_errors
try:
    from .config import load_env, gemini_key_configured, gemini_key_placeholder
except ImportError:
    from config import load_env, gemini_key_configured, gemini_key_placeholder

load_env()

try:
    # Package import (supports `python -m uvicorn server_py.main:app`)
    from .analyzer_service import analyzer_service
    from .data_assist import router as data_assist_router
    from .excel_etl import router as excel_etl_router
    from .sysadmin_routes import router as sysadmin_router
    from .security import (
        require_user, AuthContext, log_gemini_usage, log_system_error,
    )
except ImportError:
    # Script import (supports `cd server_py && python -m uvicorn main:app`)
    from analyzer_service import analyzer_service
    from data_assist import router as data_assist_router
    from excel_etl import router as excel_etl_router
    from sysadmin_routes import router as sysadmin_router
    from security import (
        require_user, AuthContext, log_gemini_usage, log_system_error,
    )

app = FastAPI(title="Reach Analyzer API", version="2.0.0")
app.include_router(data_assist_router)
app.include_router(excel_etl_router)
app.include_router(sysadmin_router)

# CORS — strict allowlist. Override via env CORS_ALLOWED_ORIGINS (comma-separated).
_default_origins = "http://localhost:3001,http://localhost:5173,http://127.0.0.1:3001"
_allowed_origins = [
    o.strip() for o in os.getenv("CORS_ALLOWED_ORIGINS", _default_origins).split(",") if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Company-Id"],
)

# Supabase Setup — fail closed if not configured. No hardcoded fallback.
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY")

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"⚠️  Supabase connection failed: {e}. Results will not be cached.")
else:
    print("⚠️  SUPABASE_URL / SUPABASE_KEY not set — DB writes disabled.")

# Make supabase + config available to all routers via app.state
app.state.supabase = supabase


class ChatRequest(BaseModel):
    analysis_id: str
    message: str
    # Optional: client can pass the context directly to avoid DB round-trip
    context: Optional[Dict[str, Any]] = None


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Reach Analyzer API v2",
        "gemini_configured": gemini_key_configured(),
        "gemini_key_placeholder": gemini_key_placeholder(),
        "supabase_connected": supabase is not None,
    }


MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB hard cap
ALLOWED_UPLOAD_EXT = {"csv", "xlsx", "xls"}


def _resolve_company_id(sb: Optional[Client], auth_user_id: str) -> Optional[str]:
    """Look up the caller's company_id from app_users — never trust client form data."""
    if not sb:
        return None
    try:
        res = sb.table("app_users").select("company_id").eq("auth_user_id", auth_user_id).single().execute()
        return (res.data or {}).get("company_id") if hasattr(res, "data") else None
    except Exception:
        return None


@app.post("/analyze")
async def analyze_file(
    request: Request,
    file: UploadFile = File(...),
    ctx: AuthContext = Depends(require_user),
):
    """Authenticated. user_id and company_id are derived from JWT, never form."""
    started = time.time()
    auth_user_id = ctx.auth_user_id
    company_id = _resolve_company_id(supabase, auth_user_id)

    # Validate file
    filename = file.filename or "upload.csv"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ALLOWED_UPLOAD_EXT:
        raise HTTPException(status_code=415, detail=f"Unsupported file type: .{ext}")

    try:
        content = await file.read()
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="File exceeds 25 MB limit.")

        analysis_id = str(uuid.uuid4())
        analysis_data = await analyzer_service.generate_analysis(content, filename, company_id or "unknown")

        if supabase:
            try:
                supabase.table("user_analyses").insert({
                    "id": analysis_id,
                    "user_id": auth_user_id,
                    "company_id": company_id,
                    "file_name": filename,
                    "metadata": analysis_data.get("metadata", {}),
                    "last_results": analysis_data,
                    "status": "completed",
                }).execute()
            except Exception as db_err:
                print(f"[WARN] DB insert failed (results still returned): {db_err}")

        log_gemini_usage(
            supabase, company_id=company_id, user_id=auth_user_id,
            surface="analyzer", model="gemini-2.0-flash",
            duration_ms=int((time.time() - started) * 1000), status_val="success",
        )

        return {"analysis_id": analysis_id, "results": {**analysis_data, "analysis_id": analysis_id}}

    except HTTPException:
        raise
    except RuntimeError as e:
        log_system_error(supabase, source="backend.analyze", message=str(e),
                         severity="warning", company_id=company_id, user_id=auth_user_id,
                         request_path="/analyze")
        raise HTTPException(status_code=503, detail=str(e))
    except genai_errors.APIError as e:
        code = 502
        try:
            code = int(getattr(e, "code", code))
        except Exception:
            pass
        log_gemini_usage(supabase, company_id=company_id, user_id=auth_user_id,
                         surface="analyzer", model="gemini-2.0-flash",
                         duration_ms=int((time.time() - started) * 1000),
                         status_val="failure", error_message=str(e))
        raise HTTPException(status_code=code, detail=getattr(e, "message", str(e)))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        log_system_error(supabase, source="backend.analyze", message=str(e),
                         severity="error", company_id=company_id, user_id=auth_user_id,
                         stack_trace=traceback.format_exc(), request_path="/analyze")
        print(f"[ERROR] Analysis failed: {e}")
        raise HTTPException(status_code=500, detail="Analysis failed.")


@app.post("/chat")
async def chat_with_data(
    req: ChatRequest,
    request: Request,
    ctx: AuthContext = Depends(require_user),
):
    """Authenticated. Caller can only fetch analyses tied to their own company."""
    started = time.time()
    auth_user_id = ctx.auth_user_id
    company_id = _resolve_company_id(supabase, auth_user_id)

    try:
        context = req.context

        if not context and supabase:
            try:
                # Enforce ownership at query time
                q = supabase.table("user_analyses").select("last_results,company_id").eq("id", req.analysis_id).single().execute()
                row = q.data or {}
                if row.get("company_id") and company_id and row["company_id"] != company_id:
                    raise HTTPException(status_code=403, detail="Analysis belongs to another tenant.")
                context = row.get("last_results", {})
            except HTTPException:
                raise
            except Exception as e:
                print(f"[WARN] Could not fetch analysis from DB: {e}")

        if not context:
            context = {}

        answer = await analyzer_service.chat_with_analysis(context, req.message)

        log_gemini_usage(
            supabase, company_id=company_id, user_id=auth_user_id,
            surface="chat", model="gemini-2.0-flash",
            duration_ms=int((time.time() - started) * 1000), status_val="success",
        )
        return {"answer": answer}

    except HTTPException:
        raise
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except genai_errors.APIError as e:
        code = 502
        try:
            code = int(getattr(e, "code", code))
        except Exception:
            pass
        raise HTTPException(status_code=code, detail=getattr(e, "message", str(e)))
    except Exception as e:
        log_system_error(supabase, source="backend.chat", message=str(e),
                         severity="error", company_id=company_id, user_id=auth_user_id,
                         stack_trace=traceback.format_exc(), request_path="/chat")
        print(f"[ERROR] Chat failed: {e}")
        raise HTTPException(status_code=500, detail="Chat failed.")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
