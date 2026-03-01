import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { NovelCliError } from "./errors.js";
import { isPlainObject } from "./type-guards.js";

const execFileAsync = promisify(execFile);

export type NerMention = {
  line: number;
  snippet: string;
};

export type NerEntity = {
  text: string;
  confidence: string;
  mentions: NerMention[];
};

export type NerOutput = {
  schema_version: 1;
  entities: {
    characters: NerEntity[];
    locations: NerEntity[];
    time_markers: NerEntity[];
    events: NerEntity[];
  };
};

export function parseNerOutput(raw: unknown): NerOutput {
  if (!isPlainObject(raw)) throw new NovelCliError(`Invalid NER output: expected JSON object.`, 2);
  const obj = raw as Record<string, unknown>;
  const schema = obj.schema_version;
  if (typeof schema !== "number" || !Number.isInteger(schema)) throw new NovelCliError(`Invalid NER output: schema_version must be an int.`, 2);
  if (schema !== 1) throw new NovelCliError(`Invalid NER output: unsupported schema_version=${schema} (expected 1).`, 2);
  const entitiesRaw = obj.entities;
  if (!isPlainObject(entitiesRaw)) throw new NovelCliError(`Invalid NER output: missing entities object.`, 2);
  const entitiesObj = entitiesRaw as Record<string, unknown>;

  const parseList = (key: string): NerEntity[] => {
    const listRaw = entitiesObj[key];
    if (!Array.isArray(listRaw)) return [];
    const out: NerEntity[] = [];
    for (const it of listRaw) {
      if (!isPlainObject(it)) continue;
      const rec = it as Record<string, unknown>;
      const text = typeof rec.text === "string" ? rec.text.trim() : "";
      const confidence = typeof rec.confidence === "string" ? rec.confidence : "unknown";
      const mentionsRaw = rec.mentions;
      const mentions: NerMention[] = [];
      if (Array.isArray(mentionsRaw)) {
        for (const m of mentionsRaw) {
          if (!isPlainObject(m)) continue;
          const mo = m as Record<string, unknown>;
          const line = typeof mo.line === "number" && Number.isInteger(mo.line) ? mo.line : null;
          const snippet = typeof mo.snippet === "string" ? mo.snippet : null;
          if (line !== null && snippet !== null) mentions.push({ line, snippet });
        }
      }
      if (text.length === 0) continue;
      out.push({ text, confidence, mentions });
    }
    return out;
  };

  return {
    schema_version: 1,
    entities: {
      characters: parseList("characters"),
      locations: parseList("locations"),
      time_markers: parseList("time_markers"),
      events: parseList("events")
    }
  };
}

function runNerScriptPath(): string {
  return fileURLToPath(new URL("../scripts/run-ner.sh", import.meta.url));
}

export async function runNer(chapterAbs: string): Promise<NerOutput> {
  const script = runNerScriptPath();
  const { stdout } = await execFileAsync("bash", [script, chapterAbs], {
    maxBuffer: 10 * 1024 * 1024,
    timeout: 60_000,
    killSignal: "SIGKILL"
  });
  const trimmed = stdout.trim();
  const raw = JSON.parse(trimmed) as unknown;
  return parseNerOutput(raw);
}
