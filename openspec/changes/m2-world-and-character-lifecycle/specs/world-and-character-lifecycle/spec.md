## ADDED Requirements

### Requirement: WorldBuilder SHALL support incremental updates with changelog
WorldBuilder SHALL support an incremental update mode that:
- Reads existing world docs and existing `world/rules.json`
- Writes updated world docs
- Updates `world/rules.json`
- Appends a new entry to `world/changelog.md`

#### Scenario: Add a new location rule
- **WHEN** the user requests “新增一个地点/规则”的世界观更新
- **THEN** WorldBuilder updates the relevant `world/*.md` and adds/updates an entry in `world/rules.json`

### Requirement: CharacterWeaver SHALL maintain dual artifacts per active character
For each active character, CharacterWeaver SHALL maintain:
- `characters/active/{character_id}.md` (narrative profile)
- `characters/active/{character_id}.json` (structured profile including `id`, `display_name`, and `contracts[]`)

#### Scenario: New character creation produces both files
- **WHEN** CharacterWeaver creates a new character
- **THEN** both `.md` and `.json` files exist under `characters/active/` for the same slug id

### Requirement: CharacterWeaver SHALL update relationship and changelog artifacts
Any add/update/retire operation SHALL update:
- `characters/relationships.json`
- `characters/changelog.md` (append-only)

#### Scenario: Updating a character relationship graph
- **WHEN** a new relationship is introduced in a chapter plan
- **THEN** `characters/relationships.json` is updated and a changelog entry is appended

### Requirement: Retiring a character SHALL respect archival protection rules
The system SHALL NOT retire a character if:
- The character is referenced by active foreshadowing of scope medium/long
- The character is referenced by any storyline (including dormant)
- The character appears in future convergence events of the storyline schedule

#### Scenario: Protected character cannot be retired
- **WHEN** the user attempts to retire a protected character
- **THEN** the system refuses and explains which protection condition applies

### Requirement: Retiring a character SHALL move files and update current state
On retirement, the system SHALL:
- Move character files to `characters/retired/`
- Remove the character entry from `state/current-state.json`
- Update relationships/changelog accordingly

#### Scenario: State reflects retirement after commit
- **WHEN** a character is retired
- **THEN** subsequent context assembly no longer injects the character as active

## References

- `docs/dr-workflow/novel-writer-tool/final/spec/agents/world-builder.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/agents/character-weaver.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/08-orchestrator.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/09-data.md`

