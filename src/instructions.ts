import { join } from "node:path";

import type { Checkpoint } from "./checkpoint.js";
import { NovelCliError } from "./errors.js";
import { ensureDir, pathExists, readTextFile, writeJsonFile } from "./fs-utils.js";
import { loadContinuityLatestSummary } from "./consistency-auditor.js";
import { computeForeshadowVisibilityReport, loadForeshadowGlobalItems } from "./foreshadow-visibility.js";
import { computeEffectiveScoringWeights, loadGenreWeightProfiles } from "./scoring-weights.js";
import { parseNovelAskQuestionSpec, type NovelAskQuestionSpec } from "./novel-ask.js";
import { loadPlatformProfile } from "./platform-profile.js";
import { resolveProjectRelativePath } from "./safe-path.js";
import { chapterRelPaths, formatStepId, pad2, type Step } from "./steps.js";

export type InstructionPacket = {
  version: 1;
  step: string;
  agent: { kind: "subagent" | "cli"; name: string };
  novel_ask?: NovelAskQuestionSpec;
  answer_path?: string;
  manifest: {
    mode: "paths" | "paths+embed";
    inline: Record<string, unknown>;
    paths: Record<string, unknown>;
    embed?: Record<string, unknown>;
  };
  expected_outputs: Array<{ path: string; required: boolean; note?: string }>;
  next_actions: Array<{ kind: "command"; command: string; note?: string }>;
};

type BuildArgs = {
  rootDir: string;
  checkpoint: Checkpoint;
  step: Step;
  embedMode: string | null;
  writeManifest: boolean;
  novelAskGate?: { novel_ask: NovelAskQuestionSpec; answer_path: string } | null;
};

function relIfExists(relPath: string, exists: boolean): string | null {
  return exists ? relPath : null;
}

function safeEmbedMode(mode: string | null): "off" | "brief" {
  if (!mode) return "off";
  if (mode === "brief") return "brief";
  throw new NovelCliError(`Unsupported --embed mode: ${mode}. Supported: brief`, 2);
}

