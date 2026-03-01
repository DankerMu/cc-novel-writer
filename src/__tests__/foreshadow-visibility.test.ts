import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  computeForeshadowVisibilityReport,
  deriveForeshadowDormancyThresholds,
  loadForeshadowGlobalItems,
  writeForeshadowVisibilityLogs,
  type ForeshadowVisibilityReport
} from "../foreshadow-visibility.js";

test("deriveForeshadowDormancyThresholds adjusts by genre_drive_type", () => {
  assert.deepEqual(deriveForeshadowDormancyThresholds(null), { short: 6, medium: 12, long: 24 });
  assert.deepEqual(deriveForeshadowDormancyThresholds("plot"), { short: 4, medium: 10, long: 22 });
  assert.deepEqual(deriveForeshadowDormancyThresholds("character"), { short: 5, medium: 11, long: 23 });
  assert.deepEqual(deriveForeshadowDormancyThresholds("slice_of_life"), { short: 8, medium: 14, long: 26 });
  assert.deepEqual(deriveForeshadowDormancyThresholds("suspense"), { short: 3, medium: 9, long: 21 });
});

test("computeForeshadowVisibilityReport includes items at the dormancy threshold", () => {
  const items: Array<Record<string, unknown> & { id: string }> = [
    { id: "a", scope: "short", status: "planted", last_updated_chapter: 10, description: "A" },
    { id: "b", scope: "short", status: "planted", last_updated_chapter: 11, description: "B" }
  ];

  const report = computeForeshadowVisibilityReport({
    items,
    asOfChapter: 16, // short base threshold is 6
    volume: 1,
    platform: null,
    genreDriveType: null
  });

  const ids = report.dormant_items.map((it) => it.id);
  assert.ok(ids.includes("a"), "expected item at threshold to be included");
  assert.ok(!ids.includes("b"), "expected item below threshold to be excluded");
});

test("loadForeshadowGlobalItems normalizes both list and object schemas", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "novel-foreshadow-test-"));
  await mkdir(join(rootDir, "foreshadowing"), { recursive: true });
  const globalAbs = join(rootDir, "foreshadowing", "global.json");

  await writeFile(globalAbs, `${JSON.stringify([{ id: "x" }], null, 2)}\n`, "utf8");
  const listItems = await loadForeshadowGlobalItems(rootDir);
  assert.equal(listItems.length, 1);
  assert.equal(listItems[0]?.id, "x");

  await writeFile(globalAbs, `${JSON.stringify({ foreshadowing: [{ id: "y" }] }, null, 2)}\n`, "utf8");
  const objItems = await loadForeshadowGlobalItems(rootDir);
  assert.equal(objItems.length, 1);
  assert.equal(objItems[0]?.id, "y");
});

test("writeForeshadowVisibilityLogs keeps latest.json monotonic by chapter (and generated_at tie-break)", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "novel-foreshadow-log-test-"));

  const mkReport = (chapter: number, generated_at: string): ForeshadowVisibilityReport => ({
    schema_version: 1,
    generated_at,
    as_of: { chapter, volume: 1 },
    platform: null,
    genre_drive_type: null,
    thresholds: { short: 6, medium: 12, long: 24 },
    dormant_items: [],
    counts: { dormant_total: 0, dormant_by_scope: { short: 0, medium: 0, long: 0 } }
  });

  await writeForeshadowVisibilityLogs({ rootDir, report: mkReport(5, "2026-01-01T00:00:00.000Z"), historyRange: null });
  await writeForeshadowVisibilityLogs({ rootDir, report: mkReport(4, "2026-01-02T00:00:00.000Z"), historyRange: null });

  const latestAbs = join(rootDir, "logs", "foreshadowing", "latest.json");
  const raw = JSON.parse(await readFile(latestAbs, "utf8")) as ForeshadowVisibilityReport;
  assert.equal(raw.as_of.chapter, 5);

  await writeForeshadowVisibilityLogs({ rootDir, report: mkReport(5, "2025-01-01T00:00:00.000Z"), historyRange: null });
  const raw2 = JSON.parse(await readFile(latestAbs, "utf8")) as ForeshadowVisibilityReport;
  assert.equal(raw2.generated_at, "2026-01-01T00:00:00.000Z");

  await writeForeshadowVisibilityLogs({ rootDir, report: mkReport(5, "2027-01-01T00:00:00.000Z"), historyRange: null });
  const raw3 = JSON.parse(await readFile(latestAbs, "utf8")) as ForeshadowVisibilityReport;
  assert.equal(raw3.generated_at, "2027-01-01T00:00:00.000Z");
});

test("writeForeshadowVisibilityLogs writes visibility history under foreshadow-visibility-vol-*.json", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "novel-foreshadow-history-test-"));

  const report: ForeshadowVisibilityReport = {
    schema_version: 1,
    generated_at: "2026-01-01T00:00:00.000Z",
    as_of: { chapter: 10, volume: 1 },
    platform: null,
    genre_drive_type: null,
    thresholds: { short: 6, medium: 12, long: 24 },
    dormant_items: [],
    counts: { dormant_total: 0, dormant_by_scope: { short: 0, medium: 0, long: 0 } }
  };

  const res = await writeForeshadowVisibilityLogs({ rootDir, report, historyRange: { start: 1, end: 10 } });
  assert.equal(res.historyRel, "logs/foreshadowing/foreshadow-visibility-vol-01-ch001-ch010.json");
  const raw = JSON.parse(await readFile(join(rootDir, res.historyRel!), "utf8")) as ForeshadowVisibilityReport;
  assert.equal(raw.schema_version, 1);
  assert.equal(raw.as_of.chapter, 10);
});
