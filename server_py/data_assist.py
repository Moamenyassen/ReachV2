"""
Data Assist — backend module.

Pipeline:
1. /data-assist/profile : receives an uploaded file (xlsx/xls/csv),
   parses with pandas, returns a JSON profile (columns, dtypes,
   basic stats, 20-row preview, AI-detected schema via Gemini).
2. /data-assist/analyze : receives a confirmed schema + analysis plan,
   runs pandas computations, asks Gemini to write narrative for each
   computed result, returns insight cards ready for Recharts.

Deliberate split:
- pandas does the math (free, exact, no API limits)
- Gemini does the framing (semantic detection + narrative)

Files are NOT persisted server-side. The frontend is responsible for
saving the resulting project to Supabase.
"""

from __future__ import annotations

import io
import json
import os
import re
from typing import Any, Dict, List, Optional

import pandas as pd
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel

try:
    from google import genai
    from google.genai import types as genai_types
    _GENAI_AVAILABLE = True
except Exception:
    _GENAI_AVAILABLE = False


router = APIRouter(prefix="/data-assist", tags=["Data Assist"])


# -----------------------------------------------------------
# Helpers
# -----------------------------------------------------------

MAX_PREVIEW_ROWS = 20
MAX_SAMPLE_FOR_AI = 50
MAX_FILE_BYTES = 100 * 1024 * 1024  # 100 MB upload cap
MAX_ROWS = 500_000                    # pandas handles this easily

# In-memory dataset cache: dataset_id -> { df, expires_at }
# Avoids re-uploading large files between /profile and /analyze.
import time
import uuid as _uuid
from threading import Lock as _Lock

_DATASET_CACHE: Dict[str, Dict[str, Any]] = {}
_CACHE_LOCK = _Lock()
_CACHE_TTL_SEC = 60 * 60  # 1 hour


def _cache_set(df: "pd.DataFrame") -> str:
    """Store df, return dataset_id. Sweeps expired entries."""
    now = time.time()
    ds_id = _uuid.uuid4().hex
    with _CACHE_LOCK:
        # Sweep
        for k in list(_DATASET_CACHE.keys()):
            if _DATASET_CACHE[k]["expires_at"] < now:
                del _DATASET_CACHE[k]
        _DATASET_CACHE[ds_id] = {"df": df, "expires_at": now + _CACHE_TTL_SEC}
    return ds_id


def _cache_get(ds_id: str) -> Optional["pd.DataFrame"]:
    with _CACHE_LOCK:
        entry = _DATASET_CACHE.get(ds_id)
        if entry is None or entry["expires_at"] < time.time():
            return None
        return entry["df"]

DATE_HINT_RE = re.compile(r"date|day|time|month|year|created|updated|when", re.I)
GEO_HINT_RE = re.compile(r"lat|lng|long|coord|gps|region|city|country|address", re.I)
ID_HINT_RE = re.compile(r"\b(id|code|uuid|sku|key|number|no)\b", re.I)
METRIC_HINT_RE = re.compile(
    r"revenue|sales|amount|price|cost|qty|quantity|count|total|sum|profit|stock|score|rate|tax|vat",
    re.I,
)


def _df_from_upload(filename: str, content: bytes) -> pd.DataFrame:
    """Parse uploaded bytes into a DataFrame based on extension."""
    if len(content) > MAX_FILE_BYTES:
        raise HTTPException(413, f"File exceeds {MAX_FILE_BYTES // (1024*1024)} MB cap.")
    name = (filename or "").lower()
    try:
        if name.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(content))
        elif name.endswith(".csv"):
            # Try utf-8 then fallback latin-1
            try:
                df = pd.read_csv(io.BytesIO(content))
            except UnicodeDecodeError:
                df = pd.read_csv(io.BytesIO(content), encoding="latin-1")
        else:
            raise HTTPException(415, "Unsupported file type. Use .xlsx, .xls, or .csv")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, f"Failed to parse file: {e}")

    if len(df) > MAX_ROWS:
        raise HTTPException(413, f"Row count {len(df):,} exceeds {MAX_ROWS:,}. Split your file.")
    return df


def _infer_role_heuristic(col_name: str, series: pd.Series) -> Dict[str, Any]:
    """Quick rule-based role guess used as a fallback if AI is unavailable."""
    name = str(col_name)
    # Date detection
    if pd.api.types.is_datetime64_any_dtype(series) or DATE_HINT_RE.search(name):
        return {"role": "date", "semantic": "timestamp"}
    # Numeric → metric (unless name screams identifier)
    if pd.api.types.is_numeric_dtype(series):
        if ID_HINT_RE.search(name) and not METRIC_HINT_RE.search(name):
            return {"role": "identifier", "semantic": "id"}
        return {"role": "metric", "semantic": "numeric"}
    # Geo
    if GEO_HINT_RE.search(name):
        return {"role": "geo", "semantic": "location"}
    # Identifier
    if ID_HINT_RE.search(name):
        return {"role": "identifier", "semantic": "id"}
    # Default: dimension
    return {"role": "dimension", "semantic": "category"}


def _basic_stats(series: pd.Series) -> Dict[str, Any]:
    """Per-column stats kept small + JSON-safe."""
    s = series.dropna()
    stats: Dict[str, Any] = {
        "count": int(series.count()),
        "missing": int(series.isna().sum()),
        "distinct": int(s.nunique()) if len(s) > 0 else 0,
    }
    if pd.api.types.is_numeric_dtype(series) and len(s) > 0:
        stats.update({
            "min": float(s.min()),
            "max": float(s.max()),
            "mean": float(s.mean()),
            "median": float(s.median()),
            "sum": float(s.sum()),
        })
    elif pd.api.types.is_datetime64_any_dtype(series) and len(s) > 0:
        stats.update({
            "min": str(s.min()),
            "max": str(s.max()),
        })
    else:
        # Top categories for dimensions
        if len(s) > 0:
            top = s.value_counts().head(5)
            stats["top"] = [{"value": str(k), "count": int(v)} for k, v in top.items()]
    return stats


