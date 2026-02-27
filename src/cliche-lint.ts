import { execFile } from "node:child_process";
import { isAbsolute, join } from "node:path";
import { promisify } from "node:util";

import { NovelCliError } from "./errors.js";
import { fingerprintFile, fingerprintTextFile, fingerprintsMatch, type FileFingerprint } from "./fingerprint.js";
import { ensureDir, pathExists, readJsonFile, writeJsonFile } from "./fs-utils.js";
import type { PlatformProfile, SeverityPolicy } from "./platform-profile.js";
import { rejectPathTraversalInput } from "./safe-path.js";
import { pad3 } from "./steps.js";
import { isPlainObject } from "./type-guards.js";

const execFileAsync = promisify(execFile);

export type WebNovelClicheLintConfig = {
  schema_version: number;
  last_updated: string | null;
  words: string[];
  categories: Record<string, string[]>;
  severity: {
    default: SeverityPolicy;
    per_category: Record<string, SeverityPolicy>;
    per_word: Record<string, SeverityPolicy>;
  };
  whitelist: string[];
  exemptions: {
    exact: string[];
    regex: string[];
  };
};

export type ClicheLintHit = {
  word: string;
  count: number;
  severity: SeverityPolicy;
  category: string | null;
  categories: string[];
  lines: number[];
  snippets: string[];
};

export type ClicheLintReport = {
  schema_version: 1;
  generated_at: string;
  scope: { chapter: number };
  config: { schema_version: number; last_updated: string | null };
  mode: "script" | "fallback";
  script?: { rel_path: string };
  script_error?: string;
  chars: number;
  total_hits: number;
  hits_per_kchars: number;
  by_severity: {
    warn: { hits: number; hits_per_kchars: number };
    soft: { hits: number; hits_per_kchars: number };
    hard: { hits: number; hits_per_kchars: number };
  };
  by_category: Record<string, { hits: number; hits_per_kchars: number }>;
  hits: ClicheLintHit[];
  top_hits: Array<{ word: string; count: number; severity: SeverityPolicy; category: string | null }>;
  has_hard_hits: boolean;
};

export type ClicheLintPrecompute = {
  status: "pass" | "skipped";
  error?: string;
  chapter_fingerprint: FileFingerprint | null;
  report: ClicheLintReport | null;
};

function requireStringArray(value: unknown, file: string, field: string): string[] {
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
    throw new NovelCliError(`Invalid ${file}: '${field}' must be a string array.`, 2);
  }
  return value.map((s) => s.trim()).filter((s) => s.length > 0);
}

function parseOptionalStringArray(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) return [];
  return value.map((s) => s.trim()).filter((s) => s.length > 0);
}

function requireSeverity(value: unknown, file: string, field: string): SeverityPolicy {
  if (value === "warn" || value === "soft" || value === "hard") return value;
  throw new NovelCliError(`Invalid ${file}: '${field}' must be one of: warn, soft, hard.`, 2);
}

function uniquePreserveOrder(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const it of items) {
    if (seen.has(it)) continue;
    seen.add(it);
    out.push(it);
  }
  return out;
}

function severityRank(s: SeverityPolicy): number {
  switch (s) {
    case "warn":
      return 1;
    case "soft":
      return 2;
    case "hard":
      return 3;
  }
}

function maxSeverity(a: SeverityPolicy, b: SeverityPolicy): SeverityPolicy {
  return severityRank(a) >= severityRank(b) ? a : b;
}

