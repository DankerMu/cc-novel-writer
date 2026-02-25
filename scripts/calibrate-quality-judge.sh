#!/usr/bin/env bash
#
# QualityJudge calibration against human-labeled dataset (M3).
#
# Usage:
#   calibrate-quality-judge.sh --project <novel_project_dir> --labels <labels.jsonl> [--out <report.json>]
#
# Output:
#   stdout JSON (exit 0 on success)
#
# Exit codes:
#   0 = success (valid JSON emitted to stdout)
#   1 = validation failure (bad args, missing files, invalid JSON)
#   2 = script exception (unexpected runtime error)
#
# Notes:
# - Aligns by chapter number.
# - Uses judge `overall_final` when available; falls back to `overall`.

set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage:
  calibrate-quality-judge.sh --project <novel_project_dir> --labels <labels.jsonl> [--out <report.json>]

Options:
  --project <dir>   Novel project directory (must contain evaluations/)
  --labels <file>   JSONL labels file (eval/datasets/**/labels-YYYY-MM-DD.jsonl)
  --out <file>      Optional: write report JSON to file (directories created)
  -h, --help        Show help
EOF
}

project_dir=""
labels_path=""
out_path=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --project)
      [ "$#" -ge 2 ] || { echo "calibrate-quality-judge.sh: error: --project requires a value" >&2; exit 1; }
      project_dir="$2"
      shift 2
      ;;
    --labels)
      [ "$#" -ge 2 ] || { echo "calibrate-quality-judge.sh: error: --labels requires a value" >&2; exit 1; }
      labels_path="$2"
      shift 2
      ;;
    --out)
      [ "$#" -ge 2 ] || { echo "calibrate-quality-judge.sh: error: --out requires a value" >&2; exit 1; }
      out_path="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "calibrate-quality-judge.sh: unknown arg: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [ -z "$project_dir" ] || [ -z "$labels_path" ]; then
  echo "calibrate-quality-judge.sh: --project and --labels are required" >&2
  usage
  exit 1
fi

if [ ! -d "$project_dir" ]; then
  echo "calibrate-quality-judge.sh: project dir not found: $project_dir" >&2
  exit 1
fi

if [ ! -f "$labels_path" ]; then
  echo "calibrate-quality-judge.sh: labels file not found: $labels_path" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "calibrate-quality-judge.sh: python3 is required but not found" >&2
  exit 1
fi

python3 - "$project_dir" "$labels_path" "$out_path" <<'PY'
import json
import math
import os
import re
import sys
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple


def _die(msg: str, exit_code: int = 1) -> None:
    sys.stderr.write(msg.rstrip() + "\n")
    raise SystemExit(exit_code)


def _load_json(path: str) -> Any:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        _die(f"calibrate-quality-judge.sh: invalid JSON at {path}: {e}", 1)


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
                    _die(f"calibrate-quality-judge.sh: invalid JSONL at {path}:{line_no}: {e}", 1)
                if not isinstance(obj, dict):
                    _die(f"calibrate-quality-judge.sh: JSONL record must be an object at {path}:{line_no}", 1)
                yield line_no, obj
    except FileNotFoundError:
        _die(f"calibrate-quality-judge.sh: labels file not found: {path}", 1)
    except SystemExit:
        raise
    except Exception as e:
        _die(f"calibrate-quality-judge.sh: failed to read labels file {path}: {e}", 1)


def _as_number(value: Any) -> Optional[float]:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        v = float(value)
        return v if math.isfinite(v) else None
    return None


def _extract_eval_used(eval_obj: Dict[str, Any]) -> Dict[str, Any]:
    maybe = eval_obj.get("eval_used")
    if isinstance(maybe, dict):
        return maybe
    return eval_obj


def _extract_judge_overall(eval_obj: Dict[str, Any]) -> Optional[float]:
    # Prefer top-level overall_final if present.
    for v in [
        eval_obj.get("overall_final"),
        _extract_eval_used(eval_obj).get("overall_final"),
        _extract_eval_used(eval_obj).get("overall"),
        eval_obj.get("overall"),
    ]:
        n = _as_number(v)
        if n is not None:
            return n

    # Fallback: metadata.judges.overall_final
    meta = eval_obj.get("metadata")
    if isinstance(meta, dict):
        judges = meta.get("judges")
        if isinstance(judges, dict):
            n = _as_number(judges.get("overall_final"))
            if n is not None:
                return n
    return None


