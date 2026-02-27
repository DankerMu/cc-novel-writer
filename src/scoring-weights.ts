import { join } from "node:path";

import { NovelCliError } from "./errors.js";
import { pathExists, readJsonFile, writeJsonFile } from "./fs-utils.js";
import type { HookPolicy, PlatformProfile, ScoringPolicy } from "./platform-profile.js";
import { isPlainObject } from "./type-guards.js";

type NormalizationSpec = {
  method: "scale_to_sum";
  sum_to: number;
  tolerance: number;
};

const CORE_DIMENSIONS = [
  "plot_logic",
  "character",
  "immersion",
  "foreshadowing",
  "pacing",
  "style_naturalness",
  "emotional_impact",
  "storyline_coherence",
] as const;

const OPTIONAL_DIMENSIONS = ["hook_strength"] as const;

const KNOWN_DIMENSIONS = new Set<string>([...CORE_DIMENSIONS, ...OPTIONAL_DIMENSIONS]);

export type GenreWeightProfilesConfig = {
  schema_version: 1;
  description?: string;
  last_updated?: string;
  dimensions: string[];
  normalization: NormalizationSpec;
  default_profile_by_drive_type: Record<string, string>;
  profiles: Record<
    string,
    {
      drive_type: string;
      weights: Record<string, number>;
    }
  >;
};

export type EffectiveScoringWeights = {
  genre_drive_type: string;
  weight_profile_id: string;
  weight_overrides: Record<string, number> | null;
  dimensions: string[];
  weights: Record<string, number>;
  normalization: NormalizationSpec & { sum_before: number; scale_factor: number; sum_after: number };
};

function requireIntField(obj: Record<string, unknown>, field: string, file: string): number {
  const v = obj[field];
  if (typeof v !== "number" || !Number.isInteger(v)) throw new NovelCliError(`Invalid ${file}: '${field}' must be an int.`, 2);
  return v;
}

function requireStringField(obj: Record<string, unknown>, field: string, file: string): string {
  const v = obj[field];
  if (typeof v !== "string" || v.trim().length === 0) throw new NovelCliError(`Invalid ${file}: '${field}' must be a non-empty string.`, 2);
  return v.trim();
}

function requireFiniteNonNegativeNumber(value: unknown, file: string, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new NovelCliError(`Invalid ${file}: '${field}' must be a finite number >= 0.`, 2);
  }
  return value;
}

function requireStringArrayField(obj: Record<string, unknown>, field: string, file: string): string[] {
  const v = obj[field];
  if (!Array.isArray(v) || !v.every((s) => typeof s === "string" && s.trim().length > 0)) {
    throw new NovelCliError(`Invalid ${file}: '${field}' must be a non-empty string array.`, 2);
  }
  const uniq = Array.from(new Set(v.map((s) => s.trim()))).filter((s) => s.length > 0);
  if (uniq.length === 0) throw new NovelCliError(`Invalid ${file}: '${field}' must be a non-empty string array.`, 2);
  return uniq;
}

function parseNormalizationSpec(raw: unknown, file: string): NormalizationSpec {
  if (!isPlainObject(raw)) throw new NovelCliError(`Invalid ${file}: 'normalization' must be an object.`, 2);
  const obj = raw as Record<string, unknown>;
  const method = requireStringField(obj, "method", file);
  if (method !== "scale_to_sum") {
    throw new NovelCliError(`Invalid ${file}: 'normalization.method' must be 'scale_to_sum'.`, 2);
  }
  const sum_to = requireFiniteNonNegativeNumber(obj.sum_to, file, "normalization.sum_to");
  if (sum_to <= 0) throw new NovelCliError(`Invalid ${file}: 'normalization.sum_to' must be > 0.`, 2);
  const tolerance = requireFiniteNonNegativeNumber(obj.tolerance, file, "normalization.tolerance");
  return { method: "scale_to_sum", sum_to, tolerance };
}

