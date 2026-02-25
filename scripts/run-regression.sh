#!/usr/bin/env bash
#
# Regression runner for M2 outputs (M3).
#
# Usage:
#   run-regression.sh --project <novel_project_dir> [--labels <labels.jsonl>] [--runs-dir <dir>] [--no-archive]
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
# - Reads existing project outputs (evaluations/logs/etc) and summarizes regression-friendly metrics.
# - Archives outputs under eval/runs/<timestamp>/ by default (recommended to be gitignored).

set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage:
  run-regression.sh --project <novel_project_dir> [--labels <labels.jsonl>] [--runs-dir <dir>] [--no-archive]

Options:
  --project <dir>     Novel project directory (must contain evaluations/)
  --labels <file>     Optional: labeled dataset JSONL (for traceability; future metrics can use it)
  --runs-dir <dir>    Output base dir for archived runs (default: eval/runs)
  --no-archive        Do not write run artifacts; only print JSON to stdout
  --no-continuity     Skip reading logs/continuity/latest.json even if present
  --no-foreshadowing  Skip reading foreshadowing/global.json even if present
  --no-style          Skip reading style-drift.json even if present
  -h, --help          Show help
EOF
}

project_dir=""
labels_path=""
runs_dir="eval/runs"
archive=1
include_continuity=1
include_foreshadowing=1
include_style=1

while [ "$#" -gt 0 ]; do
  case "$1" in
    --project)
      [ "$#" -ge 2 ] || { echo "run-regression.sh: error: --project requires a value" >&2; exit 1; }
      project_dir="$2"
      shift 2
      ;;
    --labels)
      [ "$#" -ge 2 ] || { echo "run-regression.sh: error: --labels requires a value" >&2; exit 1; }
      labels_path="$2"
      shift 2
      ;;
    --runs-dir)
      [ "$#" -ge 2 ] || { echo "run-regression.sh: error: --runs-dir requires a value" >&2; exit 1; }
      runs_dir="$2"
      shift 2
      ;;
    --no-archive)
      archive=0
      shift 1
      ;;
    --no-continuity)
      include_continuity=0
      shift 1
      ;;
    --no-foreshadowing)
      include_foreshadowing=0
      shift 1
      ;;
    --no-style)
      include_style=0
      shift 1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "run-regression.sh: unknown arg: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [ -z "$project_dir" ]; then
  echo "run-regression.sh: --project is required" >&2
  usage
  exit 1
fi

if [ ! -d "$project_dir" ]; then
  echo "run-regression.sh: project dir not found: $project_dir" >&2
  exit 1
fi

if [ -n "$labels_path" ] && [ ! -f "$labels_path" ]; then
  echo "run-regression.sh: labels file not found: $labels_path" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "run-regression.sh: python3 is required but not found" >&2
  exit 1
fi

python3 - \
  "$project_dir" \
  "$labels_path" \
  "$runs_dir" \
  "$archive" \
  "$include_continuity" \
  "$include_foreshadowing" \
  "$include_style" \
  <<'PY'
import json
import math
import os
import re
import shutil
import sys
import tempfile
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple


def _die(msg: str, exit_code: int = 1) -> None:
    sys.stderr.write(msg.rstrip() + "\n")
    raise SystemExit(exit_code)


def _load_json(path: str) -> Any:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return None
    except Exception as e:
        _die(f"run-regression.sh: invalid JSON at {path}: {e}", 1)


def _as_int(value: Any) -> Optional[int]:
    if isinstance(value, int) and not isinstance(value, bool):
        return int(value)
    return None


def _as_float(value: Any) -> Optional[float]:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        v = float(value)
        if not math.isfinite(v):
            return None
        return v
    return None


def _as_str(value: Any) -> Optional[str]:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _iso_utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _timestamp_id() -> str:
    now = datetime.now(timezone.utc)
    return now.strftime("%Y%m%dT%H%M%S") + f"_{now.strftime('%f')[:4]}Z"


