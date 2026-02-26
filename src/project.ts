import { stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { NovelCliError } from "./errors.js";
import { pathExists } from "./fs-utils.js";
import { rejectPathTraversalInput } from "./safe-path.js";

type ResolveProjectRootArgs = {
  cwd: string;
  projectOverride?: string;
};

async function isDirectory(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

export async function resolveProjectRoot(args: ResolveProjectRootArgs): Promise<string> {
  const cwdAbs = resolve(args.cwd);

  if (args.projectOverride) {
    rejectPathTraversalInput(args.projectOverride, "--project");
    const candidate = resolve(cwdAbs, args.projectOverride);
    if (!(await isDirectory(candidate))) {
      throw new NovelCliError(`Project root is not a directory: ${candidate}`, 2);
    }
    const checkpoint = join(candidate, ".checkpoint.json");
    if (!(await pathExists(checkpoint))) {
      throw new NovelCliError(`No .checkpoint.json found under --project: ${candidate}`, 2);
    }
    return candidate;
  }

  let dir = cwdAbs;
  while (true) {
    const checkpoint = join(dir, ".checkpoint.json");
    if (await pathExists(checkpoint)) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  throw new NovelCliError(`No project root found (missing .checkpoint.json). Use --project <dir>.`, 2);
}

