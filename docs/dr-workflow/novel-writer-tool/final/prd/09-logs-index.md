## 9.3 `logs/` 目录索引（SSOT）

本文件是 `logs/` 的 **单一事实来源（SSOT）**：用于统一目录清单、`latest.json` 约定、history 命名规则，以及各类报告的最小可审计契约。

> 规则：任何新增的日志/报告家族，必须先更新本索引，再实现写盘路径。

---

### 9.3.1 总体约定

#### A) `latest.json` + history（JSON 报告）

对“周期性/窗口性”或“每章”报告，统一采用：

- `logs/<topic>/latest.json`：默认 **覆盖写**，用于快速注入/展示（便于 `/novel:status`）
- `logs/<topic>/<history>.json`：**历史文件**，用于回归/审计；原则上避免覆盖。若采用“按范围/章节”的确定性命名，允许在 **同一 key**（同 range/chapter）上幂等覆盖（rerun），但不得覆盖其他 key。

> 注：个别 topic 为避免并发回退或跨范围任务重跑导致 `latest.json` “倒退”，允许采用 **单调更新**（monotonic）语义：只在“更新更前沿的范围”时覆盖（例如 `logs/continuity/latest.json`）。

推荐的 history 命名规则：

- **窗口报告**（卷 + 章节范围）：`<topic>-vol-{V:02d}-ch{start:03d}-ch{end:03d}.json`
- **每章报告**：`<topic>-chapter-{C:03d}.json`

#### B) JSONL 流（append-only）

对“事件流/append-only”类日志，统一采用 `logs/*.jsonl`（每行一个 JSON 对象）：

- 文件名固定，不需要 `latest.json`
- 只追加，不覆盖；允许外部工具按时间/章节过滤

---

### 9.3.2 报告最小契约（建议）

为降低跨模型/跨轮次差异，所有 `logs/**.json` 报告 **建议**（但不强制）包含以下字段：

- `schema_version`：整数
- `generated_at`：ISO-8601 时间
- `scope`：至少包含 `chapter` 或 `{volume, chapter_start, chapter_end}` 之一
- `issues[]`（如有）：每项建议包含 `{id, severity, summary, evidence?, suggestion?}`

> 具体字段以各自 owning spec 为准；此处只定义“最小可审计骨架”。

---

### 9.3.3 允许的 log 家族清单

#### 1) Pipeline（每章流水线日志）

- 路径：`logs/chapter-{C:03d}-log.json`
- 类型：JSON（每章一份）
- Owning specs：
  - `openspec/changes/archive/2026-02-25-m3-quality-gating-and-double-judge/specs/quality-gating-and-double-judge/spec.md`
  - `skills/continue/SKILL.md`（写入字段/降级策略）

#### 2) Audit（安全拦截审计）

- 路径：`logs/audit.jsonl`
- 类型：JSONL（append-only）
- Owning specs：
  - `openspec/changes/archive/2026-02-24-m2-hooks-and-guardrails/specs/hooks-and-guardrails/spec.md`
  - `scripts/audit-staging-path.sh`

#### 3) Unknown entities（未知实体流）

- 路径：`logs/unknown-entities.jsonl`
- 类型：JSONL（append-only）
- Owning specs：
  - `docs/dr-workflow/novel-writer-tool/final/spec/agents/summarizer.md`
  - `skills/continue/SKILL.md`

#### 4) Continuity（一致性/连续性报告）

- 目录：`logs/continuity/`
- Latest：`logs/continuity/latest.json`（单调更新：按 chapter_range end 前进；同 end 时 `volume_end` 优先于 `periodic`；仍相同则取更新的 `generated_at`）
- History：`logs/continuity/continuity-report-vol-{V:02d}-ch{start:03d}-ch{end:03d}.json`
- Internal（运行时/补偿标记；可忽略）：  
  - `logs/continuity/.latest.lock/`（并发锁，写入 `latest.json` 时短暂存在）  
  - `logs/continuity/.pending-volume-end.lock/`（并发锁，读写 pending marker 时短暂存在）  
  - `logs/continuity/pending-volume-end-vol-{V:02d}.json`（卷末审计崩溃补偿标记；下次 commit 会补跑并清理）
- Owning specs：
  - `skills/continue/references/continuity-checks.md`（schema SSOT）
  - `openspec/changes/m6-platform-optimization/specs/consistency-auditor/spec.md`（滑动窗口审计）