export function parseGenreWeightProfiles(raw: unknown, file: string): GenreWeightProfilesConfig {
  if (!isPlainObject(raw)) throw new NovelCliError(`Invalid ${file}: expected a JSON object.`, 2);
  const obj = raw as Record<string, unknown>;

  const schema_version = requireIntField(obj, "schema_version", file);
  if (schema_version !== 1) throw new NovelCliError(`Invalid ${file}: 'schema_version' must be 1.`, 2);

  const dimensions = requireStringArrayField(obj, "dimensions", file);
  for (const dim of dimensions) {
    if (!KNOWN_DIMENSIONS.has(dim)) {
      throw new NovelCliError(
        `Invalid ${file}: unknown dimension '${dim}' in dimensions (allowed: ${Array.from(KNOWN_DIMENSIONS).join(", ")}).`,
        2
      );
    }
  }
  for (const required of CORE_DIMENSIONS) {
    if (!dimensions.includes(required)) {
      throw new NovelCliError(`Invalid ${file}: dimensions missing required core dimension '${required}'.`, 2);
    }
  }
  const normalization = parseNormalizationSpec(obj.normalization, file);

  if (!isPlainObject(obj.default_profile_by_drive_type)) {
    throw new NovelCliError(`Invalid ${file}: 'default_profile_by_drive_type' must be an object.`, 2);
  }
  const dp = obj.default_profile_by_drive_type as Record<string, unknown>;
  const default_profile_by_drive_type: Record<string, string> = {};
  for (const [k, v] of Object.entries(dp)) {
    if (typeof v !== "string" || v.trim().length === 0) {
      throw new NovelCliError(`Invalid ${file}: 'default_profile_by_drive_type.${k}' must be a non-empty string.`, 2);
    }
    default_profile_by_drive_type[k.trim()] = v.trim();
  }

  if (!isPlainObject(obj.profiles)) throw new NovelCliError(`Invalid ${file}: 'profiles' must be an object.`, 2);
  const profilesRaw = obj.profiles as Record<string, unknown>;
  const profiles: GenreWeightProfilesConfig["profiles"] = {};

  const allowedDims = new Set(dimensions);

  for (const [profileId, profileRaw] of Object.entries(profilesRaw)) {
    if (!isPlainObject(profileRaw)) throw new NovelCliError(`Invalid ${file}: 'profiles.${profileId}' must be an object.`, 2);
    const p = profileRaw as Record<string, unknown>;
    const drive_type = requireStringField(p, "drive_type", file);
    if (!isPlainObject(p.weights)) throw new NovelCliError(`Invalid ${file}: 'profiles.${profileId}.weights' must be an object.`, 2);
    const weightsRaw = p.weights as Record<string, unknown>;

    const weights: Record<string, number> = {};
    for (const [dim, val] of Object.entries(weightsRaw)) {
      if (!allowedDims.has(dim)) {
        throw new NovelCliError(
          `Invalid ${file}: unknown dimension '${dim}' in profiles.${profileId}.weights (allowed: ${dimensions.join(", ")}).`,
          2
        );
      }
      weights[dim] = requireFiniteNonNegativeNumber(val, file, `profiles.${profileId}.weights.${dim}`);
    }

    for (const dim of dimensions) {
      if (!(dim in weights)) {
        throw new NovelCliError(`Invalid ${file}: profiles.${profileId}.weights missing required dimension '${dim}'.`, 2);
      }
    }

    profiles[profileId] = { drive_type, weights };
  }

  // Validate default profile references.
  for (const [driveType, profileId] of Object.entries(default_profile_by_drive_type)) {
    const p = profiles[profileId];
    if (!p) throw new NovelCliError(`Invalid ${file}: default_profile_by_drive_type.${driveType} references missing profile '${profileId}'.`, 2);
    if (p.drive_type !== driveType) {
      throw new NovelCliError(
        `Invalid ${file}: default_profile_by_drive_type.${driveType} references profile '${profileId}' with drive_type='${p.drive_type}'.`,
        2
      );
    }
  }

  const out: GenreWeightProfilesConfig = {
    schema_version: 1,
    dimensions,
    normalization,
    default_profile_by_drive_type,
    profiles
  };

  if (typeof obj.description === "string" && obj.description.trim().length > 0) out.description = obj.description.trim();
  if (typeof obj.last_updated === "string" && obj.last_updated.trim().length > 0) out.last_updated = obj.last_updated.trim();

  // Validate normalizability for each profile.
  for (const [profileId, p] of Object.entries(profiles)) {
    const sum = dimensions.reduce((acc, dim) => acc + p.weights[dim]!, 0);
    if (!Number.isFinite(sum) || sum <= 0) {
      throw new NovelCliError(`Invalid ${file}: profiles.${profileId} weights must have sum > 0 (got ${String(sum)}).`, 2);
    }
    const scale = normalization.sum_to / sum;
    const sumAfter = dimensions.reduce((acc, dim) => acc + p.weights[dim]! * scale, 0);
    if (Math.abs(sumAfter - normalization.sum_to) > normalization.tolerance) {
      throw new NovelCliError(
        `Invalid ${file}: profiles.${profileId} weights are not normalizable within tolerance (sum_after=${sumAfter}, expected ${normalization.sum_to}±${normalization.tolerance}).`,
        2
      );
    }
  }

  return out;
}

