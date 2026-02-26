## ADDED Requirements

### Requirement: The system SHALL expose a `novel` CLI with discoverable help
The system SHALL provide a `novel` command-line interface that supports `--help`, and each subcommand SHALL provide its own `--help`.

#### Scenario: User discovers CLI capabilities via help
- **WHEN** the user runs `novel --help`
- **THEN** the CLI lists available subcommands and global flags, including `--json` and `--project`

#### Scenario: User discovers subcommand usage via help
- **WHEN** the user runs `novel instructions --help`
- **THEN** the CLI prints required/optional arguments for the `instructions` subcommand

### Requirement: The CLI SHALL support a machine-readable JSON output mode
When invoked with `--json`, the CLI SHALL write exactly one JSON object to stdout and SHALL NOT print human-oriented text.

#### Scenario: Success response is JSON
- **WHEN** the user runs `novel status --json`
- **THEN** stdout is a single JSON object containing `ok=true`, `command`, and `data`

#### Scenario: Error response is JSON
- **WHEN** the user runs `novel status --json` outside a novel project
- **THEN** stdout is a single JSON object containing `ok=false`, `command`, and an `error.message`

### Requirement: The CLI SHALL auto-detect the novel project root
If `--project` is not provided, the CLI SHALL locate the project root by searching upward from the current working directory for `.checkpoint.json`.

#### Scenario: Auto-detect succeeds from a nested directory
- **WHEN** the user runs `novel status` from a subdirectory under a novel project root
- **THEN** the CLI resolves the project root directory that contains `.checkpoint.json`

#### Scenario: Auto-detect fails outside a project
- **WHEN** the user runs `novel status` from a directory tree that does not contain `.checkpoint.json`
- **THEN** the CLI exits non-zero and reports that no project root was found

### Requirement: The CLI SHALL validate and parse `.checkpoint.json` deterministically
The CLI SHALL parse `.checkpoint.json` as JSON and SHALL treat it as the single source of truth for orchestration state. The CLI SHALL reject invalid JSON and SHALL validate required fields needed for pipeline computation.

#### Scenario: Invalid checkpoint JSON is rejected
- **WHEN** `.checkpoint.json` exists but contains invalid JSON
- **THEN** the CLI reports a parse error and exits non-zero

#### Scenario: Minimal required fields are enforced
- **WHEN** `.checkpoint.json` is missing `last_completed_chapter` or `current_volume`
- **THEN** the CLI reports a schema error and exits non-zero

### Requirement: The CLI SHALL implement lock semantics compatible with PRD §10.7
The CLI SHALL treat `<project_root>/.novel.lock/` as an atomic directory lock and SHALL surface lock status for human and automation use. Mutating operations (e.g. `advance`, `commit`) SHALL NOT proceed if an active lock exists and is owned by a different process/session, unless it is stale per policy.

#### Scenario: Lock status is readable
- **WHEN** `.novel.lock/info.json` exists
- **THEN** `novel lock status` returns holder metadata (at least `started` and `chapter` when available)

#### Scenario: Stale lock can be cleared
- **WHEN** a lock exists and its `started` timestamp is older than the configured stale threshold
- **THEN** `novel lock clear` removes the lock directory and reports success

### Requirement: The CLI SHALL reject unsafe paths and traversal
All file operations performed by the CLI SHALL be confined to the resolved project root. The CLI SHALL reject path traversal attempts (e.g. `../`) in user inputs and derived paths.

#### Scenario: Traversal is rejected
- **WHEN** a user provides `--project` with a path that resolves outside the intended project root via traversal
- **THEN** the CLI reports an error and exits non-zero

## References

- `docs/dr-workflow/novel-writer-tool/final/prd/09-data.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/10-protocols.md`
- `scripts/audit-staging-path.sh`

