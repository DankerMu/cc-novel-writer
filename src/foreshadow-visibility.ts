import { mkdir, rename, rm, stat } from "node:fs/promises";
import { join } from "node:path";

import { ensureDir, pathExists, readJsonFile, writeJsonFile } from "./fs-utils.js";
import type { PlatformId } from "./platform-profile.js";
import { pad2, pad3 } from "./steps.js";
import { isPlainObject } from "./type-guards.js";

type ForeshadowScope = "short" | "medium" | "long";
type ForeshadowStatus = "planted" | "advanced" | "resolved";

type DormancyThresholds = Record<ForeshadowScope, number>;

export type ForeshadowDormancyItem = {
  id: string;
  description: string | null;
  scope: ForeshadowScope;
  status: ForeshadowStatus;
  last_updated_chapter: number;
  chapters_since_last_update: number;
  dormancy_threshold: number;
  planning_task: string;
  writing_task: string;
};

export type ForeshadowVisibilityReport = {
  schema_version: 1;
  generated_at: string;
  as_of: { chapter: number; volume: number };
  platform: PlatformId | null;
  genre_drive_type: string | null;
  thresholds: DormancyThresholds;
  dormant_items: ForeshadowDormancyItem[];
  counts: { dormant_total: number; dormant_by_scope: Record<ForeshadowScope, number> };
};

type ForeshadowRawItem = Record<string, unknown> & {
  id: string;
  description?: unknown;
  scope?: unknown;
  status?: unknown;
  planted_chapter?: unknown;
  last_updated_chapter?: unknown;
};

function safeInt(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null;
}

function safeString(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : null;
}

function normalizeScope(raw: unknown): ForeshadowScope {
  if (raw === "short" || raw === "medium" || raw === "long") return raw;
  return "medium";
}

function normalizeStatus(raw: unknown): ForeshadowStatus {
  if (raw === "planted" || raw === "advanced" || raw === "resolved") return raw;
  return "planted";
}

export function deriveForeshadowDormancyThresholds(genreDriveType: string | null): DormancyThresholds {
  // Base thresholds in chapters; adjusted by genre_drive_type.
  // Intent: keep long-scope items from going silent too long, without forcing spoilers.
  const base: DormancyThresholds = { short: 6, medium: 12, long: 24 };
  const dt = genreDriveType ?? "";
  const adjust = dt === "suspense" ? -3 : dt === "plot" ? -2 : dt === "character" ? -1 : dt === "slice_of_life" ? 2 : 0;
  const clamp = (n: number): number => Math.max(1, n);
  return {
    short: clamp(base.short + adjust),
    medium: clamp(base.medium + adjust),
    long: clamp(base.long + adjust)
  };
}

function normalizeForeshadowList(raw: unknown): ForeshadowRawItem[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (isPlainObject(raw)) {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.foreshadowing)) list = obj.foreshadowing;
  }
  const out: ForeshadowRawItem[] = [];
  for (const it of list) {
    if (!isPlainObject(it)) continue;
    const id = safeString((it as Record<string, unknown>).id);
    if (!id) continue;
    out.push({ ...(it as Record<string, unknown>), id } as ForeshadowRawItem);
  }
  return out;
}

function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function makeLightTouchTasks(args: {
  id: string;
  label: string;
  scope: ForeshadowScope;
  status: ForeshadowStatus;
  chaptersSince: number;
}): { planning_task: string; writing_task: string } {
  const scopeHint = args.scope === "short" ? "短期" : args.scope === "medium" ? "中期" : "长期";
  const statusHint = args.status === "resolved" ? "已回收" : args.status === "advanced" ? "已推进" : "已埋设";
  const common = `伏笔「${args.label}」已沉默 ${args.chaptersSince} 章（${scopeHint}/${statusHint}）`;
  return {
    planning_task: `${common}。建议在接下来几章安排一次“轻触”回响（象征/道具/一句话提及），保持读者记忆，不要提前兑现。`,
    writing_task: `${common}。本章请用 1 句/1 个意象/1 个小动作做“轻触”回响（不解释、不揭底、不兑现）。`
  };
}

export function computeForeshadowVisibilityReport(args: {
  items: ForeshadowRawItem[];
  asOfChapter: number;
  volume: number;
  platform: PlatformId | null;
  genreDriveType: string | null;
}): ForeshadowVisibilityReport {
  if (!Number.isInteger(args.asOfChapter) || args.asOfChapter < 0) throw new Error(`Invalid asOfChapter: ${String(args.asOfChapter)}`);
  if (!Number.isInteger(args.volume) || args.volume < 0) throw new Error(`Invalid volume: ${String(args.volume)}`);

  const thresholds = deriveForeshadowDormancyThresholds(args.genreDriveType);

  const dormant: ForeshadowDormancyItem[] = [];
  for (const it of args.items) {
    const status = normalizeStatus(it.status);
    if (status === "resolved") continue;
    const scope = normalizeScope(it.scope);
    const lastUpdated = safeInt(it.last_updated_chapter) ?? safeInt(it.planted_chapter) ?? 0;
    const chaptersSince = Math.max(0, args.asOfChapter - lastUpdated);
    const threshold = thresholds[scope];
    if (chaptersSince < threshold) continue;

    const description = safeString(it.description);
    const label = description ?? it.id;
    const tasks = makeLightTouchTasks({ id: it.id, label, scope, status, chaptersSince });
    dormant.push({
      id: it.id,
      description,
      scope,
      status,
      last_updated_chapter: lastUpdated,
      chapters_since_last_update: chaptersSince,
      dormancy_threshold: threshold,
      ...tasks
    });
  }

  dormant.sort((a, b) => b.chapters_since_last_update - a.chapters_since_last_update || compareStrings(a.scope, b.scope) || compareStrings(a.id, b.id));

  const dormantByScope: Record<ForeshadowScope, number> = { short: 0, medium: 0, long: 0 };
  for (const it of dormant) dormantByScope[it.scope] += 1;

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    as_of: { chapter: args.asOfChapter, volume: args.volume },
    platform: args.platform,
    genre_drive_type: args.genreDriveType,
    thresholds,
    dormant_items: dormant,
    counts: { dormant_total: dormant.length, dormant_by_scope: dormantByScope }
  };
}