function parseConfig(raw: unknown, file: string): WebNovelClicheLintConfig {
  if (!isPlainObject(raw)) throw new NovelCliError(`Invalid ${file}: expected a JSON object.`, 2);
  const obj = raw as Record<string, unknown>;

  const schema_version = typeof obj.schema_version === "number" && Number.isInteger(obj.schema_version) ? obj.schema_version : 0;
  const last_updated = typeof obj.last_updated === "string" && obj.last_updated.trim().length > 0 ? obj.last_updated.trim() : null;

  const words = obj.words === undefined ? [] : requireStringArray(obj.words, file, "words");

  const categories: Record<string, string[]> = {};
  if (obj.categories !== undefined) {
    if (!isPlainObject(obj.categories)) throw new NovelCliError(`Invalid ${file}: 'categories' must be an object.`, 2);
    for (const [cat, list] of Object.entries(obj.categories as Record<string, unknown>)) {
      categories[cat] = uniquePreserveOrder(parseOptionalStringArray(list));
    }
  }

  const severityDefault: SeverityPolicy = "warn";
  let severity_default: SeverityPolicy = severityDefault;
  const per_category: Record<string, SeverityPolicy> = {};
  const per_word: Record<string, SeverityPolicy> = {};

  if (obj.severity !== undefined) {
    if (!isPlainObject(obj.severity)) throw new NovelCliError(`Invalid ${file}: 'severity' must be an object.`, 2);
    const sev = obj.severity as Record<string, unknown>;

    const def = sev.default;
    severity_default = def === undefined ? severityDefault : requireSeverity(def, file, "severity.default");

    const pc = sev.per_category;
    if (pc !== undefined) {
      if (!isPlainObject(pc)) throw new NovelCliError(`Invalid ${file}: 'severity.per_category' must be an object.`, 2);
      for (const [k, v] of Object.entries(pc as Record<string, unknown>)) {
        per_category[k] = requireSeverity(v, file, `severity.per_category.${k}`);
      }
    }

    const pw = sev.per_word;
    if (pw !== undefined) {
      if (!isPlainObject(pw)) throw new NovelCliError(`Invalid ${file}: 'severity.per_word' must be an object.`, 2);
      for (const [k, v] of Object.entries(pw as Record<string, unknown>)) {
        per_word[k] = requireSeverity(v, file, `severity.per_word.${k}`);
      }
    }
  }

  const whitelistRaw = obj.whitelist;
  const whitelist = Array.isArray(whitelistRaw)
    ? parseOptionalStringArray(whitelistRaw)
    : isPlainObject(whitelistRaw)
      ? parseOptionalStringArray((whitelistRaw as Record<string, unknown>).words)
      : [];

  const exemptionsObj = isPlainObject(obj.exemptions) ? (obj.exemptions as Record<string, unknown>) : {};
  const exemptionsExact = parseOptionalStringArray(exemptionsObj.exact);
  const exemptionsRegex = parseOptionalStringArray(exemptionsObj.regex);

  return {
    schema_version,
    last_updated,
    words: uniquePreserveOrder(words),
    categories,
    severity: { default: severity_default, per_category, per_word },
    whitelist: uniquePreserveOrder(whitelist),
    exemptions: { exact: uniquePreserveOrder(exemptionsExact), regex: uniquePreserveOrder(exemptionsRegex) }
  };
}

export async function loadWebNovelClicheLintConfig(rootDir: string): Promise<{ relPath: string; config: WebNovelClicheLintConfig } | null> {
  const relPath = "web-novel-cliche-lint.json";
  const absPath = join(rootDir, relPath);
  if (!(await pathExists(absPath))) return null;
  const raw = await readJsonFile(absPath);
  return { relPath, config: parseConfig(raw, relPath) };
}