export async function buildInstructionPacket(args: BuildArgs): Promise<Record<string, unknown>> {
  const stepId = formatStepId(args.step);
  if (args.step.kind !== "chapter") throw new NovelCliError(`Unsupported step: ${stepId}`, 2);

  const volume = args.checkpoint.current_volume;
  const volumeOutlineRel = `volumes/vol-${pad2(volume)}/outline.md`;
  const chapterContractRel = `volumes/vol-${pad2(volume)}/chapter-contracts/chapter-${String(args.step.chapter).padStart(3, "0")}.json`;

  const rel = chapterRelPaths(args.step.chapter);

  const commonPaths: Record<string, unknown> = {};

  const maybeAdd = async (key: string, relPath: string): Promise<void> => {
    const absPath = join(args.rootDir, relPath);
    if (await pathExists(absPath)) commonPaths[key] = relPath;
  };

  await maybeAdd("project_brief", "brief.md");
  await maybeAdd("style_profile", "style-profile.json");
  await maybeAdd("platform_profile", "platform-profile.json");
  await maybeAdd("ai_blacklist", "ai-blacklist.json");
  await maybeAdd("web_novel_cliche_lint", "web-novel-cliche-lint.json");
  await maybeAdd("genre_weight_profiles", "genre-weight-profiles.json");
  await maybeAdd("style_guide", "skills/novel-writing/references/style-guide.md");
  await maybeAdd("quality_rubric", "skills/novel-writing/references/quality-rubric.md");
  await maybeAdd("current_state", "state/current-state.json");
  await maybeAdd("world_rules", "world/rules.json");

  // Optional: volume outline and chapter contract.
  if (await pathExists(join(args.rootDir, volumeOutlineRel))) commonPaths.volume_outline = volumeOutlineRel;
  if (await pathExists(join(args.rootDir, chapterContractRel))) commonPaths.chapter_contract = chapterContractRel;

  const embedMode = safeEmbedMode(args.embedMode);
  const embed: Record<string, unknown> = {};
  if (embedMode === "brief") {
    const briefAbs = join(args.rootDir, "brief.md");
    if (await pathExists(briefAbs)) {
      const content = await readTextFile(briefAbs);
      embed.brief_preview = content.slice(0, 2000);
    } else {
      embed.brief_preview = null;
    }
  }

  let agent: InstructionPacket["agent"];
  const inline: Record<string, unknown> = { chapter: args.step.chapter, volume };
  const paths: Record<string, unknown> = { ...commonPaths };
  const expected_outputs: InstructionPacket["expected_outputs"] = [];
  const next_actions: InstructionPacket["next_actions"] = [];

  if (args.step.stage === "draft") {
    agent = { kind: "subagent", name: "chapter-writer" };
    // Optional: inject non-spoiler light-touch reminders for dormant foreshadowing items (best-effort).
    try {
      const loadedPlatform = await loadPlatformProfile(args.rootDir).catch(() => null);
      const platform = loadedPlatform?.profile.platform ?? null;
      const genreDriveType = typeof loadedPlatform?.profile.scoring?.genre_drive_type === "string" ? loadedPlatform.profile.scoring.genre_drive_type : null;

      const items = await loadForeshadowGlobalItems(args.rootDir);
      const report = computeForeshadowVisibilityReport({
        items,
        asOfChapter: args.step.chapter,
        volume,
        platform,
        genreDriveType
      });
      const tasks = report.dormant_items.slice(0, 5).map((it) => ({
        id: it.id,
        scope: it.scope,
        status: it.status,
        chapters_since_last_update: it.chapters_since_last_update,
        instruction: it.writing_task
      }));
      if (tasks.length > 0) inline.foreshadow_light_touch_tasks = tasks;
    } catch {
      // ignore
    }
    expected_outputs.push({ path: rel.staging.chapterMd, required: true });
    next_actions.push({ kind: "command", command: `novel validate ${stepId}` });
    next_actions.push({ kind: "command", command: `novel advance ${stepId}` });
    next_actions.push({
      kind: "command",
      command: `novel instructions chapter:${String(args.step.chapter).padStart(3, "0")}:summarize --json`,
      note: "After advance, proceed to summarize."
    });
  } else if (args.step.stage === "summarize") {
    agent = { kind: "subagent", name: "summarizer" };
    paths.chapter_draft = relIfExists(rel.staging.chapterMd, await pathExists(join(args.rootDir, rel.staging.chapterMd)));
    expected_outputs.push({ path: rel.staging.summaryMd, required: true });
    expected_outputs.push({ path: rel.staging.deltaJson, required: true });
    expected_outputs.push({ path: rel.staging.crossrefJson, required: true });
    expected_outputs.push({ path: "staging/storylines/{storyline_id}/memory.md", required: true, note: "storyline_id comes from delta.json" });
    next_actions.push({ kind: "command", command: `novel validate ${stepId}` });
    next_actions.push({ kind: "command", command: `novel advance ${stepId}` });
  } else if (args.step.stage === "refine") {
    agent = { kind: "subagent", name: "style-refiner" };
    paths.chapter_draft = relIfExists(rel.staging.chapterMd, await pathExists(join(args.rootDir, rel.staging.chapterMd)));
    expected_outputs.push({ path: rel.staging.chapterMd, required: true });
    expected_outputs.push({ path: rel.staging.styleRefinerChangesJson, required: false });
    next_actions.push({ kind: "command", command: `novel validate ${stepId}` });
    next_actions.push({ kind: "command", command: `novel advance ${stepId}` });
  } else if (args.step.stage === "judge") {
    agent = { kind: "subagent", name: "quality-judge" };
    paths.chapter_draft = relIfExists(rel.staging.chapterMd, await pathExists(join(args.rootDir, rel.staging.chapterMd)));
    paths.cross_references = relIfExists(rel.staging.crossrefJson, await pathExists(join(args.rootDir, rel.staging.crossrefJson)));

    const loadedPlatform = await loadPlatformProfile(args.rootDir);
    if (loadedPlatform?.profile.scoring) {
      const loadedWeights = await loadGenreWeightProfiles(args.rootDir);
      if (!loadedWeights) {
        throw new NovelCliError(
          "Missing required file: genre-weight-profiles.json (required when platform-profile.json.scoring is present). Copy it from templates/genre-weight-profiles.json.",
          2
        );
      }
      const effective = computeEffectiveScoringWeights({
        config: loadedWeights.config,
        scoring: loadedPlatform.profile.scoring,
        hookPolicy: loadedPlatform.profile.hook_policy
      });
      inline.scoring_weights = {
        ...effective,
        source: { platform_profile: loadedPlatform.relPath, genre_weight_profiles: loadedWeights.relPath }
      };
    }

    // Optional: inject compact continuity summary for LS-001 evidence (non-blocking).
    inline.continuity_report_summary = await loadContinuityLatestSummary(args.rootDir);

    expected_outputs.push({
      path: rel.staging.evalJson,
      required: true,
      note: "QualityJudge returns JSON; the executor should write it to this path."
    });
    next_actions.push({ kind: "command", command: `novel validate ${stepId}` });
    next_actions.push({ kind: "command", command: `novel advance ${stepId}` });
    next_actions.push({
      kind: "command",
      command: `novel next`,
      note: "After advance, compute the next deterministic step (may be hook-fix/review/commit)."
    });
  } else if (args.step.stage === "hook-fix") {
    agent = { kind: "subagent", name: "chapter-writer" };
    paths.chapter_draft = relIfExists(rel.staging.chapterMd, await pathExists(join(args.rootDir, rel.staging.chapterMd)));
    paths.chapter_eval = relIfExists(rel.staging.evalJson, await pathExists(join(args.rootDir, rel.staging.evalJson)));
    inline.fix_mode = "hook-fix";
    inline.required_fixes = [
      {
        target: "chapter_end",
        instruction:
          "执行 hook-fix：在不改变前文既定事件/信息的前提下，只改最后 1–2 段（或末尾 ~10%），补强章末钩子（读者面对面悬念/威胁/反转/情绪 cliff/下一目标承诺）。钩子类型需遵守 platform-profile.json.hook_policy.allowed_types，目标 hook_strength >= platform-profile.json.hook_policy.min_strength。禁止新增关键设定/新命名角色/新地点，尽量不影响 state/crossref。",
      }
    ];
    expected_outputs.push({ path: rel.staging.chapterMd, required: true, note: "Overwrite chapter draft with ending-only hook fix." });
    next_actions.push({ kind: "command", command: `novel validate ${stepId}` });
    next_actions.push({ kind: "command", command: `novel advance ${stepId}` });
    next_actions.push({
      kind: "command",
      command: `novel instructions chapter:${String(args.step.chapter).padStart(3, "0")}:judge --json`,
      note: "After hook-fix, re-run QualityJudge to refresh eval."
    });
  } else if (args.step.stage === "review") {
    agent = { kind: "cli", name: "manual-review" };
    paths.chapter_draft = relIfExists(rel.staging.chapterMd, await pathExists(join(args.rootDir, rel.staging.chapterMd)));
    paths.chapter_eval = relIfExists(rel.staging.evalJson, await pathExists(join(args.rootDir, rel.staging.evalJson)));
    expected_outputs.push({ path: "(manual)", required: false, note: "Review required: hook policy still failing after bounded hook-fix." });
    next_actions.push({
      kind: "command",
      command: `novel instructions chapter:${String(args.step.chapter).padStart(3, "0")}:judge --json`,
      note: "After manually editing the chapter ending, re-run QualityJudge."
    });
  } else if (args.step.stage === "commit") {
    agent = { kind: "cli", name: "novel" };
    expected_outputs.push({ path: `chapters/chapter-${String(args.step.chapter).padStart(3, "0")}.md`, required: true });
    next_actions.push({ kind: "command", command: `novel commit --chapter ${args.step.chapter}` });
  } else {
    throw new NovelCliError(`Unsupported step stage: ${(args.step as Step).stage}`, 2);
  }

  const gate = args.novelAskGate ?? null;
  const gateSpec = gate ? parseNovelAskQuestionSpec(gate.novel_ask) : null;
  if (gate) {
    resolveProjectRelativePath(args.rootDir, gate.answer_path, "novelAskGate.answer_path");
    expected_outputs.unshift({
      path: gate.answer_path,
      required: true,
      note: "AnswerSpec JSON record for the NOVEL_ASK gate (written before main step execution)."
    });
  }

  const packet: InstructionPacket = {
    version: 1,
    step: stepId,
    agent,
    ...(gate ? { novel_ask: gateSpec as NovelAskQuestionSpec, answer_path: gate.answer_path } : {}),
    manifest: {
      mode: embedMode === "off" ? "paths" : "paths+embed",
      inline,
      paths,
      ...(embedMode === "off" ? {} : { embed })
    },
    expected_outputs,
    next_actions
  };

  let writtenPath: string | null = null;
  if (args.writeManifest) {
    const manifestsDir = join(args.rootDir, "staging/manifests");
    await ensureDir(manifestsDir);
    const fileName = `${stepId.replaceAll(":", "-")}.packet.json`;
    writtenPath = `staging/manifests/${fileName}`;
    await writeJsonFile(join(args.rootDir, writtenPath), packet);
  }

  return {
    packet,
    ...(writtenPath ? { written_manifest_path: writtenPath } : {})
  };
}
