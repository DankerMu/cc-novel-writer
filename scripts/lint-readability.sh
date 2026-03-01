#!/usr/bin/env bash
#
# Deterministic mobile readability linter (M7R.3 extension point).
#
# Usage:
#   lint-readability.sh <chapter.md> <platform-profile.json> <chapter_no>
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
# - This script is designed to be stable and regression-friendly (deterministic ordering and thresholds).
# - The CLI treats this script's JSON stdout as authoritative when present.

set -euo pipefail

if [ "$#" -ne 3 ]; then
  echo "Usage: lint-readability.sh <chapter.md> <platform-profile.json> <chapter_no>" >&2
  exit 1
fi

chapter_path="$1"
profile_path="$2"
chapter_no="$3"

if [ ! -f "$chapter_path" ]; then
  echo "lint-readability.sh: chapter file not found: $chapter_path" >&2
  exit 1
fi

if [ ! -f "$profile_path" ]; then
  echo "lint-readability.sh: platform profile file not found: $profile_path" >&2
  exit 1
fi

if ! [[ "$chapter_no" =~ ^[0-9]+$ ]] || [ "$chapter_no" -le 0 ]; then
  echo "lint-readability.sh: chapter_no must be an int >= 1" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "lint-readability.sh: python3 is required but not found" >&2
  exit 2
fi

if ! python3 -c "import sys; sys.exit(0 if sys.version_info >= (3, 7) else 1)" 2>/dev/null; then
  echo "lint-readability.sh: python3 >= 3.7 is required" >&2
  exit 2
fi

python3 - "$chapter_path" "$profile_path" "$chapter_no" <<'PY'
import json
import math
import re
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple


def _die(msg: str, exit_code: int = 1) -> None:
    sys.stderr.write(msg.rstrip() + "\n")
    raise SystemExit(exit_code)


def _load_json(path: str) -> Any:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        _die(f"lint-readability.sh: invalid JSON at {path}: {e}", 1)


def _read_text(path: str) -> str:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        _die(f"lint-readability.sh: failed to read {path}: {e}", 1)


def _count_non_whitespace_chars(text: str) -> int:
    compact = re.sub(r"\s+", "", text, flags=re.UNICODE)
    return len(compact)


def _strip_code_fences(text: str) -> str:
    # Best-effort removal of fenced code blocks to avoid counting them as prose paragraphs.
    return re.sub(r"(^|\n)```[\s\S]*?\n```[ \t]*(?=\n|$)", "\n", text, flags=re.UNICODE)


def _is_atx_heading_line(line: str) -> bool:
    return re.match(r"^(?:\ufeff)? {0,3}#{1,6}(?!#)\s+.*$", line, flags=re.UNICODE) is not None


def _extract_paragraphs(text: str) -> List[Dict[str, Any]]:
    cleaned = _strip_code_fences(text).replace("\r\n", "\n").replace("\r", "\n")
    lines = cleaned.split("\n")

    out: List[Dict[str, Any]] = []
    buf: List[str] = []

    def flush() -> None:
        nonlocal buf
        if not buf:
            return
        raw = "\n".join(buf).rstrip()
        buf = []
        if not raw.strip():
            return
        first_line = ""
        for l in raw.split("\n"):
            if l.strip():
                first_line = l
                break
        is_heading = _is_atx_heading_line(first_line)
        chars = _count_non_whitespace_chars(raw)
        has_dialogue = bool(re.search(r'["“”]', raw, flags=re.UNICODE))
        out.append(
            {
                "index": len(out) + 1,
                "raw": raw,
                "chars": chars,
                "is_heading": is_heading,
                "has_dialogue": has_dialogue,
                "is_single_line": "\n" not in raw,
            }
        )

    for line in lines:
        if not line.strip():
            flush()
            continue
        buf.append(line)
    flush()
    return out


def _snippet(text: str, max_len: int) -> str:
    s = re.sub(r"\s+", " ", text.strip(), flags=re.UNICODE)
    if len(s) <= max_len:
        return s
    return s[: max(0, max_len - 1)] + "…"


def _require_int(v: Any, field: str) -> int:
    if not isinstance(v, int) or isinstance(v, bool):
        _die(f"lint-readability.sh: invalid platform-profile.json: {field} must be an int", 1)
    return v


def _require_str(v: Any, field: str) -> str:
    if not isinstance(v, str) or not v.strip():
        _die(f"lint-readability.sh: invalid platform-profile.json: {field} must be a non-empty string", 1)
    return v.strip()