function codepointCompare(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function countNonWhitespaceChars(text: string): number {
  const compact = text.replace(/\s+/gu, "");
  return Array.from(compact).length;
}

function collectLineEvidence(text: string, phrase: string): { lines: number[]; snippets: string[] } {
  const lines: number[] = [];
  const snippets: string[] = [];
  for (const [i, line] of text.split(/\r?\n/gu).entries()) {
    if (!line.includes(phrase)) continue;
    const lineNo = i + 1;
    lines.push(lineNo);
    if (snippets.length < 5) {
      const snippet = line.trim();
      snippets.push(snippet.length > 160 ? `${snippet.slice(0, 160)}…` : snippet);
    }
    if (lines.length >= 20) break;
  }
  return { lines, snippets };
}

function maskLiteral(text: string, phrase: string): string {
  if (!phrase) return text;
  return text.replaceAll(phrase, "\x00".repeat(phrase.length));
}

function maskExemptions(text: string, exemptions: WebNovelClicheLintConfig["exemptions"]): string {
  let masked = text;
  for (const phrase of exemptions.exact) {
    masked = maskLiteral(masked, phrase);
  }
  for (const pattern of exemptions.regex) {
    try {
      const re = new RegExp(pattern, "gu");
      masked = masked.replace(re, (m) => "\x00".repeat(m.length));
    } catch {
      // ignore invalid regex patterns
    }
  }
  return masked;
}

function buildWordIndex(cfg: WebNovelClicheLintConfig): Map<string, { categories: string[]; severity: SeverityPolicy }> {
  const index = new Map<string, { categories: Set<string>; severity: SeverityPolicy }>();
  const whitelist = new Set(cfg.whitelist);
  const exemptionsExact = new Set(cfg.exemptions.exact);

  const addWord = (word: string, category: string | null): void => {
    const trimmed = word.trim();
    if (trimmed.length === 0) return;
    if (whitelist.has(trimmed)) return;
    if (exemptionsExact.has(trimmed)) return;

    const existing = index.get(trimmed) ?? { categories: new Set<string>(), severity: cfg.severity.default };
    if (category) existing.categories.add(category);
    index.set(trimmed, existing);
  };

  for (const w of cfg.words) addWord(w, null);
  for (const [cat, list] of Object.entries(cfg.categories)) {
    for (const w of list) addWord(w, cat);
  }

  const out = new Map<string, { categories: string[]; severity: SeverityPolicy }>();
  for (const [word, meta] of index.entries()) {
    let severity = cfg.severity.default;

    const perWord = cfg.severity.per_word[word];
    if (perWord) {
      severity = perWord;
    } else {
      for (const cat of meta.categories) {
        const catSev = cfg.severity.per_category[cat];
        if (catSev) severity = maxSeverity(severity, catSev);
      }
    }

    out.set(word, { categories: Array.from(meta.categories).sort(), severity });
  }
  return out;
}

function computeFallbackReport(args: {
  chapter: number;
  chapterText: string;
  config: WebNovelClicheLintConfig;
}): ClicheLintReport {
  const generated_at = new Date().toISOString();
  const chars = countNonWhitespaceChars(args.chapterText);

  const index = buildWordIndex(args.config);
  const words = Array.from(index.keys()).sort((a, b) => b.length - a.length || codepointCompare(a, b));

  let masked = maskExemptions(args.chapterText, args.config.exemptions);
  const hits: ClicheLintHit[] = [];

  let totalHits = 0;
  const severityCounts: Record<SeverityPolicy, number> = { warn: 0, soft: 0, hard: 0 };
  const categoryCounts = new Map<string, number>();

  for (const word of words) {
    if (!word) continue;
    const count = masked.split(word).length - 1;
    if (count <= 0) continue;
    masked = maskLiteral(masked, word);

    const meta = index.get(word);
    const severity = meta?.severity ?? args.config.severity.default;
    const categories = meta?.categories ?? [];
    const category = categories[0] ?? null;

    totalHits += count;
    severityCounts[severity] += count;
    if (category) categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + count);

    const evidence = collectLineEvidence(args.chapterText, word);
    hits.push({ word, count, severity, category, categories, lines: evidence.lines, snippets: evidence.snippets });
  }

  hits.sort((a, b) => b.count - a.count || severityRank(b.severity) - severityRank(a.severity) || codepointCompare(a.word, b.word));

  const hits_per_kchars = chars > 0 ? Math.round((totalHits / (chars / 1000.0)) * 1000) / 1000 : 0;
  const perK = (n: number): number => (chars > 0 ? Math.round((n / (chars / 1000.0)) * 1000) / 1000 : 0);

  const by_category: Record<string, { hits: number; hits_per_kchars: number }> = {};
  for (const [cat, n] of categoryCounts.entries()) {
    by_category[cat] = { hits: n, hits_per_kchars: perK(n) };
  }

  const top_hits = hits.slice(0, 10).map((h) => ({ word: h.word, count: h.count, severity: h.severity, category: h.category }));
  const has_hard_hits = severityCounts.hard > 0;

  return {
    schema_version: 1,
    generated_at,
    scope: { chapter: args.chapter },
    config: { schema_version: args.config.schema_version, last_updated: args.config.last_updated },
    mode: "fallback",
    chars,
    total_hits: totalHits,
    hits_per_kchars,
    by_severity: {
      warn: { hits: severityCounts.warn, hits_per_kchars: perK(severityCounts.warn) },
      soft: { hits: severityCounts.soft, hits_per_kchars: perK(severityCounts.soft) },
      hard: { hits: severityCounts.hard, hits_per_kchars: perK(severityCounts.hard) }
    },
    by_category,
    hits,
    top_hits,
    has_hard_hits
  };
}

