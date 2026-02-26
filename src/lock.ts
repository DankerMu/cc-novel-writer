import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";

import { NovelCliError } from "./errors.js";
import { pathExists, readJsonFile, removePath, writeJsonFile } from "./fs-utils.js";

const STALE_LOCK_MINUTES = 30;
const STALE_LOCK_MS = STALE_LOCK_MINUTES * 60 * 1000;

export type LockInfo = {
  pid?: number;
  started?: string;
  chapter?: number;
};

export type LockStatus = {
  exists: boolean;
  stale: boolean;
  lockDir: string;
  infoPath: string;
  info?: LockInfo;
};

function parseLockInfo(raw: unknown): LockInfo {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const obj = raw as Record<string, unknown>;
  const pid = typeof obj.pid === "number" && Number.isInteger(obj.pid) ? obj.pid : undefined;
  const started = typeof obj.started === "string" ? obj.started : undefined;
  const chapter = typeof obj.chapter === "number" && Number.isInteger(obj.chapter) ? obj.chapter : undefined;
  return { pid, started, chapter };
}

function isStale(args: { startedIso: string | undefined; fallbackStartedMs: number | null }): boolean {
  const startedMs = args.startedIso ? Date.parse(args.startedIso) : Number.NaN;
  const baseMs = Number.isFinite(startedMs) ? startedMs : args.fallbackStartedMs;
  if (baseMs === null) return false;
  const ageMs = Date.now() - baseMs;
  return ageMs > STALE_LOCK_MS;
}

export async function getLockStatus(projectRootDir: string): Promise<LockStatus> {
  const lockDir = join(projectRootDir, ".novel.lock");
  const infoPath = join(lockDir, "info.json");

  const exists = await pathExists(lockDir);
  if (!exists) {
    return { exists: false, stale: false, lockDir, infoPath };
  }

  let fallbackStartedMs: number | null = null;
  try {
    const s = await stat(lockDir);
    if (s.isDirectory()) fallbackStartedMs = s.mtimeMs;
  } catch {
    fallbackStartedMs = null;
  }

  let info: LockInfo | undefined;
  if (await pathExists(infoPath)) {
    try {
      info = parseLockInfo(await readJsonFile(infoPath));
    } catch {
      info = {};
    }
  }

  return {
    exists: true,
    stale: isStale({ startedIso: info?.started, fallbackStartedMs }),
    lockDir,
    infoPath,
    info
  };
}

export async function clearStaleLock(projectRootDir: string): Promise<boolean> {
  const status = await getLockStatus(projectRootDir);
  if (!status.exists) return false;
  if (!(await isDirectory(status.lockDir))) {
    throw new NovelCliError(`Lock path exists but is not a directory: ${status.lockDir}`, 2);
  }
  if (!status.stale) {
    throw new NovelCliError(`Lock is active; refusing to clear. Use after ${STALE_LOCK_MINUTES} minutes or stop the other session.`, 2);
  }
  await removePath(status.lockDir);
  return true;
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function acquireLockDir(projectRootDir: string, lockDir: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await mkdir(lockDir);
      return;
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code !== "EEXIST") {
        const message = err instanceof Error ? err.message : String(err);
        throw new NovelCliError(`Failed to acquire lock: ${message}`, 2);
      }

      if (!(await isDirectory(lockDir))) {
        throw new NovelCliError(`Lock path exists but is not a directory: ${lockDir}`, 2);
      }

      const status = await getLockStatus(projectRootDir);
      if (!status.stale) {
        throw new NovelCliError(
          `Another session holds the lock (started=${status.info?.started ?? "unknown"} pid=${status.info?.pid ?? "unknown"}).`,
          2
        );
      }

      await removePath(lockDir);
      continue;
    }
  }

  throw new NovelCliError(`Failed to acquire lock after clearing stale lock; another session likely acquired it.`, 2);
}

export async function withWriteLock<T>(
  projectRootDir: string,
  meta: { chapter?: number } = {},
  fn: () => Promise<T>
): Promise<T> {
  const lockDir = join(projectRootDir, ".novel.lock");
  const infoPath = join(lockDir, "info.json");

  // Try to acquire; if exists, only proceed if stale.
  await acquireLockDir(projectRootDir, lockDir);

  // Best-effort metadata write.
  await writeJsonFile(infoPath, {
    pid: process.pid,
    started: new Date().toISOString(),
    chapter: meta.chapter ?? null
  });

  try {
    return await fn();
  } finally {
    await removePath(lockDir);
  }
}
