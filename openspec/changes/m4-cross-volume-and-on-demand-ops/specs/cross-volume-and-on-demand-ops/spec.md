## ADDED Requirements

### Requirement: The system SHALL support cross-volume handoff from review to next planning
After volume completion, the system SHALL:
- produce volume review outputs sufficient to inform the next volume plan
- transition from `VOL_REVIEW` to `VOL_PLANNING`
- inject previous volume review and global state into PlotArchitect planning context

#### Scenario: Next volume planning uses previous review
- **WHEN** the user completes volume V and starts planning volume V+1
- **THEN** PlotArchitect receives `prev_volume_review`, `global_foreshadowing`, and current storylines state

### Requirement: The system SHALL provide on-demand maintenance operations via `/novel:start`
The system SHALL provide on-demand operations accessible from `/novel:start`, including at minimum:
- world update (WorldBuilder incremental)
- character management (add/update/retire via CharacterWeaver)
- foreshadow query
- storyline management (activate/dormant/update metadata)

#### Scenario: User triggers a world update
- **WHEN** the user selects “world update” from `/novel:start`
- **THEN** the system invokes WorldBuilder incremental mode and stages the resulting changes

### Requirement: On-demand operations SHALL follow staging→validate→commit semantics
All on-demand operations that modify project files SHALL write to `staging/**` first and SHALL be committed atomically, consistent with the chapter pipeline transaction model.

#### Scenario: World update is atomic
- **WHEN** a world update operation completes successfully
- **THEN** its outputs are committed together (no partial update) and checkpoint/state is consistent

### Requirement: Spec propagation signals SHALL be generated on relevant changes
When L1/L2 artifacts change, the system SHALL generate propagation signals indicating which dependent artifacts may require review/regeneration (L1→L2→L3 chain).

#### Scenario: World rule change marks impacted contracts
- **WHEN** a world rule referenced by a character contract changes
- **THEN** the system records that the contract and downstream chapter contracts require review

### Requirement: External text injection SHALL be protected by DATA delimiter
When on-demand operations pass external file content to agents via Task `prompt` parameter (world docs, research, profiles), the system SHALL wrap it using the `<DATA ...>` delimiter rules.

#### Scenario: Research content is treated as data
- **WHEN** the system injects `research/*.md` into WorldBuilder context
- **THEN** it is wrapped in `<DATA type="research" ...>` and treated as non-instructional

## References

- `docs/dr-workflow/novel-writer-tool/final/prd/04-workflow.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/05-spec-system.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/10-protocols.md`
- `docs/dr-workflow/novel-writer-tool/final/milestones.md`