def _df_to_json_safe_records(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """DataFrame → list of dicts with NaN/Inf scrubbed."""
    sanitized = df.replace({pd.NA: None}).where(pd.notnull(df), None)
    records: List[Dict[str, Any]] = []
    for row in sanitized.to_dict(orient="records"):
        clean = {}
        for k, v in row.items():
            if isinstance(v, float) and (v != v or v in (float("inf"), float("-inf"))):
                clean[str(k)] = None
            elif hasattr(v, "isoformat"):
                clean[str(k)] = v.isoformat()
            else:
                clean[str(k)] = v
        records.append(clean)
    return records


# -----------------------------------------------------------
# Gemini calls
# -----------------------------------------------------------

def _gemini_client() -> Optional[Any]:
    key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not key or not _GENAI_AVAILABLE:
        return None
    try:
        return genai.Client(api_key=key)
    except Exception as e:
        print(f"[data_assist] Gemini client init failed: {e}")
        return None


def _ai_detect_schema(columns: List[Dict[str, Any]], sample: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Ask Gemini to label each column's role + semantic + dataset type."""
    client = _gemini_client()
    if client is None:
        return None

    prompt = f"""You are a data-schema analyst. Given the columns below and a sample of rows,
return a strict JSON object describing the dataset.

COLUMNS (name + dtype + a few sample values):
{json.dumps(columns, default=str)[:4000]}

SAMPLE ROWS (first {len(sample)} rows):
{json.dumps(sample, default=str)[:6000]}

Return JSON with this exact shape:
{{
  "datasetType": "sales" | "inventory" | "customers" | "routes" | "financials" | "marketing" | "other",
  "suggestedTitle": "<short 2-4 word title>",
  "narrative": "<1 sentence: what this dataset is about>",
  "columns": [
    {{
      "name": "<exact column name>",
      "role": "dimension" | "metric" | "date" | "identifier" | "geo",
      "semantic": "<short label: revenue | customer_id | region | etc.>",
      "unit": "<empty string or short unit like 'USD', 'kg', 'count'>"
    }}
  ],
  "mapping": {{
    "//": "Slot keys depend on datasetType. Use the EXACT column name from the dataset, or empty string if no match.",
    "// sales": "amount, quantity, item, category, customer, invoice, date",
    "// inventory": "item, quantity, category, value, location",
    "// customers": "customer, segment, value, region, date",
    "// routes": "route, customer, status, date",
    "// financials": "amount, account, category, date",
    "// marketing": "channel, spend, conversions, audience, date"
  }},
  "suggestedAnalyses": [
    {{
      "id": "<unique slug>",
      "title": "<5-8 word title>",
      "type": "kpi" | "bar" | "line" | "pie" | "heatmap",
      "metric": "<column name to aggregate, or empty for kpi count>",
      "groupBy": "<column name to group by, or empty>",
      "agg": "sum" | "mean" | "count" | "min" | "max",
      "sort": "asc" | "desc",
      "limit": 10
    }}
  ]
}}

Rules:
- For "mapping", emit ONLY the slot keys belonging to the chosen datasetType (see comments above). Match column names EXACTLY. If no clean match exists, leave the slot as an empty string — DO NOT force a wrong pick.
- "amount", "quantity", "value", "spend", "conversions" MUST be numeric columns that represent money/units, NOT identifiers. NEVER pick a column whose name contains "code", "_id", "salesman", "salesperson", "rep", "user", "employee" — those are IDs, not metrics. Example of a bad pick: amount = "SalesmanCode" (because Salesman is a person, not a sale amount).
- "invoice" / "order" must be a unique-ish reference number. NEVER pick a column whose name ends in "_type", "_status", "_class", or is otherwise a categorical label. Example bad pick: invoice = "TRANSACTION_TYPE" (that is a category, not an invoice number).
- "date" must be a column that parses as a real date. Prefer columns with date dtype. AVOID int-typed columns named like "Month_Name" / "Year_Name" / month numbers — they are labels, not dates.
- "item", "customer", "account", "channel", "segment", "region", "route" can be code / name columns with reasonable cardinality.
- Generate 10 to 14 suggested analyses with VARIETY (mix of kpi / bar / line / pie). These are a fallback if the user picks datasetType="other".
- Always include at least 2 KPI cards covering the main metric and totals.
- If a date column exists, include 2+ time-series line charts.
- For each analysis, pick metric/groupBy from the actual column names listed above.
- Return ONLY the JSON, no markdown fences.
"""

    try:
        resp = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2,
                max_output_tokens=2500,
            ),
        )
        raw = (resp.text or "").strip()
        # Strip code fences if any
        if raw.startswith("```"):
            raw = re.sub(r"^```[a-zA-Z]*\n?", "", raw)
            raw = re.sub(r"\n?```$", "", raw)
        return json.loads(raw)
    except Exception as e:
        print(f"[data_assist] schema-detect failed: {e}")
        return None


def _ai_write_narrative(insight_title: str, computed: Any, dataset_context: str) -> str:
    """Short prose explanation of one computed insight. Falls back to template."""
    client = _gemini_client()
    if client is None:
        return f"{insight_title}: see chart for detail."

    try:
        resp = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=(
                f"Dataset context: {dataset_context}\n"
                f"Insight title: {insight_title}\n"
                f"Computed result (JSON): {json.dumps(computed, default=str)[:2000]}\n\n"
                "Write ONE short paragraph (max 30 words, plain prose, no markdown) explaining "
                "the most interesting takeaway. Be concrete with a number. Do NOT repeat the title."
            ),
            config=genai_types.GenerateContentConfig(
                temperature=0.3,
                max_output_tokens=200,
            ),
        )
        text = (resp.text or "").strip()
        return text or f"{insight_title}: see chart."
    except Exception as e:
        print(f"[data_assist] narrative failed: {e}")
        return f"{insight_title}: see chart."


# -----------------------------------------------------------
# Insight builder (compute + narrate batch)
# -----------------------------------------------------------

def _build_insights(
    df: pd.DataFrame,
    analyses: List[Dict[str, Any]],
    context: str,
    max_count: int = 14,
) -> List[Dict[str, Any]]:
    """Run analyses + write narratives → ready-to-render insight cards."""
    out: List[Dict[str, Any]] = []
    for spec in analyses[:max_count]:
        result = _run_analysis(df, spec)
        narrative = _ai_write_narrative(spec.get("title", "Insight"), result, context)
        out.append({
            "id": spec.get("id", f"ins-{len(out)+1}"),
            "title": spec.get("title", "Insight"),
            "type": result.get("type", "bar"),
            "narrative": narrative,
            "data": result.get("data") if result.get("type") != "kpi" else None,
            "value": result.get("value") if result.get("type") == "kpi" else None,
            "label": result.get("label", ""),
            "metric": result.get("metric", ""),
            "groupBy": result.get("groupBy", ""),
            "agg": result.get("agg", ""),
            "sort": spec.get("sort", ""),
            "limit": spec.get("limit", 0),
            "warning": result.get("warning"),
        })
    return out


def _apply_filters(df: pd.DataFrame, filters: Dict[str, List[Any]]) -> pd.DataFrame:
    """Apply { columnName: [allowed_values] } filters; ignores unknown columns."""
    if not filters:
        return df
    out = df
    for col, allowed in filters.items():
        if col in out.columns and isinstance(allowed, list) and allowed:
            # Cast allowed values to str for safe comparison with mixed dtypes
            allowed_str = [str(v) for v in allowed]
            out = out[out[col].astype(str).isin(allowed_str)]
    return out


# -----------------------------------------------------------
# Analysis primitives
# -----------------------------------------------------------

