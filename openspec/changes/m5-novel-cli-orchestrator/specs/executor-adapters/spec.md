## ADDED Requirements

### Requirement: The system SHALL provide an executor-agnostic boundary for running steps
The system SHALL treat `novel next` + `novel instructions` output as the stable boundary between deterministic orchestration and generative execution. The CLI SHALL NOT require direct LLM API calls.

#### Scenario: Orchestrator can be used without API keys
- **WHEN** a user runs `novel next` and `novel instructions` in a novel project
- **THEN** the CLI produces actionable outputs without requiring any LLM credentials

### Requirement: The system SHALL provide a Claude Code adapter for running step packets
The project SHALL provide an adapter that allows Claude Code users to run a step packet with the correct agent and staging boundaries, and then return control to the user for review or continuation.

#### Scenario: Claude Code user runs the next step and can interrupt
- **WHEN** the user invokes the adapter to execute the step returned by `novel next`
- **THEN** the adapter runs the targeted agent, writes outputs under `staging/**`, and stops at a clear breakpoint for user review

### Requirement: The system SHALL provide a Codex CLI adapter for running step packets
The project SHALL provide an adapter that allows Codex CLI users to execute step packets using subagents, and then return control to the user for validation/advance/commit decisions.

#### Scenario: Codex user executes a draft step and returns to orchestration
- **WHEN** the user invokes the adapter for `chapter:048:draft`
- **THEN** the adapter runs the `chapter-writer` agent with the packet manifest and then instructs the user to run `novel validate` / `novel advance` (or performs these actions if configured)

### Requirement: Adapters SHALL preserve recoverability via checkpoint and packet persistence
Adapters SHALL NOT mutate state in ways that bypass `.checkpoint.json` and staging semantics. If execution is interrupted, users SHALL be able to resume by re-running `novel next` and continuing from the computed step.

#### Scenario: Interrupted execution remains resumable
- **WHEN** an adapter execution is interrupted after producing staging outputs but before commit
- **THEN** `novel next` resolves to a resume step consistent with `.checkpoint.json` and `staging/**`

## References

- `openspec/changes/m5-novel-cli-orchestrator/specs/instruction-packets/spec.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/10-protocols.md`
- `agents/`