export async function loadGenreWeightProfiles(rootDir: string): Promise<{ relPath: string; config: GenreWeightProfilesConfig } | null> {
  const relPath = "genre-weight-profiles.json";
  const absPath = join(rootDir, relPath);
  if (!(await pathExists(absPath))) return null;
  const raw = await readJsonFile(absPath);
  return { relPath, config: parseGenreWeightProfiles(raw, relPath) };
}

function normalizeWeights(args: { dimensions: string[]; normalization: NormalizationSpec; weights: Record<string, number>; fileHint: string }): EffectiveScoringWeights["normalization"] {
  const sum_before = args.dimensions.reduce((acc, dim) => acc + (args.weights[dim] ?? 0), 0);
  if (!Number.isFinite(sum_before) || sum_before <= 0) {
    throw new NovelCliError(`Invalid scoring weights (${args.fileHint}): weights must have sum > 0 (got ${String(sum_before)}).`, 2);
  }
  const scale_factor = args.normalization.sum_to / sum_before;
  const sum_after = args.dimensions.reduce((acc, dim) => acc + (args.weights[dim] ?? 0) * scale_factor, 0);
  if (Math.abs(sum_after - args.normalization.sum_to) > args.normalization.tolerance) {
    throw new NovelCliError(
      `Invalid scoring weights (${args.fileHint}): weights are not normalizable within tolerance (sum_after=${sum_after}, expected ${args.normalization.sum_to}±${args.normalization.tolerance}).`,
      2
    );
  }
  return { ...args.normalization, sum_before, scale_factor, sum_after };
}

export function computeEffectiveScoringWeights(args: {
  config: GenreWeightProfilesConfig;
  scoring: ScoringPolicy;
  hookPolicy?: HookPolicy | undefined;
}): EffectiveScoringWeights {
  const driveType = args.scoring.genre_drive_type;
  const selectedProfileId = args.scoring.weight_profile_id;

  const profile = args.config.profiles[selectedProfileId];
  if (!profile) {
    const known = Object.keys(args.config.profiles).sort();
    const hint = known.length > 0 ? ` Known profiles: ${known.join(", ")}` : "";
    throw new NovelCliError(`Invalid platform-profile.json: scoring.weight_profile_id='${selectedProfileId}' not found in genre-weight-profiles.json.${hint}`, 2);
  }
  if (profile.drive_type !== driveType) {
    throw new NovelCliError(
      `Invalid platform-profile.json: scoring.genre_drive_type='${driveType}' does not match selected profile '${selectedProfileId}' (drive_type='${profile.drive_type}').`,
      2
    );
  }

  // When hook policy is enabled, hook_strength should be a first-class dimension.
  const dims = args.config.dimensions;
  if (args.hookPolicy?.required && !dims.includes("hook_strength")) {
    throw new NovelCliError(
      `Invalid genre-weight-profiles.json: missing 'hook_strength' in dimensions while platform-profile.json.hook_policy.required=true.`,
      2
    );
  }

  const overridesRaw = args.scoring.weight_overrides ?? null;
  const overrides: Record<string, number> | null = overridesRaw ? { ...overridesRaw } : null;

  const allowedDims = new Set(dims);
  if (overrides) {
    for (const [dim, v] of Object.entries(overrides)) {
      if (!allowedDims.has(dim)) {
        throw new NovelCliError(
          `Invalid platform-profile.json: scoring.weight_overrides has unknown dimension '${dim}' (allowed: ${dims.join(", ")}).`,
          2
        );
      }
      overrides[dim] = requireFiniteNonNegativeNumber(v, "platform-profile.json", `scoring.weight_overrides.${dim}`);
    }
  }

  const rawWeights: Record<string, number> = {};
  for (const dim of dims) {
    rawWeights[dim] = typeof overrides?.[dim] === "number" ? overrides[dim]! : profile.weights[dim]!;
  }

  // If hooks are not enabled, hook_strength must not influence overall scoring.
  if (!args.hookPolicy?.required && dims.includes("hook_strength")) {
    const overrideWeight = overrides?.hook_strength;
    if (typeof overrideWeight === "number" && overrideWeight > 0) {
      throw new NovelCliError(
        `Invalid platform-profile.json: scoring.weight_overrides.hook_strength=${overrideWeight} but hook_policy.required=false. Set hook_strength override to 0 or enable hook_policy.required.`,
        2
      );
    }
    rawWeights.hook_strength = 0;
  }

  const normalization = normalizeWeights({
    dimensions: dims,
    normalization: args.config.normalization,
    weights: rawWeights,
    fileHint: "platform-profile.json.scoring + genre-weight-profiles.json"
  });

  const weights: Record<string, number> = {};
  for (const dim of dims) {
    weights[dim] = rawWeights[dim]! * normalization.scale_factor;
  }

  return {
    genre_drive_type: driveType,
    weight_profile_id: selectedProfileId,
    weight_overrides: overrides,
    dimensions: dims,
    weights,
    normalization
  };
}

