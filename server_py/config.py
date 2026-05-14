import os
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv, dotenv_values


_PLACEHOLDER_MARKERS = (
    "your_real_",
    "your_",
    "replace_",
    "replace-me",
    "placeholder",
    "changeme",
    "change_me",
    "insert_",
    "todo",
)


def _is_placeholder(value: Optional[str]) -> bool:
    v = (value or "").strip()
    if not v:
        return True
    lower = v.lower()
    return any(marker in lower for marker in _PLACEHOLDER_MARKERS)


def _first_real_value(*values: Optional[str]) -> Optional[str]:
    for v in values:
        v = (v or "").strip()
        if v and not _is_placeholder(v):
            return v
    return None


def load_env() -> None:
    """
    Load env vars regardless of the current working directory, while avoiding
    placeholder API keys accidentally "winning" due to dotenv load order.
    """
    here = Path(__file__).resolve().parent
    repo_root = here.parent

    # Load all supported files (for non-key vars). Do not override OS env.
    load_dotenv(dotenv_path=repo_root / ".env.local", override=False)
    load_dotenv(dotenv_path=here / ".env", override=False)
    load_dotenv(dotenv_path=repo_root / ".env", override=False)

    # Prefer a real key from OS env, then env files (skip placeholders).
    env_gemini = os.getenv("GEMINI_API_KEY")
    env_google = os.getenv("GOOGLE_API_KEY")
    if _first_real_value(env_gemini, env_google):
        # Already have a real key via OS env (or previously loaded dotenv).
        return

    file_candidates = []
    for path in (here / ".env", repo_root / ".env.local", repo_root / ".env"):
        try:
            values = dotenv_values(path)
        except Exception:
            values = {}
        file_candidates.append(_first_real_value(values.get("GEMINI_API_KEY"), values.get("GOOGLE_API_KEY")))

    key = _first_real_value(*file_candidates)
    if key:
        os.environ["GEMINI_API_KEY"] = key
        return

    # If the current value is a placeholder, treat it as "not configured".
    if _is_placeholder(os.getenv("GEMINI_API_KEY")):
        os.environ.pop("GEMINI_API_KEY", None)


def gemini_key_configured() -> bool:
    return bool(_first_real_value(os.getenv("GEMINI_API_KEY"), os.getenv("GOOGLE_API_KEY")))


def gemini_key_placeholder() -> bool:
    val = os.getenv("GEMINI_API_KEY")
    return bool(val) and _is_placeholder(val) and not gemini_key_configured()
