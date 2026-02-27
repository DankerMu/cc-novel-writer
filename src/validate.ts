import { join } from "node:path";

import { NovelCliError } from "./errors.js";
import type { Checkpoint } from "./checkpoint.js";
import { pathExists, readJsonFile, readTextFile } from "./fs-utils.js";
import { rejectPathTraversalInput } from "./safe-path.js";
import { chapterRelPaths, formatStepId, type Step } from "./steps.js";
import { isPlainObject } from "./type-guards.js";

export type ValidateReport = {
  ok: true;
  step: string;
  warnings: string[];
};

function requireFile(exists: boolean, relPath: string): void {
  if (!exists) throw new NovelCliError(`Missing required file: ${relPath}`, 2);
}

function requireStringField(obj: Record<string, unknown>, field: string, file: string): string {
  const v = obj[field];
  if (typeof v !== "string" || v.length === 0) throw new NovelCliError(`Invalid ${file}: missing string field '${field}'.`, 2);
  return v;
}

function requireNumberField(obj: Record<string, unknown>, field: string, file: string): number {
  const v = obj[field];
  if (typeof v !== "number" || !Number.isFinite(v)) throw new NovelCliError(`Invalid ${file}: missing number field '${field}'.`, 2);
  return v;
}

export async function validateStep(args: { rootDir: string; checkpoint: Checkpoint; step: Step }): Promise<ValidateReport> {
  const warnings: string[] = [];
  const stepId = formatStepId(args.step);

  if (args.step.kind !== "chapter") {
    throw new NovelCliError(`Unsupported step: ${stepId}`, 2);
  }

  const rel = chapterRelPaths(args.step.chapter);

  if (args.step.stage === "draft") {
    const absChapter = join(args.rootDir, rel.staging.chapterMd);
    const exists = await pathExists(absChapter);
    requireFile(exists, rel.staging.chapterMd);
    const content = await readTextFile(absChapter);
    if (content.trim().length === 0) throw new NovelCliError(`Empty draft file: ${rel.staging.chapterMd}`, 2);
    return { ok: true, step: stepId, warnings };
  }

  if (args.step.stage === "summarize") {
    requireFile(await pathExists(join(args.rootDir, rel.staging.chapterMd)), rel.staging.chapterMd);
    requireFile(await pathExists(join(args.rootDir, rel.staging.summaryMd)), rel.staging.summaryMd);
    requireFile(await pathExists(join(args.rootDir, rel.staging.deltaJson)), rel.staging.deltaJson);
    requireFile(await pathExists(join(args.rootDir, rel.staging.crossrefJson)), rel.staging.crossrefJson);

    const deltaRaw = await readJsonFile(join(args.rootDir, rel.staging.deltaJson));
    if (!isPlainObject(deltaRaw)) throw new NovelCliError(`Invalid delta JSON: ${rel.staging.deltaJson} must be an object.`, 2);
    const delta = deltaRaw as Record<string, unknown>;
    const chapter = requireNumberField(delta, "chapter", rel.staging.deltaJson);
    if (chapter !== args.step.chapter) warnings.push(`Delta.chapter is ${chapter}, expected ${args.step.chapter}.`);
    const storylineId = requireStringField(delta, "storyline_id", rel.staging.deltaJson);
    rejectPathTraversalInput(storylineId, "delta.storyline_id");
    const memoryRel = chapterRelPaths(args.step.chapter, storylineId).staging.storylineMemoryMd;
    if (!memoryRel) throw new NovelCliError(`Internal error: storyline memory path is null`, 2);
    requireFile(await pathExists(join(args.rootDir, memoryRel)), memoryRel);

    // Crossref sanity.
    const crossrefRaw = await readJsonFile(join(args.rootDir, rel.staging.crossrefJson));
    if (!isPlainObject(crossrefRaw)) throw new NovelCliError(`Invalid crossref JSON: ${rel.staging.crossrefJson} must be an object.`, 2);
    return { ok: true, step: stepId, warnings };
  }

  if (args.step.stage === "refine") {
    requireFile(await pathExists(join(args.rootDir, rel.staging.chapterMd)), rel.staging.chapterMd);
    const changesExists = await pathExists(join(args.rootDir, rel.staging.styleRefinerChangesJson));
    if (!changesExists) warnings.push(`Missing optional changes log: ${rel.staging.styleRefinerChangesJson}`);
    return { ok: true, step: stepId, warnings };
  }

  if (args.step.stage === "judge") {
    requireFile(await pathExists(join(args.rootDir, rel.staging.chapterMd)), rel.staging.chapterMd);
    requireFile(await pathExists(join(args.rootDir, rel.staging.evalJson)), rel.staging.evalJson);
    const evalRaw = await readJsonFile(join(args.rootDir, rel.staging.evalJson));
    if (!isPlainObject(evalRaw)) throw new NovelCliError(`Invalid eval JSON: ${rel.staging.evalJson} must be an object.`, 2);
    const evalObj = evalRaw as Record<string, unknown>;
    const chapter = requireNumberField(evalObj, "chapter", rel.staging.evalJson);
    if (chapter !== args.step.chapter) warnings.push(`Eval.chapter is ${chapter}, expected ${args.step.chapter}.`);
    requireNumberField(evalObj, "overall", rel.staging.evalJson);
    requireStringField(evalObj, "recommendation", rel.staging.evalJson);
    return { ok: true, step: stepId, warnings };
  }

  if (args.step.stage === "commit") {
    throw new NovelCliError(`Use 'novel commit --chapter ${args.step.chapter}' for commit.`, 2);
  }

  throw new NovelCliError(`Unsupported step: ${stepId}`, 2);
}
