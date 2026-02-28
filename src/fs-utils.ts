import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { NovelCliError } from "./errors.js";

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
  try {
    await ensureDir(dirname(path));
    await writeFile(tmpPath, contents, "utf8");
    try {
      await rename(tmpPath, path);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code !== "EEXIST" && code !== "EPERM" && code !== "EACCES") throw err;

      // Windows cannot rename over an existing file; use a backup to avoid losing the last-good file.
      const backupPath = `${path}.bak-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      let backedUp = false;
      try {
        await rename(path, backupPath);
        backedUp = true;
      } catch (moveErr: unknown) {
        const moveCode = (moveErr as { code?: string }).code;
        if (moveCode !== "ENOENT") throw moveErr;
      }

      try {
        await rename(tmpPath, path);
      } catch (finalErr: unknown) {
        if (backedUp) {
          try {
            await rename(backupPath, path);
          } catch {
            // ignore
          }
        }
        throw finalErr;
      } finally {
        if (backedUp) {
          try {
            await rm(backupPath, { force: true });
          } catch {
            // ignore
          }
        }
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new NovelCliError(`Failed to write file atomically: ${path}. ${message}`);
  } finally {
    try {
      await rm(tmpPath, { force: true });
    } catch {
      // ignore
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