def _mkdir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def _extract_eval_used(eval_obj: Dict[str, Any]) -> Dict[str, Any]:
    maybe = eval_obj.get("eval_used")
    if isinstance(maybe, dict):
        return maybe
    return eval_obj


def _extract_overall(eval_obj: Dict[str, Any]) -> Optional[float]:
    for v in [
        eval_obj.get("overall_final"),
        _extract_eval_used(eval_obj).get("overall_final"),
        _extract_eval_used(eval_obj).get("overall"),
        eval_obj.get("overall"),
    ]:
        n = _as_float(v)
        if n is not None:
            return n
    meta = eval_obj.get("metadata")
    if isinstance(meta, dict):
        judges = meta.get("judges")
        if isinstance(judges, dict):
            n = _as_float(judges.get("overall_final"))
            if n is not None:
                return n
    return None


def _extract_scores(eval_obj: Dict[str, Any]) -> Dict[str, float]:
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
        v = _as_float(item.get("score"))
        if v is None:
            continue
        out[str(key)] = float(v)
    return out


def _extract_contract_verification(eval_obj: Dict[str, Any]) -> Dict[str, Any]:
    used = _extract_eval_used(eval_obj)
    cv = used.get("contract_verification")
    if isinstance(cv, dict):
        return cv
    cv = eval_obj.get("contract_verification")
    if isinstance(cv, dict):
        return cv
    return {}


def _iter_eval_files(project_dir: str) -> List[Tuple[int, str]]:
    eval_dir = os.path.join(project_dir, "evaluations")
    if not os.path.isdir(eval_dir):
        _die(f"run-regression.sh: evaluations/ not found under project dir: {project_dir}", 1)
    items: List[Tuple[int, str]] = []
    for name in os.listdir(eval_dir):
        m = re.match(r"^chapter-(\d+)-eval\.json$", name)
        if not m:
            continue
        chapter = int(m.group(1))
        items.append((chapter, os.path.join(eval_dir, name)))
    items.sort(key=lambda x: x[0])
    return items


def _severity_rank(v: str) -> int:
    return {"high": 0, "medium": 1, "low": 2}.get(v, 9)


def _summarize_continuity(report: Any) -> Optional[Dict[str, Any]]:
    if report is None:
        return None
    if not isinstance(report, dict):
        return {"error": "continuity latest.json is not an object"}
    stats = report.get("stats") if isinstance(report.get("stats"), dict) else {}
    issues = report.get("issues") if isinstance(report.get("issues"), list) else []
    top_issues: List[Dict[str, Any]] = []
    for it in issues[:50]:
        if not isinstance(it, dict):
            continue
        top_issues.append(
            {
                "id": it.get("id"),
                "type": it.get("type"),
                "severity": it.get("severity"),
                "confidence": it.get("confidence"),
                "description": it.get("description"),
            }
        )
    top_issues.sort(key=lambda x: (_severity_rank(str(x.get("severity"))), str(x.get("type")), str(x.get("id"))))
    top_issues = top_issues[:5]
    return {
        "schema_version": report.get("schema_version"),
        "generated_at": report.get("generated_at"),
        "scope": report.get("scope"),
        "volume": report.get("volume"),
        "chapter_range": report.get("chapter_range"),
        "stats": {
            "chapters_checked": stats.get("chapters_checked"),
            "issues_total": stats.get("issues_total"),
            "issues_by_severity": stats.get("issues_by_severity"),
        },
        "top_issues": top_issues,
    }


def _summarize_style_drift(obj: Any) -> Optional[Dict[str, Any]]:
    if obj is None:
        return None
    if not isinstance(obj, dict):
        return {"error": "style-drift.json is not an object"}
    drifts = obj.get("drifts") if isinstance(obj.get("drifts"), list) else []
    return {
        "active": obj.get("active"),
        "detected_chapter": obj.get("detected_chapter"),
        "window": obj.get("window"),
        "drifts_count": len(drifts),
    }


