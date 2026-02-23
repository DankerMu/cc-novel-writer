## ADDED Requirements

### Requirement: Plugin manifest SHALL exist and be loadable
The repository SHALL provide a Claude Code plugin manifest at `.claude-plugin/plugin.json` with:
- `name` = `novel`
- `skills` pointing to the plugin `skills/` directory
- `hooks` pointing to `hooks/hooks.json`

#### Scenario: Plugin manifest resolved
- **WHEN** the plugin is installed and loaded by Claude Code
- **THEN** the host can locate the `skills/` directory and `hooks/hooks.json` from `.claude-plugin/plugin.json`

### Requirement: Plugin directory scaffold SHALL exist
The plugin package SHALL include the following top-level directories:
- `skills/`
- `agents/`
- `templates/`
- `hooks/`
- `scripts/`

#### Scenario: Required directories present
- **WHEN** the plugin is packaged or copied into the host cache directory
- **THEN** the required directories exist and can be referenced by later changes

### Requirement: Plugin templates SHALL include the canonical project seed assets
The plugin SHALL ship the canonical templates under `templates/` including:
- `templates/brief-template.md`
- `templates/ai-blacklist.json`
- `templates/style-profile-template.json`

#### Scenario: Entry skill can copy templates into a new project
- **WHEN** `/novel:start` creates a new project
- **THEN** it can copy the template files from `${CLAUDE_PLUGIN_ROOT}/templates/` into the project directory

### Requirement: Plugin internal file references SHALL use `${CLAUDE_PLUGIN_ROOT}`
Any runtime reference to plugin-internal assets (e.g., `templates/`, `references/`, `scripts/`) SHALL be resolved via `${CLAUDE_PLUGIN_ROOT}` rather than hard-coded relative paths.

#### Scenario: Cache-copy path safety
- **WHEN** the host copies the plugin into a cache directory before execution
- **THEN** all Skills/scripts can still locate plugin-internal files using `${CLAUDE_PLUGIN_ROOT}`

### Requirement: Hooks config SHALL be wired from manifest
The manifest SHALL reference `hooks/hooks.json`, and `hooks/hooks.json` SHALL define at least a baseline `SessionStart` hook that calls `bash ${CLAUDE_PLUGIN_ROOT}/scripts/inject-context.sh` with a bounded timeout.

#### Scenario: SessionStart hook configuration present
- **WHEN** the host evaluates the plugin hooks configuration
- **THEN** a `SessionStart` hook entry exists with a command pointing to `${CLAUDE_PLUGIN_ROOT}/scripts/inject-context.sh`

### Requirement: Plugin files SHALL be treated as read-only at runtime
Runtime outputs (chapters, summaries, state, logs, staging artifacts) SHALL be written to the user project directory, not to the plugin installation directory.

#### Scenario: No plugin self-modification
- **WHEN** `/novel:*` workflows run
- **THEN** all writes target the user project directory (e.g., `novel-project/`) and do not mutate plugin files

## References

- `docs/dr-workflow/novel-writer-tool/final/spec/01-overview.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/01-product.md`
- `docs/dr-workflow/novel-writer-tool/final/milestones.md`