function parseScriptReport(raw: unknown): ClicheLintReport {
  if (!isPlainObject(raw)) throw new NovelCliError(`Invalid cliche lint script output: expected an object.`, 2);
  const obj = raw as Record<string, unknown>;
  if (obj.schema_version !== 1) throw new NovelCliError(`Invalid cliche lint script output: schema_version must be 1.`, 2);
  if (!isPlainObject(obj.scope) || typeof (obj.scope as Record<string, unknown>).chapter !== "number") {
    throw new NovelCliError(`Invalid cliche lint script output: missing scope.chapter.`, 2);
  }

  const requireNumber = (v: unknown, field: string): number => {
    if (typeof v !== "number" || !Number.isFinite(v)) throw new NovelCliError(`Invalid cliche lint script output: '${field}' must be a number.`, 2);
    return v;
  };

  const requireInt = (v: unknown, field: string): number => {
    const n = requireNumber(v, field);
    if (!Number.isInteger(n)) throw new NovelCliError(`Invalid cliche lint script output: '${field}' must be an int.`, 2);
    return n;
  };

  const requireString = (v: unknown, field: string): string => {
    if (typeof v !== "string" || v.trim().length === 0) throw new NovelCliError(`Invalid cliche lint script output: '${field}' must be a non-empty string.`, 2);
    return v;
  };

  const requireBool = (v: unknown, field: string): boolean => {
    if (typeof v !== "boolean") throw new NovelCliError(`Invalid cliche lint script output: '${field}' must be a boolean.`, 2);
    return v;
  };

  const scopeObj = obj.scope as Record<string, unknown>;
  const scope = { chapter: requireInt(scopeObj.chapter, "scope.chapter") };

  const configObj = isPlainObject(obj.config) ? (obj.config as Record<string, unknown>) : {};
  const configSchemaVersionRaw = configObj.schema_version;
  const configSchemaVersion =
    typeof configSchemaVersionRaw === "number" && Number.isInteger(configSchemaVersionRaw) ? configSchemaVersionRaw : 0;
  const configLastUpdatedRaw = configObj.last_updated;
  const configLastUpdated =
    typeof configLastUpdatedRaw === "string" && configLastUpdatedRaw.trim().length > 0 ? configLastUpdatedRaw.trim() : null;

  const bySeverityRaw = obj.by_severity;
  if (!isPlainObject(bySeverityRaw)) throw new NovelCliError(`Invalid cliche lint script output: 'by_severity' must be an object.`, 2);
  const bySev = bySeverityRaw as Record<string, unknown>;

  const parseSevBucket = (key: SeverityPolicy): { hits: number; hits_per_kchars: number } => {
    const rawBucket = bySev[key];
    if (!isPlainObject(rawBucket)) throw new NovelCliError(`Invalid cliche lint script output: 'by_severity.${key}' must be an object.`, 2);
    const bucket = rawBucket as Record<string, unknown>;
    return { hits: requireInt(bucket.hits, `by_severity.${key}.hits`), hits_per_kchars: requireNumber(bucket.hits_per_kchars, `by_severity.${key}.hits_per_kchars`) };
  };

  const by_severity: ClicheLintReport["by_severity"] = {
    warn: parseSevBucket("warn"),
    soft: parseSevBucket("soft"),
    hard: parseSevBucket("hard")
  };

  const by_category: ClicheLintReport["by_category"] = {};
  if (obj.by_category !== undefined) {
    if (!isPlainObject(obj.by_category)) throw new NovelCliError(`Invalid cliche lint script output: 'by_category' must be an object.`, 2);
    for (const [cat, rawBucket] of Object.entries(obj.by_category as Record<string, unknown>)) {
      if (!isPlainObject(rawBucket)) throw new NovelCliError(`Invalid cliche lint script output: 'by_category.${cat}' must be an object.`, 2);
      const bucket = rawBucket as Record<string, unknown>;
      by_category[cat] = {
        hits: requireInt(bucket.hits, `by_category.${cat}.hits`),
        hits_per_kchars: requireNumber(bucket.hits_per_kchars, `by_category.${cat}.hits_per_kchars`)
      };
    }
  }

  const hitsRaw = obj.hits;
  if (!Array.isArray(hitsRaw)) throw new NovelCliError(`Invalid cliche lint script output: 'hits' must be an array.`, 2);
  const hits: ClicheLintHit[] = hitsRaw.map((h, idx) => {
    if (!isPlainObject(h)) throw new NovelCliError(`Invalid cliche lint script output: 'hits[${idx}]' must be an object.`, 2);
    const ho = h as Record<string, unknown>;
    const word = requireString(ho.word, `hits[${idx}].word`);
    const count = requireInt(ho.count, `hits[${idx}].count`);
    const severity = requireSeverity(ho.severity, `cliche lint script output`, `hits[${idx}].severity`);

    const catRaw = ho.category;
    const category = catRaw === null ? null : typeof catRaw === "string" && catRaw.trim().length > 0 ? catRaw.trim() : null;
    const categories = Array.isArray(ho.categories) ? parseOptionalStringArray(ho.categories) : [];
    const linesRaw = ho.lines;
    const lines =
      linesRaw === undefined || linesRaw === null
        ? []
        : Array.isArray(linesRaw) && linesRaw.every((n) => typeof n === "number" && Number.isInteger(n))
          ? (linesRaw as number[])
          : (() => {
              throw new NovelCliError(`Invalid cliche lint script output: 'hits[${idx}].lines' must be an int array.`, 2);
            })();

    const snippetsRaw = ho.snippets;
    const snippets =
      snippetsRaw === undefined || snippetsRaw === null
        ? []
        : Array.isArray(snippetsRaw) && snippetsRaw.every((s) => typeof s === "string")
          ? (snippetsRaw as string[])
          : (() => {
              throw new NovelCliError(`Invalid cliche lint script output: 'hits[${idx}].snippets' must be a string array.`, 2);
            })();

    return { word, count, severity, category, categories, lines, snippets };
  });

  const topHitsRaw = obj.top_hits;
  if (!Array.isArray(topHitsRaw)) throw new NovelCliError(`Invalid cliche lint script output: 'top_hits' must be an array.`, 2);
  const top_hits = topHitsRaw.map((h, idx) => {
    if (!isPlainObject(h)) throw new NovelCliError(`Invalid cliche lint script output: 'top_hits[${idx}]' must be an object.`, 2);
    const ho = h as Record<string, unknown>;
    const word = requireString(ho.word, `top_hits[${idx}].word`);
    const count = requireInt(ho.count, `top_hits[${idx}].count`);
    const severity = requireSeverity(ho.severity, `cliche lint script output`, `top_hits[${idx}].severity`);
    const catRaw = ho.category;
    const category = catRaw === null ? null : typeof catRaw === "string" && catRaw.trim().length > 0 ? catRaw.trim() : null;
    return { word, count, severity, category };
  });

  return {
    schema_version: 1,
    generated_at: requireString(obj.generated_at, "generated_at"),
    scope,
    config: { schema_version: configSchemaVersion, last_updated: configLastUpdated },
    mode: "script",
    chars: requireInt(obj.chars, "chars"),
    total_hits: requireInt(obj.total_hits, "total_hits"),
    hits_per_kchars: requireNumber(obj.hits_per_kchars, "hits_per_kchars"),
    by_severity,
    by_category,
    hits,
    top_hits,
    has_hard_hits: requireBool(obj.has_hard_hits, "has_hard_hits")
  };
}