def _as_range(value: Any) -> Optional[Tuple[int, int]]:
    if not isinstance(value, list) or len(value) != 2:
        return None
    a = _as_int(value[0])
    b = _as_int(value[1])
    if a is None or b is None:
        return None
    if a < 1 or b < 1 or a > b:
        return None
    return (a, b)


def _foreshadow_overdue_short(item: Dict[str, Any], last_completed_chapter: int) -> bool:
    if item.get("scope") != "short":
        return False
    if item.get("status") == "resolved":
        return False
    r = _as_range(item.get("target_resolve_range"))
    if r is None:
        return False
    return last_completed_chapter > r[1]


def _summarize_foreshadowing(project_dir: str, last_completed_chapter: int) -> Optional[Dict[str, Any]]:
    global_path = os.path.join(project_dir, "foreshadowing", "global.json")
    global_obj = _load_json(global_path)
    if global_obj is None:
        return None
    if isinstance(global_obj, list):
        items = global_obj
    elif isinstance(global_obj, dict) and isinstance(global_obj.get("foreshadowing"), list):
        items = global_obj["foreshadowing"]
    else:
        return {"error": "foreshadowing/global.json has unsupported schema (expected list or {foreshadowing:[]})"}

    normalized: List[Dict[str, Any]] = [it for it in items if isinstance(it, dict)]
    active = [it for it in normalized if it.get("status") != "resolved"]
    resolved = [it for it in normalized if it.get("status") == "resolved"]
    overdue = [it for it in normalized if _foreshadow_overdue_short(it, last_completed_chapter)]

    overdue_ids = []
    for it in overdue:
        fid = _as_str(it.get("id"))
        if fid:
            overdue_ids.append(fid)

    # Optional plan alignment using checkpoint current_volume.
    plan_stats = None
    ck = _load_json(os.path.join(project_dir, ".checkpoint.json"))
    vol = ck.get("current_volume") if isinstance(ck, dict) else None
    vol_int = _as_int(vol)
    if vol_int is not None and vol_int >= 1:
        plan_path = os.path.join(project_dir, "volumes", f"vol-{vol_int:02d}", "foreshadowing.json")
        plan_obj = _load_json(plan_path)
        plan_items: List[Dict[str, Any]] = []
        if isinstance(plan_obj, dict) and isinstance(plan_obj.get("foreshadowing"), list):
            plan_items = [it for it in plan_obj["foreshadowing"] if isinstance(it, dict)]
        elif isinstance(plan_obj, list):
            plan_items = [it for it in plan_obj if isinstance(it, dict)]

        if plan_items:
            global_ids = {str(_as_str(it.get("id")) or "") for it in normalized}
            planned_ids = [str(_as_str(it.get("id")) or "") for it in plan_items if _as_str(it.get("id"))]
            planned_total = len(planned_ids)
            missing_in_global = [pid for pid in planned_ids if pid not in global_ids]

            resolved_in_global = 0
            pending_in_global = 0
            global_by_id = {str(_as_str(it.get("id")) or ""): it for it in normalized if _as_str(it.get("id"))}
            for pid in planned_ids:
                it = global_by_id.get(pid)
                if not it:
                    continue
                if it.get("status") == "resolved":
                    resolved_in_global += 1
                else:
                    pending_in_global += 1

            plan_stats = {
                "path": plan_path,
                "planned_total": planned_total,
                "resolved_in_global": resolved_in_global,
                "pending_in_global": pending_in_global,
                "missing_in_global": missing_in_global[:50],
            }

    return {
        "global_path": global_path,
        "items_total": len(normalized),
        "active_count": len(active),
        "resolved_count": len(resolved),
        "overdue_short_count": len(overdue),
        "overdue_short_ids": overdue_ids[:50],
        "plan_alignment": plan_stats,
    }


