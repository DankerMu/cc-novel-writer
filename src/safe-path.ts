import { sep } from "node:path";

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

