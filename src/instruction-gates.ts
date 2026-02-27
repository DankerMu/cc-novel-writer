import { isAbsolute, join } from "node:path";

import { NovelCliError } from "./errors.js";
import { pathExists, readJsonFile } from "./fs-utils.js";
import { parseNovelAskAnswerSpec, parseNovelAskQuestionSpec, validateNovelAskAnswerAgainstQuestionSpec, type NovelAskAnswerSpec, type NovelAskQuestionSpec } from "./novel-ask.js";
import { assertInsideProjectRoot, rejectPathTraversalInput } from "./safe-path.js";

export type NovelAskGate = {
  novel_ask: NovelAskQuestionSpec;
  answer_path: string;
};

export function extractNovelAskGate(packet: { novel_ask?: NovelAskQuestionSpec; answer_path?: string }): NovelAskGate | null {
  const hasAsk = packet.novel_ask !== undefined;
  const hasPath = packet.answer_path !== undefined;

  if (!hasAsk && !hasPath) return null;
  if (hasAsk && !hasPath) throw new NovelCliError("Invalid instruction packet: 'answer_path' is required when 'novel_ask' is present.", 2);
  if (!hasAsk && hasPath) throw new NovelCliError("Invalid instruction packet: 'novel_ask' is required when 'answer_path' is present.", 2);

  const answer_path = packet.answer_path;
  if (typeof answer_path !== "string" || answer_path.trim().length === 0) {
    throw new NovelCliError("Invalid instruction packet: 'answer_path' must be a non-empty string.", 2);
  }

  return { novel_ask: packet.novel_ask as NovelAskQuestionSpec, answer_path };
}

function resolveAnswerPath(rootDir: string, answer_path: string): string {
  if (isAbsolute(answer_path)) throw new NovelCliError("Invalid answer_path: must be a project-relative path.", 2);
  rejectPathTraversalInput(answer_path, "answer_path");
  const abs = join(rootDir, answer_path);
  assertInsideProjectRoot(rootDir, abs);
  return abs;
}

export async function loadNovelAskAnswerIfPresent(rootDir: string, gate: NovelAskGate): Promise<NovelAskAnswerSpec | null> {
  const questionSpec = parseNovelAskQuestionSpec(gate.novel_ask);
  const absAnswer = resolveAnswerPath(rootDir, gate.answer_path);

  if (!(await pathExists(absAnswer))) return null;

  const raw = await readJsonFile(absAnswer);
  let answerSpec: NovelAskAnswerSpec;
  try {
    answerSpec = parseNovelAskAnswerSpec(raw);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new NovelCliError(`Invalid AnswerSpec at ${gate.answer_path}: ${message}`, 2);
  }

  try {
    validateNovelAskAnswerAgainstQuestionSpec(questionSpec, answerSpec);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new NovelCliError(`Invalid AnswerSpec at ${gate.answer_path}: ${message}`, 2);
  }

  return answerSpec;
}

export async function requireNovelAskAnswer(rootDir: string, gate: NovelAskGate): Promise<NovelAskAnswerSpec> {
  const answer = await loadNovelAskAnswerIfPresent(rootDir, gate);
  if (answer === null) {
    throw new NovelCliError(
      `Step is blocked by NOVEL_ASK gate: missing AnswerSpec record at ${gate.answer_path}. Complete the gate and write a valid AnswerSpec JSON record to this path.`,
      2
    );
  }
  return answer;
}

