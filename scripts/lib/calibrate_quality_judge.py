"""QualityJudge calibration against human-labeled dataset (M3).

Extracted from scripts/calibrate-quality-judge.sh heredoc.
Shared helpers imported from _common.py (same directory).
"""

import json
import math
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

import _common

_SCRIPT = "calibrate-quality-judge.sh"


def _die(msg: str, exit_code: int = 1) -> None:
    _common.die(f"{_SCRIPT}: {msg}", exit_code)


def _load_json(path: str) -> Any:
    try:
        return _common.load_json(path)
    except Exception as e:
        _die(f"invalid JSON at {path}: {e}", 1)


def _iter_jsonl(path: str) -> Iterable[Tuple[int, Dict[str, Any]]]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line_no, raw in enumerate(f, start=1):
                line = raw.strip()
                if not line:
                    continue
                if line.startswith("#"):
                    continue
                try:
                    obj = json.loads(line)
                except Exception as e:
                    _die(f"invalid JSONL at {path}:{line_no}: {e}", 1)
                if not isinstance(obj, dict):
                    _die(f"JSONL record must be an object at {path}:{line_no}", 1)
                yield line_no, obj
    except FileNotFoundError:
        _die(f"labels file not found: {path}", 1)
    except SystemExit:
        raise
    except Exception as e:
        _die(f"failed to read labels file {path}: {e}", 1)


def _pearson(x: Sequence[float], y: Sequence[float]) -> Optional[float]:
    if len(x) != len(y) or len(x) < 2:
        return None
    mean_x = sum(x) / len(x)
    mean_y = sum(y) / len(y)
    num = 0.0
    den_x = 0.0
    den_y = 0.0
    for a, b in zip(x, y):
        dx = a - mean_x
        dy = b - mean_y
        num += dx * dy
        den_x += dx * dx
        den_y += dy * dy
    if den_x <= 0.0 or den_y <= 0.0:
        return None
    return num / math.sqrt(den_x * den_y)


def _linear_fit(x: Sequence[float], y: Sequence[float]) -> Optional[Dict[str, float]]:
    if len(x) != len(y) or len(x) < 2:
        return None
    mean_x = sum(x) / len(x)
    mean_y = sum(y) / len(y)
    sxx = 0.0
    sxy = 0.0
    for a, b in zip(x, y):
        dx = a - mean_x
        sxx += dx * dx
        sxy += dx * (b - mean_y)
    if sxx <= 0.0:
        return None
    slope = sxy / sxx
    intercept = mean_y - slope * mean_x
    return {"slope": slope, "intercept": intercept}


def _clamp(v: float, lo: float = 1.0, hi: float = 5.0) -> float:
    return max(lo, min(hi, v))


def _safe_round(v: Optional[float], ndigits: int = 4) -> Optional[float]:
    if v is None:
        return None
    return round(float(v), ndigits)


