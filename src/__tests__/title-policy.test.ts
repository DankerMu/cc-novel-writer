import assert from "node:assert/strict";
import test from "node:test";

import { parsePlatformProfile } from "../platform-profile.js";
import { assertTitleFixOnlyChangedH1, computeTitlePolicyReport, extractChapterTitleFromMarkdown } from "../title-policy.js";

function makeProfileRaw(extra: Record<string, unknown>): Record<string, unknown> {
  return {
    schema_version: 1,
    platform: "qidian",
    created_at: "2026-01-01T00:00:00Z",
    word_count: { target_min: 1, target_max: 2, hard_min: 1, hard_max: 2 },
    hook_policy: { required: false, min_strength: 3, allowed_types: ["question"], fix_strategy: "hook-fix" },
    info_load: { max_new_entities_per_chapter: 0, max_unknown_entities_per_chapter: 0, max_new_terms_per_1k_words: 0 },
    compliance: { banned_words: ["禁词"], duplicate_name_policy: "warn" },
    scoring: { genre_drive_type: "plot", weight_profile_id: "plot:v1" },
    ...extra
  };
}

function makeTitlePolicy(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    enabled: true,
    min_chars: 2,
    max_chars: 10,
    forbidden_patterns: ["剧透"],
    required_patterns: ["^第\\d+章"],
    auto_fix: true,
    ...overrides
  };
}

function makeRetention(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    title_policy: makeTitlePolicy(),
    hook_ledger: {
      enabled: false,
      fulfillment_window_chapters: 10,
      diversity_window_chapters: 5,
      max_same_type_streak: 2,
      min_distinct_types_in_window: 2,
      overdue_policy: "warn"
    },
    ...overrides
  };
}

test("extractChapterTitleFromMarkdown returns the first non-empty H1 title", () => {
  const out = extractChapterTitleFromMarkdown("\n\n# 第1章 开场\n正文");
  assert.equal(out.has_h1, true);
  assert.equal(out.title_text, "第1章 开场");
  assert.equal(out.line_no, 3);
});

test("extractChapterTitleFromMarkdown reports missing H1 when first non-empty line is not H1", () => {
  const out = extractChapterTitleFromMarkdown("正文\n# 标题");
  assert.equal(out.has_h1, false);
  assert.equal(out.line_no, 1);
  assert.equal(out.raw_line, "正文");
});

test("computeTitlePolicyReport skips when title_policy is missing/disabled", () => {
  const profile = parsePlatformProfile(makeProfileRaw({ retention: null }), "platform-profile.json");
  const report = computeTitlePolicyReport({ chapter: 1, chapterText: "# 标题\n正文", platformProfile: profile });
  assert.equal(report.status, "skipped");
});

test("computeTitlePolicyReport detects missing H1 title as hard violation when enabled", () => {
  const profile = parsePlatformProfile(makeProfileRaw({ retention: makeRetention() }), "platform-profile.json");
  const report = computeTitlePolicyReport({ chapter: 1, chapterText: "正文", platformProfile: profile });
  assert.equal(report.status, "violation");
  assert.equal(report.has_hard_violations, true);
  assert.ok(report.issues.some((i) => i.id.includes("missing_h1")));
});

test("computeTitlePolicyReport flags too-long title as warn (soft)", () => {
  const profile = parsePlatformProfile(makeProfileRaw({ retention: makeRetention({ title_policy: makeTitlePolicy({ max_chars: 3, required_patterns: [] }) }) }), "platform-profile.json");
  const report = computeTitlePolicyReport({ chapter: 1, chapterText: "# 太长的标题\n正文", platformProfile: profile });
  assert.equal(report.status, "warn");
  assert.equal(report.has_hard_violations, false);
  assert.ok(report.issues.some((i) => i.id.includes("too_long")));
});

test("computeTitlePolicyReport flags required-pattern mismatch as warn (soft)", () => {
  const profile = parsePlatformProfile(makeProfileRaw({ retention: makeRetention() }), "platform-profile.json");
  const report = computeTitlePolicyReport({ chapter: 1, chapterText: "# 开场\n正文", platformProfile: profile });
  assert.equal(report.status, "warn");
  assert.ok(report.issues.some((i) => i.id.includes("required_pattern_missing")));
});

test("computeTitlePolicyReport flags forbidden pattern matches as warn (soft)", () => {
  const profile = parsePlatformProfile(makeProfileRaw({ retention: makeRetention({ title_policy: makeTitlePolicy({ required_patterns: [] }) }) }), "platform-profile.json");
  const report = computeTitlePolicyReport({ chapter: 1, chapterText: "# 这是剧透\n正文", platformProfile: profile });
  assert.equal(report.status, "warn");
  assert.ok(report.issues.some((i) => i.id.includes("forbidden_pattern")));
});

test("computeTitlePolicyReport flags banned words in title as hard violation", () => {
  const profile = parsePlatformProfile(makeProfileRaw({ retention: makeRetention({ title_policy: makeTitlePolicy({ forbidden_patterns: [], required_patterns: [] }) }) }), "platform-profile.json");
  const report = computeTitlePolicyReport({ chapter: 1, chapterText: "# 禁词来了\n正文", platformProfile: profile });
  assert.equal(report.status, "violation");
  assert.equal(report.has_hard_violations, true);
  assert.ok(report.issues.some((i) => i.id.includes("banned_words")));
});

test("assertTitleFixOnlyChangedH1 allows inserting a new title line", () => {
  const before = "\n正文第一段\n第二段\n";
  const after = "\n# 新标题\n正文第一段\n第二段\n";
  assert.doesNotThrow(() => assertTitleFixOnlyChangedH1({ before, after, file: "chapters/chapter-001.md" }));
});

test("assertTitleFixOnlyChangedH1 rejects body changes", () => {
  const before = "# 标题\n正文\n";
  const after = "# 新标题\n正文改了\n";
  assert.throws(() => assertTitleFixOnlyChangedH1({ before, after, file: "chapters/chapter-001.md" }), /only change.*H1/i);
});