#### 5) Foreshadowing（伏笔可见性/盘点报告）

- 目录：`logs/foreshadowing/`
- Latest：`logs/foreshadowing/latest.json`
- History：`logs/foreshadowing/foreshadowing-check-vol-{V:02d}-ch{start:03d}-ch{end:03d}.json`
- Owning specs：
  - `openspec/changes/m6-platform-optimization/specs/foreshadow-visibility/spec.md`
  - `skills/continue/references/foreshadowing.md`

#### 6) Storylines（故事线分析：节奏/桥梁）

> 该目录当前包含多种报告类型，因此采用“每种报告一个 latest 文件”的 legacy 约定。

- 目录：`logs/storylines/`
- Latest：
  - `logs/storylines/rhythm-latest.json`
  - `logs/storylines/broken-bridges-latest.json`
- History：
  - `logs/storylines/rhythm-vol-{V:02d}-ch{start:03d}-ch{end:03d}.json`
  - `logs/storylines/broken-bridges-vol-{V:02d}-ch{start:03d}-ch{end:03d}.json`
- Owning specs：
  - `docs/dr-workflow/novel-writer-tool/final/prd/06-storylines.md`
  - `skills/start/references/vol-review.md`

#### 7) Engagement（参与度密度：窗口分析报告）

- 目录：`logs/engagement/`
- Latest：`logs/engagement/latest.json`
- History：`logs/engagement/engagement-report-vol-{V:02d}-ch{start:03d}-ch{end:03d}.json`
- Related stream：`engagement-metrics.jsonl`（项目根目录，append-only）
- Owning specs：
  - `openspec/changes/m7-narrative-health-ledgers/specs/engagement-density-auditor/spec.md`

#### 8) Promises（长周期承诺台账：窗口报告）

- 目录：`logs/promises/`
- Latest：`logs/promises/latest.json`
- History：`logs/promises/promise-ledger-report-vol-{V:02d}-ch{start:03d}-ch{end:03d}.json`
- Related ledger：`promise-ledger.json`（项目根目录）
- Owning specs：
  - `openspec/changes/m7-narrative-health-ledgers/specs/promise-ledger/spec.md`

#### 9) Retention（短周期留存钩子：窗口报告）

- 目录：`logs/retention/`
- Latest：`logs/retention/latest.json`
- History：`logs/retention/retention-report-vol-{V:02d}-ch{start:03d}-ch{end:03d}.json`
- Related ledger：`hook-ledger.json`（项目根目录）
- Owning specs：
  - `openspec/changes/m7-retention-and-readability-guards/specs/hook-ledger/spec.md`

#### 10) Readability（移动端可读性 lint：每章报告）

- 目录：`logs/readability/`
- Latest：`logs/readability/latest.json`
- History：`logs/readability/readability-report-chapter-{C:03d}.json`
- Owning specs：
  - `openspec/changes/m7-retention-and-readability-guards/specs/mobile-readability-lint/spec.md`
  - `openspec/changes/m7-retention-and-readability-guards/tasks.md`（落盘约定）

#### 11) Naming（命名冲突 lint：每章报告）

- 目录：`logs/naming/`
- Latest：`logs/naming/latest.json`
- History：`logs/naming/naming-report-chapter-{C:03d}.json`
- Owning specs：
  - `openspec/changes/m7-retention-and-readability-guards/specs/name-conflict-lint/spec.md`
  - `openspec/changes/m7-retention-and-readability-guards/tasks.md`（落盘约定）

#### 12) Platform constraints（平台约束：每章报告）

- 目录：`logs/platform-constraints/`
- Latest：`logs/platform-constraints/latest.json`
- History：`logs/platform-constraints/platform-constraints-chapter-{C:03d}.json`
- Owning specs：
  - `openspec/changes/m6-platform-optimization/specs/platform-constraints/spec.md`
  - `openspec/changes/m6-platform-optimization/specs/platform-profile/spec.md`

#### 13) Cliché lint（网文套路词 / 模板腔 lint：每章报告）

- 目录：`logs/cliche-lint/`
- Latest：`logs/cliche-lint/latest.json`
- History：`logs/cliche-lint/cliche-lint-chapter-{C:03d}.json`
- Related config：`web-novel-cliche-lint.json`（项目根目录）
- Owning specs：
  - `openspec/changes/m6-platform-optimization/specs/web-novel-cliche-lint/spec.md`