def _require_bool(v: Any, field: str) -> bool:
    if not isinstance(v, bool):
        _die(f"lint-readability.sh: invalid platform-profile.json: {field} must be a boolean", 1)
    return v


def _parse_mobile_policy(profile: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    readability = profile.get("readability")
    if readability is None:
        return None
    if not isinstance(readability, dict):
        _die("lint-readability.sh: invalid platform-profile.json: readability must be an object", 1)
    mobile = readability.get("mobile")
    if mobile is None:
        return None
    if not isinstance(mobile, dict):
        _die("lint-readability.sh: invalid platform-profile.json: readability.mobile must be an object", 1)

    enabled = _require_bool(mobile.get("enabled"), "readability.mobile.enabled")
    max_paragraph_chars = _require_int(mobile.get("max_paragraph_chars"), "readability.mobile.max_paragraph_chars")
    if max_paragraph_chars < 1:
        _die("lint-readability.sh: invalid platform-profile.json: readability.mobile.max_paragraph_chars must be >= 1", 1)
    max_consecutive = _require_int(
        mobile.get("max_consecutive_exposition_paragraphs"),
        "readability.mobile.max_consecutive_exposition_paragraphs",
    )
    if max_consecutive < 1:
        _die(
            "lint-readability.sh: invalid platform-profile.json: readability.mobile.max_consecutive_exposition_paragraphs must be >= 1",
            1,
        )
    blocking = _require_str(mobile.get("blocking_severity"), "readability.mobile.blocking_severity")
    if blocking not in ("hard_only", "soft_and_hard"):
        _die(
            "lint-readability.sh: invalid platform-profile.json: readability.mobile.blocking_severity must be 'hard_only' or 'soft_and_hard'",
            1,
        )

    return {
        "enabled": enabled,
        "max_paragraph_chars": max_paragraph_chars,
        "max_consecutive_exposition_paragraphs": max_consecutive,
        "blocking_severity": blocking,
    }


def _overlong_severity(chars: int, max_chars: int) -> str:
    return "hard" if chars > math.ceil(max_chars * 1.5) else "soft"


def _exposition_run_severity(run_len: int, max_run: int) -> str:
    return "hard" if run_len >= (max_run + 2) else "soft"


def _dialogue_dense_severity(quote_count: int, chars: int, max_chars: int) -> str:
    if quote_count >= 10:
        return "hard"
    if chars > max_chars:
        return "hard"
    return "soft"


def main() -> None:
    chapter_path = sys.argv[1]
    profile_path = sys.argv[2]
    chapter_no = int(sys.argv[3])

    profile_raw = _load_json(profile_path)
    if not isinstance(profile_raw, dict):
        _die("lint-readability.sh: platform-profile.json must be a JSON object", 1)
    profile: Dict[str, Any] = profile_raw

    policy = _parse_mobile_policy(profile)
    if policy is None or not policy.get("enabled", False):
        # Still emit a valid report for introspection, but with no issues.
        out = {
            "schema_version": 1,
            "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "scope": {"chapter": chapter_no},
            "policy": policy
            or {
                "enabled": False,
                "max_paragraph_chars": 1,
                "max_consecutive_exposition_paragraphs": 1,
                "blocking_severity": "hard_only",
            },
            "issues": [],
        }
        sys.stdout.write(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n")
        return

    chapter_text = _read_text(chapter_path)
    paragraphs = _extract_paragraphs(chapter_text)

    max_para = int(policy["max_paragraph_chars"])
    max_expo = int(policy["max_consecutive_exposition_paragraphs"])

    issues: List[Dict[str, Any]] = []

    # Chapter-level quote / punctuation consistency (warn-only).
    has_ascii_quotes = '"' in chapter_text
    has_curly_quotes = bool(re.search(r"[“”]", chapter_text, flags=re.UNICODE))
    if has_ascii_quotes and has_curly_quotes:
        issues.append(
            {
                "id": "readability.mobile.mixed_quote_styles",
                "severity": "warn",
                "summary": "Mixed quote styles detected (ASCII '\"' and curly quotes “”).",
                "suggestion": "Use a single quote style consistently to improve mobile readability.",
            }
        )

    has_ascii_ellipsis = "..." in chapter_text
    has_cjk_ellipsis = "……" in chapter_text
    if has_ascii_ellipsis and has_cjk_ellipsis:
        issues.append(
            {
                "id": "readability.mobile.mixed_ellipsis_styles",
                "severity": "warn",
                "summary": "Mixed ellipsis styles detected ('...' and '……').",
                "suggestion": "Use a single ellipsis style consistently.",
            }
        )

    punctuation_pairs = [
        (",", "，", "readability.mobile.mixed_comma_styles", "Mixed comma styles detected (',' and '，')."),
        (".", "。", "readability.mobile.mixed_period_styles", "Mixed period styles detected ('.' and '。')."),
        ("?", "？", "readability.mobile.mixed_question_mark_styles", "Mixed question mark styles detected ('?' and '？')."),
        ("!", "！", "readability.mobile.mixed_exclamation_styles", "Mixed exclamation mark styles detected ('!' and '！')."),
    ]
    for ascii_ch, full_ch, issue_id, summary in punctuation_pairs:
        if ascii_ch in chapter_text and full_ch in chapter_text:
            issues.append(
                {
                    "id": issue_id,
                    "severity": "warn",
                    "summary": summary,
                    "suggestion": "Use a single punctuation width style consistently (prefer fullwidth for Chinese prose).",
                }
            )

    # Per-paragraph checks.
    for p in paragraphs:
        if p.get("is_heading"):
            continue
        chars = int(p.get("chars") or 0)
        raw = str(p.get("raw") or "")

        if chars > max_para:
            sev = _overlong_severity(chars, max_para)
            issues.append(
                {
                    "id": "readability.mobile.overlong_paragraph",
                    "severity": sev,
                    "summary": f"Overlong paragraph ({chars} chars > max {max_para}).",
                    "evidence": _snippet(raw, 140),
                    "suggestion": "Split the paragraph into 2–3 shorter paragraphs around actions/dialogue beats.",
                    "paragraph_index": int(p.get("index") or 0),
                    "paragraph_chars": chars,
                }
            )

        has_dialogue = bool(p.get("has_dialogue"))
        if has_dialogue and bool(p.get("is_single_line")):
            quote_count = len(re.findall(r'["“”]', raw, flags=re.UNICODE))
            if quote_count >= 6:
                sev = _dialogue_dense_severity(quote_count, chars, max_para)
                issues.append(
                    {
                        "id": "readability.mobile.dialogue_dense_paragraph",
                        "severity": sev,
                        "summary": "Dialogue-heavy paragraph may hurt mobile readability (many quotes in one paragraph).",
                        "evidence": _snippet(raw, 140),
                        "suggestion": "Split dialogue into separate paragraphs per speaker and keep each paragraph short.",
                        "paragraph_index": int(p.get("index") or 0),
                        "paragraph_chars": chars,
                    }
                )

    # Consecutive exposition blocks: consecutive non-heading paragraphs with no dialogue.
    run_start = 0
    run_len = 0

    def flush_run() -> None:
        nonlocal run_start, run_len
        if run_len <= max_expo:
            run_start = 0
            run_len = 0
            return
        start_idx = run_start
        end_idx = run_start + run_len - 1
        sev = _exposition_run_severity(run_len, max_expo)
        issues.append(
            {
                "id": "readability.mobile.exposition_run_too_long",
                "severity": sev,
                "summary": f"Too many consecutive exposition paragraphs ({run_len} > max {max_expo}).",
                "evidence": f"paragraphs {start_idx}-{end_idx}",
                "suggestion": "Break up exposition with dialogue/action beats, and add whitespace for mobile scanning.",
            }
        )
        run_start = 0
        run_len = 0

    for p in paragraphs:
        if p.get("is_heading"):
            flush_run()
            continue
        is_exposition = not bool(p.get("has_dialogue"))
        if not is_exposition:
            flush_run()
            continue
        if run_len == 0:
            run_start = int(p.get("index") or 0)
        run_len += 1
    flush_run()

    out = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "scope": {"chapter": chapter_no},
        "policy": {
            "enabled": bool(policy["enabled"]),
            "max_paragraph_chars": max_para,
            "max_consecutive_exposition_paragraphs": max_expo,
            "blocking_severity": str(policy["blocking_severity"]),
        },
        "issues": issues,
    }

    sys.stdout.write(json.dumps(out, ensure_ascii=False, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:
        sys.stderr.write(f"lint-readability.sh: unexpected error: {e}\n")
        raise SystemExit(2)
PY

