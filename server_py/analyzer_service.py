import pandas as pd
import io
import os
import json
from typing import Dict, Any
from google import genai
from google.genai import types

try:
    from .config import load_env
except ImportError:
    from config import load_env

load_env()

# Configure Gemini using the new SDK
api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
if not api_key:
    print("⚠️  Warning: GEMINI_API_KEY not found. Set it in server_py/.env")
    client = None
else:
    client = genai.Client(api_key=api_key)

MODEL_ID = "gemini-2.0-flash"

MASTER_SYSTEM_PROMPT = """
You are a Senior Business Intelligence Consultant AI.
Your mission is to analyze a user's dataset and provide instant, actionable business insights.

Given a set of column headers and sample rows, you must:
1. Identify the business domain (Sales, HR, Logistics, Finance, etc.).
2. Map cryptic or abbreviated column names to professional business terms.
3. Write valid Python code using 'pandas' to calculate 5 key business KPIs and extract 3 hidden insights.
4. Provide structured data for 2 charts: a trend line and a distribution.
5. Write an executive summary (2-3 compelling sentences) as if presenting to a C-Suite.
6. Suggest 3 intelligent follow-up questions the user might want to ask.

CRITICAL RULES:
- You MUST respond ONLY with a valid JSON object. No markdown, no explanations.
- The 'python_logic' key must contain a Python string that:
  - Assumes a 'df' (pandas DataFrame) variable is already loaded.
  - Assigns final output to a dict named 'results'.
  - Sets 'results["kpi_cards"]': list of {label, value, trend, description}
  - Sets 'results["insights"]': list of {title, description, impact}
  - Sets 'results["charts"]': dict with "trend" (list of {name, value}) and "distribution" (list of {name, value})
  - Handles potential missing columns gracefully using try/except.
  - All numeric values should be formatted as strings (e.g., "1,234" or "45%").

JSON Keys Required: domain, mapping, python_logic, executive_summary, follow_up_questions
"""