def _run_analysis(df: pd.DataFrame, spec: Dict[str, Any]) -> Dict[str, Any]:
    """Execute one analysis spec on the dataframe → chart-ready data.

    Supported aggs: sum, mean, count, min, max, nunique, rows_per_distinct.
    `rows_per_distinct` = len(df) / df[metric].nunique() (e.g. avg lines per invoice).
    """
    spec_type = spec.get("type", "bar")
    metric = spec.get("metric") or ""
    group_by = spec.get("groupBy") or ""
    agg = spec.get("agg", "sum")
    sort = spec.get("sort", "desc")
    limit = int(spec.get("limit", 10))

    try:
        # ---- KPI (single number) ----
        if spec_type == "kpi":
            if agg == "nunique":
                if metric and metric in df.columns:
                    return {"type": "kpi", "value": int(df[metric].nunique(dropna=True)), "label": f"distinct {metric}"}
                return {"type": "kpi", "value": int(len(df)), "label": "rows"}
            if agg == "rows_per_distinct":
                if metric and metric in df.columns:
                    n = int(df[metric].nunique(dropna=True))
                    val = float(len(df) / n) if n > 0 else 0.0
                    return {"type": "kpi", "value": val, "label": f"rows / unique {metric}"}
                return {"type": "kpi", "value": 0, "label": "n/a"}
            if agg == "count" and (not metric or metric not in df.columns):
                return {"type": "kpi", "value": int(len(df)), "label": "rows"}
            if metric and metric in df.columns and pd.api.types.is_numeric_dtype(df[metric]):
                value = float(getattr(df[metric], agg)())
                return {"type": "kpi", "value": value, "label": metric}
            return {"type": "kpi", "value": int(len(df)), "label": "rows"}

        # ---- chart types need groupBy ----
        if not group_by or group_by not in df.columns:
            return {"type": spec_type, "data": [], "warning": "groupBy column missing"}

        # Bin datetime group columns to YYYY-MM-DD so trends aren't fragmented
        if pd.api.types.is_datetime64_any_dtype(df[group_by]):
            grp_series = df[group_by].dt.strftime("%Y-%m-%d")
        else:
            grp_series = df[group_by]

        # Aggregate
        if agg == "nunique" and metric and metric in df.columns:
            grouped = df.groupby(grp_series, dropna=False)[metric].nunique()
        elif metric and metric in df.columns and pd.api.types.is_numeric_dtype(df[metric]):
            grouped = df.groupby(grp_series, dropna=False)[metric].agg(agg)
        else:
            grouped = df.groupby(grp_series, dropna=False).size()
            metric = "count"

        # Sort: line charts sort by index (time order); bar/pie sort by value
        if spec_type == "line":
            grouped = grouped.sort_index().head(limit)
        else:
            grouped = grouped.sort_values(ascending=(sort == "asc")).head(limit)

        data = [
            {"name": str(idx) if idx is not None else "—", "value": float(val) if pd.notna(val) else 0}
            for idx, val in grouped.items()
        ]
        return {"type": spec_type, "data": data, "metric": metric, "groupBy": group_by, "agg": agg}
    except Exception as e:
        return {"type": spec_type, "data": [], "warning": f"compute error: {e}"}


# -----------------------------------------------------------
# Preset analyses per dataset type
# -----------------------------------------------------------

# ----------------------------------------------------------------
# Mapping validation + heuristic fill — drops bad AI picks and fills gaps.
# ----------------------------------------------------------------

_NUMERIC_METRIC_SLOTS = {"amount", "quantity", "value", "spend", "conversions"}
# These regexes operate on column names normalized via _normalize_name() — `_` and `-` become spaces.
_ID_NAME_RE = re.compile(r"\b(code|id|key|uuid)$|^(code|id|key)\b|\b(salesman|salesperson|rep|user|employee|owner|operator)\b", re.I)
_TYPE_NAME_RE = re.compile(r"\b(type|status|class|kind|level)$|^(type|status|class|kind)\b", re.I)
_DATE_NAME_RE = re.compile(r"\b(date|day|time|created|invoiced|posted|timestamp)\b", re.I)


def _is_numeric_dtype(dtype: str) -> bool:
    return any(t in dtype.lower() for t in ("int", "float", "double", "number"))


def _is_date_dtype(dtype: str, role: str = "") -> bool:
    return "datetime" in dtype.lower() or role == "date"


def _normalize_name(name: str) -> str:
    # Split CamelCase ("SalesmanCode" → "Salesman Code"), then collapse _ - to spaces.
    s = re.sub(r"(?<=[a-z])(?=[A-Z])", " ", name)
    s = re.sub(r"(?<=[A-Z])(?=[A-Z][a-z])", " ", s)
    return re.sub(r"[_\-]+", " ", s)


def _validate_mapping(mapping: Dict[str, str], cols_by_name: Dict[str, Dict[str, Any]]) -> Dict[str, str]:
    """Drop AI-mapped slots that fail dtype/name sanity checks."""
    clean: Dict[str, str] = {}
    for slot, name in (mapping or {}).items():
        if not isinstance(name, str) or not name:
            continue
        col = cols_by_name.get(name)
        if not col:
            continue
        dt = col.get("dtype", "")
        norm = _normalize_name(name)
        # Numeric metric slots: must be numeric AND not an ID-like column.
        if slot in _NUMERIC_METRIC_SLOTS:
            if not _is_numeric_dtype(dt):
                continue
            if _ID_NAME_RE.search(norm):
                continue
        # Invoice slot: must NOT be a type/status/class column.
        if slot == "invoice" and _TYPE_NAME_RE.search(norm):
            continue
        # Date slot: prefer real date dtype; reject pure-int columns.
        if slot == "date":
            if not _is_date_dtype(dt, col.get("role", "")) and _is_numeric_dtype(dt):
                # int-typed "Month_Name" / "Year" columns are labels, not real dates.
                continue
        clean[slot] = name
    return clean


