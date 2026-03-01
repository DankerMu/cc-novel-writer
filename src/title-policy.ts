import { join } from "node:path";

import { NovelCliError } from "./errors.js";
import { ensureDir, writeJsonFile } from "./fs-utils.js";
import type { PlatformProfile, SeverityPolicy } from "./platform-profile.js";
import { pad3 } from "./steps.js";

export type TitlePolicyCheckStatus = "pass" | "warn" | "violation" | "skipped";

export type TitlePolicyIssue = {
  id: string;
  severity: SeverityPolicy;
  summary: string;
  evidence?: string;
  suggestion?: string;
};

export type TitlePolicyReport = {
  schema_version: 1;
  generated_at: string;
  scope: { chapter: number };
  title: {
    has_h1: boolean;
    line_no: number | null;
    raw_line: string | null;
    text: string | null;
    chars: number | null;
  };
  policy: {
    enabled: boolean;
    min_chars: number;
    max_chars: number;
    forbidden_patterns: string[];
    required_patterns?: string[];
    auto_fix: boolean;
  } | null;
  status: TitlePolicyCheckStatus;
  issues: TitlePolicyIssue[];
  has_hard_violations: boolean;
};

function countOccurrences(text: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let idx = 0;
  while (true) {
    const next = text.indexOf(needle, idx);
    if (next < 0) break;
    count += 1;
    idx = next + needle.length;
  }
  return count;
}

function extractFirstNonEmptyLine(text: string): { line: string; line_no: number } | null {
  const lines = text.split(/\r?\n/gu);
  for (const [i, line] of lines.entries()) {
    if (line.trim().length === 0) continue;
    return { line, line_no: i + 1 };
  }
  return null;
}

export function extractChapterTitleFromMarkdown(text: string): {
  has_h1: boolean;
  line_no: number | null;
  raw_line: string | null;
  title_text: string | null;
} {
  const first = extractFirstNonEmptyLine(text);
  if (!first) return { has_h1: false, line_no: null, raw_line: null, title_text: null };

  const m = /^#(?!#)\s*(.*)$/u.exec(first.line);
  if (!m) return { has_h1: false, line_no: first.line_no, raw_line: first.line, title_text: null };

  const title_text = (m[1] ?? "").trim();
  return { has_h1: true, line_no: first.line_no, raw_line: first.line, title_text: title_text.length > 0 ? title_text : null };
}