def _summarize_ai_blacklist(project_dir: str) -> Optional[Dict[str, Any]]:
    path = os.path.join(project_dir, "ai-blacklist.json")
    obj = _load_json(path)
    if obj is None:
        return None
    if not isinstance(obj, dict):
        return {"error": "ai-blacklist.json is not an object"}
    words = obj.get("words") if isinstance(obj.get("words"), list) else []
    whitelist_words = []
    whitelist = obj.get("whitelist")
    if isinstance(whitelist, list):
        whitelist_words = [w for w in whitelist if isinstance(w, str)]
    elif isinstance(whitelist, dict) and isinstance(whitelist.get("words"), list):
        whitelist_words = [w for w in whitelist["words"] if isinstance(w, str)]
    return {
        "version": obj.get("version"),
        "last_updated": obj.get("last_updated"),
        "words_count": len(words),
        "whitelist_words_count": len(whitelist_words),
        "path": path,
    }


def _summarize_logs(project_dir: str) -> Dict[str, Any]:
    logs_dir = os.path.join(project_dir, "logs")
    if not os.path.isdir(logs_dir):
        return {"present": False}
    log_files = []
    for name in os.listdir(logs_dir):
        if re.match(r"^chapter-\d+-log\.json$", name):
            log_files.append(os.path.join(logs_dir, name))
    log_files.sort()

    stages_by_model: Dict[str, int] = {}
    judge_models: Dict[str, int] = {}
    gate_decisions: Dict[str, int] = {}
    revisions_sum = 0
    force_passed_count = 0

    for path in log_files:
        obj = _load_json(path)
        if not isinstance(obj, dict):
            continue
        gate = _as_str(obj.get("gate_decision")) or "unknown"
        gate_decisions[gate] = gate_decisions.get(gate, 0) + 1

        rev = _as_int(obj.get("revisions"))
        if rev is not None:
            revisions_sum += rev
        if obj.get("force_passed") is True:
            force_passed_count += 1

        stages = obj.get("stages")
        if isinstance(stages, list):
            for st in stages:
                if not isinstance(st, dict):
                    continue
                m = _as_str(st.get("model"))
                if m:
                    stages_by_model[m] = stages_by_model.get(m, 0) + 1

        judges = obj.get("judges")
        if isinstance(judges, dict):
            primary = judges.get("primary")
            if isinstance(primary, dict):
                m = _as_str(primary.get("model"))
                if m:
                    judge_models[m] = judge_models.get(m, 0) + 1
            secondary = judges.get("secondary")
            if isinstance(secondary, dict):
                m = _as_str(secondary.get("model"))
                if m:
                    judge_models[m] = judge_models.get(m, 0) + 1

    return {
        "present": True,
        "chapter_logs_count": len(log_files),
        "gate_decisions": dict(sorted(gate_decisions.items())),
        "revisions_sum": revisions_sum,
        "force_passed_count": force_passed_count,
        "stages_by_model": dict(sorted(stages_by_model.items())),
        "judge_models": dict(sorted(judge_models.items())),
    }


def _get_rule_id(layer: str, item: Dict[str, Any]) -> str:
    if layer == "L1":
        return _as_str(item.get("rule_id")) or "UNKNOWN"
    if layer == "L2":
        return _as_str(item.get("contract_id")) or _as_str(item.get("rule_id")) or "UNKNOWN"
    if layer == "L3":
        return _as_str(item.get("objective_id")) or _as_str(item.get("rule_id")) or "UNKNOWN"
    if layer == "LS":
        return _as_str(item.get("rule_id")) or "UNKNOWN"
    return _as_str(item.get("rule_id")) or "UNKNOWN"


def _norm_confidence(v: Any) -> str:
    s = _as_str(v)
    if not s:
        return "unknown"
    s = s.lower()
    if s in {"high", "medium", "low"}:
        return s
    return "unknown"


def _norm_status(v: Any) -> str:
    s = _as_str(v)
    if not s:
        return "unknown"
    return s.lower()


def _is_violation_status(status: str) -> bool:
    return status in {"violation", "violation_suspected"}