def _heuristic_fill_mapping(
    dataset_type: str,
    columns_info: List[Dict[str, Any]],
    current: Dict[str, str],
) -> Dict[str, str]:
    """Fill missing slots using rule-based detection over column names + dtypes."""
    keys = PRESET_MAPPING_KEYS.get(dataset_type, [])
    if not keys:
        return current
    out = dict(current)
    used = set(v for v in current.values() if v)

    SLOT_PATTERNS: Dict[str, List[re.Pattern]] = {
        "amount":      [re.compile(r"^(net|gross)?[_ ]?(sales|revenue|amount|total)$", re.I),
                        re.compile(r"\b(net[_ ]?sales|gross[_ ]?sales|sales[_ ]?value|revenue|amount|total[_ ]?(amount|value)?|line[_ ]?total|grand[_ ]?total)\b", re.I)],
        "quantity":    [re.compile(r"^(qty|quantity|units|pcs|pieces|count)$", re.I),
                        re.compile(r"\b(qty|quantity|units|pcs|pieces|sold|sold[_ ]?qty)\b", re.I)],
        "value":       [re.compile(r"\b(value|amount|price|cost|total|worth)\b", re.I)],
        "spend":       [re.compile(r"\b(spend|cost|budget|investment)\b", re.I)],
        "conversions": [re.compile(r"\b(conv|conversion|leads|signup|click|orders?)\b", re.I)],
        "item":        [re.compile(r"\b(item|product|sku|material)\b", re.I)],
        "category":    [re.compile(r"\b(categ|class|group|family|sub[_ ]?family|product[_ ]?type|item[_ ]?type|department)\b", re.I)],
        "customer":    [re.compile(r"\b(customer|client|account|cust)\b", re.I)],
        "invoice":     [re.compile(r"\b(invoice|order|bill|receipt|doc[_ ]?(no|num|number)|trans[a-z]*[_ ]?(no|id|num|number))\b", re.I)],
        "location":    [re.compile(r"\b(location|warehouse|branch|store|site|depot|outlet)\b", re.I)],
        "segment":     [re.compile(r"\b(segment|tier|grade|level)\b", re.I)],
        "region":      [re.compile(r"\b(region|country|state|city|area|territory|zone|gov)\b", re.I)],
        "route":       [re.compile(r"\b(route|trip|path|tour)\b", re.I)],
        "status":      [re.compile(r"\b(status|state|outcome|result)\b", re.I)],
        "account":     [re.compile(r"\b(account|gl|ledger)\b", re.I)],
        "channel":     [re.compile(r"\b(channel|source|medium|platform)\b", re.I)],
        "audience":    [re.compile(r"\b(audience|persona|target)\b", re.I)],
    }

    def find(slot: str) -> str:
        patterns = SLOT_PATTERNS.get(slot, [])
        for p in patterns:
            for c in columns_info:
                if c["name"] in used:
                    continue
                dt = c.get("dtype", "")
                norm = _normalize_name(c["name"])
                # Numeric metric slot constraints
                if slot in _NUMERIC_METRIC_SLOTS:
                    if not _is_numeric_dtype(dt):
                        continue
                    if _ID_NAME_RE.search(norm):
                        continue
                # Invoice constraint
                if slot == "invoice" and _TYPE_NAME_RE.search(norm):
                    continue
                if p.search(norm):
                    return c["name"]
        return ""

    for slot in keys:
        if out.get(slot):
            continue
        if slot == "date":
            # Prefer a real datetime column
            for c in columns_info:
                if c["name"] in used:
                    continue
                if _is_date_dtype(c.get("dtype", ""), c.get("role", "")):
                    out[slot] = c["name"]
                    used.add(c["name"])
                    break
            else:
                # Object-typed columns with date-like names
                for c in columns_info:
                    if c["name"] in used:
                        continue
                    if not _is_numeric_dtype(c.get("dtype", "")) and _DATE_NAME_RE.search(_normalize_name(c["name"])):
                        out[slot] = c["name"]
                        used.add(c["name"])
                        break
            continue
        picked = find(slot)
        if picked:
            out[slot] = picked
            used.add(picked)

    return out


# Mapping schema per dataset type — column-name slots the AI fills in.
PRESET_MAPPING_KEYS: Dict[str, List[str]] = {
    "sales":      ["amount", "quantity", "item", "category", "customer", "invoice", "date"],
    "inventory":  ["item", "quantity", "category", "value", "location"],
    "customers":  ["customer", "segment", "value", "region", "date"],
    "routes":     ["route", "customer", "status", "date"],
    "financials": ["amount", "account", "category", "date"],
    "marketing":  ["channel", "spend", "conversions", "audience", "date"],
    "other":      [],
}