def main() -> None:
    project_dir = sys.argv[1]
    labels_path = sys.argv[2]
    out_path = sys.argv[3].strip() if len(sys.argv) > 3 else ""

    label_records: Dict[int, Dict[str, Any]] = {}
    label_line_by_chapter: Dict[int, int] = {}

    for line_no, obj in _iter_jsonl(labels_path):
        chapter = obj.get("chapter")
        if not isinstance(chapter, int) or chapter < 1:
            _die(f"labels record missing valid chapter at {labels_path}:{line_no}", 1)
        schema_version = obj.get("schema_version")
        if schema_version != 1:
            _die(
                f"unsupported schema_version at {labels_path}:{line_no} (expected 1, got {schema_version})",
                1,
            )
        human_scores = obj.get("human_scores")
        if not isinstance(human_scores, dict) or _common.as_float(human_scores.get("overall")) is None:
            _die(f"labels record missing human_scores.overall at {labels_path}:{line_no}", 1)
        if chapter in label_records:
            _die(
                f"duplicate chapter {chapter} in labels (lines {label_line_by_chapter[chapter]} and {line_no})",
                1,
            )
        label_records[chapter] = obj
        label_line_by_chapter[chapter] = line_no

    if not label_records:
        _die("labels file has no records", 1)

    eval_dir = os.path.join(project_dir, "evaluations")
    if not os.path.isdir(eval_dir):
        _die(f"evaluations/ not found under project dir: {project_dir}", 1)

    eval_file_list = _common.find_eval_files(eval_dir)
    eval_files: Dict[int, str] = {ch: path for ch, path in eval_file_list}

    matched_chapters: List[int] = []
    missing_eval_chapters: List[int] = []

    human_overall: List[float] = []
    judge_overall: List[float] = []
    judge_overall_source: Dict[int, str] = {}

    dim_pairs: Dict[str, Tuple[List[float], List[float]]] = {}

    for chapter in sorted(label_records.keys()):
        eval_path = eval_files.get(chapter)
        if not eval_path:
            missing_eval_chapters.append(chapter)
            continue

        eval_obj = _load_json(eval_path)
        if not isinstance(eval_obj, dict):
            _die(f"eval JSON must be an object at {eval_path}", 1)

        human = _common.as_float(label_records[chapter]["human_scores"]["overall"])
        judge = _common.extract_overall(eval_obj)
        if human is None:
            _die(f"labels human_scores.overall not a number for chapter {chapter}", 1)
        if judge is None:
            missing_eval_chapters.append(chapter)
            continue

        # Track which field provided judge overall.
        src = "unknown"
        if _common.as_float(eval_obj.get("overall_final")) is not None:
            src = "overall_final"
        elif _common.as_float(_common.extract_eval_used(eval_obj).get("overall_final")) is not None:
            src = "eval_used.overall_final"
        elif _common.as_float(_common.extract_eval_used(eval_obj).get("overall")) is not None:
            src = "eval_used.overall"
        elif _common.as_float(eval_obj.get("overall")) is not None:
            src = "overall"
        else:
            meta = eval_obj.get("metadata")
            if isinstance(meta, dict) and isinstance(meta.get("judges"), dict) and _common.as_float(meta["judges"].get("overall_final")) is not None:
                src = "metadata.judges.overall_final"
        judge_overall_source[chapter] = src

        matched_chapters.append(chapter)
        human_overall.append(float(human))
        judge_overall.append(float(judge))

        human_scores = label_records[chapter].get("human_scores")
        human_dims: Dict[str, float] = {}
        if isinstance(human_scores, dict):
            for k, v in human_scores.items():
                if k == "overall":
                    continue
                n = _common.as_float(v)
                if n is not None:
                    human_dims[str(k)] = float(n)

        judge_dims = _common.extract_dimension_scores(eval_obj)
        for dim_key, human_dim_score in human_dims.items():
            judge_dim_score = judge_dims.get(dim_key)
            if judge_dim_score is None:
                continue
            xs, ys = dim_pairs.setdefault(dim_key, ([], []))
            xs.append(float(human_dim_score))
            ys.append(float(judge_dim_score))

    if len(matched_chapters) < 2:
        _die(
            f"need at least 2 matched chapters to compute Pearson (matched={len(matched_chapters)})",
            1,
        )

    r_overall = _pearson(human_overall, judge_overall)
    fit = _linear_fit(judge_overall, human_overall)  # human ~ slope * judge + intercept

    errors = [j - h for h, j in zip(human_overall, judge_overall)]
    mae = sum(abs(e) for e in errors) / len(errors)
    rmse = math.sqrt(sum(e * e for e in errors) / len(errors))
    bias = sum(errors) / len(errors)

    # pause_for_user_force_rewrite is implicit (<2.0), no threshold to calibrate
    default_thresholds = {"pass": 4.0, "polish": 3.5, "revise": 3.0, "pause_for_user": 2.0}

    suggestions: Dict[str, Any] = {"defaults": default_thresholds, "methods": {}}

    # Method 1: shift thresholds by mean judge-human bias.
    shifted = {k: _safe_round(_clamp(v + bias), 3) for k, v in default_thresholds.items()}
    suggestions["methods"]["shift_by_bias"] = {
        "bias_judge_minus_human": _safe_round(bias, 4),
        "suggested_thresholds": shifted,
        "note": "若 judge 整体偏高（bias>0），建议上调阈值；偏低（bias<0）则下调。仅作启发式建议。",
    }

    # Method 2: linear fit inversion: find judge thresholds that map to target human thresholds.
    if fit is not None and abs(float(fit["slope"])) > 1e-6:
        slope = float(fit["slope"])
        intercept = float(fit["intercept"])
        inv = {}
        for k, human_t in default_thresholds.items():
            inv[k] = _safe_round(_clamp((human_t - intercept) / slope), 3)
        suggestions["methods"]["linear_fit_inverse"] = {
            "fit_human_equals_slope_times_judge_plus_intercept": {
                "slope": _safe_round(slope, 6),
                "intercept": _safe_round(intercept, 6),
            },
            "suggested_thresholds": inv,
            "note": "基于最小二乘线性拟合的反解（用 judge 预测 human）。样本少/分布窄时可能不稳定，仅作建议。",
        }
    else:
        suggestions["methods"]["linear_fit_inverse"] = {
            "fit_human_equals_slope_times_judge_plus_intercept": None,
            "suggested_thresholds": None,
            "note": "judge 分布过窄或样本不足，无法稳定拟合。",
        }

    dims_report: Dict[str, Any] = {}
    for dim_key in sorted(dim_pairs.keys()):
        xs, ys = dim_pairs[dim_key]
        r = _pearson(xs, ys)
        dims_report[dim_key] = {"n": len(xs), "pearson_r": _safe_round(r, 4)}

    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    out: Dict[str, Any] = {
        "schema_version": 1,
        "generated_at": now,
        "project": {
            "path": os.path.abspath(project_dir),
            "evaluations_dir": os.path.join(os.path.abspath(project_dir), "evaluations"),
        },
        "labels": {
            "path": os.path.abspath(labels_path),
            "records": len(label_records),
        },
        "alignment": {
            "matched_chapters": matched_chapters,
            "missing_eval_chapters": missing_eval_chapters,
            "judge_overall_source_by_chapter": {str(k): v for k, v in sorted(judge_overall_source.items())},
        },
        "overall": {
            "n": len(matched_chapters),
            "pearson_r": _safe_round(r_overall, 4),
            "human_mean": _safe_round(sum(human_overall) / len(human_overall), 4),
            "judge_mean": _safe_round(sum(judge_overall) / len(judge_overall), 4),
            "mae": _safe_round(mae, 4),
            "rmse": _safe_round(rmse, 4),
            "bias_judge_minus_human": _safe_round(bias, 4),
        },
        "dimensions": dims_report,
        "threshold_suggestions": suggestions,
    }

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
            _die(f"failed to write report to {out_path}: {e}", 1)


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:
        sys.stderr.write(f"calibrate-quality-judge.sh: unexpected error: {e}\n")
        raise SystemExit(2)
