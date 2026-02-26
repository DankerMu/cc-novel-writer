## ADDED Requirements

### Requirement: The system SHALL compute engagement density metrics per chapter
The system SHALL compute engagement density metrics per committed chapter and store them as an append-only JSONL stream (default: `engagement-metrics.jsonl` at project root).

Each JSONL record SHALL include at minimum:
- `chapter` (integer)
- `word_count` (integer)
- `plot_progression_beats` (integer; coarse count)
- `conflict_intensity` (1-5)
- `payoff_score` (1-5)
- `new_info_load_score` (1-5)
- `notes` (short, non-spoiler)

#### Scenario: Metrics record appended after commit
- **WHEN** chapter C is committed
- **THEN** the system appends one metrics record for chapter C to `engagement-metrics.jsonl`

### Requirement: The system SHALL analyze engagement density over a sliding window and flag low-density stretches
The system SHALL analyze engagement density over a sliding window (default: last 10 chapters) and flag “low-density stretches”, such as:
- consecutive chapters with low `plot_progression_beats`
- low payoff trend (few rewards/reveals)
- conflict plateau (conflict_intensity remains low)

The analysis SHALL produce a structured report under `logs/engagement/`.

#### Scenario: Low-density stretch flagged
- **WHEN** the last 5 chapters have consistently low payoff scores
- **THEN** the report flags a low-density stretch and suggests concrete planning adjustments

### Requirement: Engagement density outputs SHOULD be advisory by default
Engagement density flags SHOULD be warnings/suggestions by default and MUST NOT hard-block commit unless explicitly enabled by configuration.

#### Scenario: Advisory-only by default
- **WHEN** a low-density stretch is detected
- **THEN** the system surfaces it as a warning with suggestions
- **AND** does not require chapter rewrite solely based on this flag

### Requirement: Engagement reports SHALL be regression-friendly and auditable
Reports SHALL:
- include the chapter window analyzed
- include the computed metrics
- provide stable issue identifiers when applicable
- write `logs/engagement/latest.json` and a history report

#### Scenario: latest.json updated and history preserved
- **WHEN** a new engagement analysis completes
- **THEN** `logs/engagement/latest.json` is updated and a history file is written

## References

- `openspec/changes/m7-narrative-health-ledgers/proposal.md`
