## ADDED Requirements

### Requirement: The system SHALL maintain a persistent promise ledger
The system SHALL maintain a persistent promise ledger at the project root (default: `promise-ledger.json`) as the source of truth for narrative “promises”, including at minimum:
- selling-point promises (爽点机制承诺)
- core mysteries (核心谜团承诺)
- mechanism promises (规则/系统/外挂机制承诺)
- relationship arcs (关系弧承诺)

Each promise entry SHALL include at minimum:
- `id` (stable identifier)
- `type` (bounded enum)
- `promise_text` (short, non-spoiler)
- `status` in {`promised`, `advanced`, `delivered`}
- `introduced_chapter` (integer)
- `last_touched_chapter` (integer)
- `history[]` entries with `{chapter, action, note}`

#### Scenario: Promise ledger file exists and is loadable
- **WHEN** the project enables narrative health ledgers
- **THEN** `promise-ledger.json` exists and can be loaded as the source of truth

### Requirement: The system SHALL compute dormancy and surface overdue promises
The system SHALL compute `chapters_since_last_touch` for each promise and SHOULD surface overdue promises in periodic reports.

Overdue thresholds SHOULD be configurable, and MUST default to a conservative warn-only behavior.

#### Scenario: Overdue promise surfaced in report
- **WHEN** a promise has not been touched for more than the configured dormancy threshold
- **THEN** the periodic report highlights it and suggests a non-spoiler next touch

### Requirement: The system SHALL produce periodic promise-ledger reports with actionable suggestions
The system SHALL generate reports under `logs/promises/` including:
- dormant promises
- high-risk promises (many open promises, low advancement rate)
- suggested next touches (non-spoiler)

It SHALL update `logs/promises/latest.json` and write history reports for traceability.

#### Scenario: Volume-end report includes promise status summary
- **WHEN** the user reaches volume end review
- **THEN** the system produces a promise-ledger report summarizing promise progression within the volume

### Requirement: Promise-ledger suggestions MUST avoid spoilers
Suggestions derived from the ledger MUST be phrased as “light-touch” reminders and MUST avoid revealing eventual payoffs.

#### Scenario: Suggestion is non-spoiler
- **WHEN** the system suggests touching a dormant core mystery
- **THEN** the suggestion does not reveal the answer, only recommends a subtle reminder or small clue

## References

- `openspec/changes/m7-narrative-health-ledgers/proposal.md`
- `openspec/changes/m6-platform-optimization/specs/foreshadow-visibility/spec.md`
