import type { Checkpoint, PipelineStage } from "./checkpoint.js";
import { readCheckpoint, writeCheckpoint } from "./checkpoint.js";
import { NovelCliError } from "./errors.js";
import { removePath } from "./fs-utils.js";
import { withWriteLock } from "./lock.js";
import { chapterRelPaths, type Step } from "./steps.js";
import { validateStep } from "./validate.js";
import { join } from "node:path";

function stageForStep(step: Step): PipelineStage {
  if (step.kind !== "chapter") throw new NovelCliError(`Unsupported step kind: ${step.kind}`, 2);
  switch (step.stage) {
    case "draft":
      return "drafting";
    case "summarize":
      return "drafted";
    case "refine":
      return "refined";
    case "judge":
      return "judged";
    case "hook-fix":
      return "refined";
    case "review":
      return "judged";
    case "commit":
      return "committed";
  }
}

export async function advanceCheckpointForStep(args: { rootDir: string; step: Step }): Promise<Checkpoint> {
  if (args.step.kind !== "chapter") throw new NovelCliError(`Unsupported step kind: ${args.step.kind}`, 2);
  if (args.step.stage === "commit") throw new NovelCliError(`Use 'novel commit' for commit.`, 2);
  if (args.step.stage === "review") throw new NovelCliError(`Review is a manual step; do not advance it.`, 2);

  return await withWriteLock(args.rootDir, { chapter: args.step.chapter }, async () => {
    const checkpoint = await readCheckpoint(args.rootDir);

    // Enforce validate-before-advance to keep deterministic semantics.
    await validateStep({ rootDir: args.rootDir, checkpoint, step: args.step });

    const updated: Checkpoint = { ...checkpoint };
    const nextStage = stageForStep(args.step);

    updated.pipeline_stage = nextStage;
    updated.inflight_chapter = args.step.chapter;

    // Reset revision counter when (re)starting a chapter from draft.
    if (args.step.stage === "draft") {
      if (typeof updated.revision_count !== "number") updated.revision_count = 0;
    }

    // Hook-fix counts as a bounded micro-revision and invalidates the current eval.
    if (args.step.stage === "hook-fix") {
      const prev = typeof updated.hook_fix_count === "number" ? updated.hook_fix_count : 0;
      updated.hook_fix_count = prev + 1;
      const rel = chapterRelPaths(args.step.chapter);
      await removePath(join(args.rootDir, rel.staging.evalJson));
    }

    updated.last_checkpoint_time = new Date().toISOString();

    await writeCheckpoint(args.rootDir, updated);
    return updated;
  });
}
