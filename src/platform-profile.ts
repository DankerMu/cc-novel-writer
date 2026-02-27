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
  script_paths?: Record<string, string>;
};

export type HookPolicy = {
  required: boolean;
  min_strength: number;
  allowed_types: string[];
  fix_strategy: string;
};

export type ScoringPolicy = {
  genre_drive_type: string;
  weight_profile_id: string;
  weight_overrides?: Record<string, number>;
};

export type PlatformProfile = {
  schema_version: number;
  platform: PlatformId;
  created_at: string;
  word_count: WordCountPolicy;
  info_load: InfoLoadPolicy;
  compliance: CompliancePolicy;
  hook_policy?: HookPolicy;
  scoring?: ScoringPolicy;
};

function requireIntField(obj: Record<string, unknown>, field: string, file: string): number {
  const v = obj[field];
  if (typeof v !== "number" || !Number.isInteger(v)) throw new NovelCliError(`Invalid ${file}: '${field}' must be an int.`, 2);
  return v;
}

function requirePositiveNumberField(obj: Record<string, unknown>, field: string, file: string): number {
  const v = obj[field];
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) throw new NovelCliError(`Invalid ${file}: '${field}' must be a non-negative number.`, 2);
  return v;
}

function requireBoolField(obj: Record<string, unknown>, field: string, file: string): boolean {
  const v = obj[field];
  if (typeof v !== "boolean") throw new NovelCliError(`Invalid ${file}: '${field}' must be a boolean.`, 2);
  return v;
}

function requireStringArrayField(obj: Record<string, unknown>, field: string, file: string): string[] {
  const v = obj[field];
  if (!Array.isArray(v) || !v.every((s) => typeof s === "string")) throw new NovelCliError(`Invalid ${file}: '${field}' must be a string array.`, 2);
  return v as string[];
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
    max_new_terms_per_1k_words: requirePositiveNumberField(obj, "max_new_terms_per_1k_words", file)
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

  const out: CompliancePolicy = {
    banned_words,
    duplicate_name_policy: requireSeverityPolicy(obj.duplicate_name_policy, file, "compliance.duplicate_name_policy")
  };

  if (obj.script_paths !== undefined) {
    if (!isPlainObject(obj.script_paths)) throw new NovelCliError(`Invalid ${file}: 'compliance.script_paths' must be an object.`, 2);
    const sp = obj.script_paths as Record<string, unknown>;
    const script_paths: Record<string, string> = {};
    for (const [k, v] of Object.entries(sp)) {
      if (typeof v !== "string" || v.trim().length === 0) {
        throw new NovelCliError(`Invalid ${file}: 'compliance.script_paths.${k}' must be a non-empty string.`, 2);
      }
      script_paths[k] = v.trim();
    }
    out.script_paths = script_paths;
  }

  return out;
}

const VALID_FIX_STRATEGIES = ["hook-fix"] as const;

function parseHookPolicy(raw: unknown, file: string): HookPolicy {
  if (!isPlainObject(raw)) throw new NovelCliError(`Invalid ${file}: 'hook_policy' must be an object.`, 2);
  const obj = raw as Record<string, unknown>;
  const min_strength = requireIntField(obj, "min_strength", file);
  if (min_strength < 1 || min_strength > 5) throw new NovelCliError(`Invalid ${file}: 'hook_policy.min_strength' must be 1-5.`, 2);
  const fix_strategy = requireStringField(obj, "fix_strategy", file);
  if (!(VALID_FIX_STRATEGIES as readonly string[]).includes(fix_strategy)) {
    throw new NovelCliError(`Invalid ${file}: 'hook_policy.fix_strategy' must be one of: ${VALID_FIX_STRATEGIES.join(", ")}.`, 2);
  }
  const allowed_types = Array.from(new Set(requireStringArrayField(obj, "allowed_types", file).map((s) => s.trim()))).filter((s) => s.length > 0);
  if (allowed_types.length === 0) {
    throw new NovelCliError(`Invalid ${file}: 'hook_policy.allowed_types' must be a non-empty string array.`, 2);
  }
  return {
    required: requireBoolField(obj, "required", file),
    min_strength,
    allowed_types,
    fix_strategy
  };
}

function parseScoringPolicy(raw: unknown, file: string): ScoringPolicy {
  if (!isPlainObject(raw)) throw new NovelCliError(`Invalid ${file}: 'scoring' must be an object.`, 2);
  const obj = raw as Record<string, unknown>;
  const out: ScoringPolicy = {
    genre_drive_type: requireStringField(obj, "genre_drive_type", file),
    weight_profile_id: requireStringField(obj, "weight_profile_id", file)
  };
  if (obj.weight_overrides !== undefined) {
    if (!isPlainObject(obj.weight_overrides)) throw new NovelCliError(`Invalid ${file}: 'scoring.weight_overrides' must be an object.`, 2);
    const wo = obj.weight_overrides as Record<string, unknown>;
    const overrides: Record<string, number> = {};
    for (const [k, v] of Object.entries(wo)) {
      if (typeof v !== "number" || !Number.isFinite(v)) throw new NovelCliError(`Invalid ${file}: 'scoring.weight_overrides.${k}' must be a number.`, 2);
      overrides[k] = v;
    }
    out.weight_overrides = overrides;
  }
  return out;
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

  const hook_policy = isPlainObject(obj.hook_policy) ? parseHookPolicy(obj.hook_policy, file) : undefined;
  const scoring = isPlainObject(obj.scoring) ? parseScoringPolicy(obj.scoring, file) : undefined;

  return { schema_version, platform, created_at, word_count, info_load, compliance, hook_policy, scoring };
}

export async function loadPlatformProfile(rootDir: string): Promise<{ relPath: string; profile: PlatformProfile } | null> {
  const relPath = "platform-profile.json";
  const absPath = join(rootDir, relPath);
  if (!(await pathExists(absPath))) return null;
  const raw = await readJsonFile(absPath);
  return { relPath, profile: parsePlatformProfile(raw, relPath) };
}
