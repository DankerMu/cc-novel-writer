## ADDED Requirements

### Requirement: The system SHALL extract named entities for consistency checks
The system SHALL extract named entities (at minimum characters and locations) from recent chapters (preferably via summaries, with optional access to full chapter text for evidence).

#### Scenario: Entity list generated for a batch of chapters
- **WHEN** the user runs a consistency check for chapters C-9..C
- **THEN** the system produces an entity list per chapter sufficient to compare across chapters

### Requirement: The system SHALL detect high-confidence continuity contradictions
The system SHALL detect high-confidence contradictions including:
- A character being in two incompatible locations at the same time marker
- A storyline time sequence contradicting concurrent storyline state (LS-001)

#### Scenario: Location contradiction flagged with evidence
- **WHEN** chapter summaries imply Character X is in Location A and Location B in the same time marker
- **THEN** the system flags a contradiction and includes evidence snippets and confidence

### Requirement: Cross-storyline timeline consistency SHALL be enforced for LS-001
The system SHALL provide an input signal for LS-001 (hard) by checking timeline consistency across active storylines using available time markers and concurrent_state.

#### Scenario: Timeline contradiction becomes an LS-001 violation signal
- **WHEN** concurrent_state indicates two simultaneous events that cannot co-exist
- **THEN** the system reports an LS-001 violation signal with confidence grading

### Requirement: Deterministic NER script SHALL be used when available
If a deterministic script `scripts/run-ner.sh` exists, the system SHALL prefer it for entity extraction; otherwise it SHALL fall back to an LLM-based extraction path.

#### Scenario: Script path preferred
- **WHEN** `scripts/run-ner.sh` exists and returns valid JSON
- **THEN** the system uses its output rather than re-extracting entities via LLM

### Requirement: Consistency reports SHALL be actionable and regression-friendly
The system SHALL output a report that includes:
issue type, severity, confidence, chapter references, and suggested fix guidance.
The report SHALL be suitable for repeated runs (regression) on the same chapter set.

#### Scenario: Regression run produces comparable output
- **WHEN** the same chapter batch is checked twice without content changes
- **THEN** the report is stable enough to compare (same issue IDs/types, evidence may vary minimally)

## References

- `docs/dr-workflow/novel-writer-tool/final/milestones.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/06-storylines.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/06-extensions.md`

