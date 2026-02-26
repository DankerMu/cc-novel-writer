import { mkdir, stat } from "node:fs/promises";
import { join } from "node:path";

import { NovelCliError } from "./errors.js";
import { pathExists, readJsonFile, removePath, writeJsonFile } from "./fs-utils.js";

const STALE_LOCK_MINUTES = 30;

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

function isStale(startedIso: string | undefined): boolean {
  if (!startedIso) return true;
  const startedMs = Date.parse(startedIso);
  if (!Number.isFinite(startedMs)) return true;
  const ageMs = Date.now() - startedMs;
  return ageMs > STALE_LOCK_MINUTES * 60 * 1000;
}

export async function getLockStatus(projectRootDir: string): Promise<LockStatus> {
  const lockDir = join(projectRootDir, ".novel.lock");
  const infoPath = join(lockDir, "info.json");

  const exists = await pathExists(lockDir);
  if (!exists) {
    return { exists: false, stale: false, lockDir, infoPath };
  }

  let info: LockInfo | undefined;
  if (await pathExists(infoPath)) {
    try {
      info = parseLockInfo(await readJsonFile(infoPath));
    } catch {
      info = {};
    }
  }

  return { exists: true, stale: isStale(info?.started), lockDir, infoPath, info };
}

export async function clearStaleLock(projectRootDir: string): Promise<boolean> {
  const status = await getLockStatus(projectRootDir);
  if (!status.exists) return false;
  if (!status.stale) {
    throw new NovelCliError(`Lock is active; refusing to clear. Use after ${STALE_LOCK_MINUTES} minutes or stop the other session.`, 2);
  }
  await removePath(status.lockDir);
  return true;
}

async function ensureLockDir(lockDir: string): Promise<void> {
  try {
    await mkdir(lockDir);
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === "EEXIST") return;
    const message = err instanceof Error ? err.message : String(err);
    throw new NovelCliError(`Failed to create lock directory: ${lockDir}. ${message}`, 2);
  }
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

export async function withWriteLock<T>(
  projectRootDir: string,
  meta: { chapter?: number } = {},
  fn: () => Promise<T>
): Promise<T> {
  const lockDir = join(projectRootDir, ".novel.lock");
  const infoPath = join(lockDir, "info.json");

  // Try to acquire; if exists, only proceed if stale.
  try {
    await mkdir(lockDir);
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
    await ensureLockDir(lockDir);
  }

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