export function computeTitlePolicyReport(args: {
  chapter: number;
  chapterText: string;
  platformProfile: PlatformProfile;
}): TitlePolicyReport {
  const generated_at = new Date().toISOString();
  const titlePolicy = args.platformProfile.retention?.title_policy ?? null;
  const policy = titlePolicy
    ? {
        enabled: titlePolicy.enabled,
        min_chars: titlePolicy.min_chars,
        max_chars: titlePolicy.max_chars,
        forbidden_patterns: titlePolicy.forbidden_patterns,
        ...(titlePolicy.required_patterns ? { required_patterns: titlePolicy.required_patterns } : {}),
        auto_fix: titlePolicy.auto_fix
      }
    : null;

  const extracted = extractChapterTitleFromMarkdown(args.chapterText);
  const titleText = extracted.title_text;
  const chars = titleText ? Array.from(titleText).length : null;

  const issues: TitlePolicyIssue[] = [];
  if (!titlePolicy || !titlePolicy.enabled) {
    return {
      schema_version: 1,
      generated_at,
      scope: { chapter: args.chapter },
      title: {
        has_h1: extracted.has_h1,
        line_no: extracted.line_no,
        raw_line: extracted.raw_line,
        text: titleText,
        chars
      },
      policy,
      status: "skipped",
      issues: [],
      has_hard_violations: false
    };
  }

  if (!extracted.has_h1) {
    issues.push({
      id: "retention.title_policy.missing_h1",
      severity: "hard",
      summary: "Missing chapter title: expected the first non-empty line to be a Markdown H1 ('# ...').",
      evidence: extracted.raw_line ?? undefined,
      suggestion: "Add an H1 title as the first non-empty line, and keep it within configured length/pattern rules."
    });
  } else if (!titleText) {
    issues.push({
      id: "retention.title_policy.empty_title",
      severity: "hard",
      summary: "Empty chapter title: H1 line exists but title text is missing.",
      evidence: extracted.raw_line ?? undefined,
      suggestion: "Fill in a meaningful title (avoid spoilers) and keep it within configured length/pattern rules."
    });
  }

  if (titleText && chars !== null) {
    if (chars < titlePolicy.min_chars) {
      issues.push({
        id: "retention.title_policy.too_short",
        severity: "soft",
        summary: `Title is too short (${chars} chars < min ${titlePolicy.min_chars}).`,
        evidence: titleText,
        suggestion: "Expand the title to better signal the chapter's hook without spoilers."
      });
    }
    if (chars > titlePolicy.max_chars) {
      issues.push({
        id: "retention.title_policy.too_long",
        severity: "soft",
        summary: `Title is too long (${chars} chars > max ${titlePolicy.max_chars}).`,
        evidence: titleText,
        suggestion: "Shorten the title; keep the promise clear and avoid padding words."
      });
    }

    // Banned words: reuse platform-profile compliance list.
    const bannedHits: Array<{ word: string; count: number }> = [];
    for (const word of args.platformProfile.compliance.banned_words) {
      const count = countOccurrences(titleText, word);
      if (count <= 0) continue;
      bannedHits.push({ word, count });
    }
    if (bannedHits.length > 0) {
      bannedHits.sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, "zh"));
      const top = bannedHits[0];
      issues.push({
        id: "retention.title_policy.banned_words",
        severity: "hard",
        summary: `Title contains banned words (${bannedHits.length} distinct).`,
        evidence: top ? `${top.word} x${top.count}` : undefined,
        suggestion: "Remove or replace banned words in the title."
      });
    }

    // Forbidden patterns.
    for (const [i, pattern] of titlePolicy.forbidden_patterns.entries()) {
      const re = new RegExp(pattern);
      const m = re.exec(titleText);
      if (!m) continue;
      const match = (m[0] ?? "").trim();
      issues.push({
        id: `retention.title_policy.forbidden_pattern.${i}`,
        severity: "soft",
        summary: `Title matches forbidden pattern /${pattern}/.`,
        evidence: match.length > 0 ? match : titleText,
        suggestion: "Adjust the title to avoid forbidden patterns (spoilers/markers/phrases)."
      });
    }

    // Required patterns (OR semantics).
    if (titlePolicy.required_patterns && titlePolicy.required_patterns.length > 0) {
      const ok = titlePolicy.required_patterns.some((p) => new RegExp(p).test(titleText));
      if (!ok) {
        issues.push({
          id: "retention.title_policy.required_pattern_missing",
          severity: "soft",
          summary: "Title does not match any required pattern configured by the platform policy.",
          evidence: titleText,
          suggestion: "Rewrite the title to match one of the required patterns (e.g. '第XX章 …')."
        });
      }
    }
  }

  const hasHard = issues.some((i) => i.severity === "hard");
  const status: TitlePolicyCheckStatus = issues.length === 0 ? "pass" : hasHard ? "violation" : "warn";

  return {
    schema_version: 1,
    generated_at,
    scope: { chapter: args.chapter },
    title: {
      has_h1: extracted.has_h1,
      line_no: extracted.line_no,
      raw_line: extracted.raw_line,
      text: titleText,
      chars
    },
    policy,
    status,
    issues,
    has_hard_violations: hasHard
  };
}

export async function writeTitlePolicyLogs(args: {
  rootDir: string;
  chapter: number;
  report: TitlePolicyReport;
}): Promise<{ latestRel: string; historyRel: string }> {
  const dirRel = "logs/retention/title-policy";
  const dirAbs = join(args.rootDir, dirRel);
  await ensureDir(dirAbs);

  const historyRel = `${dirRel}/title-policy-chapter-${pad3(args.chapter)}.json`;
  const latestRel = `${dirRel}/latest.json`;

  await writeJsonFile(join(args.rootDir, historyRel), args.report);
  await writeJsonFile(join(args.rootDir, latestRel), args.report);

  return { latestRel, historyRel };
}

export function stripFirstH1TitleLine(text: string): { stripped: string; removed_line: string | null } {
  let scanIdx = 0;

  const findNextLine = (): { line: string; start: number; end: number } | null => {
    if (scanIdx > text.length) return null;
    const nextNl = text.indexOf("\n", scanIdx);
    if (nextNl === -1) {
      const line = text.slice(scanIdx);
      const start = scanIdx;
      const end = text.length;
      scanIdx = text.length + 1;
      return { line, start, end };
    }
    const line = text.slice(scanIdx, nextNl).replace(/\r$/u, "");
    const start = scanIdx;
    const end = nextNl + 1;
    scanIdx = end;
    return { line, start, end };
  };

  // Find first non-empty line by scanning the original string to preserve exact slicing.
  while (true) {
    const next = findNextLine();
    if (!next) return { stripped: text, removed_line: null };
    const trimmed = next.line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    if (!/^#(?!#)\s*.*$/u.test(next.line)) {
      return { stripped: text, removed_line: null };
    }
    const stripped = text.slice(0, next.start) + text.slice(next.end);
    return { stripped, removed_line: next.line };
  }
}

export function assertTitleFixOnlyChangedH1(args: { before: string; after: string; file: string }): void {
  const b = stripFirstH1TitleLine(args.before);
  const a = stripFirstH1TitleLine(args.after);
  if (b.stripped !== a.stripped) {
    throw new NovelCliError(
      `Invalid ${args.file}: title-fix must only change the first H1 title line; chapter body changed.`,
      2
    );
  }
}