export async function writeForeshadowVisibilityLogs(args: {
  rootDir: string;
  report: ForeshadowVisibilityReport;
  historyRange?: { start: number; end: number } | null;
}): Promise<{ latestRel: string; historyRel?: string }> {
  const dirRel = "logs/foreshadowing";
  const dirAbs = join(args.rootDir, dirRel);
  await ensureDir(dirAbs);

  const latestRel = `${dirRel}/latest.json`;
  const latestAbs = join(args.rootDir, latestRel);

  const result: { latestRel: string; historyRel?: string } = { latestRel };
  if (args.historyRange) {
    const start = args.historyRange.start;
    const end = args.historyRange.end;
    const historyRel = `${dirRel}/foreshadow-visibility-vol-${pad2(args.report.as_of.volume)}-ch${pad3(start)}-ch${pad3(end)}.json`;
    await writeJsonFile(join(args.rootDir, historyRel), args.report);
    result.historyRel = historyRel;
  }

  const parseLatest = (raw: unknown): { chapter: number; generated_at: string | null } | null => {
    if (!isPlainObject(raw)) return null;
    const obj = raw as Record<string, unknown>;
    if (obj.schema_version !== 1) return null;
    const asOf = obj.as_of;
    if (!isPlainObject(asOf)) return null;
    const chapter = (asOf as Record<string, unknown>).chapter;
    if (typeof chapter !== "number" || !Number.isInteger(chapter) || chapter < 0) return null;
    const generated_at = typeof obj.generated_at === "string" ? obj.generated_at : null;
    return { chapter, generated_at };
  };

  const lockAbs = join(dirAbs, ".latest.lock");
  const LOCK_STALE_MS = 30_000;
  const LOCK_TIMEOUT_MS = 2_000;
  const sleep = async (ms: number): Promise<void> => {
    await new Promise((r) => setTimeout(r, ms));
  };
  const lockMtimeMs = async (): Promise<number | null> => {
    try {
      return (await stat(lockAbs)).mtimeMs;
    } catch {
      return null;
    }
  };

  const acquireLock = async (): Promise<void> => {
    const startMs = Date.now();
    while (true) {
      try {
        await mkdir(lockAbs);
        return;
      } catch (err: unknown) {
        const code = (err as { code?: string }).code;
        if (code !== "EEXIST") throw err;

        const mtimeMs = await lockMtimeMs();
        if (mtimeMs !== null && Date.now() - mtimeMs > LOCK_STALE_MS) {
          await rm(lockAbs, { recursive: true, force: true });
          continue;
        }

        if (Date.now() - startMs > LOCK_TIMEOUT_MS) {
          throw new Error(`Timed out acquiring foreshadow latest lock: ${lockAbs}`);
        }

        await sleep(50);
        continue;
      }
    }
  };

  const releaseLock = async (): Promise<void> => {
    try {
      await rm(lockAbs, { recursive: true, force: true });
    } catch {
      // ignore
    }
  };

  await acquireLock();
  try {
    let existing: { chapter: number; generated_at: string | null } | null = null;
    if (await pathExists(latestAbs)) {
      try {
        existing = parseLatest(await readJsonFile(latestAbs));
      } catch {
        existing = null;
      }
    }

    const next = { chapter: args.report.as_of.chapter, generated_at: args.report.generated_at };
    let shouldWriteLatest = true;
    if (existing) {
      if (existing.chapter > next.chapter) {
        shouldWriteLatest = false;
      } else if (existing.chapter === next.chapter) {
        if (existing.generated_at && existing.generated_at >= next.generated_at) shouldWriteLatest = false;
      }
    }

    if (shouldWriteLatest) {
      const tmpAbs = join(dirAbs, `.tmp-foreshadowing-latest-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.json`);
      await writeJsonFile(tmpAbs, args.report);
      await rename(tmpAbs, latestAbs);
      try {
        if (await pathExists(tmpAbs)) await rm(tmpAbs, { force: true });
      } catch {
        // ignore
      }
    }
  } finally {
    await releaseLock();
  }

  return result;
}

export async function loadForeshadowGlobalItems(rootDir: string): Promise<ForeshadowRawItem[]> {
  const rel = "foreshadowing/global.json";
  const abs = join(rootDir, rel);
  if (!(await pathExists(abs))) return [];
  const raw = await readJsonFile(abs);
  return normalizeForeshadowList(raw);
}
