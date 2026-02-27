import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";

export type FileFingerprint = { size: number; mtime_ms: number; content_hash: string };

export function hashText(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export async function fingerprintTextFile(absPath: string): Promise<{ fingerprint: FileFingerprint; text: string }> {
  const [s, text] = await Promise.all([stat(absPath), readFile(absPath, "utf8")]);
  return { fingerprint: { size: s.size, mtime_ms: s.mtimeMs, content_hash: hashText(text) }, text };
}

export async function fingerprintFile(absPath: string): Promise<FileFingerprint> {
  const { fingerprint } = await fingerprintTextFile(absPath);
  return fingerprint;
}

export function fingerprintsMatch(a: FileFingerprint, b: FileFingerprint): boolean {
  return a.size === b.size && a.mtime_ms === b.mtime_ms && a.content_hash === b.content_hash;
}

