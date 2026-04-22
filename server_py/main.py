import os
import json
import uuid
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
from supabase import create_client, Client
from dotenv import load_dotenv
from analyzer_service import analyzer_service

load_dotenv()

app = FastAPI(title="Reach Analyzer API", version="2.0.0")

# CORS — allow the Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase Setup (graceful fallback if not configured)
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://mpkfvaccnsucdmxxtosu.supabase.co")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY") or \
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wa2Z2YWNjbnN1Y2RteHh0b3N1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3NzQ3ODQsImV4cCI6MjA4MzM1MDc4NH0.dlfstdHCzWJF-CMCa93J4RsZvm2nwhqnE5hvZ_8pkEo"

try:
    supabase: Optional[Client] = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    print(f"⚠️  Supabase connection failed: {e}. Results will not be cached.")
    supabase = None


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
        "gemini_configured": bool(os.getenv("GEMINI_API_KEY")),
        "supabase_connected": supabase is not None,
    }


@app.post("/analyze")
async def analyze_file(
    file: UploadFile = File(...),
    user_id: str = Form(...),
    company_id: str = Form(...)
):
    """
    Main endpoint: receives a CSV/Excel file, orchestrates AI analysis,
    caches results to Supabase, and returns structured insights.
    """
    try:
        content = await file.read()
        filename = file.filename or "upload.csv"
        analysis_id = str(uuid.uuid4())

        # Run AI Analysis
        analysis_data = await analyzer_service.generate_analysis(content, filename, company_id)

        # Persist to Supabase (non-blocking failure)
        if supabase:
            try:
                db_data = {
                    "id": analysis_id,
                    "user_id": user_id,
                    "company_id": company_id,
                    "file_name": filename,
                    "metadata": analysis_data.get('metadata', {}),
                    "last_results": analysis_data,
                    "status": "completed"
                }
                supabase.table("user_analyses").insert(db_data).execute()
            except Exception as db_err:
                print(f"[WARN] DB insert failed (results still returned): {db_err}")

        return {
            "analysis_id": analysis_id,
            "results": {
                **analysis_data,
                "analysis_id": analysis_id
            }
        }

    except RuntimeError as e:
        # Config errors (missing API key etc.)
        raise HTTPException(status_code=503, detail=str(e))
    except ValueError as e:
        # File parsing errors
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        print(f"[ERROR] Analysis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/chat")
async def chat_with_data(req: ChatRequest):
    """
    Context-aware chat endpoint. Uses previously stored analysis or
    client-supplied context to answer follow-up questions.
    """
    try:
        context = req.context

        # If client didn't supply context, fetch from DB
        if not context and supabase:
            try:
                result = supabase.table("user_analyses").select("last_results").eq("id", req.analysis_id).single().execute()
                if result.data:
                    context = result.data.get("last_results", {})
            except Exception as e:
                print(f"[WARN] Could not fetch analysis from DB: {e}")

        if not context:
            context = {}

        answer = await analyzer_service.chat_with_analysis(context, req.message)
        return {"answer": answer}

    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        print(f"[ERROR] Chat failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
