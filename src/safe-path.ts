import { isAbsolute, join, sep } from "node:path";

import { NovelCliError } from "./errors.js";

export function rejectPathTraversalInput(inputPath: string, label: string): void {
  const normalized = inputPath.replaceAll("\\", "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.includes("..")) {
    throw new NovelCliError(`${label} must not contain '..' path traversal segments.`, 2);
  }
}

export function assertInsideProjectRoot(projectRootAbs: string, absolutePath: string): void {
  const root = projectRootAbs.endsWith(sep) ? projectRootAbs : `${projectRootAbs}${sep}`;
  if (absolutePath === projectRootAbs) return;
  if (!absolutePath.startsWith(root)) {
    throw new NovelCliError(`Unsafe path outside project root: ${absolutePath}`, 2);
  }
}

export function resolveProjectRelativePath(projectRootAbs: string, relPath: string, label: string): string {
  if (typeof relPath !== "string" || relPath.trim().length === 0) {
    throw new NovelCliError(`Invalid ${label}: must be a non-empty string.`, 2);
  }
  if (isAbsolute(relPath)) {
    throw new NovelCliError(`Invalid ${label}: must be a project-relative path.`, 2);
  }
  rejectPathTraversalInput(relPath, label);
  const abs = join(projectRootAbs, relPath);
  assertInsideProjectRoot(projectRootAbs, abs);
  return abs;
}
