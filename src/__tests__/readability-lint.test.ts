import assert from "node:assert/strict";
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { parsePlatformProfile } from "../platform-profile.js";
import { computeReadabilityReport, writeReadabilityLogs, type ReadabilityReport } from "../readability-lint.js";

function makeProfileRaw(extra: Record<string, unknown>): Record<string, unknown> {
  return {
    schema_version: 1,
    platform: "qidian",
    created_at: "2026-01-01T00:00:00Z",
    word_count: { target_min: 1, target_max: 2, hard_min: 1, hard_max: 2 },
    hook_policy: { required: false, min_strength: 3, allowed_types: ["question"], fix_strategy: "hook-fix" },
    info_load: { max_new_entities_per_chapter: 0, max_unknown_entities_per_chapter: 0, max_new_terms_per_1k_words: 0 },
    compliance: { banned_words: [], duplicate_name_policy: "warn" },
    scoring: { genre_drive_type: "plot", weight_profile_id: "plot:v1" },
    ...extra
  };
}

function makeReadabilityPolicy(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    mobile: {
      enabled: true,
      max_paragraph_chars: 10,
      max_consecutive_exposition_paragraphs: 2,
      blocking_severity: "hard_only",
      ...overrides
    }
  };
}

test("computeReadabilityReport skips when readability.mobile is missing/disabled", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "novel-readability-skip-test-"));
  const profile = parsePlatformProfile(makeProfileRaw({ readability: null }), "platform-profile.json");
  const report = await computeReadabilityReport({
    rootDir,
    chapter: 1,
    chapterAbsPath: join(rootDir, "chapter.md"),
    chapterText: "# T\n正文",
    platformProfile: profile
  });
  assert.equal(report.status, "skipped");
  assert.equal(report.issues.length, 0);
});

test("computeReadabilityReport fallback flags overlong paragraphs and mixed punctuation (warn-only)", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "novel-readability-fallback-test-"));
  const profile = parsePlatformProfile(makeProfileRaw({ readability: makeReadabilityPolicy({ max_paragraph_chars: 5 }) }), "platform-profile.json");

  const chapterText = '第一段太长太长太长, A. 但是用了全角，。\n\n第二段。';
  const report = await computeReadabilityReport({
    rootDir,
    chapter: 1,
    chapterAbsPath: join(rootDir, "chapter.md"),
    chapterText,
    platformProfile: profile
  });

  assert.equal(report.mode, "fallback");
  assert.equal(report.has_blocking_issues, false);
  assert.equal(report.status, "warn");
  assert.ok(report.issues.some((i) => i.id === "readability.mobile.overlong_paragraph"));
  assert.ok(report.issues.some((i) => i.id === "readability.mobile.mixed_comma_styles"));
  assert.ok(report.issues.some((i) => i.id === "readability.mobile.mixed_period_styles"));
});

test("computeReadabilityReport uses deterministic script output and derives blocking status from policy", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "novel-readability-script-test-"));
  await mkdir(join(rootDir, "scripts"), { recursive: true });

  const profile = parsePlatformProfile(
    makeProfileRaw({
      compliance: { banned_words: [], duplicate_name_policy: "warn", script_paths: { lint_readability: "scripts/lint-readability.sh" } },
      readability: makeReadabilityPolicy({ blocking_severity: "soft_and_hard" })
    }),
    "platform-profile.json"
  );

  await writeFile(join(rootDir, "platform-profile.json"), `${JSON.stringify(profile, null, 2)}\n`, "utf8");
  const chapterAbsPath = join(rootDir, "chapter.md");
  await writeFile(chapterAbsPath, "# T\n正文\n", "utf8");

  const scriptAbs = join(rootDir, "scripts", "lint-readability.sh");
  const stubJson =
    '{"schema_version":1,"generated_at":"2026-01-01T00:00:00.000Z","scope":{"chapter":1},"policy":{"enabled":true,"max_paragraph_chars":10,"max_consecutive_exposition_paragraphs":2,"blocking_severity":"soft_and_hard"},"issues":[{"id":"readability.mobile.overlong_paragraph","severity":"soft","summary":"Soft but blocking when configured."}]}';
  const stubScript = `#!/usr/bin/env bash\nset -euo pipefail\nprintf '%s\\n' '${stubJson}'\n`;
  await writeFile(scriptAbs, stubScript, "utf8");

  const report = await computeReadabilityReport({
    rootDir,
    chapter: 1,
    chapterAbsPath,
    chapterText: "# T\n正文\n",
    platformProfile: profile
  });

  assert.equal(report.mode, "script");
  assert.equal(report.has_blocking_issues, true);
  assert.equal(report.status, "violation");
});

