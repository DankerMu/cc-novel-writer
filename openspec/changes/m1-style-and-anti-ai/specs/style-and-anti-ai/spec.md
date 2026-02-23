## ADDED Requirements

### Requirement: StyleAnalyzer SHALL output a structured `style-profile.json`
StyleAnalyzer SHALL output `style-profile.json` containing at minimum:
- `source_type` in {`original`, `reference`, `template`}
- `reference_author` (required when `source_type="reference"`, otherwise null/empty)
- `avg_sentence_length`, `dialogue_ratio`
- `rhetoric_preferences[]`, `forbidden_words[]`
- `character_speech_patterns{}`
- `writing_directives[]`
- `override_constraints{}`

#### Scenario: Original-sample extraction
- **WHEN** the user provides 1-3 chapters of their own writing samples
- **THEN** StyleAnalyzer outputs `style-profile.json` with `source_type="original"` and non-empty `writing_directives`

### Requirement: The system SHALL support a no-sample downgrade path
When the user cannot provide original samples, the system SHALL support:
- Reference-author mode (`source_type="reference"`)
- Template mode (`source_type="template"`)
and SHALL always mark the correct `source_type`.

#### Scenario: Reference-author mode
- **WHEN** the user specifies a reference author and sample chapters
- **THEN** the output sets `source_type="reference"` and populates `reference_author`

### Requirement: AI blacklist SHALL be a versioned JSON asset
The plugin SHALL ship a read-only blacklist template at `templates/ai-blacklist.json` with:
- `version`, `last_updated`
- `words[]` containing at least 30 entries
- `categories{}` mapping category names to word arrays

#### Scenario: Blacklist file is usable by downstream stages
- **WHEN** `/novel:start` initializes a new project
- **THEN** it copies `${CLAUDE_PLUGIN_ROOT}/templates/ai-blacklist.json` to the project root as `ai-blacklist.json` and downstream stages read/update the project file (not the plugin template)

### Requirement: The `novel-writing` knowledge base SHALL exist as shared methodology
The plugin SHALL provide a shared knowledge base skill under `skills/novel-writing/` including:
- `skills/novel-writing/SKILL.md` (methodology)
- `skills/novel-writing/references/style-guide.md`
- `skills/novel-writing/references/quality-rubric.md`

#### Scenario: Shared references are available for agents
- **WHEN** an entry skill or agent needs shared guidance (anti-AI rules, quality rubric)
- **THEN** the referenced files exist and can be loaded as supporting context

### Requirement: ChapterWriter SHALL use style profile as positive guidance
Downstream generation SHALL treat `style-profile.json` as positive guidance:
- Pass `writing_directives[]` via Task `prompt` parameter to guide tone and expression
- Allow `override_constraints` to override default constraints where specified

#### Scenario: Override constraints changes scene description limit
- **WHEN** `override_constraints.max_scene_sentences` is set to 5
- **THEN** ChapterWriter uses the overridden limit instead of the default 2-sentence limit

### Requirement: StyleRefiner SHALL replace blacklist hits without semantic drift
StyleRefiner SHALL:
- Replace blacklist hits with style-consistent expressions
- Keep plot/dialogue/character behavior semantics unchanged
- Keep modification ratio within a bounded threshold (e.g., ≤15%)

#### Scenario: Blacklist phrase replaced while meaning preserved
- **WHEN** the draft contains a blacklisted phrase
- **THEN** the refined text removes the phrase while preserving the original meaning and story facts

### Requirement: QualityJudge SHALL score style naturalness using measurable signals
QualityJudge SHALL evaluate `style_naturalness` using measurable indicators including:
- Blacklist hit rate threshold (e.g., < 3 hits per 1000 Chinese characters)
- Sentence-pattern repetition heuristics
- Match to style-profile guidance

#### Scenario: Naturalness score includes blacklist hit rate
- **WHEN** the chapter contains 1 blacklist hit per 1000 chars
- **THEN** the style naturalness rationale references the hit rate and its impact on the score

## References

- `docs/dr-workflow/novel-writer-tool/final/prd/07-anti-ai.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/agents/style-analyzer.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/05-templates.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/04-quality.md`
