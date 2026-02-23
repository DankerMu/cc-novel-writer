## ADDED Requirements

### Requirement: The system SHALL compute a gate decision from violations and score
The system SHALL compute a `gate_decision` using:
- contract verification violations where `confidence="high"` (hard gate)
- overall weighted quality score
and SHALL follow the PRD threshold table for pass/polish/revise/pause outcomes.

#### Scenario: High-confidence violation forces revise
- **WHEN** QualityJudge returns `has_violations=true` with at least one `confidence="high"` hard violation
- **THEN** the system sets `gate_decision="revise"` regardless of overall score

### Requirement: The system SHALL implement an automated revision loop with a max retry bound
When `gate_decision="revise"`, the system SHALL:
- trigger an automated revision run (ChapterWriter revision mode, higher-quality model as configured)
- re-run evaluation and re-compute gate decision
- stop after at most 2 automated revisions

#### Scenario: Revision succeeds within the bound
- **WHEN** a chapter scores 3.2 with no violations
- **THEN** the system performs one automated revision and re-evaluates until the chapter reaches a non-revise decision or max revisions

### Requirement: Revision loop termination MUST be explicit and auditable
After reaching max revisions, the system SHALL:
- `force_pass` only when there are no high-confidence violations AND `overall >= 3.0`
- otherwise pause and require user decision before proceeding
and SHALL record `revisions` count and `force_passed` in the chapter log/evaluation metadata.

#### Scenario: Force pass after two revisions
- **WHEN** revisions reach 2 and the latest evaluation has `overall=3.1` with no high-confidence violations
- **THEN** the system commits the chapter with `force_passed=true` and records the termination reason

### Requirement: The system SHALL perform double-judge on key chapters
For key chapters (volume first, volume last, or convergence-event chapters), the system SHALL run a secondary QualityJudge evaluation (Opus or configured stronger model).

#### Scenario: Convergence chapter triggers a second judge
- **WHEN** chapter C is within any `convergence_events.chapter_range`
- **THEN** the system runs a secondary judge evaluation and records both results

### Requirement: Double-judge result aggregation SHALL follow worst-case logic
For double-judge chapters, the system SHALL:
- set final overall score to `min(primary.overall, secondary.overall)`
- treat any high-confidence hard violation from either judge as a hard gate input

#### Scenario: Lower score governs
- **WHEN** primary overall is 4.2 and secondary overall is 3.6
- **THEN** the final overall used for gate decision is 3.6

### Requirement: Gate decisions SHALL be logged for traceability
The system SHALL write gate decision metadata to `logs/chapter-{C:03d}-log.json`, including:
`gate_decision`, `revisions`, and for key chapters both judge model identifiers and scores.

#### Scenario: Log contains gate decision and revision count
- **WHEN** chapter C is committed
- **THEN** `logs/chapter-{C:03d}-log.json` includes `gate_decision` and `revisions`

## References

- `docs/dr-workflow/novel-writer-tool/final/prd/04-workflow.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/08-orchestrator.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/agents/quality-judge.md`
- `docs/dr-workflow/novel-writer-tool/final/milestones.md`

