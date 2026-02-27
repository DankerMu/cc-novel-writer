#!/usr/bin/env bash
#
# Deterministic web-novel cliché linter (M6.4 extension point).
#
# Usage:
#   lint-cliche.sh <chapter.md> <web-novel-cliche-lint.json>
#
# Output:
#   stdout JSON (exit 0 on success)
#
# Exit codes:
#   0 = success (valid JSON emitted to stdout)
#   1 = validation failure (bad args, missing files, invalid JSON/schema)
#   2 = script exception (unexpected runtime error)
#
# Notes:
# - Treats whitelist and exemptions as "do not count as hits":
#     - web-novel-cliche-lint.json.whitelist (list[str])
#     - web-novel-cliche-lint.json.whitelist.words (list[str])
#     - web-novel-cliche-lint.json.exemptions.exact (list[str])
#     - web-novel-cliche-lint.json.exemptions.regex (list[str])
# - Hit rate is computed as "hits per 1000 non-whitespace characters" (次/千字).

set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: lint-cliche.sh <chapter.md> <web-novel-cliche-lint.json>" >&2
  exit 1
fi

chapter_path="$1"
config_path="$2"

if [ ! -f "$chapter_path" ]; then
  echo "lint-cliche.sh: chapter file not found: $chapter_path" >&2
  exit 1
fi

if [ ! -f "$config_path" ]; then
  echo "lint-cliche.sh: config file not found: $config_path" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "lint-cliche.sh: python3 is required but not found" >&2
  exit 2
fi

python3 - "$chapter_path" "$config_path" <<'PY'
import json
import re
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple


def _die(msg: str, exit_code: int = 1) -> None:
    sys.stderr.write(msg.rstrip() + "\n")
    raise SystemExit(exit_code)


def _load_json(path: str) -> Any:
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        _die(f"lint-cliche.sh: invalid JSON at {path}: {e}", 1)


def _as_str_list(value: Any) -> List[str]:
    if value is None:
        return []
    if not isinstance(value, list):
        return []
    out: List[str] = []
    for item in value:
        if isinstance(item, str) and item.strip():
            out.append(item.strip())
    return out


def _unique_preserve_order(items: List[str]) -> List[str]:
    seen: Set[str] = set()
    out: List[str] = []
    for item in items:
        if item in seen:
            continue
        seen.add(item)
        out.append(item)
    return out


def _sev_rank(sev: str) -> int:
    if sev == "warn":
        return 1
    if sev == "soft":
        return 2
    if sev == "hard":
        return 3
    return 0


def _max_sev(a: str, b: str) -> str:
    return a if _sev_rank(a) >= _sev_rank(b) else b


def _get_whitelist_words(cfg: Dict[str, Any]) -> Set[str]:
    words: List[str] = []
    whitelist = cfg.get("whitelist")
    if isinstance(whitelist, list):
        words.extend(_as_str_list(whitelist))
    elif isinstance(whitelist, dict):
        words.extend(_as_str_list(whitelist.get("words")))
    return set(words)


def _get_exemptions(cfg: Dict[str, Any]) -> Tuple[List[str], List[str]]:
    exemptions = cfg.get("exemptions")
    if not isinstance(exemptions, dict):
        return ([], [])
    exact = _as_str_list(exemptions.get("exact"))
    regex = _as_str_list(exemptions.get("regex"))
    return (_unique_preserve_order(exact), _unique_preserve_order(regex))


def _mask_literal(text: str, phrase: str) -> str:
    if not phrase:
        return text
    return text.replace(phrase, "\x00" * len(phrase))


def _mask_exemptions(text: str, exact: List[str], regex: List[str]) -> str:
    masked = text
    for phrase in exact:
        masked = _mask_literal(masked, phrase)
    for pattern in regex:
        try:
            re_obj = re.compile(pattern, flags=re.UNICODE)
        except Exception:
            continue
        masked = re_obj.sub(lambda m: "\x00" * len(m.group(0)), masked)
    return masked