def _preset_analyses(dataset_type: str, mapping: Dict[str, str]) -> List[Dict[str, Any]]:
    """Return a curated list of AnalysisSpec for the given dataset type + column mapping.

    Specs that reference an empty/unmapped slot are skipped. Frontend & backend share
    the same ID slugs so re-runs are stable.
    """
    g = lambda k: (mapping or {}).get(k) or ""
    has = lambda k: bool(g(k))
    dt = (dataset_type or "other").lower()
    specs: List[Dict[str, Any]] = []

    if dt == "sales":
        if has("amount"):
            specs.append({"id": "total-sales", "title": "Total Sales", "type": "kpi", "metric": g("amount"), "agg": "sum"})
            specs.append({"id": "avg-sale", "title": "Avg Sale Value", "type": "kpi", "metric": g("amount"), "agg": "mean"})
        if has("customer"):
            specs.append({"id": "distinct-customers", "title": "Customers Sold", "type": "kpi", "metric": g("customer"), "agg": "nunique"})
        if has("item"):
            specs.append({"id": "distinct-items", "title": "Items Sold", "type": "kpi", "metric": g("item"), "agg": "nunique"})
        if has("quantity"):
            specs.append({"id": "total-qty", "title": "Total Quantity", "type": "kpi", "metric": g("quantity"), "agg": "sum"})
        if has("invoice"):
            specs.append({"id": "distinct-invoices", "title": "Total Invoices", "type": "kpi", "metric": g("invoice"), "agg": "nunique"})
            specs.append({"id": "avg-lines-invoice", "title": "Avg Lines per Invoice", "type": "kpi", "metric": g("invoice"), "agg": "rows_per_distinct"})
        if has("amount") and has("item"):
            specs.append({"id": "top-items-sales", "title": "Top 10 Items by Sales", "type": "bar", "metric": g("amount"), "groupBy": g("item"), "agg": "sum", "sort": "desc", "limit": 10})
        if has("amount") and has("customer"):
            specs.append({"id": "top-customers", "title": "Top 10 Customers", "type": "bar", "metric": g("amount"), "groupBy": g("customer"), "agg": "sum", "sort": "desc", "limit": 10})
        if has("amount") and has("category"):
            specs.append({"id": "sales-by-category", "title": "Sales by Category", "type": "pie", "metric": g("amount"), "groupBy": g("category"), "agg": "sum", "sort": "desc", "limit": 10})
        if has("quantity") and has("item"):
            specs.append({"id": "top-items-qty", "title": "Top 10 Items by Quantity", "type": "bar", "metric": g("quantity"), "groupBy": g("item"), "agg": "sum", "sort": "desc", "limit": 10})
        if has("quantity") and has("category"):
            specs.append({"id": "qty-by-category", "title": "Quantity by Category", "type": "bar", "metric": g("quantity"), "groupBy": g("category"), "agg": "sum", "sort": "desc", "limit": 10})
        if has("amount") and has("date"):
            specs.append({"id": "sales-trend", "title": "Sales Over Time", "type": "line", "metric": g("amount"), "groupBy": g("date"), "agg": "sum", "sort": "asc", "limit": 90})

    elif dt == "inventory":
        if has("item"):
            specs.append({"id": "distinct-items", "title": "SKU Count", "type": "kpi", "metric": g("item"), "agg": "nunique"})
        if has("quantity"):
            specs.append({"id": "total-stock", "title": "Total Stock", "type": "kpi", "metric": g("quantity"), "agg": "sum"})
            specs.append({"id": "avg-stock", "title": "Avg Stock per Row", "type": "kpi", "metric": g("quantity"), "agg": "mean"})
        if has("value"):
            specs.append({"id": "total-value", "title": "Total Value", "type": "kpi", "metric": g("value"), "agg": "sum"})
        if has("quantity") and has("item"):
            specs.append({"id": "top-items-stock", "title": "Top 10 Items by Stock", "type": "bar", "metric": g("quantity"), "groupBy": g("item"), "agg": "sum", "sort": "desc", "limit": 10})
            specs.append({"id": "low-items-stock", "title": "Bottom 10 Items by Stock", "type": "bar", "metric": g("quantity"), "groupBy": g("item"), "agg": "sum", "sort": "asc", "limit": 10})
        if has("quantity") and has("category"):
            specs.append({"id": "stock-by-category", "title": "Stock by Category", "type": "bar", "metric": g("quantity"), "groupBy": g("category"), "agg": "sum", "sort": "desc", "limit": 10})
        if has("value") and has("category"):
            specs.append({"id": "value-by-category", "title": "Value by Category", "type": "pie", "metric": g("value"), "groupBy": g("category"), "agg": "sum", "sort": "desc", "limit": 10})
        if has("quantity") and has("location"):
            specs.append({"id": "stock-by-location", "title": "Stock by Location", "type": "bar", "metric": g("quantity"), "groupBy": g("location"), "agg": "sum", "sort": "desc", "limit": 10})

    elif dt == "customers":
        if has("customer"):
            specs.append({"id": "distinct-customers", "title": "Total Customers", "type": "kpi", "metric": g("customer"), "agg": "nunique"})
        if has("value"):
            specs.append({"id": "total-value", "title": "Total Value", "type": "kpi", "metric": g("value"), "agg": "sum"})
            specs.append({"id": "avg-value", "title": "Avg Value", "type": "kpi", "metric": g("value"), "agg": "mean"})
        if has("value") and has("customer"):
            specs.append({"id": "top-customers", "title": "Top 10 Customers by Value", "type": "bar", "metric": g("value"), "groupBy": g("customer"), "agg": "sum", "sort": "desc", "limit": 10})
        if has("segment"):
            specs.append({"id": "by-segment", "title": "Customers by Segment", "type": "pie", "metric": "", "groupBy": g("segment"), "agg": "count", "sort": "desc", "limit": 10})
        if has("value") and has("segment"):
            specs.append({"id": "value-by-segment", "title": "Value by Segment", "type": "pie", "metric": g("value"), "groupBy": g("segment"), "agg": "sum", "sort": "desc", "limit": 10})
        if has("region"):
            specs.append({"id": "by-region", "title": "Customers by Region", "type": "bar", "metric": "", "groupBy": g("region"), "agg": "count", "sort": "desc", "limit": 10})
        if has("date"):
            specs.append({"id": "acquisition-trend", "title": "Acquisition Over Time", "type": "line", "metric": "", "groupBy": g("date"), "agg": "count", "sort": "asc", "limit": 90})

    elif dt == "routes":
        specs.append({"id": "total-visits", "title": "Total Visits", "type": "kpi", "metric": "", "agg": "count"})
        if has("route"):
            specs.append({"id": "distinct-routes", "title": "Total Routes", "type": "kpi", "metric": g("route"), "agg": "nunique"})
        if has("customer"):
            specs.append({"id": "distinct-customers", "title": "Customers Visited", "type": "kpi", "metric": g("customer"), "agg": "nunique"})
        if has("route") and has("customer"):
            specs.append({"id": "avg-cust-per-route", "title": "Avg Visits per Route", "type": "kpi", "metric": g("route"), "agg": "rows_per_distinct"})
        if has("status"):
            specs.append({"id": "by-status", "title": "Visits by Status", "type": "pie", "metric": "", "groupBy": g("status"), "agg": "count", "sort": "desc", "limit": 10})
        if has("route"):
            specs.append({"id": "visits-by-route", "title": "Visits by Route", "type": "bar", "metric": "", "groupBy": g("route"), "agg": "count", "sort": "desc", "limit": 10})
        if has("date"):
            specs.append({"id": "trend", "title": "Visits Over Time", "type": "line", "metric": "", "groupBy": g("date"), "agg": "count", "sort": "asc", "limit": 90})

    elif dt == "financials":
        if has("amount"):
            specs.append({"id": "total-amount", "title": "Total Amount", "type": "kpi", "metric": g("amount"), "agg": "sum"})
            specs.append({"id": "avg-amount", "title": "Avg Transaction", "type": "kpi", "metric": g("amount"), "agg": "mean"})
        specs.append({"id": "tx-count", "title": "Total Transactions", "type": "kpi", "metric": "", "agg": "count"})
        if has("amount") and has("account"):
            specs.append({"id": "by-account", "title": "Amount by Account", "type": "bar", "metric": g("amount"), "groupBy": g("account"), "agg": "sum", "sort": "desc", "limit": 10})
        if has("amount") and has("category"):
            specs.append({"id": "by-category", "title": "Amount by Category", "type": "pie", "metric": g("amount"), "groupBy": g("category"), "agg": "sum", "sort": "desc", "limit": 10})
        if has("amount") and has("date"):
            specs.append({"id": "trend", "title": "Amount Over Time", "type": "line", "metric": g("amount"), "groupBy": g("date"), "agg": "sum", "sort": "asc", "limit": 90})

    elif dt == "marketing":
        if has("spend"):
            specs.append({"id": "total-spend", "title": "Total Spend", "type": "kpi", "metric": g("spend"), "agg": "sum"})
        if has("conversions"):
            specs.append({"id": "total-conv", "title": "Total Conversions", "type": "kpi", "metric": g("conversions"), "agg": "sum"})
        if has("spend") and has("channel"):
            specs.append({"id": "spend-by-channel", "title": "Spend by Channel", "type": "pie", "metric": g("spend"), "groupBy": g("channel"), "agg": "sum", "sort": "desc", "limit": 10})
        if has("conversions") and has("channel"):
            specs.append({"id": "conv-by-channel", "title": "Conversions by Channel", "type": "bar", "metric": g("conversions"), "groupBy": g("channel"), "agg": "sum", "sort": "desc", "limit": 10})
        if has("conversions") and has("audience"):
            specs.append({"id": "by-audience", "title": "Conversions by Audience", "type": "bar", "metric": g("conversions"), "groupBy": g("audience"), "agg": "sum", "sort": "desc", "limit": 10})
        if has("spend") and has("date"):
            specs.append({"id": "spend-trend", "title": "Spend Over Time", "type": "line", "metric": g("spend"), "groupBy": g("date"), "agg": "sum", "sort": "asc", "limit": 90})

    return specs


# -----------------------------------------------------------
# Endpoints
# -----------------------------------------------------------

