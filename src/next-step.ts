import { join } from "node:path";

import type { Checkpoint } from "./checkpoint.js";
import { pathExists } from "./fs-utils.js";
import { chapterRelPaths, formatStepId } from "./steps.js";

export type NextStepResult = {
  step: string;
  reason: string;
  inflight: { chapter: number | null; pipeline_stage: string | null };
  evidence?: Record<string, unknown>;
};

function normalizeStage(stage: unknown): string | null {
  if (stage === null || stage === undefined) return null;
  if (typeof stage === "string") return stage;
  return null;
}

export async function computeNextStep(projectRootDir: string, checkpoint: Checkpoint): Promise<NextStepResult> {
  const inflightChapter = typeof checkpoint.inflight_chapter === "number" ? checkpoint.inflight_chapter : null;
  const stage = normalizeStage(checkpoint.pipeline_stage);

  // Fresh start.
  if (inflightChapter === null || stage === null || stage === "committed") {
    const nextChapter = checkpoint.last_completed_chapter + 1;
    return {
      step: formatStepId({ kind: "chapter", chapter: nextChapter, stage: "draft" }),
      reason: "fresh",
      inflight: { chapter: null, pipeline_stage: stage }
    };
  }

  const rel = chapterRelPaths(inflightChapter);
  const hasChapter = await pathExists(join(projectRootDir, rel.staging.chapterMd));
  const hasSummary = await pathExists(join(projectRootDir, rel.staging.summaryMd));
  const hasDelta = await pathExists(join(projectRootDir, rel.staging.deltaJson));
  const hasCrossref = await pathExists(join(projectRootDir, rel.staging.crossrefJson));
  const hasEval = await pathExists(join(projectRootDir, rel.staging.evalJson));

  const evidence = { hasChapter, hasSummary, hasDelta, hasCrossref, hasEval };

  // Resume rules (aligned with skills/continue).
  if (stage === "drafting" || stage === "revising") {
    if (!hasChapter) {
      return {
        step: formatStepId({ kind: "chapter", chapter: inflightChapter, stage: "draft" }),
        reason: `${stage}:missing_chapter`,
        inflight: { chapter: inflightChapter, pipeline_stage: stage },
        evidence
      };
    }
    if (!hasSummary || !hasDelta || !hasCrossref) {
      return {
        step: formatStepId({ kind: "chapter", chapter: inflightChapter, stage: "summarize" }),
        reason: `${stage}:missing_summary`,
        inflight: { chapter: inflightChapter, pipeline_stage: stage },
        evidence
      };
    }
    return {
      step: formatStepId({ kind: "chapter", chapter: inflightChapter, stage: "refine" }),
      reason: `${stage}:ready_refine`,
      inflight: { chapter: inflightChapter, pipeline_stage: stage },
      evidence
    };
  }

  if (stage === "drafted") {
    if (!hasChapter) {
      return {
        step: formatStepId({ kind: "chapter", chapter: inflightChapter, stage: "draft" }),
        reason: "drafted:missing_chapter",
        inflight: { chapter: inflightChapter, pipeline_stage: stage },
        evidence
      };
    }
    if (!hasSummary || !hasDelta || !hasCrossref) {
      return {
        step: formatStepId({ kind: "chapter", chapter: inflightChapter, stage: "summarize" }),
        reason: "drafted:missing_summary",
        inflight: { chapter: inflightChapter, pipeline_stage: stage },
        evidence
      };
    }
    return {
      step: formatStepId({ kind: "chapter", chapter: inflightChapter, stage: "refine" }),
      reason: "drafted:resume_refine",
      inflight: { chapter: inflightChapter, pipeline_stage: stage },
      evidence
    };
  }

  if (stage === "refined") {
    if (!hasEval) {
      return {
        step: formatStepId({ kind: "chapter", chapter: inflightChapter, stage: "judge" }),
        reason: "refined:missing_eval",
        inflight: { chapter: inflightChapter, pipeline_stage: stage },
        evidence
      };
    }
    return {
      step: formatStepId({ kind: "chapter", chapter: inflightChapter, stage: "commit" }),
      reason: "refined:ready_commit",
      inflight: { chapter: inflightChapter, pipeline_stage: stage },
      evidence
    };
  }

  if (stage === "judged") {
    if (!hasEval) {
      return {
        step: formatStepId({ kind: "chapter", chapter: inflightChapter, stage: "judge" }),
        reason: "judged:missing_eval",
        inflight: { chapter: inflightChapter, pipeline_stage: stage },
        evidence
      };
    }
    return {
      step: formatStepId({ kind: "chapter", chapter: inflightChapter, stage: "commit" }),
      reason: "judged:ready_commit",
      inflight: { chapter: inflightChapter, pipeline_stage: stage },
      evidence
    };
  }

  // Unknown stage: fall back to safest.
  return {
    step: formatStepId({ kind: "chapter", chapter: inflightChapter, stage: "draft" }),
    reason: `unknown_stage:${stage}`,
    inflight: { chapter: inflightChapter, pipeline_stage: stage },
    evidence
  };
}

