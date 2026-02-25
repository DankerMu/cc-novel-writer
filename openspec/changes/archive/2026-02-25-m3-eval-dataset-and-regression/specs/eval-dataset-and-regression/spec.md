## ADDED Requirements

### Requirement: The system SHALL define a labeled evaluation dataset format
The system SHALL define a labeled dataset format for at least 30 chapters, capturing:
- labeled continuity errors (NER/continuity categories)
- labeled Spec/LS violations (layer, rule_id, severity/confidence)
- labeled storyline issues
- human scores (overall and optional dimension scores)

#### Scenario: A single labeled chapter entry is parseable
- **WHEN** the regression runner reads one dataset record for chapter C
- **THEN** it can parse labels and human scores deterministically

### Requirement: The system SHALL support QualityJudge calibration against human scores
The system SHALL compute correlation between QualityJudge scores and human scores (at minimum overall), and SHALL output a calibration report including correlation values and recommended threshold adjustments.

#### Scenario: Calibration report generated
- **WHEN** the user runs calibration on a labeled dataset
- **THEN** the system outputs Pearson correlation for overall scores and a brief recommendation summary

### Requirement: The system SHALL run regression checks on M2 outputs
The system SHALL support running regression checks against an M2-produced project (30 chapters), including:
- Spec + LS compliance rate statistics
- continuity/NER check outputs (when available)
and SHALL produce a structured regression report.

#### Scenario: Regression report includes compliance rate
- **WHEN** regression runs on a 30-chapter project
- **THEN** the report includes Spec+LS compliance rate and per-rule violation counts

### Requirement: Regression runs SHALL be archived for comparison
The system SHALL archive regression outputs with:
- timestamp
- configuration snapshot (models, thresholds, enabled checks)
- summary metrics
to enable future comparisons.

#### Scenario: Two runs can be compared
- **WHEN** two regression runs are executed with different thresholds
- **THEN** their archived summaries can be compared for metric deltas

## References

- `docs/dr-workflow/novel-writer-tool/final/milestones.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/11-appendix.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/04-workflow.md`

