import type { Checkpoint, PipelineStage } from "./checkpoint.js";
import { writeCheckpoint } from "./checkpoint.js";
import { NovelCliError } from "./errors.js";
import { withWriteLock } from "./lock.js";
import type { Step } from "./steps.js";
import { validateStep } from "./validate.js";

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
    case "commit":
      return "committed";
  }
}

export async function advanceCheckpointForStep(args: { rootDir: string; checkpoint: Checkpoint; step: Step }): Promise<Checkpoint> {
  // Enforce validate-before-advance to keep deterministic semantics.
  await validateStep({ rootDir: args.rootDir, checkpoint: args.checkpoint, step: args.step });

  if (args.step.kind !== "chapter") throw new NovelCliError(`Unsupported step kind: ${args.step.kind}`, 2);
  if (args.step.stage === "commit") throw new NovelCliError(`Use 'novel commit' for commit.`, 2);

  const updated: Checkpoint = { ...args.checkpoint };
  const nextStage = stageForStep(args.step);

  updated.pipeline_stage = nextStage;
  updated.inflight_chapter = args.step.chapter;

  // Reset revision counter when (re)starting a chapter from draft.
  if (args.step.stage === "draft") {
    if (typeof updated.revision_count !== "number") updated.revision_count = 0;
  }

  updated.last_checkpoint_time = new Date().toISOString();

  await withWriteLock(args.rootDir, { chapter: args.step.chapter }, async () => {
    await writeCheckpoint(args.rootDir, updated);
  });

  return updated;
}

