import type { HookPolicy } from "./platform-profile.js";
import { isPlainObject } from "./type-guards.js";

type HookEvalExtract = {
  present: boolean | null;
  type: string | null;
  evidence: string | null;
  strength: number | null;
};

export type HookPolicyCheckResult =
  | { status: "skipped"; reason: string }
  | { status: "invalid_eval"; reason: string; extracted: HookEvalExtract }
  | { status: "fail"; reason: string; extracted: HookEvalExtract }
  | { status: "pass"; reason: string; extracted: HookEvalExtract };

function asBool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function extractHookStrength(evalObj: Record<string, unknown>): { strength: number | null; evidence: string | null } {
  const scoresRaw = evalObj.scores;
  if (isPlainObject(scoresRaw)) {
    const hsRaw = (scoresRaw as Record<string, unknown>).hook_strength;
    if (isPlainObject(hsRaw)) {
      const score = asNumber((hsRaw as Record<string, unknown>).score);
      const evidence = asString((hsRaw as Record<string, unknown>).evidence);
      return { strength: score, evidence };
    }
  }

  const legacyStrength = asNumber(evalObj.hook_strength);
  if (legacyStrength !== null) return { strength: legacyStrength, evidence: null };

  const hookRaw = evalObj.hook;
  if (isPlainObject(hookRaw)) {
    const strength = asNumber((hookRaw as Record<string, unknown>).strength);
    const evidence = asString((hookRaw as Record<string, unknown>).evidence);
    return { strength, evidence };
  }

  return { strength: null, evidence: null };
}

function extractHook(evalObj: Record<string, unknown>): { present: boolean | null; type: string | null; evidence: string | null } {
  const hookRaw = evalObj.hook;
  if (!isPlainObject(hookRaw)) return { present: null, type: null, evidence: null };
  const hookObj = hookRaw as Record<string, unknown>;
  return {
    present: asBool(hookObj.present),
    type: asString(hookObj.type),
    evidence: asString(hookObj.evidence)
  };
}

function strengthInRange(strength: number | null): strength is number {
  return strength !== null && strength >= 1 && strength <= 5;
}

export function checkHookPolicy(args: { hookPolicy: HookPolicy; evalRaw: unknown }): HookPolicyCheckResult {
  if (!args.hookPolicy.required) {
    return { status: "skipped", reason: "hook_policy.required=false" };
  }

  if (!isPlainObject(args.evalRaw)) {
    return {
      status: "invalid_eval",
      reason: "eval is not a JSON object",
      extracted: { present: null, type: null, evidence: null, strength: null }
    };
  }

  const evalObj = args.evalRaw as Record<string, unknown>;
  const { strength, evidence: strengthEvidence } = extractHookStrength(evalObj);
  const hook = extractHook(evalObj);
  const extracted: HookEvalExtract = { ...hook, strength };

  if (!strengthInRange(strength)) {
    return { status: "invalid_eval", reason: "missing or invalid scores.hook_strength.score (expected 1-5)", extracted };
  }

  if (hook.present === null) {
    return { status: "invalid_eval", reason: "missing hook.present (expected boolean)", extracted };
  }

  if (hook.type === null) {
    return { status: "invalid_eval", reason: "missing hook.type (expected non-empty string or 'none')", extracted };
  }

  const evidence = hook.evidence ?? strengthEvidence;
  if (evidence === null) {
    return { status: "invalid_eval", reason: "missing hook evidence snippet (expected hook.evidence or scores.hook_strength.evidence)", extracted };
  }

  const allowed = Array.isArray(args.hookPolicy.allowed_types) ? args.hookPolicy.allowed_types : [];
  const minStrength = typeof args.hookPolicy.min_strength === "number" ? args.hookPolicy.min_strength : 1;

  if (!hook.present || hook.type === "none") {
    return {
      status: "fail",
      reason: "missing chapter-end hook",
      extracted: { ...extracted, evidence }
    };
  }

  if (allowed.length > 0 && !allowed.includes(hook.type)) {
    return {
      status: "fail",
      reason: `hook.type not allowed: ${hook.type}`,
      extracted: { ...extracted, evidence }
    };
  }

  if (strength < minStrength) {
    return {
      status: "fail",
      reason: `hook_strength ${strength} < min_strength ${minStrength}`,
      extracted: { ...extracted, evidence }
    };
  }

  return { status: "pass", reason: "hook policy satisfied", extracted: { ...extracted, evidence } };
}