@router.post("/profile")
async def profile_dataset(
    file: UploadFile = File(...),
    user_id: str = Form(""),
):
    """Parse + profile + AI-detect schema. Returns everything the wizard needs."""
    content = await file.read()
    df = _df_from_upload(file.filename or "upload", content)

    # Try datetime coercion on string columns that look date-like
    for col in df.columns:
        if df[col].dtype == "object" and DATE_HINT_RE.search(str(col)):
            try:
                df[col] = pd.to_datetime(df[col], errors="coerce")
            except Exception:
                pass

    columns_info: List[Dict[str, Any]] = []
    for col in df.columns:
        series = df[col]
        heuristic = _infer_role_heuristic(col, series)
        sample_vals = series.dropna().head(5).tolist()
        columns_info.append({
            "name": str(col),
            "dtype": str(series.dtype),
            "role": heuristic["role"],
            "semantic": heuristic["semantic"],
            "unit": "",
            "stats": _basic_stats(series),
            "sample": [str(v)[:80] for v in sample_vals],
        })

    preview = _df_to_json_safe_records(df.head(MAX_PREVIEW_ROWS))
    sample_for_ai = _df_to_json_safe_records(df.head(MAX_SAMPLE_FOR_AI))

    # AI schema detection — overlay on heuristic
    ai = _ai_detect_schema(columns_info, sample_for_ai)
    dataset_type = "other"
    suggested_title = (file.filename or "Untitled").rsplit(".", 1)[0]
    suggested_analyses: List[Dict[str, Any]] = []
    narrative = ""
    ai_mapping: Dict[str, str] = {}
    if ai:
        dataset_type = ai.get("datasetType", "other")
        suggested_title = ai.get("suggestedTitle", suggested_title)
        narrative = ai.get("narrative", "")
        # Overlay AI labels onto heuristic columns
        ai_cols = {c["name"]: c for c in ai.get("columns", [])}
        for c in columns_info:
            if c["name"] in ai_cols:
                ac = ai_cols[c["name"]]
                c["role"] = ac.get("role", c["role"])
                c["semantic"] = ac.get("semantic", c["semantic"])
                c["unit"] = ac.get("unit", "")
        suggested_analyses = ai.get("suggestedAnalyses", [])
        # Keep only mapping keys that belong to the chosen type and that exist in the df
        raw_mapping = ai.get("mapping", {}) or {}
        valid_keys = set(PRESET_MAPPING_KEYS.get(dataset_type, []))
        df_cols = set(df.columns)
        ai_mapping = {
            k: v for k, v in raw_mapping.items()
            if k in valid_keys and isinstance(v, str) and v in df_cols
        }
        # Validate (drop nonsense picks like amount=SalesmanCode) + heuristic-fill missing slots.
        cols_by_name = {c["name"]: c for c in columns_info}
        ai_mapping = _validate_mapping(ai_mapping, cols_by_name)
        ai_mapping = _heuristic_fill_mapping(dataset_type, columns_info, ai_mapping)
    else:
        # No AI — pure heuristic fill against the heuristic-detected dataset_type.
        ai_mapping = _heuristic_fill_mapping(dataset_type, columns_info, {})
    # Heuristic fallback (always merge — covers gaps when AI returns sparse list)
    metrics = [c["name"] for c in columns_info if c["role"] == "metric"]
    dims = [c["name"] for c in columns_info if c["role"] == "dimension"]
    date_cols_h = [c["name"] for c in columns_info if c["role"] == "date"]

    fallbacks: List[Dict[str, Any]] = [{
        "id": "auto-rows", "title": "Total Records", "type": "kpi",
        "metric": "", "groupBy": "", "agg": "count", "sort": "desc", "limit": 1,
    }]
    for m in metrics[:3]:
        fallbacks.append({
            "id": f"kpi-sum-{m}", "title": f"Total {m}", "type": "kpi",
            "metric": m, "groupBy": "", "agg": "sum", "sort": "desc", "limit": 1,
        })
    for d in dims[:3]:
        if metrics:
            fallbacks.append({
                "id": f"bar-{d}-{metrics[0]}", "title": f"{metrics[0]} by {d}",
                "type": "bar", "metric": metrics[0], "groupBy": d,
                "agg": "sum", "sort": "desc", "limit": 10,
            })
        else:
            fallbacks.append({
                "id": f"bar-count-{d}", "title": f"Records by {d}",
                "type": "bar", "metric": "", "groupBy": d,
                "agg": "count", "sort": "desc", "limit": 10,
            })
    if date_cols_h and metrics:
        fallbacks.append({
            "id": f"line-{metrics[0]}-time", "title": f"{metrics[0]} over time",
            "type": "line", "metric": metrics[0], "groupBy": date_cols_h[0],
            "agg": "sum", "sort": "asc", "limit": 30,
        })

    # De-dupe by id while preserving order (AI suggestions first)
    seen = set()
    merged: List[Dict[str, Any]] = []
    for spec in (suggested_analyses + fallbacks):
        sid = spec.get("id")
        if sid and sid not in seen:
            seen.add(sid)
            merged.append(spec)
    suggested_analyses = merged[:14]

    # Baseline KPIs
    baseline_kpis: Dict[str, Any] = {
        "rows": int(len(df)),
        "columns": int(len(df.columns)),
        "missingCells": int(df.isna().sum().sum()),
    }
    date_cols = [c["name"] for c in columns_info if c["role"] == "date"]
    if date_cols:
        dc = date_cols[0]
        try:
            d_series = pd.to_datetime(df[dc], errors="coerce").dropna()
            if len(d_series) > 0:
                baseline_kpis["dateRange"] = {
                    "column": dc,
                    "min": str(d_series.min()),
                    "max": str(d_series.max()),
                }
        except Exception:
            pass

    dataset_id = _cache_set(df)

    # NOTE: do NOT auto-run insights here. The user confirms dataset type +
    # column mapping on the next screen, then /analyze-by-type runs the
    # curated KPIs for that type.
    return {
        "datasetId": dataset_id,
        "datasetType": dataset_type,
        "suggestedTitle": suggested_title,
        "narrative": narrative,
        "columns": columns_info,
        "preview": preview,
        "kpis": baseline_kpis,
        "suggestedAnalyses": suggested_analyses,
        "mapping": ai_mapping,
        "mappingKeys": PRESET_MAPPING_KEYS,  # frontend uses this to render slots
        "insights": [],
        "rowCount": int(len(df)),
        "fileMeta": {
            "filename": file.filename,
            "size": len(content),
        },
    }


class AnalyzeRowsBody(BaseModel):
    rows: Optional[List[Dict[str, Any]]] = None       # legacy / re-analyze path
    dataset_id: Optional[str] = None                   # cached path (preferred)
    schema_columns: List[Dict[str, Any]]
    analyses: List[Dict[str, Any]]
    dataset_type: Optional[str] = "other"
    title: Optional[str] = ""