class AnalyzerService:
    def get_file_metadata(self, file_content: bytes, filename: str) -> Dict[str, Any]:
        """
        Extracts headers and the first 5 rows to minimize token usage.
        """
        file_ext = filename.rsplit('.', 1)[-1].lower()
        
        if file_ext == 'csv':
            df = pd.read_csv(io.BytesIO(file_content), nrows=100)
        elif file_ext in ['xls', 'xlsx']:
            df = pd.read_excel(io.BytesIO(file_content), nrows=100)
        else:
            raise ValueError("Unsupported file format. Please upload CSV or Excel.")

        headers = df.columns.tolist()
        # Convert sample to JSON-safe format
        sample_rows = json.loads(df.head(5).to_json(orient='records', date_format='iso'))
        
        return {
            "headers": headers,
            "sample_rows": sample_rows,
            "total_columns": len(headers),
            "file_type": file_ext
        }

    async def generate_analysis(self, file_content: bytes, filename: str, company_id: str) -> Dict[str, Any]:
        """
        The Master Logic: Extract metadata → LLM generates spec → execute Python → return results.
        """
        if not client:
            raise RuntimeError(
                "Gemini API key is not configured. Set `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) "
                "to your real key in `server_py/.env` and restart the backend."
            )

        metadata = self.get_file_metadata(file_content, filename)
        
        user_prompt = f"""
Analyze this dataset:

Column Headers: {metadata['headers']}
Sample Rows (first 5): {json.dumps(metadata['sample_rows'], indent=2)}

Generate the full analysis JSON as instructed.
"""

        # Call LLM with new SDK
        response = client.models.generate_content(
            model=MODEL_ID,
            config=types.GenerateContentConfig(
                system_instruction=MASTER_SYSTEM_PROMPT,
                temperature=0.3,
            ),
            contents=user_prompt,
        )
        ai_response_text = response.text.strip()
        
        # Clean response if LLM adds markdown backticks
        if "```json" in ai_response_text:
            ai_response_text = ai_response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in ai_response_text:
            ai_response_text = ai_response_text.split("```")[1].split("```")[0].strip()

        try:
            analysis_spec = json.loads(ai_response_text)
        except json.JSONDecodeError as e:
            print(f"[ERROR] Failed to parse AI JSON response: {ai_response_text[:500]}")
            raise ValueError(f"AI returned invalid JSON: {e}")

        # Execute the AI-generated Python logic against the full dataset
        results = self.execute_analysis_logic(file_content, filename, analysis_spec.get('python_logic', ''))
        
        return {
            "domain": analysis_spec.get('domain', 'General Business'),
            "mapping": analysis_spec.get('mapping', {}),
            "executive_summary": analysis_spec.get('executive_summary', ''),
            "follow_up_questions": analysis_spec.get('follow_up_questions', []),
            "kpis": results.get('kpi_cards', []),
            "insights": results.get('insights', []),
            "charts": results.get('charts', {"trend": [], "distribution": []}),
            "metadata": metadata
        }

    def execute_analysis_logic(self, file_content: bytes, filename: str, python_code: str) -> Dict[str, Any]:
        """
        Runs the AI-generated Python code in a hardened sandbox:
          - Restricted builtins (no import, no open, no eval/exec, no os/sys)
          - Static code scan blocks known-bad tokens (os, subprocess, __import__, ...)
          - 15s wall-clock timeout
        """
        file_ext = filename.rsplit('.', 1)[-1].lower()
        if file_ext == 'csv':
            df = pd.read_csv(io.BytesIO(file_content))
        else:
            df = pd.read_excel(io.BytesIO(file_content))

        # ── Static block-list — refuse to execute if Gemini emitted anything dangerous
        forbidden = (
            "import os", "import sys", "import subprocess", "import socket",
            "import shutil", "import requests", "import urllib", "import http",
            "import pathlib", "import pickle", "import marshal", "import ctypes",
            "import importlib", "__import__", "eval(", "exec(", "compile(",
            "open(", "globals(", "locals(", "vars(", "getattr(", "setattr(",
            "delattr(", "breakpoint(", "input(",
        )
        low = python_code.lower()
        for needle in forbidden:
            if needle.lower() in low:
                print(f"[SECURITY] Refused AI code containing forbidden token: {needle!r}")
                return self._fallback_kpis(df)

        # ── Restricted builtins — minimal whitelist
        safe_builtins = {
            "abs": abs, "all": all, "any": any, "bool": bool, "dict": dict,
            "enumerate": enumerate, "filter": filter, "float": float, "int": int,
            "len": len, "list": list, "map": map, "max": max, "min": min,
            "range": range, "round": round, "set": set, "sorted": sorted,
            "str": str, "sum": sum, "tuple": tuple, "zip": zip, "print": print,
            "isinstance": isinstance, "type": type, "True": True, "False": False, "None": None,
        }
        sandbox_globals = {"__builtins__": safe_builtins, "pd": pd}
        local_scope = {"df": df, "results": {}, "pd": pd}

        # ── Timeout — 15s wall clock (SIGALRM, POSIX only)
        import signal
        class _Timeout(Exception): ...
        def _handle(signum, frame):
            raise _Timeout("AI code execution exceeded 15s timeout.")
        alarm_installed = False
        try:
            try:
                signal.signal(signal.SIGALRM, _handle)
                signal.alarm(15)
                alarm_installed = True
            except Exception:
                pass  # non-POSIX or non-main-thread; rely on Gemini being well-behaved
            exec(python_code, sandbox_globals, local_scope)  # noqa: S102 — sandboxed above
            return local_scope.get('results', {})
        except _Timeout as te:
            print(f"[SECURITY] {te}")
            return self._fallback_kpis(df)
        except Exception as e:
            print(f"[ERROR] AI code execution failed: {e}")
            return self._fallback_kpis(df)
        finally:
            if alarm_installed:
                try:
                    signal.alarm(0)
                except Exception:
                    pass

    def _fallback_kpis(self, df) -> Dict[str, Any]:
        fallback_kpis = []
        for col in df.select_dtypes(include='number').columns[:5]:
            fallback_kpis.append({
                "label": col,
                "value": f"{df[col].sum():,.0f}",
                "trend": "up",
                "description": f"Total sum of {col}",
            })
        return {
            "kpi_cards": fallback_kpis,
            "insights": [{"title": "Data Loaded", "description": f"Dataset has {len(df)} rows and {len(df.columns)} columns.", "impact": "medium"}],
            "charts": {
                "trend": [{"name": str(i), "value": int(v)} for i, v in enumerate(df.select_dtypes(include='number').iloc[:, 0].dropna().head(10).tolist())] if len(df.select_dtypes(include='number').columns) > 0 else [],
                "distribution": [{"name": str(k), "value": int(v)} for k, v in df.select_dtypes(include='number').iloc[:, 0].value_counts().head(5).items()] if len(df.select_dtypes(include='number').columns) > 0 else [],
            },
        }

    async def chat_with_analysis(self, analysis_context: dict, user_message: str) -> str:
        """
        Context-aware chat using the initial analysis results.
        """
        if not client:
            raise RuntimeError(
                "Gemini API key is not configured. Set `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) "
                "to your real key in `server_py/.env` and restart the backend."
            )

        system = """
You are a Senior Business Intelligence Consultant AI.
The user has uploaded and analyzed a dataset. You have context from the initial analysis.
Answer their follow-up questions clearly and professionally, referencing the data insights.
Keep responses concise (2-4 sentences unless a detailed breakdown is needed).
"""
        context_str = f"""
Dataset Domain: {analysis_context.get('domain', 'Unknown')}
Executive Summary: {analysis_context.get('executive_summary', '')}
Column Mapping: {json.dumps(analysis_context.get('mapping', {}), indent=2)}
KPIs Found: {json.dumps([k.get('label') for k in analysis_context.get('kpis', [])], indent=2)}
"""
        prompt = f"{context_str}\n\nUser Question: {user_message}"

        response = client.models.generate_content(
            model=MODEL_ID,
            config=types.GenerateContentConfig(
                system_instruction=system,
                temperature=0.5,
            ),
            contents=prompt,
        )
        return response.text

analyzer_service = AnalyzerService()
