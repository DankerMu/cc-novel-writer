## ADDED Requirements

### Requirement: Pipeline SHALL execute in a fixed stage order per chapter
For each chapter, the system SHALL execute the pipeline in the following order:
1) Acquire `.novel.lock/`
2) ChapterWriter (draft)
3) Summarizer (summary + ops + crossref + memory)
4) StyleRefiner (polish without semantic drift)
5) QualityJudge (contract verification + scoring)
6) Gate decision (pass/polish/revise/rewrite)
7) Commit (move artifacts + merge state + update checkpoint)

#### Scenario: Successful chapter generation
- **WHEN** `/novel:continue 1` runs in `WRITING` state
- **THEN** the pipeline runs in the fixed order and produces a committed chapter with evaluation, summary, and checkpoint update

### Requirement: Agents SHALL respect write boundaries
ChapterWriter, Summarizer, and StyleRefiner SHALL only write under `staging/**`. QualityJudge SHALL be read-only and SHALL NOT write any project files.

#### Scenario: No agent writes to final directories
- **WHEN** the pipeline runs
- **THEN** only the entry skill writes to `chapters/`, `summaries/`, `evaluations/`, `state/`, and `storylines/**` during commit

### Requirement: Staging outputs SHALL follow canonical paths and names
The system SHALL write intermediate artifacts to canonical staging paths using `chapter-{C:03d}` naming:
- `staging/chapters/chapter-{C:03d}.md`
- `staging/summaries/chapter-{C:03d}-summary.md`
- `staging/state/chapter-{C:03d}-delta.json`
- `staging/state/chapter-{C:03d}-crossref.json`
- `staging/storylines/{storyline_id}/memory.md`
- `staging/evaluations/chapter-{C:03d}-eval.json`

#### Scenario: Canonical staging artifacts exist after Summarizer
- **WHEN** Summarizer completes for chapter C
- **THEN** the corresponding summary/delta/crossref/memory files exist under `staging/**`

### Requirement: Checkpoint SHALL enable idempotent recovery
`.checkpoint.json` SHALL record `pipeline_stage` and `inflight_chapter`. On restart, the system SHALL resume from the latest recoverable stage based on `pipeline_stage` and existing staging files.

#### Scenario: Resume after interruption at refined stage
- **WHEN** a session ends after `pipeline_stage="refined"` for chapter C
- **THEN** a subsequent run resumes from QualityJudge (and later stages) without re-drafting

### Requirement: Gate decision SHALL follow thresholds and violation confidence
The gate decision SHALL:
- Force revision when any contract violation has `confidence="high"`
- Not block the pipeline for `confidence="medium"` or `"low"` violations (record warnings)
- Apply score thresholds (pass/polish/revise/rewrite) per PRD tables
- Enforce a maximum revision count (e.g., 2) to prevent infinite loops

#### Scenario: High-confidence violation triggers forced revise
- **WHEN** QualityJudge reports a high-confidence L1/L2/L3/LS violation
- **THEN** the system re-invokes ChapterWriter revision and re-runs the gate until max revisions is reached

### Requirement: Commit SHALL be atomic and update derived state
On gate pass, commit SHALL:
- Move chapter markdown into `chapters/`
- Move summary markdown into `summaries/`
- Move evaluation JSON into `evaluations/`
- Merge state delta into `state/current-state.json` and append `state/changelog.jsonl`
- Update `foreshadowing/global.json` from `foreshadow` ops
- Update `.checkpoint.json` to `pipeline_stage="committed"` and increment progress

#### Scenario: After commit, project directories reflect the new chapter
- **WHEN** commit completes for chapter C
- **THEN** `chapters/chapter-{C:03d}.md` exists and `.checkpoint.json.last_completed_chapter` advances

## References

- `docs/dr-workflow/novel-writer-tool/final/prd/10-protocols.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/09-data.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/agents/quality-judge.md`

