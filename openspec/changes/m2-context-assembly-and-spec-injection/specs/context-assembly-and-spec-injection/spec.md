## ADDED Requirements

### Requirement: Context assembly SHALL be deterministic per agent type
The system SHALL assemble context variables deterministically based on project files for each agent type (ChapterWriter, Summarizer, StyleRefiner, QualityJudge, PlotArchitect).

#### Scenario: ChapterWriter context assembled for chapter C
- **WHEN** `/novel:continue` starts drafting chapter C
- **THEN** the ChapterWriter context contains the required keys sourced from the correct project files

### Requirement: ChapterWriter context SHALL include storyline and spec inputs
For ChapterWriter, context SHALL include at minimum:
- Project brief (`brief.md`)
- Current volume outline and extracted chapter outline block
- `storyline_id`, `storyline_context`, `concurrent_state`, and storyline memories (`storylines/{id}/memory.md`)
- Recent 3 summaries
- Current state
- L1/L2/L3 inputs when available (world rules, character contracts, chapter contract)
- Style profile and blacklist Top-10 reminder

#### Scenario: Storyline memory injected for current line
- **WHEN** chapter C is scheduled on storyline S
- **THEN** `storylines/S/memory.md` is loaded and injected into ChapterWriter context

### Requirement: Summarizer context SHALL include `entity_id_map` for ops normalization
For Summarizer, context SHALL include at minimum:
- Chapter content (draft)
- Current state
- Foreshadowing tasks (when available)
- `entity_id_map` constructed from `characters/active/*.json` as `{slug_id → display_name}` mapping
- Writer hints (optional)

#### Scenario: Summarizer receives entity map for slug ID conversion
- **WHEN** Summarizer extracts ops paths from chapter text containing Chinese display names
- **THEN** it uses `entity_id_map` to emit slug-ID-based ops paths (e.g., `characters.lin-feng.location`)

### Requirement: L2 contract pruning SHALL follow chapter-contract preconditions
When `chapter_contract.preconditions.character_states` exists, the system SHALL load L2 contracts for those characters without a hard upper limit. When it does not exist, it SHALL load at most 15 active characters (by recency/importance rule).

#### Scenario: No contract → default cap
- **WHEN** no chapter contract exists for chapter C
- **THEN** at most 15 active character contracts are injected

### Requirement: Outline extraction SHALL follow a strict format
Chapter outline extraction from `volumes/vol-{V:02d}/outline.md` SHALL locate the block by the heading prefix `### 第 {C} 章` (it SHALL NOT require a literal `:`) and extract until the next `###` block or EOF.

#### Scenario: Outline parsing fails safely
- **WHEN** the outline does not contain a valid `### 第 C 章` block
- **THEN** the system surfaces an actionable error and routes the user back to volume planning to fix the outline format

### Requirement: File-content injection SHALL use `<DATA>` delimiter
Whenever any file raw content (`.md` or other external text) is passed to an agent via Task `prompt` parameter, it SHALL be wrapped with `<DATA type="..." source="..." readonly="true">...</DATA>`.

#### Scenario: Research doc injected as data
- **WHEN** `research/*.md` is injected into WorldBuilder or CharacterWeaver
- **THEN** it is wrapped in a `<DATA type="research">` block and treated as non-instructional data

## References

- `docs/dr-workflow/novel-writer-tool/final/prd/08-orchestrator.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/02-skills.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/05-spec-system.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/06-storylines.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/10-protocols.md`
