import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { NovelCliError } from "./errors.js";
import { ensureDir, pathExists, readJsonFile, writeJsonFile } from "./fs-utils.js";
import type { PlatformId, PlatformProfile, SeverityPolicy } from "./platform-profile.js";
import { pad3 } from "./steps.js";
import { isPlainObject } from "./type-guards.js";

const execFileAsync = promisify(execFile);

const INFO_LOAD_WINDOW_CHAPTERS = 10;

type CheckStatus = "pass" | "warn" | "violation" | "skipped";

export type ConstraintIssue = {
  id: string;
  severity: SeverityPolicy;
  summary: string;
  evidence?: string;
  suggestion?: string;
};

export type PlatformConstraintsReport = {
  schema_version: 1;
  generated_at: string;
  scope: { chapter: number };
  platform: PlatformId;
  platform_profile: { schema_version: number; created_at: string };
  word_count: {
    chars: number;
    target_min: number;
    target_max: number;
    hard_min: number;
    hard_max: number;
    status: Exclude<CheckStatus, "skipped">;
  };
  compliance: {
    status: CheckStatus;
    banned_words: {
      status: CheckStatus;
      total_hits: number;
      hits: Array<{ word: string; count: number; lines: number[]; snippets: string[] }>;
    };
    duplicate_names: {
      status: CheckStatus;
      policy: SeverityPolicy;
      duplicates: Array<{ display_name: string; entity_paths: string[] }>;
    };
    script_consistency: {
      status: CheckStatus;
      has_simplified_signal: boolean;
      has_traditional_signal: boolean;
      samples: { simplified: string[]; traditional: string[] };
    };
  };
  info_load: {
    status: CheckStatus;
    window_chapters: number;
    ner: { status: CheckStatus; error?: string };
    unknown_entities_count: number | null;
    max_unknown_entities_per_chapter: number;
    new_entities_count: number | null;
    max_new_entities_per_chapter: number;
    new_terms_per_1k_words: number | null;
    max_new_terms_per_1k_words: number;
    unknown_entities: Array<{ text: string; category: string; evidence: string | null }> | null;
    new_entities: Array<{ text: string; category: string; evidence: string | null }> | null;
  };
  issues: ConstraintIssue[];
  has_hard_violations: boolean;
};

function countNonWhitespaceChars(text: string): number {
  const compact = text.replace(/\s+/gu, "");
  return Array.from(compact).length;
}

function findPhraseHits(text: string, phrase: string): { count: number; lines: number[]; snippets: string[] } {
  if (!phrase) return { count: 0, lines: [], snippets: [] };

  let count = 0;
  let idx = 0;
  while (true) {
    const next = text.indexOf(phrase, idx);
    if (next < 0) break;
    count += 1;
    idx = next + phrase.length;
  }

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
  }

  return { count, lines: lines.slice(0, 20), snippets };
}

const SIMPLIFIED_TRADITIONAL_PAIRS: Array<[string, string]> = [
  ["后", "後"],
  ["里", "裡"],
  ["发", "發"],
  ["复", "復"],
  ["面", "麵"],
  ["台", "臺"],
  ["万", "萬"],
  ["云", "雲"],
  ["么", "麼"],
  ["为", "為"],
  ["于", "於"],
  ["众", "眾"],
  ["优", "優"],
  ["会", "會"],
  ["体", "體"],
  ["余", "餘"],
  ["伤", "傷"],
  ["传", "傳"],
  ["价", "價"],
  ["儿", "兒"],
  ["写", "寫"],
  ["凤", "鳳"],
  ["刘", "劉"],
  ["别", "別"],
  ["制", "製"],
  ["动", "動"],
  ["历", "歷"],
  ["听", "聽"],
  ["国", "國"],
  ["图", "圖"],
  ["场", "場"],
  ["声", "聲"],
  ["够", "夠"],
  ["妈", "媽"],
  ["学", "學"],
  ["宁", "寧"],
  ["实", "實"],
  ["对", "對"],
  ["将", "將"],
  ["尽", "盡"],
  ["归", "歸"],
  ["当", "當"],
  ["录", "錄"],
  ["开", "開"],
  ["张", "張"],
  ["强", "強"],
  ["忆", "憶"],
  ["态", "態"],
  ["总", "總"],
  ["战", "戰"],
  ["时", "時"],
  ["术", "術"],
  ["来", "來"],
  ["条", "條"],
  ["气", "氣"],
  ["没", "沒"],
  ["灭", "滅"],
  ["灵", "靈"],
  ["点", "點"],
  ["现", "現"],
  ["着", "著"],
  ["离", "離"],
  ["种", "種"],
  ["线", "線"],
  ["绝", "絕"],
  ["续", "續"],
  ["罗", "羅"],
  ["脸", "臉"],
  ["见", "見"],
  ["觉", "覺"],
  ["说", "說"],
  ["语", "語"],
  ["识", "識"],
  ["轻", "輕"],
  ["这", "這"],
  ["进", "進"],
  ["连", "連"],
  ["过", "過"],
  ["还", "還"],
  ["远", "遠"],
  ["门", "門"],
  ["阴", "陰"],
  ["难", "難"],
  ["陈", "陳"],
  ["风", "風"],
  ["飞", "飛"],
  ["马", "馬"]
];