def _extract_judge_dimension_scores(eval_obj: Dict[str, Any]) -> Dict[str, float]:
    used = _extract_eval_used(eval_obj)
    scores = used.get("scores")
    if not isinstance(scores, dict):
        scores = eval_obj.get("scores")
        if not isinstance(scores, dict):
            return {}

    out: Dict[str, float] = {}
    for key, item in scores.items():
        if not isinstance(item, dict):
            continue
        score = _as_number(item.get("score"))
        if score is None:
            continue
        out[str(key)] = float(score)
    return out


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


def _find_eval_files(project_dir: str) -> Dict[int, str]:
    eval_dir = os.path.join(project_dir, "evaluations")
    if not os.path.isdir(eval_dir):
        _die(f"calibrate-quality-judge.sh: evaluations/ not found under project dir: {project_dir}", 1)

    by_chapter: Dict[int, str] = {}
    for name in os.listdir(eval_dir):
        m = re.match(r"^chapter-(\d+)-eval\.json$", name)
        if not m:
            continue
        chapter = int(m.group(1))
        by_chapter[chapter] = os.path.join(eval_dir, name)
    return by_chapter


def main() -> None:
    project_dir = sys.argv[1]
    labels_path = sys.argv[2]
    out_path = sys.argv[3].strip() if len(sys.argv) > 3 else ""

    label_records: Dict[int, Dict[str, Any]] = {}
    label_line_by_chapter: Dict[int, int] = {}

    for line_no, obj in _iter_jsonl(labels_path):
        chapter = obj.get("chapter")
        if not isinstance(chapter, int) or chapter < 1:
            _die(f"calibrate-quality-judge.sh: labels record missing valid chapter at {labels_path}:{line_no}", 1)
        schema_version = obj.get("schema_version")
        if schema_version != 1:
            _die(
                f"calibrate-quality-judge.sh: unsupported schema_version at {labels_path}:{line_no} (expected 1, got {schema_version})",
                1,
            )
        human_scores = obj.get("human_scores")
        if not isinstance(human_scores, dict) or _as_number(human_scores.get("overall")) is None:
            _die(f"calibrate-quality-judge.sh: labels record missing human_scores.overall at {labels_path}:{line_no}", 1)
        if chapter in label_records:
            _die(
                f"calibrate-quality-judge.sh: duplicate chapter {chapter} in labels (lines {label_line_by_chapter[chapter]} and {line_no})",
                1,
            )
        label_records[chapter] = obj
        label_line_by_chapter[chapter] = line_no

    if not label_records:
        _die("calibrate-quality-judge.sh: labels file has no records", 1)

    eval_files = _find_eval_files(project_dir)

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
            _die(f"calibrate-quality-judge.sh: eval JSON must be an object at {eval_path}", 1)

        human = _as_number(label_records[chapter]["human_scores"]["overall"])
        judge = _extract_judge_overall(eval_obj)
        if human is None:
            _die(f"calibrate-quality-judge.sh: labels human_scores.overall not a number for chapter {chapter}", 1)
        if judge is None:
            missing_eval_chapters.append(chapter)
            continue

        # Track which field provided judge overall.
        src = "unknown"
        if _as_number(eval_obj.get("overall_final")) is not None:
            src = "overall_final"
        elif _as_number(_extract_eval_used(eval_obj).get("overall_final")) is not None:
            src = "eval_used.overall_final"
        elif _as_number(_extract_eval_used(eval_obj).get("overall")) is not None:
            src = "eval_used.overall"
        elif _as_number(eval_obj.get("overall")) is not None:
            src = "overall"
        else:
            meta = eval_obj.get("metadata")
            if isinstance(meta, dict) and isinstance(meta.get("judges"), dict) and _as_number(meta["judges"].get("overall_final")) is not None:
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
                n = _as_number(v)
                if n is not None:
                    human_dims[str(k)] = float(n)

        judge_dims = _extract_judge_dimension_scores(eval_obj)
        for dim_key, human_dim_score in human_dims.items():
            judge_dim_score = judge_dims.get(dim_key)
            if judge_dim_score is None:
                continue
            xs, ys = dim_pairs.setdefault(dim_key, ([], []))
            xs.append(float(human_dim_score))
            ys.append(float(judge_dim_score))

    if len(matched_chapters) < 2:
        _die(
            f"calibrate-quality-judge.sh: need at least 2 matched chapters to compute Pearson (matched={len(matched_chapters)})",
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
            _die(f"calibrate-quality-judge.sh: failed to write report to {out_path}: {e}", 1)


try:
    main()
except SystemExit:
    raise
except Exception as e:
    sys.stderr.write(f"calibrate-quality-judge.sh: unexpected error: {e}\n")
    raise SystemExit(2)
PY

