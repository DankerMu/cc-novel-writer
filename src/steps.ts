import { NovelCliError } from "./errors.js";

export const CHAPTER_STAGES = ["draft", "summarize", "refine", "judge", "title-fix", "hook-fix", "review", "commit"] as const;
export type ChapterStage = (typeof CHAPTER_STAGES)[number];

export type ChapterStep = {
  kind: "chapter";
  chapter: number;
  stage: ChapterStage;
};

export type Step = ChapterStep;

export function pad3(n: number): string {
  return String(n).padStart(3, "0");
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function titleFixSnapshotRel(chapter: number): string {
  return `staging/logs/title-fix-chapter-${pad3(chapter)}-before.md`;
}

export function formatStepId(step: Step): string {
  if (step.kind !== "chapter") throw new NovelCliError(`Unsupported step kind: ${(step as Step).kind}`, 2);
  return `chapter:${pad3(step.chapter)}:${step.stage}`;
}

export function parseStepId(input: string): Step {
  const trimmed = input.trim();
  const parts = trimmed.split(":");
  if (parts.length !== 3) {
    throw new NovelCliError(`Invalid step id: ${input}. Expected format: chapter:048:draft`, 2);
  }
  const [kind, chapterRaw, stageRaw] = parts as [string, string, string];
  if (kind !== "chapter") throw new NovelCliError(`Invalid step id: ${input}. Only 'chapter' steps are supported.`, 2);
  if (!/^\d+$/.test(chapterRaw)) throw new NovelCliError(`Invalid step id: ${input}. Chapter must be a number.`, 2);
  const chapter = Number.parseInt(chapterRaw, 10);
  if (!Number.isInteger(chapter) || chapter <= 0) {
    throw new NovelCliError(`Invalid step id: ${input}. Chapter must be an int >= 1.`, 2);
  }
  if (!CHAPTER_STAGES.includes(stageRaw as ChapterStage)) {
    throw new NovelCliError(`Invalid step id: ${input}. Stage must be one of: ${CHAPTER_STAGES.join(", ")}`, 2);
  }
  return { kind: "chapter", chapter, stage: stageRaw as ChapterStage };
}

export function chapterRelPaths(chapter: number, storylineId?: string): {
  staging: {
    chapterMd: string;
    summaryMd: string;
    deltaJson: string;
    crossrefJson: string;
    evalJson: string;
    styleRefinerChangesJson: string;
    storylineMemoryMd: string | null;
  };
  final: {
    chapterMd: string;
    summaryMd: string;
    evalJson: string;
    crossrefJson: string;
    storylineMemoryMd: string | null;
    foreshadowGlobalJson: string;
    stateCurrentJson: string;
    stateChangelogJsonl: string;
  };
} {
  const id = pad3(chapter);
  return {
    staging: {
      chapterMd: `staging/chapters/chapter-${id}.md`,
      summaryMd: `staging/summaries/chapter-${id}-summary.md`,
      deltaJson: `staging/state/chapter-${id}-delta.json`,
      crossrefJson: `staging/state/chapter-${id}-crossref.json`,
      evalJson: `staging/evaluations/chapter-${id}-eval.json`,
      styleRefinerChangesJson: `staging/logs/style-refiner-chapter-${id}-changes.json`,
      storylineMemoryMd: storylineId ? `staging/storylines/${storylineId}/memory.md` : null
    },
    final: {
      chapterMd: `chapters/chapter-${id}.md`,
      summaryMd: `summaries/chapter-${id}-summary.md`,
      evalJson: `evaluations/chapter-${id}-eval.json`,
      crossrefJson: `state/chapter-${id}-crossref.json`,
      storylineMemoryMd: storylineId ? `storylines/${storylineId}/memory.md` : null,
      foreshadowGlobalJson: "foreshadowing/global.json",
      stateCurrentJson: "state/current-state.json",
      stateChangelogJsonl: "state/changelog.jsonl"
    }
  };
}