function detectScriptConsistency(text: string): {
  has_simplified_signal: boolean;
  has_traditional_signal: boolean;
  samples: { simplified: string[]; traditional: string[] };
} {
  const simplifiedCounts = new Map<string, number>();
  const traditionalCounts = new Map<string, number>();

  const targetChars = new Set<string>();
  for (const [s, t] of SIMPLIFIED_TRADITIONAL_PAIRS) {
    targetChars.add(s);
    targetChars.add(t);
  }

  const freq = new Map<string, number>();
  for (const ch of text) {
    if (!targetChars.has(ch)) continue;
    freq.set(ch, (freq.get(ch) ?? 0) + 1);
  }

  for (const [s, t] of SIMPLIFIED_TRADITIONAL_PAIRS) {
    const sCount = freq.get(s) ?? 0;
    const tCount = freq.get(t) ?? 0;
    if (sCount > 0) simplifiedCounts.set(s, sCount);
    if (tCount > 0) traditionalCounts.set(t, tCount);
  }

  const hasSimplified = simplifiedCounts.size > 0;
  const hasTraditional = traditionalCounts.size > 0;

  const topSimplified = Array.from(simplifiedCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([c]) => c);
  const topTraditional = Array.from(traditionalCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([c]) => c);

  return { has_simplified_signal: hasSimplified, has_traditional_signal: hasTraditional, samples: { simplified: topSimplified, traditional: topTraditional } };
}

function collectKnownEntityNames(state: Record<string, unknown>): Set<string> {
  const names = new Set<string>();
  for (const category of ["characters", "items", "locations", "factions"] as const) {
    const raw = state[category];
    if (!isPlainObject(raw)) continue;
    for (const [id, entryRaw] of Object.entries(raw)) {
      if (id.trim().length > 0) names.add(id.trim());
      if (!isPlainObject(entryRaw)) continue;
      const display = (entryRaw as Record<string, unknown>).display_name;
      if (typeof display === "string" && display.trim().length > 0) names.add(display.trim());
    }
  }
  return names;
}

function findDuplicateDisplayNames(state: Record<string, unknown>): Array<{ display_name: string; entity_paths: string[] }> {
  const index = new Map<string, string[]>();

  for (const category of ["characters", "items", "locations", "factions"] as const) {
    const raw = state[category];
    if (!isPlainObject(raw)) continue;
    for (const [id, entryRaw] of Object.entries(raw)) {
      if (!isPlainObject(entryRaw)) continue;
      const display = (entryRaw as Record<string, unknown>).display_name;
      if (typeof display !== "string" || display.trim().length === 0) continue;
      const key = display.trim();
      const path = `${category}.${id}`;
      const prev = index.get(key) ?? [];
      prev.push(path);
      index.set(key, prev);
    }
  }

  const out: Array<{ display_name: string; entity_paths: string[] }> = [];
  for (const [display_name, entity_paths] of index.entries()) {
    const unique = Array.from(new Set(entity_paths));
    if (unique.length <= 1) continue;
    out.push({ display_name, entity_paths: unique.sort() });
  }
  out.sort((a, b) => a.display_name.localeCompare(b.display_name, "zh"));
  return out;
}

type NerEntity = { text: string; confidence: string; mentions: Array<{ line: number; snippet: string }> };
type NerOutput = {
  schema_version: number;
  entities: {
    characters: NerEntity[];
    locations: NerEntity[];
    time_markers: NerEntity[];
    events: NerEntity[];
  };
};

