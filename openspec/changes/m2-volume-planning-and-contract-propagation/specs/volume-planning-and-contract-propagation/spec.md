## ADDED Requirements

### Requirement: PlotArchitect SHALL produce a deterministically parseable outline
For a volume V, PlotArchitect SHALL write `volumes/vol-{V:02d}/outline.md` where each chapter block:
- Starts with `### 第 {C} 章` (a literal `:` is allowed but SHALL NOT be required for parsing)
- Contains fixed key lines using the exact `- **Key**:` format (Storyline/POV/Location/Conflict/Arc/Foreshadowing/StateChanges/TransitionHint)

#### Scenario: Entry skill extracts chapter outline by regex
- **WHEN** the entry skill needs the outline for chapter C
- **THEN** it can locate the block with `^### 第 C 章` and extract until the next chapter block or EOF

### Requirement: PlotArchitect SHALL generate L3 chapter contracts for the volume
PlotArchitect SHALL generate `volumes/vol-{V:02d}/chapter-contracts/chapter-{C:03d}.json` for each chapter, containing:
- `preconditions`, `objectives`, `postconditions`, `acceptance_criteria`
- Storyline fields (`storyline_id`, `storyline_context`, `transition_hint`) when applicable

#### Scenario: QualityJudge reads contract for chapter C
- **WHEN** QualityJudge is invoked for chapter C
- **THEN** the chapter contract file exists and can be loaded for contract verification

### Requirement: Contracts SHALL support chain propagation between chapters
PlotArchitect SHALL ensure the chain rule:
Previous chapter `postconditions` become the next chapter `preconditions` (unless explicitly overridden with rationale).

#### Scenario: Preconditions derived from prior postconditions
- **WHEN** generating contracts for chapters C and C+1
- **THEN** the contract for C+1 reflects postconditions from C as its baseline preconditions

### Requirement: PlotArchitect SHALL output storyline schedule and foreshadow plans
For each volume, PlotArchitect SHALL output:
- `volumes/vol-{V:02d}/storyline-schedule.json`
- `volumes/vol-{V:02d}/foreshadowing.json`
and update global foreshadow state as part of the planning workflow (per project conventions).

#### Scenario: Schedule constrains active storylines
- **WHEN** planning a volume
- **THEN** the schedule lists active storylines (≤4) and convergence events with chapter ranges

### Requirement: PlotArchitect SHALL output a new-character manifest
PlotArchitect SHALL output `volumes/vol-{V:02d}/new-characters.json` listing characters referenced in the outline that do not exist in `characters/active/`.

#### Scenario: New character list triggers CharacterWeaver creation
- **WHEN** `new-characters.json` contains entries
- **THEN** the entry skill can batch-create those characters by invoking CharacterWeaver before entering WRITING state

### Requirement: Spec changes SHALL be traceable and propagate impact
When L1 world rules change, the system SHALL identify potentially impacted L2 and L3 artifacts and mark them for review/re-generation rather than silently ignoring the change.

#### Scenario: Rule update marks dependent contracts for review
- **WHEN** a world rule referenced by a contract changes
- **THEN** the system marks affected contracts and surfaces the need for update during the next planning/review interaction

## References

- `docs/dr-workflow/novel-writer-tool/final/spec/agents/plot-architect.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/05-spec-system.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/06-storylines.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/09-data.md`
