import { join } from "node:path";

import type { Checkpoint } from "./checkpoint.js";
import { NovelCliError } from "./errors.js";
import { ensureDir, pathExists, readTextFile, writeJsonFile } from "./fs-utils.js";
import { parseNovelAskQuestionSpec, type NovelAskQuestionSpec } from "./novel-ask.js";
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
  await maybeAdd("ai_blacklist", "ai-blacklist.json");
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
    expected_outputs.push({
      path: rel.staging.evalJson,
      required: true,
      note: "QualityJudge returns JSON; the executor should write it to this path."
    });
    next_actions.push({ kind: "command", command: `novel validate ${stepId}` });
    next_actions.push({ kind: "command", command: `novel advance ${stepId}` });
    next_actions.push({ kind: "command", command: `novel commit --chapter ${args.step.chapter}`, note: "After judged, commit staging artifacts." });
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
