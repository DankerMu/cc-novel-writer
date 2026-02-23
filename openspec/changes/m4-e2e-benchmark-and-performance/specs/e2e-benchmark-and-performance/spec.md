## ADDED Requirements

### Requirement: The system SHALL provide an end-to-end benchmark definition for 100 chapters
The system SHALL define an end-to-end benchmark that covers 3 volumes / 100 chapters, including required inputs/configuration and expected outputs for verification.

#### Scenario: Benchmark run is well-defined
- **WHEN** a maintainer prepares to run the benchmark
- **THEN** they can follow the documented inputs/config and understand what artifacts and metrics should be produced

### Requirement: Benchmark reports SHALL include quality and compliance metrics
The benchmark report SHALL include, at minimum:
- Spec + LS compliance rate (violations per chapter set)
- average QualityJudge overall score and revision counts
- storyline convergence attainment rate (planned vs actual)
- foreshadowing resolution/completion statistics

#### Scenario: Compliance rate computed
- **WHEN** the benchmark completes 100 chapters
- **THEN** the report includes overall Spec+LS compliance rate and the count of violating chapters

### Requirement: The system SHALL measure cold-start recovery performance
The system SHALL measure cold-start recovery time (file-based restore) and SHALL target < 30 seconds as a benchmark goal.

#### Scenario: Cold start measurement recorded
- **WHEN** a new session starts in an existing project directory
- **THEN** the benchmark records the time to determine next-step recommendation and compares it to the target

### Requirement: Pipeline stage durations SHALL be aggregatable for performance analysis
The system SHALL ensure per-chapter logs include stage durations such that a performance report can aggregate time spent in draft/summarize/refine/judge.

#### Scenario: Stage timings aggregated
- **WHEN** the benchmark tool reads `logs/chapter-*-log.json` for 100 chapters
- **THEN** it can compute total/average duration per stage across the run

### Requirement: MCP wrapping SHALL remain optional for benchmark execution
If an MCP server is configured for deterministic tools, the system MAY use it, but benchmark execution SHALL NOT require MCP to be present.

#### Scenario: Benchmark runs without MCP
- **WHEN** no MCP configuration is present
- **THEN** the benchmark can still run using the baseline tool paths (LLM + Bash/system commands)

## References

- `docs/dr-workflow/novel-writer-tool/final/milestones.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/11-appendix.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/06-extensions.md`

