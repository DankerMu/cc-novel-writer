import { execFile } from "node:child_process";
import { isAbsolute, join } from "node:path";
import { promisify } from "node:util";

import { NovelCliError } from "./errors.js";
import { fingerprintFile, fingerprintTextFile, fingerprintsMatch, type FileFingerprint } from "./fingerprint.js";
import { ensureDir, pathExists, readJsonFile, writeJsonFile } from "./fs-utils.js";
import type { MobileReadabilityBlockingSeverity, PlatformProfile, SeverityPolicy } from "./platform-profile.js";
import { rejectPathTraversalInput } from "./safe-path.js";
import { pad3 } from "./steps.js";
import { isPlainObject } from "./type-guards.js";

const execFileAsync = promisify(execFile);

export type ReadabilityCheckStatus = "pass" | "warn" | "violation" | "skipped";

export type ReadabilityIssue = {
  id: string;
  severity: SeverityPolicy;
  summary: string;
  evidence?: string;
  suggestion?: string;
  paragraph_index?: number;
  paragraph_chars?: number;
};

export type ReadabilityReport = {
  schema_version: 1;
  generated_at: string;
  scope: { chapter: number };
  policy: {
    enabled: boolean;
    max_paragraph_chars: number;
    max_consecutive_exposition_paragraphs: number;
    blocking_severity: MobileReadabilityBlockingSeverity;
  } | null;
  mode: "script" | "fallback";
  script?: { rel_path: string };
  script_error?: string;
  status: ReadabilityCheckStatus;
  issues: ReadabilityIssue[];
  has_blocking_issues: boolean;
};

export type ReadabilityLintPrecompute = {
  status: "pass" | "skipped";
  error?: string;
  chapter_fingerprint: FileFingerprint | null;
  report: ReadabilityReport | null;
};

function countNonWhitespaceChars(text: string): number {
  return Array.from(text.replace(/\s+/gu, "")).length;
}

function isAtxHeadingLine(line: string): boolean {
  return /^(?:\uFEFF)? {0,3}#{1,6}(?!#)\s+.*$/u.test(line);
}

function stripCodeFences(text: string): string {
  // Best-effort removal of fenced code blocks to avoid counting them as prose paragraphs.
  // This is a deterministic heuristic, not a Markdown parser.
  return text.replace(/(^|\n)```[\s\S]*?\n```[ \t]*(?=\n|$)/gu, "\n");
}

