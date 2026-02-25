"""Shared utilities for M3 evaluation/regression scripts.

Imported by calibrate_quality_judge.py, run_regression.py, compare_regression_runs.py.
"""

import json
import math
import os
import re
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Sequence, Tuple


# ---------------------------------------------------------------------------
# Low-level helpers
# ---------------------------------------------------------------------------

def die(msg: str, exit_code: int = 1) -> None:
    sys.stderr.write(msg.rstrip() + "\n")
    raise SystemExit(exit_code)


def load_json(path: str, *, missing_ok: bool = False) -> Any:
    """Load JSON file.  Returns None on missing when *missing_ok*."""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        if missing_ok:
            return None
        raise


def as_float(value: Any) -> Optional[float]:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        v = float(value)
        return v if math.isfinite(v) else None
    return None


def as_int(value: Any) -> Optional[int]:
    if isinstance(value, int) and not isinstance(value, bool):
        return int(value)
    return None


def as_str(value: Any) -> Optional[str]:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def iso_utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


# ---------------------------------------------------------------------------
# Eval-object extraction (QualityJudge output format)
# ---------------------------------------------------------------------------

def extract_eval_used(eval_obj: Dict[str, Any]) -> Dict[str, Any]:
    maybe = eval_obj.get("eval_used")
    return maybe if isinstance(maybe, dict) else eval_obj


def extract_overall(eval_obj: Dict[str, Any]) -> Optional[float]:
    """Extract overall/overall_final with fallback chain."""
    for v in [
        eval_obj.get("overall_final"),
        extract_eval_used(eval_obj).get("overall_final"),
        extract_eval_used(eval_obj).get("overall"),
        eval_obj.get("overall"),
    ]:
        n = as_float(v)
        if n is not None:
            return n
    meta = eval_obj.get("metadata")
    if isinstance(meta, dict):
        judges = meta.get("judges")
        if isinstance(judges, dict):
            n = as_float(judges.get("overall_final"))
            if n is not None:
                return n
    return None


def extract_dimension_scores(eval_obj: Dict[str, Any]) -> Dict[str, float]:
    """Extract per-dimension {key: score} from eval object."""
    used = extract_eval_used(eval_obj)
    scores = used.get("scores")
    if not isinstance(scores, dict):
        scores = eval_obj.get("scores")
        if not isinstance(scores, dict):
            return {}
    out: Dict[str, float] = {}
    for key, item in scores.items():
        if not isinstance(item, dict):
            continue
        v = as_float(item.get("score"))
        if v is not None:
            out[str(key)] = float(v)
    return out


def extract_contract_verification(eval_obj: Dict[str, Any]) -> Dict[str, Any]:
    used = extract_eval_used(eval_obj)
    cv = used.get("contract_verification")
    if isinstance(cv, dict):
        return cv
    cv = eval_obj.get("contract_verification")
    if isinstance(cv, dict):
        return cv
    return {}


# ---------------------------------------------------------------------------
# File discovery
# ---------------------------------------------------------------------------

def find_eval_files(eval_dir: str) -> List[Tuple[int, str]]:
    """Find chapter-NNN-eval.json in *eval_dir*.  Returns sorted [(chapter, path)]."""
    if not os.path.isdir(eval_dir):
        return []
    items: List[Tuple[int, str]] = []
    for name in os.listdir(eval_dir):
        m = re.match(r"^chapter-(\d+)-eval\.json$", name)
        if m:
            items.append((int(m.group(1)), os.path.join(eval_dir, name)))
    items.sort(key=lambda x: x[0])
    return items