function parseNerOutput(raw: unknown): NerOutput {
  if (!isPlainObject(raw)) throw new NovelCliError(`Invalid NER output: expected an object.`, 2);
  const obj = raw as Record<string, unknown>;
  const schema = obj.schema_version;
  if (typeof schema !== "number" || !Number.isInteger(schema)) throw new NovelCliError(`Invalid NER output: missing schema_version.`, 2);
  if (schema !== 1) throw new NovelCliError(`Invalid NER output: unsupported schema_version=${schema} (expected 1).`, 2);
  const entitiesRaw = obj.entities;
  if (!isPlainObject(entitiesRaw)) throw new NovelCliError(`Invalid NER output: missing entities object.`, 2);
  const entitiesObj = entitiesRaw as Record<string, unknown>;

  const parseList = (key: string): NerEntity[] => {
    const listRaw = entitiesObj[key];
    if (!Array.isArray(listRaw)) return [];
    const out: NerEntity[] = [];
    for (const it of listRaw) {
      if (!isPlainObject(it)) continue;
      const rec = it as Record<string, unknown>;
      const text = typeof rec.text === "string" ? rec.text.trim() : "";
      const confidence = typeof rec.confidence === "string" ? rec.confidence : "unknown";
      const mentionsRaw = rec.mentions;
      const mentions: Array<{ line: number; snippet: string }> = [];
      if (Array.isArray(mentionsRaw)) {
        for (const m of mentionsRaw) {
          if (!isPlainObject(m)) continue;
          const mo = m as Record<string, unknown>;
          const line = typeof mo.line === "number" && Number.isInteger(mo.line) ? mo.line : null;
          const snippet = typeof mo.snippet === "string" ? mo.snippet : null;
          if (line !== null && snippet !== null) mentions.push({ line, snippet });
        }
      }
      if (text.length === 0) continue;
      out.push({ text, confidence, mentions });
    }
    return out;
  };

  return {
    schema_version: schema,
    entities: {
      characters: parseList("characters"),
      locations: parseList("locations"),
      time_markers: parseList("time_markers"),
      events: parseList("events")
    }
  };
}

function runNerScriptPath(): string {
  return fileURLToPath(new URL("../scripts/run-ner.sh", import.meta.url));
}

async function runNer(chapterAbs: string): Promise<NerOutput> {
  const script = runNerScriptPath();
  const { stdout } = await execFileAsync("bash", [script, chapterAbs], { maxBuffer: 10 * 1024 * 1024 });
  const trimmed = stdout.trim();
  const raw = JSON.parse(trimmed) as unknown;
  return parseNerOutput(raw);
}

type EntityIndex = Map<string, { category: string; evidence: string | null }>;

function buildEntityIndex(ner: NerOutput): EntityIndex {
  const index: EntityIndex = new Map();
  const add = (category: string, list: NerEntity[]): void => {
    for (const e of list) {
      if (index.has(e.text)) continue;
      const first = e.mentions[0] ?? null;
      const evidence = first ? `L${first.line}: ${first.snippet}` : null;
      index.set(e.text, { category, evidence });
    }
  };

  add("character", ner.entities.characters);
  add("location", ner.entities.locations);
  add("time_marker", ner.entities.time_markers);
  add("event", ner.entities.events);
  return index;
}

type FileFingerprint = { size: number; mtime_ms: number };

async function fingerprintFile(absPath: string): Promise<FileFingerprint> {
  const s = await stat(absPath);
  return { size: s.size, mtime_ms: s.mtimeMs };
}

async function collectRecentEntityTexts(args: { rootDir: string; chapter: number }): Promise<Set<string>> {
  const recent = new Set<string>();
  const start = Math.max(1, args.chapter - INFO_LOAD_WINDOW_CHAPTERS);
  const end = args.chapter - 1;

  const chapterAbsPaths: string[] = [];
  for (let c = start; c <= end; c += 1) {
    const rel = `chapters/chapter-${pad3(c)}.md`;
    const abs = join(args.rootDir, rel);
    if (await pathExists(abs)) chapterAbsPaths.push(abs);
  }

  const MAX_PARALLEL_NER = 4;
  let cursor = 0;
  const workers = Array.from({ length: Math.min(MAX_PARALLEL_NER, chapterAbsPaths.length) }, async () => {
    while (true) {
      const idx = cursor;
      cursor += 1;
      const abs = chapterAbsPaths[idx];
      if (!abs) break;
      try {
        const ner = await runNer(abs);
        for (const text of buildEntityIndex(ner).keys()) recent.add(text);
      } catch {
        // ignore
      }
    }
  });
  await Promise.all(workers);

  return recent;
}