test("computeReadabilityReport trusts platform profile policy over script policy", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "novel-readability-policy-wins-test-"));
  await mkdir(join(rootDir, "scripts"), { recursive: true });

  const profile = parsePlatformProfile(
    makeProfileRaw({
      compliance: { banned_words: [], duplicate_name_policy: "warn", script_paths: { lint_readability: "scripts/lint-readability.sh" } },
      readability: makeReadabilityPolicy({ blocking_severity: "hard_only" })
    }),
    "platform-profile.json"
  );

  await writeFile(join(rootDir, "platform-profile.json"), `${JSON.stringify(profile, null, 2)}\n`, "utf8");
  const chapterAbsPath = join(rootDir, "chapter.md");
  await writeFile(chapterAbsPath, "# T\n正文\n", "utf8");

  const scriptAbs = join(rootDir, "scripts", "lint-readability.sh");
  const stubJson =
    '{"schema_version":1,"generated_at":"2026-01-01T00:00:00.000Z","scope":{"chapter":1},"policy":{"enabled":true,"max_paragraph_chars":10,"max_consecutive_exposition_paragraphs":2,"blocking_severity":"soft_and_hard"},"issues":[{"id":"readability.mobile.overlong_paragraph","severity":"soft","summary":"Soft issue should not block when profile is hard_only."}]}';
  const stubScript = `#!/usr/bin/env bash\nset -euo pipefail\nprintf '%s\\n' '${stubJson}'\n`;
  await writeFile(scriptAbs, stubScript, "utf8");

  const report = await computeReadabilityReport({
    rootDir,
    chapter: 1,
    chapterAbsPath,
    chapterText: "# T\n正文\n",
    platformProfile: profile
  });

  assert.equal(report.mode, "script");
  assert.equal(report.policy?.blocking_severity, "hard_only");
  assert.equal(report.has_blocking_issues, false);
  assert.equal(report.status, "warn");
});

test("computeReadabilityReport falls back when lint_readability script path contains traversal segments", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "novel-readability-traversal-test-"));

  const profile = parsePlatformProfile(
    makeProfileRaw({
      compliance: { banned_words: [], duplicate_name_policy: "warn", script_paths: { lint_readability: "../evil.sh" } },
      readability: makeReadabilityPolicy()
    }),
    "platform-profile.json"
  );

  const chapterAbsPath = join(rootDir, "chapter.md");
  await writeFile(chapterAbsPath, "# T\n正文\n", "utf8");

  const report = await computeReadabilityReport({
    rootDir,
    chapter: 1,
    chapterAbsPath,
    chapterText: "# T\n正文\n",
    platformProfile: profile
  });

  assert.equal(report.mode, "fallback");
  assert.ok(typeof report.script_error === "string" && report.script_error.includes("../evil.sh"));
  assert.ok(typeof report.script_error === "string" && report.script_error.includes("must not contain '..'"));
});

