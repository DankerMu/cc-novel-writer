## Why

续写流水线的“可用”不等于“可持续”：没有自动化门控与修订闭环，低分章节和 Spec/LS 违反会在长篇中累积并导致全局崩坏。M3 需要把质量门控从“评估后人工决定”升级为“可自动执行、可追溯、对关键章更严格”的系统能力。

## What Changes

- 质量门控自动流程：合规检查（L1/L2/L3/LS）+ 评分 → 自动决定 pass/polish/revise/rewrite/暂停
- 修订闭环：当触发 revise/rewrite 时自动走“修订 → 复评 → 通过/拒绝”流程，并限制最大修订次数避免无限循环
- 强制规则：存在 Spec/LS violation（仅 `confidence="high"`）时无条件强制修订（不看印象分）
- 关键章双裁判：卷首/卷尾/交汇事件章进行第二次 Opus 复核，取较低分作为最终结果
- 输出可审计日志：记录 gate 决策、修订次数、双裁判分数与最终分

## Capabilities

### New Capabilities

- `quality-gating-and-double-judge`: 门控决策引擎 + 自动修订闭环 + 关键章双裁判策略与审计输出。

### Modified Capabilities

- (none)

## Impact

- 影响范围：`/novel:continue` 的写作流水线（gate + revise loop）、QualityJudge 触发策略、`logs/chapter-*-log.json` 字段充实
- 成本影响：关键章额外一次 QualityJudge 调用（Opus/高成本），需要严格限定触发范围
- 依赖关系：依赖 QualityJudge 的 contract_verification.confidence 语义、storyline-schedule 的交汇事件定义、checkpoint 的 pipeline_stage/重试语义

## Milestone Mapping

- Milestone 3: 3.3（质量门控自动流程）、3.9（关键章双裁判）。参见 `docs/dr-workflow/novel-writer-tool/final/milestones.md`。

## References

- `docs/dr-workflow/novel-writer-tool/final/milestones.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/04-workflow.md`（门控阈值表）
- `docs/dr-workflow/novel-writer-tool/final/prd/08-orchestrator.md`（CHAPTER_REWRITE 状态与修订次数）
- `docs/dr-workflow/novel-writer-tool/final/prd/10-protocols.md`（staging→validate→commit）
- `docs/dr-workflow/novel-writer-tool/final/spec/agents/quality-judge.md`（双裁判与 confidence 语义）
- `docs/dr-workflow/novel-writer-tool/final/prd/09-data.md`（logs/evaluations 字段）