export type InfoLoadNerPrecompute = {
  status: "pass" | "skipped";
  error?: string;
  chapter_fingerprint: FileFingerprint | null;
  current_index: EntityIndex | null;
  recent_texts: Set<string> | null;
};

export async function precomputeInfoLoadNer(args: {
  rootDir: string;
  chapter: number;
  chapterAbsPath: string;
}): Promise<InfoLoadNerPrecompute> {
  try {
    const fpBefore = await fingerprintFile(args.chapterAbsPath);
    const ner = await runNer(args.chapterAbsPath);
    const fpAfter = await fingerprintFile(args.chapterAbsPath);
    if (fpBefore.size !== fpAfter.size || fpBefore.mtime_ms !== fpAfter.mtime_ms) {
      return {
        status: "skipped",
        error: "Chapter changed while running NER; skipping info-load NER.",
        chapter_fingerprint: null,
        current_index: null,
        recent_texts: null
      };
    }
    const current_index = buildEntityIndex(ner);
    const recent_texts = await collectRecentEntityTexts({ rootDir: args.rootDir, chapter: args.chapter });
    return { status: "pass", chapter_fingerprint: fpAfter, current_index, recent_texts };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { status: "skipped", error: message, chapter_fingerprint: null, current_index: null, recent_texts: null };
  }
}

