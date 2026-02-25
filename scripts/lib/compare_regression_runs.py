"""Compare two archived regression-run summaries (M3).

Extracted from the heredoc in scripts/compare-regression-runs.sh.
Reuses helpers from _common to avoid duplication.
"""

import json
import os
import sys
from typing import Any, Dict, Optional

import _common


def _die(msg: str, exit_code: int = 1) -> None:
    _common.die(f"compare-regression-runs.sh: {msg}", exit_code)


def _load_json(path: str) -> Any:
    try:
        return _common.load_json(path)
    except Exception as e:
        _die(f"invalid JSON at {path}: {e}", 1)


def _delta_number(a: Any, b: Any) -> Optional[float]:
    na = _common.as_float(a)
    nb = _common.as_float(b)
    if na is None or nb is None:
        return None
    return nb - na


def _delta_dim_means(a: Any, b: Any) -> Dict[str, Optional[float]]:
    """Delta on score_dimensions: extract 'mean' from {n, mean} objects."""
    if not isinstance(a, dict):
        a = {}
    if not isinstance(b, dict):
        b = {}
    keys = sorted(set(list(a.keys()) + list(b.keys())))
    out: Dict[str, Optional[float]] = {}
    for k in keys:
        va = a.get(k)
        vb = b.get(k)
        ma = _common.as_float(va.get("mean")) if isinstance(va, dict) else None
        mb = _common.as_float(vb.get("mean")) if isinstance(vb, dict) else None
        if ma is None and mb is None:
            continue
        if ma is None or mb is None:
            out[k] = None
        else:
            out[k] = round(float(mb - ma), 6)
    return out


def _delta_map(a: Any, b: Any) -> Dict[str, Optional[float]]:
    if not isinstance(a, dict):
        a = {}
    if not isinstance(b, dict):
        b = {}
    keys = set([str(k) for k in a.keys()] + [str(k) for k in b.keys()])
    out: Dict[str, Optional[float]] = {}
    for k in sorted(keys):
        da = _common.as_float(a.get(k))
        db = _common.as_float(b.get(k))
        if da is None and db is None:
            continue
        if da is None or db is None:
            out[k] = None
        else:
            out[k] = float(db - da)
    return out


def main() -> None:
    path_a = sys.argv[1]
    path_b = sys.argv[2]
    out_path = sys.argv[3].strip() if len(sys.argv) > 3 else ""

    a = _load_json(path_a)
    b = _load_json(path_b)
    if not isinstance(a, dict) or not isinstance(b, dict):
        _die("both summaries must be JSON objects", 1)

    comp_a = a.get("compliance") if isinstance(a.get("compliance"), dict) else {}
    comp_b = b.get("compliance") if isinstance(b.get("compliance"), dict) else {}

    score_a = a.get("score_overall") if isinstance(a.get("score_overall"), dict) else {}
    score_b = b.get("score_overall") if isinstance(b.get("score_overall"), dict) else {}

    out = {
        "schema_version": 1,
        "generated_at": _common.iso_utc_now(),
        "run_a": {"dir": os.path.dirname(os.path.abspath(path_a)), "summary_path": os.path.abspath(path_a), "run_id": a.get("run_id")},
        "run_b": {"dir": os.path.dirname(os.path.abspath(path_b)), "summary_path": os.path.abspath(path_b), "run_id": b.get("run_id")},
        "delta": {
            "chapters_total": _delta_number(a.get("chapters_total"), b.get("chapters_total")),
            "violations_total": _delta_number(a.get("violations_total"), b.get("violations_total")),
            "compliance_rate_high_confidence": _delta_number(comp_a.get("compliance_rate_high_confidence"), comp_b.get("compliance_rate_high_confidence")),
            "compliance_rate_any_violation": _delta_number(comp_a.get("compliance_rate_any_violation"), comp_b.get("compliance_rate_any_violation")),
            "chapters_with_high_confidence_violation": _delta_number(
                comp_a.get("chapters_with_high_confidence_violation"), comp_b.get("chapters_with_high_confidence_violation")
            ),
            "chapters_with_any_violation": _delta_number(comp_a.get("chapters_with_any_violation"), comp_b.get("chapters_with_any_violation")),
            "violations_by_confidence": _delta_map(a.get("violations_by_confidence"), b.get("violations_by_confidence")),
            "violations_by_layer": _delta_map(a.get("violations_by_layer"), b.get("violations_by_layer")),
            "score_overall_mean": _delta_number(score_a.get("mean"), score_b.get("mean")),
        },
        "score_dimensions": {},
        "notes": [],
    }

    if _common.as_float(a.get("chapters_total")) != _common.as_float(b.get("chapters_total")):
        out["notes"].append("chapters_total differs; compare deltas with caution.")

    dims_a = a.get("score_dimensions", {})
    dims_b = b.get("score_dimensions", {})
    if dims_a or dims_b:
        out["score_dimensions"] = _delta_dim_means(dims_a, dims_b)

    out_json = json.dumps(out, ensure_ascii=False, sort_keys=True) + "\n"
    sys.stdout.write(out_json)

    if out_path:
        out_dir = os.path.dirname(os.path.abspath(out_path))
        if out_dir and not os.path.isdir(out_dir):
            os.makedirs(out_dir, exist_ok=True)
        try:
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(out_json)
        except Exception as e:
            _die(f"failed to write to {out_path}: {e}", 1)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:
        sys.stderr.write(f"compare-regression-runs.sh: unexpected error: {e}\n")
        raise SystemExit(2)
