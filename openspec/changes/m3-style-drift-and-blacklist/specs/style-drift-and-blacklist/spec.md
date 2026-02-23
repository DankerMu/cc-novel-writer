## ADDED Requirements

### Requirement: The system SHALL detect style drift every 5 chapters
Every 5 chapters, the system SHALL extract style metrics from recent output and compare against `style-profile.json` baseline, including at minimum:
- average sentence length
- dialogue ratio
and SHALL flag drift when thresholds exceed the configured limits (e.g., >20% sentence length, >15% dialogue ratio).

#### Scenario: Drift detection runs on chapter 25
- **WHEN** the user commits chapter 25
- **THEN** the system runs drift detection for the last 5 chapters and produces a drift result

### Requirement: The system SHALL generate `style-drift.json` when drift is detected
When drift is detected, the system SHALL write `style-drift.json` containing:
- detected_chapter
- `drifts[]` entries with `{metric, baseline, current, directive}`
- `injected_to[]` listing at least `ChapterWriter` and `StyleRefiner`

#### Scenario: Drift file created with directives
- **WHEN** average sentence length deviates beyond threshold
- **THEN** `style-drift.json` includes a directive to return to baseline pacing

### Requirement: The system SHALL inject drift directives until baseline is restored
When `style-drift.json` exists, the system SHALL inject its directives into ChapterWriter and StyleRefiner context on subsequent chapters.
It SHALL clear or remove drift directives once metrics return within the recovery threshold (e.g., <10% deviation).

#### Scenario: Drift cleared after recovery
- **WHEN** the next drift check shows deviations below the recovery threshold
- **THEN** the system clears `style-drift.json` (or marks it inactive) to stop injection

### Requirement: The system SHALL support dynamic AI blacklist updates
The system SHALL support updating `ai-blacklist.json` with new high-frequency AI phrases detected during writing, including storing update metadata sufficient for audit.

#### Scenario: New AI phrase appended
- **WHEN** QualityJudge repeatedly flags a phrase as a new AI-like expression
- **THEN** the blacklist file is updated to include the phrase with a timestamp/version bump

### Requirement: Blacklist updates MUST include false-positive protection
If a blacklist entry is a high-frequency term in the user's style samples or is explicitly whitelisted, the system SHALL exempt it from enforcement/scoring signals.

#### Scenario: User-style phrase exempted
- **WHEN** a candidate blacklist phrase appears as an intentional high-frequency expression in the user’s style samples
- **THEN** the system records it as exempt and does not treat its occurrences as blacklist hits

### Requirement: Deterministic blacklist lint script SHALL be used when available
If `scripts/lint-blacklist.sh` exists, the system SHALL prefer it to compute blacklist hit counts (and optional locations); otherwise it SHALL fall back to an estimated/LLM path.

#### Scenario: Script path preferred for hit counting
- **WHEN** `scripts/lint-blacklist.sh` exists and returns valid JSON
- **THEN** the system uses its hit counts to inform style naturalness scoring

## References

- `docs/dr-workflow/novel-writer-tool/final/prd/07-anti-ai.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/09-data.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/04-quality.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/06-extensions.md`

