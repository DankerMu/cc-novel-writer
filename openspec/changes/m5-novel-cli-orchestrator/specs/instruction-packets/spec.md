## ADDED Requirements

### Requirement: The system SHALL define a canonical step id format for chapter pipeline steps
The system SHALL represent chapter pipeline actions using a canonical `step id` string that is stable across runs and suitable for filenames and logs.

#### Scenario: A chapter draft step id is representable
- **WHEN** the pipeline needs to draft chapter 48
- **THEN** the system can represent the action as a step id like `chapter:048:draft`

#### Scenario: A commit step id is representable
- **WHEN** the pipeline needs to commit chapter 48 staging artifacts
- **THEN** the system can represent the action as a step id like `chapter:048:commit`

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

