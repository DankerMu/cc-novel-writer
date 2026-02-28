## ADDED Requirements

### Requirement: The system SHALL run sliding-window consistency audits on a fixed cadence
The system SHALL run a sliding-window consistency audit:
- every 5 committed chapters, and
- at volume end (full-volume audit)

When a commit is the volume-end chapter, the system SHOULD run only the volume-end audit (skip the periodic window for that commit) to avoid redundant work.

The default sliding-window parameters SHALL be:
- stride = 5 chapters
- window = 10 chapters (most recent 10)

#### Scenario: Commit chapter 25 triggers a window audit
- **WHEN** the user commits chapter 25
- **THEN** the system runs a consistency audit over chapters 16–25 (10 chapters)
- **AND** produces an updated report in `logs/continuity/`

### Requirement: ConsistencyAuditor outputs MUST be regression-friendly and compatible with continuity schema
Consistency audit outputs SHALL be written under `logs/continuity/` and MUST be compatible with the continuity report schema defined in `skills/continue/references/continuity-checks.md` (at minimum fields and ordering rules).

The system SHALL write:
- a historical report file for traceability, and
- update `logs/continuity/latest.json` for fast injection (best-effort)

`logs/continuity/latest.json` SHOULD be **monotonic** to avoid concurrency regressions:
- prefer the report with the largest `chapter_range[1]` (end chapter)
- if end chapter ties: prefer `scope="volume_end"` over `scope="periodic"`
- if still ties: prefer the newer `generated_at` when comparable

#### Scenario: latest.json is monotonic and history preserved
- **WHEN** an audit completes successfully
- **THEN** a `continuity-report-*.json` history file is written for that range
- **AND** `logs/continuity/latest.json` is updated only if it would move the summary forward (or keep the same end chapter with higher-priority scope)
- **AND** failures to update `latest.json` MUST NOT break the commit (history files remain the source of truth)

### Requirement: Volume-end audits SHALL be crash-compensated
To avoid a “checkpoint committed but volume-end audit missing” gap, the system SHALL:
- create a pending marker before running a `scope="volume_end"` audit
- remove the marker only after successfully writing `volumes/vol-{V:02d}/continuity-report.json`

The pending marker SHOULD be written under `logs/continuity/` as:
- `pending-volume-end-vol-{V:02d}.json`

### Requirement: The system SHOULD include “logic drift” hints without hard-blocking by default
In addition to hard continuity contradictions (location/timeline/relationship), the audit SHOULD emit low-severity hints for:
- goal/motivation drift
- causality gaps that accumulate over chapters

These hints MUST NOT be treated as hard violations by default unless explicitly configured.

#### Scenario: Logic drift hint is informational
- **WHEN** the auditor detects gradual motivation drift across the window
- **THEN** it records a low-severity issue/hint
- **AND** does not hard-block commit solely due to this hint

### Requirement: High-confidence timeline contradictions SHALL be surfaced as LS-001 signals
When the audit reports a high-confidence `timeline_contradiction`, the system SHALL surface it as an LS-001 input signal to QualityJudge (consistent with existing behavior).

#### Scenario: Timeline contradiction becomes a judge input
- **WHEN** `logs/continuity/latest.json` contains a high-confidence `timeline_contradiction`
- **THEN** the next QualityJudge invocation receives a compact summary of the issue as strong evidence input

## References

- `skills/continue/references/continuity-checks.md`
- `openspec/changes/archive/2026-02-25-m3-ner-and-continuity-checks/specs/ner-and-continuity-checks/spec.md`
- `openspec/changes/m6-platform-optimization/proposal.md`