@router.post("/analyze")
async def analyze_dataset(body: AnalyzeRowsBody):
    """Run the chosen analyses on a cached dataset (or rows[]) and return chart-ready insights."""
    df: Optional[pd.DataFrame] = None
    if body.dataset_id:
        df = _cache_get(body.dataset_id)
        if df is None:
            raise HTTPException(410, "Dataset cache expired. Please re-upload the file.")
    elif body.rows:
        df = pd.DataFrame(body.rows)
    else:
        raise HTTPException(400, "Provide either dataset_id or rows.")

    # Coerce types based on schema
    for col in body.schema_columns:
        name = col.get("name")
        role = col.get("role")
        if not name or name not in df.columns:
            continue
        if role == "date":
            try:
                df[name] = pd.to_datetime(df[name], errors="coerce")
            except Exception:
                pass
        elif role == "metric":
            try:
                df[name] = pd.to_numeric(df[name], errors="coerce")
            except Exception:
                pass

    context = (
        f"Dataset type: {body.dataset_type}. Title: {body.title}. "
        f"Rows: {len(df)}. Columns: {list(df.columns)}."
    )

    insights: List[Dict[str, Any]] = []
    for spec in body.analyses[:8]:  # cap at 8
        result = _run_analysis(df, spec)
        narrative = _ai_write_narrative(
            spec.get("title", "Insight"),
            result,
            context,
        )
        insights.append({
            "id": spec.get("id", f"ins-{len(insights)+1}"),
            "title": spec.get("title", "Insight"),
            "type": result.get("type", "bar"),
            "narrative": narrative,
            "data": result.get("data") if result.get("type") != "kpi" else None,
            "value": result.get("value") if result.get("type") == "kpi" else None,
            "label": result.get("label", ""),
            "metric": result.get("metric", ""),
            "groupBy": result.get("groupBy", ""),
            "agg": result.get("agg", ""),
            "warning": result.get("warning"),
        })

    return {
        "insights": insights,
        "kpis": {
            "rows": int(len(df)),
            "columns": int(len(df.columns)),
            "missingCells": int(df.isna().sum().sum()),
        },
    }


class AnalyzeReachBody(BaseModel):
    user_id: str
    company_id: str
    table: str  # 'normalized_customers' | 'route_visits' | 'history_logs'
    branch_ids: Optional[List[str]] = None


@router.post("/from-reach-table")
async def from_reach_table(body: AnalyzeReachBody):
    """Pull rows from a Reach table (RLS-filtered) and return same shape as /profile."""
    from supabase import create_client
    SUPABASE_URL = os.getenv("SUPABASE_URL", "https://mpkfvaccnsucdmxxtosu.supabase.co")
    SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY") or ""
    if not SUPABASE_KEY:
        raise HTTPException(500, "Supabase not configured.")
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    allowed = {"normalized_customers", "route_visits", "history_logs"}
    if body.table not in allowed:
        raise HTTPException(400, f"Table '{body.table}' not allowed.")

    q = sb.table(body.table).select("*").eq("company_id", body.company_id).limit(MAX_ROWS)
    if body.branch_ids and body.table == "normalized_customers":
        q = q.in_("branch_id", body.branch_ids)
    try:
        resp = q.execute()
        rows = resp.data or []
    except Exception as e:
        raise HTTPException(500, f"Supabase fetch failed: {e}")

    if not rows:
        raise HTTPException(404, "No rows returned for that table/scope.")

    df = pd.DataFrame(rows)
    if len(df) > MAX_ROWS:
        df = df.head(MAX_ROWS)

    # Reuse the profile pipeline
    columns_info: List[Dict[str, Any]] = []
    for col in df.columns:
        series = df[col]
        heuristic = _infer_role_heuristic(col, series)
        sample_vals = series.dropna().head(5).tolist()
        columns_info.append({
            "name": str(col),
            "dtype": str(series.dtype),
            "role": heuristic["role"],
            "semantic": heuristic["semantic"],
            "unit": "",
            "stats": _basic_stats(series),
            "sample": [str(v)[:80] for v in sample_vals],
        })

    preview = _df_to_json_safe_records(df.head(MAX_PREVIEW_ROWS))
    sample_for_ai = _df_to_json_safe_records(df.head(MAX_SAMPLE_FOR_AI))
    ai = _ai_detect_schema(columns_info, sample_for_ai)

    dataset_type = "other"
    suggested_title = body.table.replace("_", " ").title()
    suggested_analyses: List[Dict[str, Any]] = []
    narrative = ""
    ai_mapping: Dict[str, str] = {}
    if ai:
        dataset_type = ai.get("datasetType", "other")
        suggested_title = ai.get("suggestedTitle", suggested_title)
        narrative = ai.get("narrative", "")
        ai_cols = {c["name"]: c for c in ai.get("columns", [])}
        for c in columns_info:
            if c["name"] in ai_cols:
                ac = ai_cols[c["name"]]
                c["role"] = ac.get("role", c["role"])
                c["semantic"] = ac.get("semantic", c["semantic"])
                c["unit"] = ac.get("unit", "")
        suggested_analyses = ai.get("suggestedAnalyses", [])
        raw_mapping = ai.get("mapping", {}) or {}
        valid_keys = set(PRESET_MAPPING_KEYS.get(dataset_type, []))
        df_cols = set(df.columns)
        ai_mapping = {
            k: v for k, v in raw_mapping.items()
            if k in valid_keys and isinstance(v, str) and v in df_cols
        }
        cols_by_name = {c["name"]: c for c in columns_info}
        ai_mapping = _validate_mapping(ai_mapping, cols_by_name)
        ai_mapping = _heuristic_fill_mapping(dataset_type, columns_info, ai_mapping)
    else:
        ai_mapping = _heuristic_fill_mapping(dataset_type, columns_info, {})

    dataset_id = _cache_set(df)

    return {
        "datasetId": dataset_id,
        "datasetType": dataset_type,
        "suggestedTitle": suggested_title,
        "narrative": narrative,
        "columns": columns_info,
        "preview": preview,
        "kpis": {
            "rows": int(len(df)),
            "columns": int(len(df.columns)),
            "missingCells": int(df.isna().sum().sum()),
        },
        "suggestedAnalyses": suggested_analyses,
        "mapping": ai_mapping,
        "mappingKeys": PRESET_MAPPING_KEYS,
        "insights": [],
        "rowCount": int(len(df)),
        "fileMeta": {
            "filename": f"{body.table}.reach",
            "size": 0,
        },
    }


# ============================================================
# /analyze-by-type — confirmed-type curated insights
# ============================================================

class AnalyzeByTypeBody(BaseModel):
    dataset_id: str
    dataset_type: str          # 'sales' | 'inventory' | 'customers' | 'routes' | 'financials' | 'marketing' | 'other'
    mapping: Dict[str, str] = {}   # { slot_key: column_name }
    title: Optional[str] = ""
    fallback_analyses: Optional[List[Dict[str, Any]]] = None  # used when type='other'