type ScriptAttempt =
  | { status: "missing" }
  | { status: "ok"; report: ClicheLintReport }
  | { status: "error"; error: string };

async function tryRunDeterministicScript(args: {
  rootDir: string;
  chapterAbsPath: string;
  configAbsPath: string;
  scriptRelPath: string;
}): Promise<ScriptAttempt> {
  const scriptRel = args.scriptRelPath.trim();
  if (scriptRel.length === 0) {
    return { status: "error", error: "Invalid lint_cliche script path: empty string." };
  }
  if (isAbsolute(scriptRel)) {
    return { status: "error", error: "Invalid lint_cliche script path: must be project-relative (not absolute)." };
  }
  try {
    rejectPathTraversalInput(scriptRel, "platform-profile.json.compliance.script_paths.lint_cliche");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "error", error: message };
  }

  const scriptAbs = join(args.rootDir, scriptRel);
  if (!(await pathExists(scriptAbs))) return { status: "missing" };

  try {
    const { stdout } = await execFileAsync("bash", [scriptAbs, args.chapterAbsPath, args.configAbsPath], { maxBuffer: 10 * 1024 * 1024 });
    const trimmed = stdout.trim();
    const parsed = JSON.parse(trimmed) as unknown;
    const report = parseScriptReport(parsed);
    return { status: "ok", report: { ...report, mode: "script", script: { rel_path: scriptRel } } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stderr = (err as { stderr?: unknown }).stderr;
    const stderrText = typeof stderr === "string" && stderr.trim().length > 0 ? stderr.trim() : null;
    const detail = stderrText ? ` stderr=${stderrText.slice(0, 200)}` : "";
    return { status: "error", error: `${message}${detail}` };
  }
}

