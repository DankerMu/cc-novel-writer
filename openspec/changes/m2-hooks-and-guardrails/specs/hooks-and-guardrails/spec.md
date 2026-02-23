## ADDED Requirements

### Requirement: SessionStart hook SHALL inject project state when in a novel project
On session start, the hook SHALL:
- Detect `.checkpoint.json` in the current directory
- If absent, exit silently with success
- If present, output checkpoint content and (if available) the latest chapter summary truncated to a safe limit

#### Scenario: SessionStart injects checkpoint and summary
- **WHEN** a new session starts in a directory containing `.checkpoint.json`
- **THEN** the injected output includes the checkpoint JSON and the latest summary excerpt

### Requirement: SessionStart SHALL be bounded and degrade gracefully
The hook SHALL complete within a strict timeout (e.g., 5 seconds). If JSON parsing fails, it SHALL fall back (python3 → jq) or skip optional fields without failing the session.

#### Scenario: Missing python3 falls back to jq
- **WHEN** python3 is unavailable but jq exists
- **THEN** the hook still resolves `last_completed_chapter` and injects the summary if present

### Requirement: PostToolUse hook SHALL enforce staging-only writes for Agents
When invoked for Agent Write/Edit tool calls, the path-audit hook SHALL:
- Allow only paths under `staging/**`
- Block writes outside the allowlist
- Append an audit event to `logs/audit.jsonl`

#### Scenario: Agent write outside staging is blocked
- **WHEN** an Agent attempts to write `chapters/chapter-001.md`
- **THEN** the operation is blocked and an audit event is appended to `logs/audit.jsonl`

### Requirement: Audit log SHALL be append-only and machine-readable
Audit events written to `logs/audit.jsonl` SHALL be one JSON object per line and include at minimum:
timestamp, tool_name, path, allowed, reason.

#### Scenario: Audit record is created for a blocked write
- **WHEN** a write is blocked
- **THEN** a new JSON line is appended containing the required fields

## References

- `docs/dr-workflow/novel-writer-tool/final/spec/01-overview.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/01-product.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/02-skills.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/10-protocols.md`