@router.post("/analyze-by-type")
async def analyze_by_type(body: AnalyzeByTypeBody):
    """Run the curated preset KPIs/charts for a confirmed dataset type."""
    df = _cache_get(body.dataset_id)
    if df is None:
        raise HTTPException(410, "Dataset cache expired. Please re-upload the file.")

    dt = (body.dataset_type or "other").lower()

    # Coerce numeric/date columns based on the mapping (so 'amount' is summable, etc.)
    numeric_slots = {"amount", "quantity", "value", "spend", "conversions"}
    date_slots = {"date"}
    for slot, col in (body.mapping or {}).items():
        if not col or col not in df.columns:
            continue
        if slot in numeric_slots:
            try:
                df[col] = pd.to_numeric(df[col], errors="coerce")
            except Exception:
                pass
        elif slot in date_slots:
            try:
                df[col] = pd.to_datetime(df[col], errors="coerce")
            except Exception:
                pass

    if dt == "other" or not body.mapping:
        # Fallback: run whatever was suggested by AI / heuristic
        analyses = body.fallback_analyses or []
        if not analyses:
            # Build a minimal generic set
            analyses = [{"id": "rows", "title": "Total Records", "type": "kpi", "metric": "", "agg": "count"}]
            for c in df.columns:
                if pd.api.types.is_numeric_dtype(df[c]):
                    analyses.append({"id": f"sum-{c}", "title": f"Total {c}", "type": "kpi", "metric": str(c), "agg": "sum"})
                    if len(analyses) >= 6:
                        break
    else:
        analyses = _preset_analyses(dt, body.mapping or {})

    context = (
        f"Dataset type: {dt}. Title: {body.title}. "
        f"Rows: {len(df)}. Mapping: {body.mapping}. Columns: {list(df.columns)}."
    )
    insights = _build_insights(df, analyses, context, max_count=20)

    return {
        "datasetType": dt,
        "mapping": body.mapping,
        "appliedAnalyses": analyses,
        "insights": insights,
        "kpis": {
            "rows": int(len(df)),
            "columns": int(len(df.columns)),
            "missingCells": int(df.isna().sum().sum()),
        },
    }


# ============================================================
# /filter — re-run insights with filters applied
# ============================================================

class FilterBody(BaseModel):
    dataset_id: str
    filters: Dict[str, List[Any]] = {}             # { column: [allowed_values] }
    analyses: Optional[List[Dict[str, Any]]] = None  # if missing, returns KPIs only


@router.post("/filter")
async def filter_dataset(body: FilterBody):
    df = _cache_get(body.dataset_id)
    if df is None:
        raise HTTPException(410, "Dataset cache expired. Please re-upload the file.")
    filtered = _apply_filters(df, body.filters)
    if len(filtered) == 0:
        return {
            "kpis": {"rows": 0, "columns": int(len(df.columns)), "missingCells": 0},
            "insights": [],
            "filteredRowCount": 0,
        }
    context = f"Filtered subset. Rows: {len(filtered)}. Filters: {body.filters}."
    insights = _build_insights(filtered, body.analyses or [], context) if body.analyses else []
    return {
        "kpis": {
            "rows": int(len(filtered)),
            "columns": int(len(filtered.columns)),
            "missingCells": int(filtered.isna().sum().sum()),
        },
        "insights": insights,
        "filteredRowCount": int(len(filtered)),
    }


# ============================================================
# /chat — ask a natural-language question about the dataset
# ============================================================

class ChatBody(BaseModel):
    dataset_id: str
    question: str
    schema_columns: Optional[List[Dict[str, Any]]] = None
    history: Optional[List[Dict[str, str]]] = None  # [{role,content}]


def _ai_plan_chart(question: str, columns: List[Dict[str, Any]], sample: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Ask Gemini: given this question + schema, return one analysis spec to run."""
    client = _gemini_client()
    if client is None:
        return None
    cols_min = [{"name": c.get("name"), "role": c.get("role"), "dtype": c.get("dtype")} for c in columns]
    prompt = f"""You are a data analyst. The user asks a question about their dataset.
Return a JSON describing ONE chart that best answers it.

QUESTION: {question}

COLUMNS (name + role + dtype):
{json.dumps(cols_min)[:3000]}

SAMPLE ROWS (3 rows):
{json.dumps(sample[:3], default=str)[:2000]}

Return JSON with this shape:
{{
  "title": "<chart title, 5-10 words>",
  "type": "kpi" | "bar" | "line" | "pie",
  "metric": "<numeric column name, or empty string>",
  "groupBy": "<dimension/date column name, or empty string>",
  "agg": "sum" | "mean" | "count" | "min" | "max",
  "sort": "asc" | "desc",
  "limit": 10,
  "answer": "<one short sentence answering the question — DO NOT include numbers, those come from the chart>"
}}

Rules:
- Use ONLY column names from the list above.
- If the question is unclear or impossible to answer with this data, set type="kpi", metric="", groupBy="", agg="count" and explain in answer.
- Return ONLY JSON, no fences.
"""
    try:
        resp = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.2,
                max_output_tokens=600,
            ),
        )
        raw = (resp.text or "").strip()
        if raw.startswith("```"):
            raw = re.sub(r"^```[a-zA-Z]*\n?", "", raw)
            raw = re.sub(r"\n?```$", "", raw)
        return json.loads(raw)
    except Exception as e:
        print(f"[data_assist] chat-plan failed: {e}")
        return None


@router.post("/chat")
async def chat_with_dataset(body: ChatBody):
    df = _cache_get(body.dataset_id)
    if df is None:
        raise HTTPException(410, "Dataset cache expired. Please re-upload the file.")

    columns = body.schema_columns or [
        {"name": str(c), "role": "metric" if pd.api.types.is_numeric_dtype(df[c]) else "dimension", "dtype": str(df[c].dtype)}
        for c in df.columns
    ]
    sample = _df_to_json_safe_records(df.head(3))

    plan = _ai_plan_chart(body.question, columns, sample)
    if plan is None:
        return {
            "answer": "I couldn't process that question. Please rephrase or check that the data has the relevant columns.",
            "insight": None,
        }

    spec = {
        "id": f"chat-{int(time.time()*1000)}",
        "title": plan.get("title", "Answer"),
        "type": plan.get("type", "bar"),
        "metric": plan.get("metric", ""),
        "groupBy": plan.get("groupBy", ""),
        "agg": plan.get("agg", "sum"),
        "sort": plan.get("sort", "desc"),
        "limit": plan.get("limit", 10),
    }
    result = _run_analysis(df, spec)

    # Compose final answer with concrete numbers from the result
    answer_seed = plan.get("answer", "")
    if result.get("type") == "kpi":
        v = result.get("value")
        v_str = f"{v:,.2f}" if isinstance(v, float) else f"{v:,}"
        answer = f"{answer_seed} ({result.get('label', '')}: {v_str})".strip()
    elif result.get("data"):
        top = result["data"][0] if result["data"] else None
        if top:
            try:
                answer = f"{answer_seed} Top: {top['name']} = {top['value']:,.2f}.".strip()
            except Exception:
                answer = answer_seed
        else:
            answer = answer_seed or "No data matched."
    else:
        answer = answer_seed or "No data matched the question."

    insight = {
        "id": spec["id"],
        "title": spec["title"],
        "type": result.get("type", "bar"),
        "narrative": answer,
        "data": result.get("data") if result.get("type") != "kpi" else None,
        "value": result.get("value") if result.get("type") == "kpi" else None,
        "label": result.get("label", ""),
        "metric": result.get("metric", ""),
        "groupBy": result.get("groupBy", ""),
        "agg": result.get("agg", ""),
        "warning": result.get("warning"),
    }
    return {"answer": answer, "insight": insight}
