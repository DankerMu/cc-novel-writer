## MODIFIED Requirements

### Requirement: The system SHALL persist an immutable platform binding per novel project
The system SHALL persist a platform binding chosen at initialization in `platform-profile.json` at the project root.
The platform binding SHALL be one of:
- `qidian`
- `tomato`

Once `platform-profile.json` is created, the platform binding MUST NOT change for the lifetime of the project.

#### Scenario: Platform profile created during init
- **WHEN** the user initializes a novel project and selects platform `qidian`
- **THEN** the system writes `platform-profile.json` with `"platform":"qidian"`
- **AND** the system treats the platform as immutable for subsequent operations

#### Scenario: Attempt to change platform is rejected
- **WHEN** `platform-profile.json` already exists with `"platform":"tomato"`
- **AND** the user attempts to switch the platform to `qidian`
- **THEN** the system rejects the operation
- **AND** leaves `platform-profile.json` unchanged

### Requirement: `platform-profile.json` SHALL define platform-tuned policies for constraints, retention, readability, and naming
`platform-profile.json` SHALL contain a stable schema with enough information to drive:
- Chapter word count targets and hard limits
- Chapter-end hook requirements (including minimum strength thresholds)
- Information-load thresholds (new entities / unknown entities / new terms)
- Pre-judge checks (banned words, naming checks, simplified/traditional consistency)
- Retention guardrails (hook ledger policy, chapter title policy)
- Mobile readability lint policies
- Scoring weights selection (via `genre_drive_type` + profile mapping)

At minimum, it SHALL include:
- `schema_version` (integer)
- `platform` (string)
- `created_at` (ISO-8601 string)
- `word_count` object:
  - `target_min` / `target_max` (integers, words)
  - `hard_min` / `hard_max` (integers, words)
- `hook_policy` object:
  - `required` (boolean)
  - `min_strength` (integer 1-5)
  - `allowed_types` (string array)
  - `fix_strategy` (string, e.g. `"hook-fix"`)
- `info_load` object:
  - `max_new_entities_per_chapter` (integer)
  - `max_unknown_entities_per_chapter` (integer)
  - `max_new_terms_per_1k_words` (integer)
- `compliance` object:
  - `banned_words` (string array)
  - `duplicate_name_policy` (string enum)
  - `script_paths` (optional object for deterministic linters)
- `retention` object:
  - `hook_ledger` object:
    - `enabled` (boolean)
    - `fulfillment_window_chapters` (integer; e.g., N means C+1..C+N)
    - `diversity_window_chapters` (integer)
    - `max_same_type_streak` (integer)
    - `min_distinct_types_in_window` (integer)
    - `overdue_policy` (enum; e.g., `warn`, `soft`, `hard`)
  - `title_policy` object:
    - `enabled` (boolean)
    - `min_chars` / `max_chars` (integers)
    - `forbidden_patterns` (string array)
    - `required_patterns` (optional string array)
    - `auto_fix` (boolean)
- `readability` object:
  - `mobile` object:
    - `enabled` (boolean)
    - `max_paragraph_chars` (integer)
    - `max_consecutive_exposition_paragraphs` (integer)
    - `blocking_severity` (enum; e.g., `hard_only`, `soft_and_hard`)
- `naming` object:
  - `enabled` (boolean)
  - `near_duplicate_threshold` (number or integer policy)
  - `blocking_conflict_types` (string array; e.g., `duplicate`, `alias_collision`)
  - `exemptions` (optional)
- `scoring` object:
  - `genre_drive_type` (string enum; see `genre-weight-profiles`)
  - `weight_profile_id` (string)
  - `weight_overrides` (optional object)

#### Scenario: Platform profile enables retention and readability guardrails
- **WHEN** the system loads `platform-profile.json` for platform `tomato`
- **THEN** it can derive title, hook-ledger, readability, and naming policies in addition to word count and compliance rules

### Requirement: The system SHALL support built-in defaults with user-confirmed overrides
The system SHALL ship with built-in default profiles for `qidian` and `tomato`.
During initialization, the system SHALL allow the user to override key thresholds (e.g., word count targets, title max length, hook fulfillment window) and persist those overrides in `platform-profile.json`.

#### Scenario: User adjusts defaults during init
- **WHEN** the user selects platform `tomato`
- **AND** the system proposes default `word_count.target_min/target_max`
- **AND** the user overrides the target range
- **THEN** the system writes the overridden values into `platform-profile.json`

## References

- `openspec/changes/m6-platform-optimization/specs/platform-profile/spec.md`
- `openspec/changes/m7-retention-and-readability-guards/proposal.md`