function resolveClicheLintScriptRelPath(profile: PlatformProfile | null): string {
  const fromProfile = profile?.compliance.script_paths?.lint_cliche;
  if (fromProfile && typeof fromProfile === "string" && fromProfile.trim().length > 0) return fromProfile.trim();
  return "scripts/lint-cliche.sh";
}

export async function computeClicheLintReport(args: {
  rootDir: string;
  chapter: number;
  chapterAbsPath: string;
  chapterText: string;
  config: WebNovelClicheLintConfig;
  configRelPath: string;
  platformProfile: PlatformProfile | null;
  preferDeterministicScript?: boolean;
}): Promise<ClicheLintReport> {
  const preferScript = args.preferDeterministicScript ?? true;
  if (preferScript) {
    const scriptRelPath = resolveClicheLintScriptRelPath(args.platformProfile);
    const attempted = await tryRunDeterministicScript({
      rootDir: args.rootDir,
      chapterAbsPath: args.chapterAbsPath,
      configAbsPath: join(args.rootDir, args.configRelPath),
      scriptRelPath
    });
    if (attempted.status === "ok") return attempted.report;
    if (attempted.status === "error") {
      const report = computeFallbackReport({ chapter: args.chapter, chapterText: args.chapterText, config: args.config });
      const scriptRel = scriptRelPath.trim();
      const scriptPrefix = scriptRel.length > 0 ? `${scriptRel}: ` : "";
      return { ...report, script_error: `${scriptPrefix}${attempted.error}` };
    }
  }
  return computeFallbackReport({ chapter: args.chapter, chapterText: args.chapterText, config: args.config });
}

