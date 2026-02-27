import { join } from "node:path";

import { NovelCliError } from "./errors.js";
import { pathExists, readJsonFile } from "./fs-utils.js";
import { isPlainObject } from "./type-guards.js";

export type PlatformId = "qidian" | "tomato";
export type SeverityPolicy = "warn" | "soft" | "hard";

export type WordCountPolicy = {
  target_min: number;
  target_max: number;
  hard_min: number;
  hard_max: number;
};

export type InfoLoadPolicy = {
  max_new_entities_per_chapter: number;
  max_unknown_entities_per_chapter: number;
  max_new_terms_per_1k_words: number;
};

export type CompliancePolicy = {
  banned_words: string[];
  duplicate_name_policy: SeverityPolicy;
};

export type PlatformProfile = {
  schema_version: number;
  platform: PlatformId;
  created_at: string;
  word_count: WordCountPolicy;
  info_load: InfoLoadPolicy;
  compliance: CompliancePolicy;
};

function requireIntField(obj: Record<string, unknown>, field: string, file: string): number {
  const v = obj[field];
  if (typeof v !== "number" || !Number.isInteger(v)) throw new NovelCliError(`Invalid ${file}: '${field}' must be an int.`, 2);
  return v;
}

function requireStringField(obj: Record<string, unknown>, field: string, file: string): string {
  const v = obj[field];
  if (typeof v !== "string" || v.trim().length === 0) throw new NovelCliError(`Invalid ${file}: '${field}' must be a non-empty string.`, 2);
  return v;
}

function requirePlatformId(value: unknown, file: string): PlatformId {
  if (value === "qidian" || value === "tomato") return value;
  throw new NovelCliError(`Invalid ${file}: 'platform' must be one of: qidian, tomato.`, 2);
}

function requireSeverityPolicy(value: unknown, file: string, field: string): SeverityPolicy {
  if (value === "warn" || value === "soft" || value === "hard") return value;
  throw new NovelCliError(`Invalid ${file}: '${field}' must be one of: warn, soft, hard.`, 2);
}

function parseWordCountPolicy(raw: unknown, file: string): WordCountPolicy {
  if (!isPlainObject(raw)) throw new NovelCliError(`Invalid ${file}: 'word_count' must be an object.`, 2);
  const obj = raw as Record<string, unknown>;
  return {
    target_min: requireIntField(obj, "target_min", file),
    target_max: requireIntField(obj, "target_max", file),
    hard_min: requireIntField(obj, "hard_min", file),
    hard_max: requireIntField(obj, "hard_max", file)
  };
}

function parseInfoLoadPolicy(raw: unknown, file: string): InfoLoadPolicy {
  if (!isPlainObject(raw)) throw new NovelCliError(`Invalid ${file}: 'info_load' must be an object.`, 2);
  const obj = raw as Record<string, unknown>;
  return {
    max_new_entities_per_chapter: requireIntField(obj, "max_new_entities_per_chapter", file),
    max_unknown_entities_per_chapter: requireIntField(obj, "max_unknown_entities_per_chapter", file),
    max_new_terms_per_1k_words: requireIntField(obj, "max_new_terms_per_1k_words", file)
  };
}

function parseCompliancePolicy(raw: unknown, file: string): CompliancePolicy {
  if (!isPlainObject(raw)) throw new NovelCliError(`Invalid ${file}: 'compliance' must be an object.`, 2);
  const obj = raw as Record<string, unknown>;

  const bannedRaw = obj.banned_words;
  if (!Array.isArray(bannedRaw) || !bannedRaw.every((w) => typeof w === "string" && w.trim().length > 0)) {
    throw new NovelCliError(`Invalid ${file}: 'compliance.banned_words' must be a string array.`, 2);
  }
  const banned_words = Array.from(new Set(bannedRaw.map((w) => w.trim()))).filter((w) => w.length > 0);

  return {
    banned_words,
    duplicate_name_policy: requireSeverityPolicy(obj.duplicate_name_policy, file, "compliance.duplicate_name_policy")
  };
}

export function parsePlatformProfile(raw: unknown, file: string): PlatformProfile {
  if (!isPlainObject(raw)) throw new NovelCliError(`Invalid ${file}: expected a JSON object.`, 2);
  const obj = raw as Record<string, unknown>;

  const schema_version = requireIntField(obj, "schema_version", file);
  const platform = requirePlatformId(obj.platform, file);
  const created_at = requireStringField(obj, "created_at", file);
  const word_count = parseWordCountPolicy(obj.word_count, file);
  const info_load = parseInfoLoadPolicy(obj.info_load, file);
  const compliance = parseCompliancePolicy(obj.compliance, file);

  return { schema_version, platform, created_at, word_count, info_load, compliance };
}

export async function loadPlatformProfile(rootDir: string): Promise<{ relPath: string; profile: PlatformProfile } | null> {
  const relPath = "platform-profile.json";
  const absPath = join(rootDir, relPath);
  if (!(await pathExists(absPath))) return null;
  const raw = await readJsonFile(absPath);
  return { relPath, profile: parsePlatformProfile(raw, relPath) };
}

