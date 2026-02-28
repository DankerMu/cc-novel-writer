import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { NovelCliError } from "./errors.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableWindowsIoError(err: unknown): boolean {
  const code = (err as { code?: string }).code;
  return code === "EBUSY" || code === "EPERM" || code === "EACCES";
}

async function retryIo<T>(op: () => Promise<T>, attempts: number): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await op();
    } catch (err: unknown) {
      last = err;
      if (!isRetryableWindowsIoError(err) || i === attempts - 1) throw err;
      await sleep(40 * (i + 1));
    }
  }
  throw last;
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function readTextFile(path: string): Promise<string> {
  try {
    return await readFile(path, "utf8");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new NovelCliError(`Failed to read file: ${path}. ${message}`);
  }
}

export async function readJsonFile(path: string): Promise<unknown> {
  const raw = await readTextFile(path);
  try {
    return JSON.parse(raw) as unknown;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new NovelCliError(`Invalid JSON: ${path}. ${message}`);
  }
}

export async function writeTextFile(path: string, contents: string): Promise<void> {
  try {
    await ensureDir(dirname(path));
    await writeFile(path, contents, "utf8");
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new NovelCliError(`Failed to write file: ${path}. ${message}`);
  }
}

export async function writeTextFileAtomic(path: string, contents: string): Promise<void> {
  const tmpPath = `${path}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  let cleanupTmp = true;
  try {
    await ensureDir(dirname(path));
    await writeFile(tmpPath, contents, "utf8");
    try {
      await rename(tmpPath, path);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code !== "EEXIST" && code !== "EPERM" && code !== "EACCES" && code !== "EBUSY") throw err;

      // Windows cannot rename over an existing file; use a backup to avoid losing the last-good file.
      const backupPath = `${path}.bak-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      let backedUp = false;
      try {
        await retryIo(() => rename(path, backupPath), 5);
        backedUp = true;
      } catch (moveErr: unknown) {
        const moveCode = (moveErr as { code?: string }).code;
        if (moveCode !== "ENOENT") {
          cleanupTmp = false;
          const message = moveErr instanceof Error ? moveErr.message : String(moveErr);
          throw new NovelCliError(
            `Failed to write file atomically (tmp preserved; failed to move existing file aside). path=${path} tmp=${tmpPath}. ${message}`,
            1
          );
        }
      }

      try {
        await retryIo(() => rename(tmpPath, path), 8);
        if (backedUp) {
          try {
            await rm(backupPath, { force: true });
          } catch {
            // ignore
          }
        }
      } catch (finalErr: unknown) {
        const finalMessage = finalErr instanceof Error ? finalErr.message : String(finalErr);
        let restored = false;
        let restoreMessage: string | null = null;
        if (backedUp) {
          try {
            await retryIo(() => rename(backupPath, path), 8);
            restored = true;
          } catch (restoreErr: unknown) {
            restoreMessage = restoreErr instanceof Error ? restoreErr.message : String(restoreErr);
            restored = false;
          }
        } else {
          restored = true;
        }

        if (!backedUp) {
          cleanupTmp = false;
          throw new NovelCliError(`Failed to write file atomically (tmp preserved). path=${path} tmp=${tmpPath}. ${finalMessage}`, 1);
        }

        if (!restored) {
          cleanupTmp = false;
          const restoreSuffix = restoreMessage ? ` restore_error=${restoreMessage}` : "";
          throw new NovelCliError(
            `Failed to write file atomically; restore failed (backup+tmp preserved). path=${path} backup=${backupPath} tmp=${tmpPath}. write_error=${finalMessage}${restoreSuffix}`,
            1
          );
        }
        throw finalErr;
      }
    }
  } catch (err: unknown) {
    if (err instanceof NovelCliError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new NovelCliError(`Failed to write file atomically: ${path}. ${message}`, 1);
  } finally {
    if (cleanupTmp) {
      try {
        await rm(tmpPath, { force: true });
      } catch {
        // ignore
      }
    }
  }
}

export async function writeJsonFile(path: string, payload: unknown): Promise<void> {
  await writeTextFile(path, `${JSON.stringify(payload, null, 2)}\n`);
}

export async function writeJsonFileAtomic(path: string, payload: unknown): Promise<void> {
  await writeTextFileAtomic(path, `${JSON.stringify(payload, null, 2)}\n`);
}

export async function removePath(path: string): Promise<void> {
  try {
    await rm(path, { recursive: true, force: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new NovelCliError(`Failed to remove path: ${path}. ${message}`);
  }
}
