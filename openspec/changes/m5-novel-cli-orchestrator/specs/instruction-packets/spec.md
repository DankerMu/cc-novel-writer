## ADDED Requirements

### Requirement: The system SHALL define a canonical step id format for chapter pipeline steps
The system SHALL represent chapter pipeline actions using a canonical `step id` string that is stable across runs and suitable for filenames and logs.

#### Scenario: A chapter draft step id is representable
- **WHEN** the pipeline needs to draft chapter 48
- **THEN** the system can represent the action as a step id like `chapter:048:draft`

#### Scenario: A commit step id is representable
- **WHEN** the pipeline needs to commit chapter 48 staging artifacts
- **THEN** the system can represent the action as a step id like `chapter:048:commit`

### Requirement: Step ids SHALL map to checkpoint resume fields (`pipeline_stage` / `inflight_chapter`)
`step id` stage names (`draft|summarize|refine|judge|commit`) overlap conceptually with `.checkpoint.json.pipeline_stage` values (`drafting|drafted|refined|judged|committed|revising`) but they are **not the same namespace**:

- `step id` describes **the next action to execute**
- `pipeline_stage` describes **the last completed orchestration stage** for an inflight chapter

The system SHALL define and use the following mapping for advance/resume and auditing:

| Step id (next action) | Checkpoint fields after `advance <step>` | Notes |
|---|---|---|
| `chapter:NNN:draft` | `pipeline_stage="drafting"`, `inflight_chapter=NNN` | summarize becomes possible once `staging/chapters/chapter-NNN.md` exists |
| `chapter:NNN:summarize` | `pipeline_stage="drafted"`, `inflight_chapter=NNN` | refine becomes possible once summary/delta/crossref + storyline memory exist |
| `chapter:NNN:refine` | `pipeline_stage="refined"`, `inflight_chapter=NNN` | judge becomes possible once refined chapter is written |
| `chapter:NNN:judge` | `pipeline_stage="judged"`, `inflight_chapter=NNN` | commit becomes possible once `staging/evaluations/chapter-NNN-eval.json` exists |
| `chapter:NNN:commit` | `pipeline_stage="committed"`, `inflight_chapter=null` | commit finalizes the transaction and clears inflight state |

`orchestrator_state` (e.g. `WRITING`, `VOL_PLANNING`) remains the **high-level** state machine and is intentionally not encoded in step ids.

**Revision loop note:** when `pipeline_stage="revising"` (gate-triggered rewrite loop), the next action step id is still expressed in the same namespace (typically `chapter:NNN:draft`), while the checkpoint uses `revision_count` to bound retries.

### Requirement: The system SHALL compute the deterministic next step
Given `.checkpoint.json`, existing `staging/**` files, and `pipeline_stage`/`inflight_chapter`, the system SHALL compute a deterministic next step for safe resume.

#### Scenario: Fresh chapter starts at draft
- **WHEN** `.checkpoint.json.pipeline_stage` is `committed` (or null) and no inflight chapter exists
- **THEN** `novel next` returns `chapter:{last_completed_chapter+1}:draft`

#### Scenario: Interrupted pipeline resumes at the latest recoverable stage
- **WHEN** `.checkpoint.json.inflight_chapter` is set and `pipeline_stage` indicates an in-progress stage
- **THEN** `novel next` returns the correct resume step id according to the resume rules and existing staging files

### Requirement: The CLI SHALL emit an instruction packet for a given step
For a given step id, the CLI SHALL emit an instruction packet as JSON. The packet SHALL be sufficient for an external executor (Claude Code/Codex) to run the correct agent with a context manifest and write outputs under `staging/**`.

#### Scenario: Draft step packet targets ChapterWriter agent and staging output
- **WHEN** the user runs `novel instructions chapter:048:draft --json`
- **THEN** the packet identifies the `chapter-writer` agent and declares `staging/chapters/chapter-048.md` as an expected output

#### Scenario: Summarize step packet targets Summarizer agent and declares expected outputs
- **WHEN** the user runs `novel instructions chapter:048:summarize --json`
- **THEN** the packet identifies the `summarizer` agent and declares summary/state/storyline staging outputs expected for validation

### Requirement: The instruction packet SHALL default to manifest (path-based) context
The instruction packet SHALL reference project files by path (manifest mode) rather than embedding full file contents, to reduce context size and limit prompt-injection risk.

#### Scenario: Packet references style profile by path
- **WHEN** the user requests a draft packet
- **THEN** the packet includes `paths.style_profile` pointing to `style-profile.json` (or equivalent) instead of embedding its full content

### Requirement: The CLI SHALL support persisting instruction packets to `staging/` for audit and resume
When invoked with `--write-manifest`, the CLI SHALL write the packet JSON to a deterministic location under `staging/` and return the written path.

#### Scenario: Packet is written under staging manifests
- **WHEN** the user runs `novel instructions chapter:048:draft --write-manifest --json`
- **THEN** the CLI writes a JSON file under `staging/manifests/` and reports its path in the JSON response

## References

- `docs/dr-workflow/novel-writer-tool/final/prd/09-data.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/10-protocols.md`
- `agents/chapter-writer.md`
- `agents/summarizer.md`
