import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
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

export async function writeJsonFile(path: string, payload: unknown): Promise<void> {
  await writeTextFile(path, `${JSON.stringify(payload, null, 2)}\n`);
}

export async function removePath(path: string): Promise<void> {
  try {
    await rm(path, { recursive: true, force: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new NovelCliError(`Failed to remove path: ${path}. ${message}`);
  }
}

