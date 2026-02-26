## 1. Platform Profile Extensions

- [ ] 1.1 Extend `platform-profile.json` schema with `retention/title_policy`, `retention/hook_ledger`, `readability/mobile`, and `naming` fields
- [ ] 1.2 Update built-in qidian/tomato defaults to include reasonable retention/readability/naming policies
- [ ] 1.3 Add validation for new profile fields (fail fast with clear errors; do not hang pipeline)

## 2. Title System

- [ ] 2.1 Implement title presence + policy validator (length/patterns/banned words)
- [ ] 2.2 Add `title-fix` micro-step that edits only the H1 title line (bounded retries + escalation)
- [ ] 2.3 Wire title report into pre-judge compliance/guardrail report and chapter logs

## 3. Mobile Readability Lint

- [ ] 3.1 Define readability issue taxonomy + severity mapping (warn/soft/hard) driven by platform profile
- [ ] 3.2 Add deterministic lint script hook (e.g., `scripts/lint-readability.sh`) with JSON stdout contract
- [ ] 3.3 Implement safe fallback when script missing/fails (warn-only; no blocking)
- [ ] 3.4 Persist readability reports under `logs/readability/` (`latest.json` + history)

## 4. Naming Conflict Lint

- [ ] 4.1 Implement name registry derivation from `characters/active/*.json` (+ optional aliases)
- [ ] 4.2 Implement duplicate + near-duplicate + alias collision detection with configurable thresholds
- [ ] 4.3 Integrate NER/unknown-entity signals (if available) to warn on confusing new names
- [ ] 4.4 Persist naming reports under `logs/naming/` (`latest.json` + history)

## 5. Hook Ledger

- [ ] 5.1 Define `hook-ledger.json` schema (id/type/strength/promise_text/window/status/history)
- [ ] 5.2 Update evaluation/metadata to capture hook type + strength + compact end-of-chapter evidence
- [ ] 5.3 Implement ledger update on commit + fulfillment window assignment + overdue detection
- [ ] 5.4 Implement diversity checks (streak + distinct types in window) and retention reporting under `logs/retention/`

## 6. Pipeline Integration

- [ ] 6.1 Extend pre-judge checks to include title/readability/naming guardrails (structured report input)
- [ ] 6.2 Ensure hard issues can block commit when enabled, while defaults remain non-blocking
- [ ] 6.3 Keep all new fields backward-compatible in manifests (optional fields; null-safe)

## 7. Documentation

- [ ] 7.1 Document new platform profile sections and default behaviors
- [ ] 7.2 Document how to interpret `logs/retention/*`, `logs/readability/*`, `logs/naming/*`