export async function computePlatformConstraints(args: {
  rootDir: string;
  chapter: number;
  chapterAbsPath: string;
  chapterText: string;
  platformProfile: PlatformProfile;
  state: Record<string, unknown>;
  infoLoadNer?: InfoLoadNerPrecompute;
}): Promise<PlatformConstraintsReport> {
  const generated_at = new Date().toISOString();

  const wordCount = countNonWhitespaceChars(args.chapterText);
  const wc = args.platformProfile.word_count;
  const wcHardViolation = wordCount < wc.hard_min || wordCount > wc.hard_max;
  const wcSoftWarn = !wcHardViolation && (wordCount < wc.target_min || wordCount > wc.target_max);
  const wcStatus: PlatformConstraintsReport["word_count"]["status"] = wcHardViolation ? "violation" : wcSoftWarn ? "warn" : "pass";

  const issues: ConstraintIssue[] = [];
  if (wcHardViolation) {
    issues.push({
      id: "word_count.hard_violation",
      severity: "hard",
      summary: `Word count ${wordCount} is outside hard range ${wc.hard_min}-${wc.hard_max}.`,
      suggestion: "Revise the chapter length to fit platform hard bounds."
    });
  } else if (wcSoftWarn) {
    issues.push({
      id: "word_count.target_deviation",
      severity: "soft",
      summary: `Word count ${wordCount} is outside target range ${wc.target_min}-${wc.target_max} (within hard bounds).`,
      suggestion: "Consider adjusting chapter length to better match platform target range."
    });
  }

  // Compliance: banned words.
  const bannedHits: Array<{ word: string; count: number; lines: number[]; snippets: string[] }> = [];
  let bannedTotalHits = 0;
  for (const word of args.platformProfile.compliance.banned_words) {
    const hit = findPhraseHits(args.chapterText, word);
    if (hit.count <= 0) continue;
    bannedTotalHits += hit.count;
    bannedHits.push({ word, count: hit.count, lines: hit.lines, snippets: hit.snippets });
  }
  bannedHits.sort((a, b) => b.count - a.count || a.word.localeCompare(b.word, "zh"));

  const bannedStatus: CheckStatus = bannedTotalHits > 0 ? "violation" : "pass";
  if (bannedTotalHits > 0) {
    const top = bannedHits[0];
    issues.push({
      id: "compliance.banned_words",
      severity: "hard",
      summary: `Detected banned words (${bannedTotalHits} hits).`,
      evidence: top ? `${top.word} x${top.count} (${top.snippets[0] ?? "no snippet"})` : undefined,
      suggestion: "Remove or replace banned words."
    });
  }

  // Compliance: duplicate display names (project scope).
  const duplicates = findDuplicateDisplayNames(args.state);
  const dupPolicy = args.platformProfile.compliance.duplicate_name_policy;
  const dupStatus: CheckStatus = duplicates.length > 0 ? (dupPolicy === "hard" ? "violation" : "warn") : "pass";
  if (duplicates.length > 0) {
    issues.push({
      id: "compliance.duplicate_names",
      severity: dupPolicy,
      summary: `Duplicate display_name detected (${duplicates.length}).`,
      evidence: duplicates[0] ? `${duplicates[0].display_name}: ${duplicates[0].entity_paths.join(", ")}` : undefined,
      suggestion: "Rename or consolidate duplicate entities to keep display names unique."
    });
  }

  // Compliance: simplified/traditional consistency (best-effort).
  const scriptConsistency = detectScriptConsistency(args.chapterText);
  const mixedScript = scriptConsistency.has_simplified_signal && scriptConsistency.has_traditional_signal;
  const scriptStatus: CheckStatus = mixedScript ? "warn" : "pass";
  if (mixedScript) {
    issues.push({
      id: "compliance.script_inconsistency",
      severity: "warn",
      summary: "Mixed simplified/traditional Chinese signals detected in chapter text.",
      evidence: `simplified_samples=${scriptConsistency.samples.simplified.join("")} traditional_samples=${scriptConsistency.samples.traditional.join("")}`,
      suggestion: "Normalize text to a single writing system (simplified or traditional)."
    });
  }

  const complianceStatus: CheckStatus = [bannedStatus, dupStatus, scriptStatus].includes("violation")
    ? "violation"
    : [bannedStatus, dupStatus, scriptStatus].includes("warn")
      ? "warn"
      : "pass";

  // Info-load metrics.
  let nerStatus: CheckStatus = "pass";
  let nerError: string | undefined;
  let unknownEntitiesCount: number | null = null;
  let newEntitiesCount: number | null = null;
  let newTermsPer1k: number | null = null;
  let unknownEntities: Array<{ text: string; category: string; evidence: string | null }> | null = null;
  let newEntities: Array<{ text: string; category: string; evidence: string | null }> | null = null;

  try {
    const pre = args.infoLoadNer;
    if (pre && pre.status === "skipped") {
      throw new Error(pre.error ?? "NER precompute skipped.");
    }
    const currentIndex = pre?.current_index ?? buildEntityIndex(await runNer(args.chapterAbsPath));
    const recentTexts = pre?.recent_texts ?? await collectRecentEntityTexts({ rootDir: args.rootDir, chapter: args.chapter });
    const knownNames = collectKnownEntityNames(args.state);

    const unknown: Array<{ text: string; category: string; evidence: string | null }> = [];
    const newlyIntroduced: Array<{ text: string; category: string; evidence: string | null }> = [];

    for (const [text, meta] of currentIndex.entries()) {
      if (!knownNames.has(text)) unknown.push({ text, category: meta.category, evidence: meta.evidence });
      if (!recentTexts.has(text) && meta.category !== "time_marker") newlyIntroduced.push({ text, category: meta.category, evidence: meta.evidence });
    }

    unknown.sort((a, b) => a.text.localeCompare(b.text, "zh"));
    newlyIntroduced.sort((a, b) => a.text.localeCompare(b.text, "zh"));

    unknownEntities = unknown;
    newEntities = newlyIntroduced;

    unknownEntitiesCount = unknown.length;
    newEntitiesCount = newlyIntroduced.length;

    const denom = wordCount > 0 ? wordCount / 1000.0 : null;
    if (denom && denom > 0) {
      newTermsPer1k = Math.round((newlyIntroduced.length / denom) * 1000) / 1000;
    } else {
      newTermsPer1k = 0;
    }
  } catch (err: unknown) {
    nerStatus = "skipped";
    const message = err instanceof Error ? err.message : String(err);
    nerError = message;
  }

  const info = args.platformProfile.info_load;
  const infoIssues: ConstraintIssue[] = [];
  if (unknownEntitiesCount !== null && unknownEntitiesCount > info.max_unknown_entities_per_chapter) {
    infoIssues.push({
      id: "info_load.unknown_entities_exceeded",
      severity: "soft",
      summary: `Unknown entities ${unknownEntitiesCount} exceeds max ${info.max_unknown_entities_per_chapter}.`,
      evidence: unknownEntities?.[0] ? `${unknownEntities[0].text} (${unknownEntities[0].category})` : undefined,
      suggestion: "Reduce new/unknown names or add brief reintroductions/grounding context."
    });
  }
  if (newEntitiesCount !== null && newEntitiesCount > info.max_new_entities_per_chapter) {
    infoIssues.push({
      id: "info_load.new_entities_exceeded",
      severity: "soft",
      summary: `New entities ${newEntitiesCount} exceeds max ${info.max_new_entities_per_chapter}.`,
      evidence: newEntities?.[0] ? `${newEntities[0].text} (${newEntities[0].category})` : undefined,
      suggestion: "Reduce the number of newly introduced entities in a single chapter."
    });
  }
  if (newTermsPer1k !== null && newTermsPer1k > info.max_new_terms_per_1k_words) {
    infoIssues.push({
      id: "info_load.new_terms_density_exceeded",
      severity: "soft",
      summary: `New terms per 1k ${newTermsPer1k} exceeds max ${info.max_new_terms_per_1k_words}.`,
      suggestion: "Spread new terminology across chapters or add clearer context for each new term."
    });
  }
  issues.push(...infoIssues);

  const infoStatus: CheckStatus = nerStatus === "skipped"
    ? "skipped"
    : infoIssues.length > 0
      ? "warn"
      : "pass";

  const hasHard = issues.some((i) => i.severity === "hard");

  return {
    schema_version: 1,
    generated_at,
    scope: { chapter: args.chapter },
    platform: args.platformProfile.platform,
    platform_profile: { schema_version: args.platformProfile.schema_version, created_at: args.platformProfile.created_at },
    word_count: {
      chars: wordCount,
      target_min: wc.target_min,
      target_max: wc.target_max,
      hard_min: wc.hard_min,
      hard_max: wc.hard_max,
      status: wcStatus
    },
    compliance: {
      status: complianceStatus,
      banned_words: { status: bannedStatus, total_hits: bannedTotalHits, hits: bannedHits },
      duplicate_names: { status: dupStatus, policy: dupPolicy, duplicates },
      script_consistency: { status: scriptStatus, ...scriptConsistency }
    },
    info_load: {
      status: infoStatus,
      window_chapters: INFO_LOAD_WINDOW_CHAPTERS,
      ner: { status: nerStatus, ...(nerError ? { error: nerError } : {}) },
      unknown_entities_count: unknownEntitiesCount,
      max_unknown_entities_per_chapter: info.max_unknown_entities_per_chapter,
      new_entities_count: newEntitiesCount,
      max_new_entities_per_chapter: info.max_new_entities_per_chapter,
      new_terms_per_1k_words: newTermsPer1k,
      max_new_terms_per_1k_words: info.max_new_terms_per_1k_words,
      unknown_entities: unknownEntities,
      new_entities: newEntities
    },
    issues,
    has_hard_violations: hasHard
  };
}