def _collect_line_evidence(text: str, phrase: str) -> Tuple[List[int], List[str]]:
    lines: List[int] = []
    snippets: List[str] = []
    for idx, line in enumerate(text.splitlines(), start=1):
        if phrase not in line:
            continue
        lines.append(idx)
        if len(snippets) < 5:
            snippet = line.strip()
            if len(snippet) > 160:
                snippet = snippet[:160] + "…"
            snippets.append(snippet)
        if len(lines) >= 20:
            break
    return (lines, snippets)


def main() -> None:
    chapter_path = sys.argv[1]
    config_path = sys.argv[2]

    cfg_raw = _load_json(config_path)
    if not isinstance(cfg_raw, dict):
        _die("lint-cliche.sh: web-novel-cliche-lint.json must be a JSON object", 1)
    cfg: Dict[str, Any] = cfg_raw

    schema_version = cfg.get("schema_version")
    if not isinstance(schema_version, int):
        schema_version = 0
    last_updated = cfg.get("last_updated")
    if not isinstance(last_updated, str) or not last_updated.strip():
        last_updated = None
    else:
        last_updated = last_updated.strip()

    words_raw = cfg.get("words")
    if words_raw is None:
        words_raw = []
    if not isinstance(words_raw, list) or not all(isinstance(w, str) for w in words_raw):
        _die("lint-cliche.sh: web-novel-cliche-lint.json.words must be a list of strings", 1)
    words_flat = _unique_preserve_order([w.strip() for w in words_raw if isinstance(w, str) and w.strip()])

    categories_raw = cfg.get("categories")
    categories: Dict[str, List[str]] = {}
    if categories_raw is not None:
        if not isinstance(categories_raw, dict):
            _die("lint-cliche.sh: web-novel-cliche-lint.json.categories must be an object", 1)
        for k, v in categories_raw.items():
            if not isinstance(k, str) or not k.strip():
                continue
            categories[k] = _unique_preserve_order([w.strip() for w in _as_str_list(v) if w.strip()])

    severity_raw = cfg.get("severity")
    severity_default = "warn"
    per_category: Dict[str, str] = {}
    per_word: Dict[str, str] = {}
    if severity_raw is not None:
        if not isinstance(severity_raw, dict):
            _die("lint-cliche.sh: web-novel-cliche-lint.json.severity must be an object", 1)
        default_raw = severity_raw.get("default")
        if isinstance(default_raw, str) and default_raw in ("warn", "soft", "hard"):
            severity_default = default_raw
        pc_raw = severity_raw.get("per_category")
        if isinstance(pc_raw, dict):
            for k, v in pc_raw.items():
                if isinstance(k, str) and isinstance(v, str) and v in ("warn", "soft", "hard"):
                    per_category[k] = v
        pw_raw = severity_raw.get("per_word")
        if isinstance(pw_raw, dict):
            for k, v in pw_raw.items():
                if isinstance(k, str) and isinstance(v, str) and v in ("warn", "soft", "hard"):
                    per_word[k] = v

    whitelist = _get_whitelist_words(cfg)
    exemptions_exact, exemptions_regex = _get_exemptions(cfg)
    exemptions_exact_set = set(exemptions_exact)

    # Build index: word -> (categories, severity)
    index: Dict[str, Dict[str, Any]] = {}

    def _add_word(word: str, cat: Optional[str]) -> None:
        w = word.strip()
        if not w:
            return
        if w in whitelist:
            return
        if w in exemptions_exact_set:
            return
        meta = index.get(w)
        if meta is None:
            meta = {"categories": set(), "severity": severity_default}
            index[w] = meta
        if cat:
            meta["categories"].add(cat)

    for w in words_flat:
        _add_word(w, None)
    for cat, lst in categories.items():
        for w in lst:
            _add_word(w, cat)

    # Resolve severities
    for w, meta in index.items():
        if w in per_word:
            meta["severity"] = per_word[w]
        else:
            sev = severity_default
            for cat in meta["categories"]:
                if cat in per_category:
                    sev = _max_sev(sev, per_category[cat])
            meta["severity"] = sev

    # Sort by length desc, then stable word sort for determinism
    effective_words = list(index.keys())
    effective_words.sort(key=lambda w: (-len(w), w))

    try:
        with open(chapter_path, "r", encoding="utf-8") as f:
            text = f.read()
    except Exception as e:
        _die(f"lint-cliche.sh: failed to read chapter: {e}", 1)

    masked_text = _mask_exemptions(text, exemptions_exact, exemptions_regex)
    non_ws_chars = len(re.sub(r"\s+", "", text))

    severity_counts: Dict[str, int] = {"warn": 0, "soft": 0, "hard": 0}
    category_counts: Dict[str, int] = {}
    hits: List[Dict[str, Any]] = []
    total_hits = 0

    for word in effective_words:
        count = masked_text.count(word)
        if count <= 0:
            continue
        total_hits += count
        masked_text = _mask_literal(masked_text, word)

        meta = index.get(word, {"categories": set(), "severity": severity_default})
        sev = meta.get("severity", severity_default)
        if sev not in ("warn", "soft", "hard"):
            sev = severity_default
        severity_counts[sev] = severity_counts.get(sev, 0) + count

        cats_sorted = sorted(list(meta.get("categories", set())))
        primary_cat = cats_sorted[0] if len(cats_sorted) > 0 else None
        if primary_cat:
            category_counts[primary_cat] = category_counts.get(primary_cat, 0) + count

        lines, snippets = _collect_line_evidence(text, word)
        hits.append(
            {
                "word": word,
                "count": count,
                "severity": sev,
                "category": primary_cat,
                "categories": cats_sorted,
                "lines": lines,
                "snippets": snippets,
            }
        )

    def _sort_hits_key(h: Dict[str, Any]) -> Tuple[int, int, str]:
        return (-int(h.get("count", 0)), -_sev_rank(str(h.get("severity", "warn"))), str(h.get("word", "")))

    hits.sort(key=_sort_hits_key)

    def _per_k(n: int) -> float:
        if non_ws_chars <= 0:
            return 0.0
        return round(float(n) / (non_ws_chars / 1000.0), 3)

    hits_per_kchars = _per_k(total_hits)

    by_severity = {
        "warn": {"hits": int(severity_counts.get("warn", 0)), "hits_per_kchars": _per_k(int(severity_counts.get("warn", 0)))},
        "soft": {"hits": int(severity_counts.get("soft", 0)), "hits_per_kchars": _per_k(int(severity_counts.get("soft", 0)))},
        "hard": {"hits": int(severity_counts.get("hard", 0)), "hits_per_kchars": _per_k(int(severity_counts.get("hard", 0)))},
    }

    by_category: Dict[str, Any] = {}
    for cat, n in category_counts.items():
        by_category[cat] = {"hits": int(n), "hits_per_kchars": _per_k(int(n))}

    top_hits = [
        {"word": h["word"], "count": int(h["count"]), "severity": h["severity"], "category": h.get("category")}
        for h in hits[:10]
    ]

    has_hard_hits = int(severity_counts.get("hard", 0)) > 0

    chapter_num = 0
    m = re.search(r"chapter-(\d+)", chapter_path)
    if m:
        try:
            chapter_num = int(m.group(1))
        except Exception:
            chapter_num = 0

    out: Dict[str, Any] = {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "scope": {"chapter": chapter_num},
        "config": {"schema_version": int(schema_version), "last_updated": last_updated},
        "mode": "script",
        "chars": int(non_ws_chars),
        "total_hits": int(total_hits),
        "hits_per_kchars": float(hits_per_kchars),
        "by_severity": by_severity,
        "by_category": by_category,
        "hits": hits,
        "top_hits": top_hits,
        "has_hard_hits": bool(has_hard_hits),
    }

    sys.stdout.write(json.dumps(out, ensure_ascii=False) + "\n")


try:
    main()
except SystemExit:
    raise
except Exception as e:
    sys.stderr.write(f"lint-cliche.sh: unexpected error: {e}\n")
    raise SystemExit(2)
PY

