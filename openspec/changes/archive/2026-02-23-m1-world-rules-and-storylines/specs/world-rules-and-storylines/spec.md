## ADDED Requirements

### Requirement: WorldBuilder SHALL output narrative world docs and structured L1 rules
On initialization, WorldBuilder SHALL output:
- `world/geography.md`
- `world/history.md`
- `world/rules.md`
- `world/rules.json`
- `world/changelog.md`

`world/rules.json` SHALL contain `rules[]` entries with:
`id`, `category`, `rule`, `constraint_type` in {`hard`,`soft`}, `exceptions[]`, `introduced_chapter`, `last_verified`.

#### Scenario: L1 rules file created during project initialization
- **WHEN** the user creates a new project and WorldBuilder runs in initialization mode
- **THEN** `world/rules.json` exists and contains at least one rule entry with an `id`

### Requirement: Hard L1 rules SHALL be treated as non-violable constraints
Any rule in `world/rules.json` with `constraint_type="hard"` SHALL be treated as a hard constraint in:
- ChapterWriter generation (as a “must not violate” list)
- QualityJudge Track 1 verification (as pass/violation checks)

#### Scenario: Hard rule injected into ChapterWriter context
- **WHEN** ChapterWriter is invoked for a chapter
- **THEN** hard L1 rules are included in the context as an explicit non-violable list

### Requirement: The system SHALL maintain a novel-level storylines model
The system SHALL store a novel-level storylines model at `storylines/storylines.json` containing:
- `storylines[]` with stable `id` (slug), `type`, `scope`, `status`, and descriptive metadata
- `relationships[]` describing bridges between storylines (characters/foreshadowing/events)
- `storyline_types[]` enumerating supported storyline types

#### Scenario: Storylines file created with a minimum main arc
- **WHEN** a new project is initialized
- **THEN** `storylines/storylines.json` exists and includes at least one storyline with `type="main_arc"` and `status="active"`

### Requirement: Each storyline SHALL have an independent memory file
For each storyline `id`, the project SHALL maintain `storylines/{id}/memory.md` as the storyline’s independent memory:
- Limited to a bounded size (e.g., ≤500 Chinese characters/words of key facts)
- Updated per chapter via the Summarizer → staging → commit flow

#### Scenario: Memory file path is stable and updateable
- **WHEN** Summarizer produces a memory update for a chapter in `storyline_id=S`
- **THEN** it writes `staging/storylines/S/memory.md`, and commit overwrites `storylines/S/memory.md`

## References

- `docs/dr-workflow/novel-writer-tool/final/spec/agents/world-builder.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/05-spec-system.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/06-storylines.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/09-data.md`