export async function writePlatformConstraintsLogs(args: { rootDir: string; chapter: number; report: PlatformConstraintsReport }): Promise<{ latestRel: string; historyRel: string }> {
  const dirRel = "logs/platform-constraints";
  const dirAbs = join(args.rootDir, dirRel);
  await ensureDir(dirAbs);

  const historyRel = `${dirRel}/platform-constraints-chapter-${pad3(args.chapter)}.json`;
  const latestRel = `${dirRel}/latest.json`;

  await writeJsonFile(join(args.rootDir, historyRel), args.report);
  await writeJsonFile(join(args.rootDir, latestRel), args.report);

  return { latestRel, historyRel };
}

export async function attachPlatformConstraintsToEval(args: {
  evalAbsPath: string;
  evalRelPath: string;
  platform: PlatformId;
  reportRelPath: string;
  report: PlatformConstraintsReport;
}): Promise<void> {
  const raw = await readJsonFile(args.evalAbsPath);
  if (!isPlainObject(raw)) throw new NovelCliError(`Invalid ${args.evalRelPath}: eval JSON must be an object.`, 2);
  const obj = raw as Record<string, unknown>;

  obj.platform = args.platform;
  obj.platform_constraints = {
    report_path: args.reportRelPath,
    word_count: args.report.word_count,
    compliance: args.report.compliance,
    info_load: args.report.info_load,
    has_hard_violations: args.report.has_hard_violations,
    issues: args.report.issues
  };

  await writeJsonFile(args.evalAbsPath, obj);
}