test("computeReadabilityReport falls back when lint_readability script resolves outside project root (symlink)", async () => {
  if (process.platform === "win32") return;

  const rootDir = await mkdtemp(join(tmpdir(), "novel-readability-symlink-test-"));
  await mkdir(join(rootDir, "scripts"), { recursive: true });

  const outsideDir = await mkdtemp(join(tmpdir(), "novel-readability-symlink-outside-"));
  const outsideAbs = join(outsideDir, "lint-readability.sh");
  await writeFile(outsideAbs, "#!/usr/bin/env bash\nset -euo pipefail\necho 'not-used'\n", "utf8");

  await symlink(outsideAbs, join(rootDir, "scripts", "lint-readability.sh"));

  const profile = parsePlatformProfile(makeProfileRaw({ readability: makeReadabilityPolicy() }), "platform-profile.json");
  const chapterAbsPath = join(rootDir, "chapter.md");
  await writeFile(chapterAbsPath, "# T\n正文\n", "utf8");

  const report = await computeReadabilityReport({
    rootDir,
    chapter: 1,
    chapterAbsPath,
    chapterText: "# T\n正文\n",
    platformProfile: profile
  });

  assert.equal(report.mode, "fallback");
  assert.ok(typeof report.script_error === "string" && report.script_error.includes("Unsafe path outside project root"));
});

test("computeReadabilityReport falls back when deterministic script output is invalid JSON", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "novel-readability-bad-json-test-"));
  await mkdir(join(rootDir, "scripts"), { recursive: true });

  const profile = parsePlatformProfile(makeProfileRaw({ readability: makeReadabilityPolicy() }), "platform-profile.json");
  await writeFile(join(rootDir, "platform-profile.json"), `${JSON.stringify(profile, null, 2)}\n`, "utf8");

  const chapterAbsPath = join(rootDir, "chapter.md");
  await writeFile(chapterAbsPath, "# T\n正文\n", "utf8");

  await writeFile(join(rootDir, "scripts", "lint-readability.sh"), "#!/usr/bin/env bash\nset -euo pipefail\necho 'not-json'\n", "utf8");

  const report = await computeReadabilityReport({
    rootDir,
    chapter: 1,
    chapterAbsPath,
    chapterText: "# T\n正文\n",
    platformProfile: profile
  });

  assert.equal(report.mode, "fallback");
  assert.ok(typeof report.script_error === "string" && report.script_error.includes("scripts/lint-readability.sh"));
  assert.equal(report.has_blocking_issues, false);
});

test("computeReadabilityReport falls back when deterministic script returns wrong scope.chapter", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "novel-readability-wrong-chapter-test-"));
  await mkdir(join(rootDir, "scripts"), { recursive: true });

  const profile = parsePlatformProfile(makeProfileRaw({ readability: makeReadabilityPolicy() }), "platform-profile.json");
  await writeFile(join(rootDir, "platform-profile.json"), `${JSON.stringify(profile, null, 2)}\n`, "utf8");

  const chapterAbsPath = join(rootDir, "chapter.md");
  await writeFile(chapterAbsPath, "# T\n正文\n", "utf8");

  const wrongScopeJson =
    '{"schema_version":1,"generated_at":"2026-01-01T00:00:00.000Z","scope":{"chapter":2},"policy":{"enabled":true,"max_paragraph_chars":10,"max_consecutive_exposition_paragraphs":2,"blocking_severity":"hard_only"},"issues":[]}';
  await writeFile(
    join(rootDir, "scripts", "lint-readability.sh"),
    `#!/usr/bin/env bash\nset -euo pipefail\nprintf '%s\\n' '${wrongScopeJson}'\n`,
    "utf8"
  );

  const report = await computeReadabilityReport({
    rootDir,
    chapter: 1,
    chapterAbsPath,
    chapterText: "# T\n正文\n",
    platformProfile: profile
  });

  assert.equal(report.mode, "fallback");
  assert.ok(typeof report.script_error === "string" && report.script_error.includes("scope.chapter=2"));
  assert.equal(report.has_blocking_issues, false);
});

test("writeReadabilityLogs writes history under readability-report-chapter-*.json", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "novel-readability-logs-test-"));

  const report: ReadabilityReport = {
    schema_version: 1,
    generated_at: "2026-01-01T00:00:00.000Z",
    scope: { chapter: 1 },
    policy: null,
    mode: "fallback",
    status: "pass",
    issues: [],
    has_blocking_issues: false
  };

  const out = await writeReadabilityLogs({ rootDir, chapter: 1, report });
  assert.equal(out.latestRel, "logs/readability/latest.json");
  assert.equal(out.historyRel, "logs/readability/readability-report-chapter-001.json");
});