function extractParagraphs(text: string): Array<{ index: number; raw: string; chars: number; isHeading: boolean; hasDialogue: boolean }> {
  const cleaned = stripCodeFences(text).replace(/\r\n?/gu, "\n");
  const lines = cleaned.split("\n");
  const out: Array<{ index: number; raw: string; chars: number; isHeading: boolean; hasDialogue: boolean }> = [];
  let buf: string[] = [];

  const flush = () => {
    if (buf.length === 0) return;
    const raw = buf.join("\n").trimEnd();
    buf = [];
    if (raw.trim().length === 0) return;
    const firstLine = raw.split("\n").find((l) => l.trim().length > 0) ?? "";
    const isHeading = isAtxHeadingLine(firstLine);
    const chars = countNonWhitespaceChars(raw);
    const hasDialogue = /["“”]/u.test(raw);
    out.push({ index: out.length + 1, raw, chars, isHeading, hasDialogue });
  };

  for (const line of lines) {
    if (line.trim().length === 0) {
      flush();
      continue;
    }
    buf.push(line);
  }
  flush();
  return out;
}

function severityRank(sev: SeverityPolicy): number {
  if (sev === "warn") return 1;
  if (sev === "soft") return 2;
  if (sev === "hard") return 3;
  return 0;
}

function isBlockingSeverity(blocking: MobileReadabilityBlockingSeverity, severity: SeverityPolicy): boolean {
  if (severity === "warn") return false;
  if (blocking === "hard_only") return severity === "hard";
  return severity === "soft" || severity === "hard";
}

function computeStatus(args: { blocking: MobileReadabilityBlockingSeverity; issues: ReadabilityIssue[] }): ReadabilityCheckStatus {
  if (args.issues.length === 0) return "pass";
  return args.issues.some((i) => isBlockingSeverity(args.blocking, i.severity)) ? "violation" : "warn";
}

function computeStatusWarnOnly(issues: ReadabilityIssue[]): ReadabilityCheckStatus {
  if (issues.length === 0) return "pass";
  return "warn";
}

function computeHasBlockingIssues(args: { blocking: MobileReadabilityBlockingSeverity; issues: ReadabilityIssue[] }): boolean {
  return args.issues.some((i) => isBlockingSeverity(args.blocking, i.severity));
}

function snippet(text: string, maxLen: number): string {
  const s = text.trim().replace(/\s+/gu, " ");
  if (s.length <= maxLen) return s;
  return `${s.slice(0, Math.max(0, maxLen - 1))}…`;
}

function computeFallbackReport(args: {
  chapter: number;
  chapterText: string;
  platformProfile: PlatformProfile;
  scriptError?: string;
  scriptRelPath?: string;
}): ReadabilityReport {
  const generated_at = new Date().toISOString();
  const policy = args.platformProfile.readability?.mobile ?? null;

  if (!policy || !policy.enabled) {
    return {
      schema_version: 1,
      generated_at,
      scope: { chapter: args.chapter },
      policy: policy
        ? {
            enabled: policy.enabled,
            max_paragraph_chars: policy.max_paragraph_chars,
            max_consecutive_exposition_paragraphs: policy.max_consecutive_exposition_paragraphs,
            blocking_severity: policy.blocking_severity
          }
        : null,
      mode: "fallback",
      ...(args.scriptRelPath ? { script: { rel_path: args.scriptRelPath } } : {}),
      ...(args.scriptError ? { script_error: args.scriptError } : {}),
      status: "skipped",
      issues: [],
      has_blocking_issues: false
    };
  }

  const paragraphs = extractParagraphs(args.chapterText);
  const issues: ReadabilityIssue[] = [];

  // Chapter-level quote consistency.
  const hasAsciiQuotes = args.chapterText.includes("\"");
  const hasCurlyQuotes = /[“”]/u.test(args.chapterText);
  if (hasAsciiQuotes && hasCurlyQuotes) {
    issues.push({
      id: "readability.mobile.mixed_quote_styles",
      severity: "warn",
      summary: "Mixed quote styles detected (ASCII '\"' and curly quotes “”).",
      suggestion: "Use a single quote style consistently to improve mobile readability."
    });
  }

  // Chapter-level ellipsis consistency.
  const hasAsciiDots = args.chapterText.includes("...");
  const hasCjkEllipsis = args.chapterText.includes("……");
  if (hasAsciiDots && hasCjkEllipsis) {
    issues.push({
      id: "readability.mobile.mixed_ellipsis_styles",
      severity: "warn",
      summary: "Mixed ellipsis styles detected ('...' and '……').",
      suggestion: "Use a single ellipsis style consistently."
    });
  }

  // Chapter-level fullwidth punctuation consistency (best-effort).
  const punctuationPairs: Array<{ ascii: string; full: string; id: string; summary: string }> = [
    { ascii: ",", full: "，", id: "readability.mobile.mixed_comma_styles", summary: "Mixed comma styles detected (',' and '，')." },
    { ascii: ".", full: "。", id: "readability.mobile.mixed_period_styles", summary: "Mixed period styles detected ('.' and '。')." },
    { ascii: "?", full: "？", id: "readability.mobile.mixed_question_mark_styles", summary: "Mixed question mark styles detected ('?' and '？')." },
    { ascii: "!", full: "！", id: "readability.mobile.mixed_exclamation_styles", summary: "Mixed exclamation mark styles detected ('!' and '！')." }
  ];
  for (const pair of punctuationPairs) {
    if (!args.chapterText.includes(pair.ascii)) continue;
    if (!args.chapterText.includes(pair.full)) continue;
    issues.push({
      id: pair.id,
      severity: "warn",
      summary: pair.summary,
      suggestion: "Use a single punctuation width style consistently (prefer fullwidth for Chinese prose)."
    });
  }

  // Per-paragraph checks.
  for (const p of paragraphs) {
    if (p.isHeading) continue;
    if (p.chars > policy.max_paragraph_chars) {
      issues.push({
        id: "readability.mobile.overlong_paragraph",
        severity: "warn",
        summary: `Overlong paragraph (${p.chars} chars > max ${policy.max_paragraph_chars}).`,
        evidence: snippet(p.raw, 140),
        suggestion: "Split the paragraph into 2–3 shorter paragraphs around actions/dialogue beats.",
        paragraph_index: p.index,
        paragraph_chars: p.chars
      });
    }

    // Dialogue dense paragraph: many quotes packed into a single paragraph.
    if (p.hasDialogue) {
      const quoteCount = (p.raw.match(/["“”]/gu) ?? []).length;
      const isSingleLine = !p.raw.includes("\n");
      if (isSingleLine && quoteCount >= 6) {
        issues.push({
          id: "readability.mobile.dialogue_dense_paragraph",
          severity: "warn",
          summary: "Dialogue-heavy paragraph may hurt mobile readability (many quotes in one paragraph).",
          evidence: snippet(p.raw, 140),
          suggestion: "Split dialogue into separate paragraphs per speaker and keep each paragraph short.",
          paragraph_index: p.index,
          paragraph_chars: p.chars
        });
      }
    }
  }

  // Consecutive exposition blocks: heuristic = consecutive non-heading paragraphs with no dialogue quotes.
  let runStart = 0;
  let runLen = 0;
  const flushRun = () => {
    if (runLen <= policy.max_consecutive_exposition_paragraphs) {
      runStart = 0;
      runLen = 0;
      return;
    }
    const startIdx = runStart;
    const endIdx = runStart + runLen - 1;
    issues.push({
      id: "readability.mobile.exposition_run_too_long",
      severity: "warn",
      summary: `Too many consecutive exposition paragraphs (${runLen} > max ${policy.max_consecutive_exposition_paragraphs}).`,
      evidence: `paragraphs ${startIdx}-${endIdx}`,
      suggestion: "Break up exposition with dialogue/action beats, and add whitespace for mobile scanning."
    });
    runStart = 0;
    runLen = 0;
  };

  for (const p of paragraphs) {
    if (p.isHeading) {
      flushRun();
      continue;
    }
    const isExposition = !p.hasDialogue;
    if (!isExposition) {
      flushRun();
      continue;
    }
    if (runLen === 0) runStart = p.index;
    runLen += 1;
  }
  flushRun();

  // Fallback is warn-only and must not block.
  return {
    schema_version: 1,
    generated_at,
    scope: { chapter: args.chapter },
    policy: {
      enabled: policy.enabled,
      max_paragraph_chars: policy.max_paragraph_chars,
      max_consecutive_exposition_paragraphs: policy.max_consecutive_exposition_paragraphs,
      blocking_severity: policy.blocking_severity
    },
    mode: "fallback",
    ...(args.scriptRelPath ? { script: { rel_path: args.scriptRelPath } } : {}),
    ...(args.scriptError ? { script_error: args.scriptError } : {}),
    status: computeStatusWarnOnly(issues),
    issues,
    has_blocking_issues: false
  };
}

function parseSeverity(value: unknown, ctx: string): SeverityPolicy {
  if (value === "warn" || value === "soft" || value === "hard") return value;
  throw new NovelCliError(`Invalid readability lint output: ${ctx} must be one of: warn, soft, hard.`, 2);
}

function parseBlockingSeverity(value: unknown): MobileReadabilityBlockingSeverity {
  if (value === "hard_only" || value === "soft_and_hard") return value;
  throw new NovelCliError(`Invalid readability lint output: policy.blocking_severity must be 'hard_only' or 'soft_and_hard'.`, 2);
}

function requireInt(value: unknown, ctx: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new NovelCliError(`Invalid readability lint output: ${ctx} must be an int.`, 2);
  }
  return value;
}

function requireBool(value: unknown, ctx: string): boolean {
  if (typeof value !== "boolean") {
    throw new NovelCliError(`Invalid readability lint output: ${ctx} must be a boolean.`, 2);
  }
  return value;
}

function requireNonEmptyString(value: unknown, ctx: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new NovelCliError(`Invalid readability lint output: ${ctx} must be a non-empty string.`, 2);
  }
  return value.trim();
}

function parseScriptReport(raw: unknown): ReadabilityReport {
  if (!isPlainObject(raw)) throw new NovelCliError("Invalid readability lint output: expected JSON object.", 2);
  const obj = raw as Record<string, unknown>;
  const schema = obj.schema_version;
  if (schema !== 1) throw new NovelCliError(`Invalid readability lint output: schema_version must be 1.`, 2);
  const generated_at = typeof obj.generated_at === "string" ? obj.generated_at : null;
  if (!generated_at) throw new NovelCliError("Invalid readability lint output: generated_at must be a string.", 2);

  const scopeRaw = obj.scope;
  if (!isPlainObject(scopeRaw)) throw new NovelCliError("Invalid readability lint output: scope must be an object.", 2);
  const scopeObj = scopeRaw as Record<string, unknown>;
  const chapter = requireInt(scopeObj.chapter, "scope.chapter");
  if (chapter <= 0) throw new NovelCliError("Invalid readability lint output: scope.chapter must be an int >= 1.", 2);

  const policyRaw = obj.policy;
  if (!isPlainObject(policyRaw)) throw new NovelCliError("Invalid readability lint output: policy must be an object.", 2);
  const policyObj = policyRaw as Record<string, unknown>;
  const enabled = requireBool(policyObj.enabled, "policy.enabled");
  const maxParagraph = requireInt(policyObj.max_paragraph_chars, "policy.max_paragraph_chars");
  if (maxParagraph < 1) throw new NovelCliError("Invalid readability lint output: policy.max_paragraph_chars must be an int >= 1.", 2);
  const maxExpo = requireInt(policyObj.max_consecutive_exposition_paragraphs, "policy.max_consecutive_exposition_paragraphs");
  if (maxExpo < 1) {
    throw new NovelCliError("Invalid readability lint output: policy.max_consecutive_exposition_paragraphs must be an int >= 1.", 2);
  }
  const blocking = parseBlockingSeverity(policyObj.blocking_severity);

  const issuesRaw = obj.issues;
  if (!Array.isArray(issuesRaw)) throw new NovelCliError("Invalid readability lint output: issues must be an array.", 2);
  const issues: ReadabilityIssue[] = [];
  for (const [idx, it] of issuesRaw.entries()) {
    if (!isPlainObject(it)) throw new NovelCliError(`Invalid readability lint output: issues[${idx}] must be an object.`, 2);
    const rec = it as Record<string, unknown>;
    const id = requireNonEmptyString(rec.id, `issues[${idx}].id`);
    const severity = parseSeverity(rec.severity, `issues[${idx}].severity`);
    const summary = requireNonEmptyString(rec.summary, `issues[${idx}].summary`);
    const issue: ReadabilityIssue = { id, severity, summary };
    if (rec.evidence !== undefined && rec.evidence !== null) {
      const evidence = requireNonEmptyString(rec.evidence, `issues[${idx}].evidence`);
      issue.evidence = evidence;
    }
    if (rec.suggestion !== undefined && rec.suggestion !== null) {
      const suggestion = requireNonEmptyString(rec.suggestion, `issues[${idx}].suggestion`);
      issue.suggestion = suggestion;
    }
    if (rec.paragraph_index !== undefined && rec.paragraph_index !== null) {
      const paragraph_index = requireInt(rec.paragraph_index, `issues[${idx}].paragraph_index`);
      if (paragraph_index <= 0) throw new NovelCliError(`Invalid readability lint output: issues[${idx}].paragraph_index must be >= 1.`, 2);
      issue.paragraph_index = paragraph_index;
    }
    if (rec.paragraph_chars !== undefined && rec.paragraph_chars !== null) {
      const paragraph_chars = requireInt(rec.paragraph_chars, `issues[${idx}].paragraph_chars`);
      if (paragraph_chars < 0) throw new NovelCliError(`Invalid readability lint output: issues[${idx}].paragraph_chars must be >= 0.`, 2);
      issue.paragraph_chars = paragraph_chars;
    }
    issues.push(issue);
  }

  const has_blocking_issues = computeHasBlockingIssues({ blocking, issues });
  const status = computeStatus({ blocking, issues });

  return {
    schema_version: 1,
    generated_at,
    scope: { chapter },
    policy: {
      enabled,
      max_paragraph_chars: maxParagraph,
      max_consecutive_exposition_paragraphs: maxExpo,
      blocking_severity: blocking
    },
    mode: "script",
    status,
    issues,
    has_blocking_issues
  };
}

type ScriptAttempt =
  | { status: "missing" }
  | { status: "ok"; report: ReadabilityReport }
  | { status: "error"; error: string };

async function tryRunDeterministicScript(args: {
  rootDir: string;
  chapterAbsPath: string;
  platformProfileAbsPath: string;
  scriptRelPath: string;
  chapter: number;
}): Promise<ScriptAttempt> {
  const scriptRel = args.scriptRelPath.trim();
  if (scriptRel.length === 0) return { status: "error", error: "Invalid lint_readability script path: empty string." };
  if (isAbsolute(scriptRel)) return { status: "error", error: "Invalid lint_readability script path: must be project-relative (not absolute)." };
  try {
    rejectPathTraversalInput(scriptRel, "platform-profile.json.compliance.script_paths.lint_readability");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "error", error: message };
  }

  const scriptAbs = join(args.rootDir, scriptRel);
  if (!(await pathExists(scriptAbs))) return { status: "missing" };

  try {
    const { stdout } = await execFileAsync("bash", [scriptAbs, args.chapterAbsPath, args.platformProfileAbsPath, String(args.chapter)], {
      maxBuffer: 10 * 1024 * 1024,
      timeout: 10_000,
      killSignal: "SIGKILL"
    });
    const trimmed = stdout.trim();
    const parsed = JSON.parse(trimmed) as unknown;
    const report = parseScriptReport(parsed);
    if (report.scope.chapter !== args.chapter) {
      return { status: "error", error: `Invalid readability lint output: scope.chapter=${report.scope.chapter}, expected ${args.chapter}.` };
    }
    return { status: "ok", report: { ...report, mode: "script", script: { rel_path: scriptRel } } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stderr = (err as { stderr?: unknown }).stderr;
    const stderrText = typeof stderr === "string" && stderr.trim().length > 0 ? stderr.trim() : null;
    const detail = stderrText ? ` stderr=${stderrText.slice(0, 200)}` : "";
    return { status: "error", error: `${message}${detail}` };
  }
}

function resolveReadabilityLintScriptRelPath(profile: PlatformProfile): string {
  const fromProfile = profile.compliance.script_paths?.lint_readability;
  if (typeof fromProfile === "string" && fromProfile.trim().length > 0) return fromProfile.trim();
  return "scripts/lint-readability.sh";
}

export async function computeReadabilityReport(args: {
  rootDir: string;
  chapter: number;
  chapterAbsPath: string;
  chapterText: string;
  platformProfile: PlatformProfile;
  preferDeterministicScript?: boolean;
}): Promise<ReadabilityReport> {
  const policy = args.platformProfile.readability?.mobile ?? null;
  const generated_at = new Date().toISOString();

  if (!policy || !policy.enabled) {
    return {
      schema_version: 1,
      generated_at,
      scope: { chapter: args.chapter },
      policy: policy
        ? {
            enabled: policy.enabled,
            max_paragraph_chars: policy.max_paragraph_chars,
            max_consecutive_exposition_paragraphs: policy.max_consecutive_exposition_paragraphs,
            blocking_severity: policy.blocking_severity
          }
        : null,
      mode: "fallback",
      status: "skipped",
      issues: [],
      has_blocking_issues: false
    };
  }

  const preferScript = args.preferDeterministicScript ?? true;
  const scriptRelPath = resolveReadabilityLintScriptRelPath(args.platformProfile);

  if (preferScript) {
    const attempted = await tryRunDeterministicScript({
      rootDir: args.rootDir,
      chapterAbsPath: args.chapterAbsPath,
      platformProfileAbsPath: join(args.rootDir, "platform-profile.json"),
      scriptRelPath,
      chapter: args.chapter
    });
    if (attempted.status === "ok") {
      const expectedPolicy: NonNullable<ReadabilityReport["policy"]> = {
        enabled: policy.enabled,
        max_paragraph_chars: policy.max_paragraph_chars,
        max_consecutive_exposition_paragraphs: policy.max_consecutive_exposition_paragraphs,
        blocking_severity: policy.blocking_severity
      };

      const issues = attempted.report.issues;
      const blocking = policy.blocking_severity;
      return {
        ...attempted.report,
        policy: expectedPolicy,
        status: computeStatus({ blocking, issues }),
        has_blocking_issues: computeHasBlockingIssues({ blocking, issues })
      };
    }
    if (attempted.status === "error") {
      const scriptPrefix = scriptRelPath.trim().length > 0 ? `${scriptRelPath.trim()}: ` : "";
      return computeFallbackReport({
        chapter: args.chapter,
        chapterText: args.chapterText,
        platformProfile: args.platformProfile,
        scriptError: `${scriptPrefix}${attempted.error}`,
        scriptRelPath: scriptRelPath.trim()
      });
    }
  }

  // Missing script or preferDeterministicScript disabled: warn-only fallback (non-blocking).
  return computeFallbackReport({
    chapter: args.chapter,
    chapterText: args.chapterText,
    platformProfile: args.platformProfile,
    ...(preferScript ? { scriptRelPath: scriptRelPath.trim() } : {})
  });
}

export function summarizeReadabilityIssues(issues: ReadabilityIssue[], limit: number): string {
  const ordered = issues
    .slice()
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || a.id.localeCompare(b.id, "en"));
  return ordered
    .slice(0, limit)
    .map((i) => i.summary)
    .join(" | ");
}

export async function writeReadabilityLogs(args: {
  rootDir: string;
  chapter: number;
  report: ReadabilityReport;
}): Promise<{ latestRel: string; historyRel: string }> {
  const dirRel = "logs/readability";
  const dirAbs = join(args.rootDir, dirRel);
  await ensureDir(dirAbs);

  const historyRel = `${dirRel}/readability-report-chapter-${pad3(args.chapter)}.json`;
  const latestRel = `${dirRel}/latest.json`;

  await writeJsonFile(join(args.rootDir, historyRel), args.report);
  await writeJsonFile(join(args.rootDir, latestRel), args.report);

  return { latestRel, historyRel };
}

export async function precomputeReadabilityReport(args: {
  rootDir: string;
  chapter: number;
  chapterAbsPath: string;
  platformProfile: PlatformProfile;
}): Promise<ReadabilityLintPrecompute> {
  try {
    const before = await fingerprintTextFile(args.chapterAbsPath);

    const report = await computeReadabilityReport({
      rootDir: args.rootDir,
      chapter: args.chapter,
      chapterAbsPath: args.chapterAbsPath,
      chapterText: before.text,
      platformProfile: args.platformProfile,
      preferDeterministicScript: true
    });

    const afterFp = await fingerprintFile(args.chapterAbsPath);
    if (!fingerprintsMatch(before.fingerprint, afterFp)) {
      return {
        status: "skipped",
        error: "Chapter changed while running readability lint; skipping precomputed result.",
        chapter_fingerprint: null,
        report: null
      };
    }

    const error = report.script_error ? `Deterministic readability lint script failed; used fallback. ${report.script_error}` : undefined;
    return { status: "pass", ...(error ? { error } : {}), chapter_fingerprint: afterFp, report };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "skipped", error: message, chapter_fingerprint: null, report: null };
  }
}

export async function attachReadabilityLintToEval(args: {
  evalAbsPath: string;
  evalRelPath: string;
  reportRelPath: string;
  report: ReadabilityReport;
}): Promise<void> {
  const raw = await readJsonFile(args.evalAbsPath);
  if (!isPlainObject(raw)) throw new NovelCliError(`Invalid ${args.evalRelPath}: eval JSON must be an object.`, 2);
  const obj = raw as Record<string, unknown>;

  const bySeverity = { warn: 0, soft: 0, hard: 0 };
  for (const issue of args.report.issues) {
    if (issue.severity === "warn") bySeverity.warn += 1;
    else if (issue.severity === "soft") bySeverity.soft += 1;
    else if (issue.severity === "hard") bySeverity.hard += 1;
  }

  obj.readability_lint = {
    report_path: args.reportRelPath,
    status: args.report.status,
    mode: args.report.mode,
    ...(args.report.policy ? { blocking_severity: args.report.policy.blocking_severity } : { blocking_severity: null }),
    issues_total: args.report.issues.length,
    issues_by_severity: bySeverity,
    has_blocking_issues: args.report.has_blocking_issues
  };

  await writeJsonFile(args.evalAbsPath, obj);
}
