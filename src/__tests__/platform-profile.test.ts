import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parsePlatformProfile } from "../platform-profile.js";

test("parsePlatformProfile loads legacy profile without retention/readability/naming", () => {
  const raw = {
    schema_version: 1,
    platform: "qidian",
    created_at: "2026-01-01T00:00:00Z",
    word_count: { target_min: 1, target_max: 2, hard_min: 1, hard_max: 2 },
    hook_policy: { required: true, min_strength: 3, allowed_types: ["question"], fix_strategy: "hook-fix" },
    info_load: { max_new_entities_per_chapter: 0, max_unknown_entities_per_chapter: 0, max_new_terms_per_1k_words: 0 },
    compliance: { banned_words: [], duplicate_name_policy: "warn" },
    scoring: { genre_drive_type: "plot", weight_profile_id: "plot:v1" }
  };

  const profile = parsePlatformProfile(raw, "platform-profile.json");
  assert.equal(Object.prototype.hasOwnProperty.call(profile, "retention"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(profile, "readability"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(profile, "naming"), false);
});

test("parsePlatformProfile loads extended profile with retention/readability/naming", () => {
  const raw = {
    schema_version: 1,
    platform: "qidian",
    created_at: "2026-01-01T00:00:00Z",
    word_count: { target_min: 1, target_max: 2, hard_min: 1, hard_max: 2 },
    hook_policy: { required: true, min_strength: 3, allowed_types: ["question"], fix_strategy: "hook-fix" },
    info_load: { max_new_entities_per_chapter: 0, max_unknown_entities_per_chapter: 0, max_new_terms_per_1k_words: 0 },
    compliance: { banned_words: [], duplicate_name_policy: "warn" },
    scoring: { genre_drive_type: "plot", weight_profile_id: "plot:v1" },
    retention: {
      title_policy: { enabled: true, min_chars: 2, max_chars: 30, forbidden_patterns: [], auto_fix: false },
      hook_ledger: {
        enabled: true,
        fulfillment_window_chapters: 12,
        diversity_window_chapters: 5,
        max_same_type_streak: 2,
        min_distinct_types_in_window: 2,
        overdue_policy: "warn"
      }
    },
    readability: { mobile: { enabled: true, max_paragraph_chars: 320, max_consecutive_exposition_paragraphs: 3, blocking_severity: "hard_only" } },
    naming: { enabled: true, near_duplicate_threshold: 0.88, blocking_conflict_types: ["duplicate"], exemptions: {} }
  };

  const profile = parsePlatformProfile(raw, "platform-profile.json");
  assert.ok(profile.retention);
  assert.equal(profile.retention?.hook_ledger.overdue_policy, "warn");
  assert.equal(profile.readability?.mobile.blocking_severity, "hard_only");
  assert.deepEqual(profile.naming?.blocking_conflict_types, ["duplicate"]);
});

test("parsePlatformProfile rejects unknown naming conflict types", () => {
  const raw = {
    schema_version: 1,
    platform: "qidian",
    created_at: "2026-01-01T00:00:00Z",
    word_count: { target_min: 1, target_max: 2, hard_min: 1, hard_max: 2 },
    hook_policy: { required: true, min_strength: 3, allowed_types: ["question"], fix_strategy: "hook-fix" },
    info_load: { max_new_entities_per_chapter: 0, max_unknown_entities_per_chapter: 0, max_new_terms_per_1k_words: 0 },
    compliance: { banned_words: [], duplicate_name_policy: "warn" },
    scoring: { genre_drive_type: "plot", weight_profile_id: "plot:v1" },
    naming: { enabled: true, near_duplicate_threshold: 0.5, blocking_conflict_types: ["typo"] }
  };

  assert.throws(() => parsePlatformProfile(raw, "platform-profile.json"), /blocking_conflict_types.*unknown type/i);
});

test("templates/platform-profile.json defaults parse as valid platform profiles", async () => {
  const raw = JSON.parse(await readFile("templates/platform-profile.json", "utf8")) as { defaults?: Record<string, unknown> };
  assert.ok(raw.defaults, "expected templates/platform-profile.json to have defaults");

  for (const [platform, profileRaw] of Object.entries(raw.defaults)) {
    const profile = parsePlatformProfile(profileRaw, `templates/platform-profile.json#defaults.${platform}`);
    assert.ok(profile.retention, `expected defaults.${platform}.retention to be present`);
    assert.ok(profile.readability, `expected defaults.${platform}.readability to be present`);
    assert.ok(profile.naming, `expected defaults.${platform}.naming to be present`);
  }
});