def _is_high_conf_violation(layer: str, item: Dict[str, Any]) -> bool:
    status = _norm_status(item.get("status"))
    if status != "violation":
        return False
    conf = _norm_confidence(item.get("confidence"))
    if conf != "high":
        return False
    if layer != "LS":
        return True
    constraint_type = _as_str(item.get("constraint_type"))
    if constraint_type is None or constraint_type == "hard":
        return True
    return False


def _format_md_report(data: Dict[str, Any]) -> str:
    summary = data.get("metrics", {})
    lines: List[str] = []
    lines.append(f"# Regression Summary ({summary.get('run_id')})")
    lines.append("")
    lines.append(f"- Project: `{summary.get('project_path')}`")
    lines.append(f"- Generated at: `{summary.get('generated_at')}`")
    lines.append("")
    lines.append("## Spec+LS Compliance")
    lines.append("")
    comp = summary.get("compliance", {})
    lines.append(f"- Chapters: {comp.get('chapters_total')}")
    lines.append(f"- Compliance (high-confidence gate): {comp.get('compliance_rate_high_confidence')}")
    lines.append(f"- Chapters w/ high-confidence violations: {comp.get('chapters_with_high_confidence_violation')}")
    lines.append(f"- Compliance (any violation status): {comp.get('compliance_rate_any_violation')}")
    lines.append(f"- Chapters w/ any violations: {comp.get('chapters_with_any_violation')}")
    lines.append("")

    if isinstance(data.get("top_rules"), list) and data["top_rules"]:
        lines.append("## Top Violated Rules (any confidence)")
        lines.append("")
        for it in data["top_rules"][:10]:
            lines.append(f"- {it.get('layer')} {it.get('rule_id')}: {it.get('count')}")
        lines.append("")

    if data.get("continuity") is not None:
        lines.append("## Continuity (logs/continuity/latest.json)")
        lines.append("")
        stats = data["continuity"].get("stats", {}) if isinstance(data["continuity"], dict) else {}
        lines.append(f"- issues_total: {stats.get('issues_total')}")
        lines.append(f"- issues_by_severity: {stats.get('issues_by_severity')}")
        lines.append("")

    if data.get("foreshadowing") is not None:
        lines.append("## Foreshadowing (foreshadowing/global.json)")
        lines.append("")
        fs = data["foreshadowing"]
        lines.append(f"- active: {fs.get('active_count')} / total: {fs.get('items_total')} / resolved: {fs.get('resolved_count')}")
        lines.append(f"- overdue_short: {fs.get('overdue_short_count')}")
        lines.append("")

    if data.get("style_drift") is not None:
        lines.append("## Style Drift (style-drift.json)")
        lines.append("")
        sd = data["style_drift"]
        lines.append(f"- active: {sd.get('active')} / drifts_count: {sd.get('drifts_count')}")
        lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def main() -> None:
    project_dir = sys.argv[1]
    labels_path = sys.argv[2].strip()
    runs_dir = sys.argv[3]
    archive = int(sys.argv[4]) == 1
    include_continuity = int(sys.argv[5]) == 1
    include_foreshadowing = int(sys.argv[6]) == 1
    include_style = int(sys.argv[7]) == 1

    project_dir_abs = os.path.abspath(project_dir)

    eval_items = _iter_eval_files(project_dir_abs)
    if not eval_items:
        _die(f"run-regression.sh: no evaluations found under {project_dir_abs}/evaluations", 1)

    chapters_total = len(eval_items)
    chapters = [c for c, _ in eval_items]

    # Determine last_completed_chapter for overdue logic.
    checkpoint = _load_json(os.path.join(project_dir_abs, ".checkpoint.json"))
    last_completed = None
    if isinstance(checkpoint, dict):
        last_completed = _as_int(checkpoint.get("last_completed_chapter"))
    if last_completed is None:
        last_completed = max(chapters)

    # Spec+LS compliance aggregation.
    violations_total = 0
    chapters_with_any_violation = set()
    chapters_with_high_conf_violation = set()

    violations_by_conf: Dict[str, int] = {"high": 0, "medium": 0, "low": 0, "unknown": 0}
    violations_by_layer: Dict[str, int] = {"L1": 0, "L2": 0, "L3": 0, "LS": 0, "unknown": 0}

    by_rule: Dict[str, Dict[str, Dict[str, int]]] = {}  # layer -> rule_id -> confidence -> count

    overall_scores: List[float] = []
    dim_sums: Dict[str, float] = {}
    dim_counts: Dict[str, int] = {}

    for chapter, path in eval_items:
        obj = _load_json(path)
        if not isinstance(obj, dict):
            continue

        overall = _extract_overall(obj)
        if overall is not None:
            overall_scores.append(overall)

        scores = _extract_scores(obj)
        for k, v in scores.items():
            dim_sums[k] = dim_sums.get(k, 0.0) + float(v)
            dim_counts[k] = dim_counts.get(k, 0) + 1

        cv = _extract_contract_verification(obj)
        layer_map = {
            "L1": cv.get("l1_checks"),
            "L2": cv.get("l2_checks"),
            "L3": cv.get("l3_checks"),
            "LS": cv.get("ls_checks"),
        }

        chapter_any_violation = False
        chapter_high_violation = False

        for layer, checks in layer_map.items():
            if not isinstance(checks, list):
                continue
            for it in checks:
                if not isinstance(it, dict):
                    continue
                status = _norm_status(it.get("status"))
                conf = _norm_confidence(it.get("confidence"))

                if _is_violation_status(status):
                    chapter_any_violation = True
                    violations_total += 1
                    violations_by_conf[conf] = violations_by_conf.get(conf, 0) + 1
                    violations_by_layer[layer] = violations_by_layer.get(layer, 0) + 1

                    rule_id = _get_rule_id(layer, it)
                    by_rule.setdefault(layer, {}).setdefault(rule_id, {}).setdefault(conf, 0)
                    by_rule[layer][rule_id][conf] += 1

                if _is_high_conf_violation(layer, it):
                    chapter_high_violation = True

        if chapter_any_violation:
            chapters_with_any_violation.add(chapter)
        if chapter_high_violation:
            chapters_with_high_conf_violation.add(chapter)

    def _rate(ok: int, total: int) -> float:
        if total <= 0:
            return 0.0
        return ok / total

    compliance_rate_any = _rate(chapters_total - len(chapters_with_any_violation), chapters_total)
    compliance_rate_high = _rate(chapters_total - len(chapters_with_high_conf_violation), chapters_total)

    # Top rules list for quick view.
    top_rules: List[Dict[str, Any]] = []
    for layer in sorted(by_rule.keys()):
        for rule_id, conf_map in by_rule[layer].items():
            top_rules.append({"layer": layer, "rule_id": rule_id, "count": sum(conf_map.values())})
    top_rules.sort(key=lambda x: (-int(x["count"]), str(x["layer"]), str(x["rule_id"])))

    score_summary = None
    if overall_scores:
        score_summary = {
            "n": len(overall_scores),
            "mean": round(sum(overall_scores) / len(overall_scores), 4),
            "min": round(min(overall_scores), 4),
            "max": round(max(overall_scores), 4),
        }

    dim_summary = {}
    for k in sorted(dim_sums.keys()):
        cnt = dim_counts.get(k, 0)
        if cnt <= 0:
            continue
        dim_summary[k] = {"n": cnt, "mean": round(dim_sums[k] / cnt, 4)}

    continuity_summary = None
    if include_continuity:
        continuity_summary = _summarize_continuity(_load_json(os.path.join(project_dir_abs, "logs", "continuity", "latest.json")))

    foreshadow_summary = None
    if include_foreshadowing:
        foreshadow_summary = _summarize_foreshadowing(project_dir_abs, last_completed)

    style_summary = None
    if include_style:
        style_summary = _summarize_style_drift(_load_json(os.path.join(project_dir_abs, "style-drift.json")))

    blacklist_summary = _summarize_ai_blacklist(project_dir_abs)
    logs_summary = _summarize_logs(project_dir_abs)

    run_id = _timestamp_id()
    generated_at = _iso_utc_now()

    config_snapshot = {
        "schema_version": 1,
        "run_id": run_id,
        "generated_at": generated_at,
        "project_path": project_dir_abs,
        "labels_path": os.path.abspath(labels_path) if labels_path else None,
        "enabled_checks": {
            "continuity_latest_json": bool(include_continuity),
            "foreshadowing_global_json": bool(include_foreshadowing),
            "style_drift_json": bool(include_style),
        },
        # pause_for_user_force_rewrite is implicit (<2.0), no threshold to calibrate
        "gate_thresholds_defaults": {"pass": 4.0, "polish": 3.5, "revise": 3.0, "pause_for_user": 2.0},
    }

    summary_metrics = {
        "schema_version": 1,
        "run_id": run_id,
        "generated_at": generated_at,
        "project_path": project_dir_abs,
        "chapters_total": chapters_total,
        "chapter_range": [min(chapters), max(chapters)],
        "compliance": {
            "chapters_total": chapters_total,
            "chapters_with_any_violation": len(chapters_with_any_violation),
            "chapters_with_high_confidence_violation": len(chapters_with_high_conf_violation),
            "compliance_rate_any_violation": round(compliance_rate_any, 6),
            "compliance_rate_high_confidence": round(compliance_rate_high, 6),
        },
        "violations_total": violations_total,
        "violations_by_confidence": violations_by_conf,
        "violations_by_layer": violations_by_layer,
        "score_overall": score_summary,
        "score_dimensions": dim_summary,
    }

    report = {
        "schema_version": 1,
        "run_id": run_id,
        "generated_at": generated_at,
        "project_path": project_dir_abs,
        "labels_path": os.path.abspath(labels_path) if labels_path else None,
        "chapter_ids": chapters,
        "checkpoint": checkpoint if isinstance(checkpoint, dict) else None,
        "spec_ls": {
            "violations_total": violations_total,
            "chapters_with_any_violation": sorted(list(chapters_with_any_violation)),
            "chapters_with_high_confidence_violation": sorted(list(chapters_with_high_conf_violation)),
            "violations_by_layer_rule_confidence": by_rule,
            "top_rules": top_rules[:50],
        },
        "continuity": continuity_summary,
        "foreshadowing": foreshadow_summary,
        "style_drift": style_summary,
        "ai_blacklist": blacklist_summary,
        "logs": logs_summary,
    }

    out_json = json.dumps(report, ensure_ascii=False, sort_keys=True) + "\n"
    sys.stdout.write(out_json)

    if not archive:
        return

    run_dir = os.path.join(os.path.abspath(runs_dir), run_id)
    parent_dir = os.path.abspath(runs_dir)
    _mkdir(parent_dir)
    tmp_dir = tempfile.mkdtemp(dir=parent_dir)

    try:
        with open(os.path.join(tmp_dir, "config.json"), "w", encoding="utf-8") as f:
            f.write(json.dumps(config_snapshot, ensure_ascii=False, sort_keys=True) + "\n")
        with open(os.path.join(tmp_dir, "summary.json"), "w", encoding="utf-8") as f:
            f.write(json.dumps(summary_metrics, ensure_ascii=False, sort_keys=True) + "\n")
        with open(os.path.join(tmp_dir, "report.json"), "w", encoding="utf-8") as f:
            f.write(out_json)
        with open(os.path.join(tmp_dir, "report.md"), "w", encoding="utf-8") as f:
            report_data = {
                "metrics": summary_metrics,
                "top_rules": top_rules[:10],
                "continuity": continuity_summary,
                "foreshadowing": foreshadow_summary,
                "style_drift": style_summary,
            }
            f.write(_format_md_report(report_data))
        os.rename(tmp_dir, run_dir)
    except Exception:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise


try:
    main()
except SystemExit:
    raise
except Exception as e:
    sys.stderr.write(f"run-regression.sh: unexpected error: {e}\n")
    raise SystemExit(2)
PY