function getScoresTargets(evalObj: Record<string, unknown>): Array<{ scores: Record<string, unknown>; path: string }> {
  const targets: Array<{ scores: Record<string, unknown>; path: string }> = [];

  const evalUsed = evalObj.eval_used;
  if (isPlainObject(evalUsed) && isPlainObject((evalUsed as Record<string, unknown>).scores)) {
    targets.push({ scores: (evalUsed as Record<string, unknown>).scores as Record<string, unknown>, path: "eval_used.scores" });
  }

  const topScores = evalObj.scores;
  if (isPlainObject(topScores)) {
    targets.push({ scores: topScores as Record<string, unknown>, path: "scores" });
  }

  return targets;
}

export async function attachScoringWeightsToEval(args: {
  evalAbsPath: string;
  evalRelPath: string;
  platformProfile: PlatformProfile;
  genreWeightProfiles: { relPath: string; config: GenreWeightProfilesConfig };
}): Promise<void> {
  const scoring = args.platformProfile.scoring;
  if (!scoring) return;

  const effective = computeEffectiveScoringWeights({
    config: args.genreWeightProfiles.config,
    scoring,
    hookPolicy: args.platformProfile.hook_policy
  });

  const raw = await readJsonFile(args.evalAbsPath);
  if (!isPlainObject(raw)) throw new NovelCliError(`Invalid ${args.evalRelPath}: eval JSON must be an object.`, 2);
  const obj = raw as Record<string, unknown>;

  obj.scoring_weights = {
    genre_drive_type: effective.genre_drive_type,
    weight_profile_id: effective.weight_profile_id,
    weight_overrides: effective.weight_overrides,
    dimensions: effective.dimensions,
    weights: effective.weights,
    normalization: effective.normalization,
    source: {
      platform_profile: "platform-profile.json",
      genre_weight_profiles: args.genreWeightProfiles.relPath
    }
  };

  const targets = getScoresTargets(obj);
  if (targets.length === 0) {
    throw new NovelCliError(
      `Invalid ${args.evalRelPath}: missing scores object (expected 'scores' or 'eval_used.scores'); cannot attach per-dimension weights.`,
      2
    );
  }

  for (const target of targets) {
    for (const dim of effective.dimensions) {
      const entry = target.scores[dim];
      if (!isPlainObject(entry)) continue;
      (entry as Record<string, unknown>).weight = effective.weights[dim] ?? 0;
    }
  }

  await writeJsonFile(args.evalAbsPath, obj);
}