export async function precomputeClicheLintReport(args: {
  rootDir: string;
  chapter: number;
  chapterAbsPath: string;
  config: WebNovelClicheLintConfig;
  configRelPath: string;
  platformProfile: PlatformProfile | null;
}): Promise<ClicheLintPrecompute> {
  try {
    const before = await fingerprintTextFile(args.chapterAbsPath);

    const scriptRelPath = resolveClicheLintScriptRelPath(args.platformProfile);
    const attempted = await tryRunDeterministicScript({
      rootDir: args.rootDir,
      chapterAbsPath: args.chapterAbsPath,
      configAbsPath: join(args.rootDir, args.configRelPath),
      scriptRelPath
    });

    const scriptRel = scriptRelPath.trim();
    const scriptPrefix = scriptRel.length > 0 ? `${scriptRel}: ` : "";
    const scriptError = attempted.status === "error" ? `${scriptPrefix}${attempted.error}` : undefined;

    const report = attempted.status === "ok"
      ? attempted.report
      : {
          ...computeFallbackReport({ chapter: args.chapter, chapterText: before.text, config: args.config }),
          ...(scriptError ? { script_error: scriptError } : {})
        };

    const afterFp = await fingerprintFile(args.chapterAbsPath);
    if (!fingerprintsMatch(before.fingerprint, afterFp)) {
      return {
        status: "skipped",
        error: "Chapter changed while running cliché lint; skipping precomputed result.",
        chapter_fingerprint: null,
        report: null
      };
    }
    const error = scriptError ? `Deterministic cliché lint script failed; used fallback. ${scriptError}` : undefined;
    return { status: "pass", ...(error ? { error } : {}), chapter_fingerprint: afterFp, report };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "skipped", error: message, chapter_fingerprint: null, report: null };
  }
}

export async function writeClicheLintLogs(args: { rootDir: string; chapter: number; report: ClicheLintReport }): Promise<{ latestRel: string; historyRel: string }> {
  const dirRel = "logs/cliche-lint";
  const dirAbs = join(args.rootDir, dirRel);
  await ensureDir(dirAbs);

  const historyRel = `${dirRel}/cliche-lint-chapter-${pad3(args.chapter)}.json`;
  const latestRel = `${dirRel}/latest.json`;

  await writeJsonFile(join(args.rootDir, historyRel), args.report);
  await writeJsonFile(join(args.rootDir, latestRel), args.report);
  return { latestRel, historyRel };
}

export async function attachClicheLintToEval(args: {
  evalAbsPath: string;
  evalRelPath: string;
  reportRelPath: string;
  report: ClicheLintReport;
}): Promise<void> {
  const raw = await readJsonFile(args.evalAbsPath);
  if (!isPlainObject(raw)) throw new NovelCliError(`Invalid ${args.evalRelPath}: eval JSON must be an object.`, 2);
  const obj = raw as Record<string, unknown>;

  obj.cliche_lint = {
    report_path: args.reportRelPath,
    chars: args.report.chars,
    total_hits: args.report.total_hits,
    hits_per_kchars: args.report.hits_per_kchars,
    by_severity: args.report.by_severity,
    by_category: args.report.by_category,
    top_hits: args.report.top_hits,
    has_hard_hits: args.report.has_hard_hits
  };

  await writeJsonFile(args.evalAbsPath, obj);
}
