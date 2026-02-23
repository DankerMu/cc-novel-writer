## Why

续写系统的“可用性”取决于稳定的单章流水线：从生成正文到摘要/状态增量、去 AI 化、质量验收，再到原子提交。没有该流水线，就无法实现 M1 的“试写 3 章并验收”，也无法支撑后续卷制循环。

## What Changes

- 定义并实现 4 个核心 Agents 的输入/输出契约：
  - ChapterWriter：生成单章初稿（含可选 hints）
  - Summarizer：生成摘要 + 权威 ops patch + 串线检测 + 线记忆更新 + 未知实体报告
  - StyleRefiner：去 AI 化润色（语义不变 + 修改量上限）
  - QualityJudge：双轨验收（L1/L2/L3/LS 合规 + 8 维度评分），只读返回结构化 JSON
- 固化 staging→commit 事务语义与 `.checkpoint.json` 的 `pipeline_stage` 幂等恢复契约
- 固化并发锁 `.novel.lock/`，防止多次 `/novel:continue` 并发写入冲突

## Capabilities

### New Capabilities

- `chapter-pipeline-agents`: 提供单章流水线的 agent 契约、事务写入与门控决策规则，支撑试写与日常续写。

### Modified Capabilities

- (none)

## Impact

- 影响范围：agents prompt 文件 + `/novel:continue` 的流水线调度与文件写入契约
- 与数据结构强耦合：`staging/**`、`chapters/**`、`summaries/**`、`state/**`、`evaluations/**`、`logs/**`、`.checkpoint.json`
- 依赖关系：依赖 `m1-plugin-skeleton` 与 `m1-entry-skills-and-orchestration`；与 world/style/spec changes 通过输入文件契约对接

## Milestone Mapping

- Milestone 1: 1.3（ChapterWriter）、1.4（Summarizer）、1.6（StyleRefiner）、1.7（QualityJudge）、1.9（staging→commit + pipeline_stage + DATA delimiter）、1.12（试写 3 章集成）。参见 `docs/dr-workflow/novel-writer-tool/final/milestones.md`。

## References

- `docs/dr-workflow/novel-writer-tool/final/spec/agents/chapter-writer.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/agents/summarizer.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/agents/style-refiner.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/agents/quality-judge.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/09-data.md`（staging、checkpoint、state、logs/evaluations 格式）
- `docs/dr-workflow/novel-writer-tool/final/prd/10-protocols.md`（事务写入、并发锁、门控、注入安全）
- `docs/dr-workflow/novel-writer-tool/final/prd/04-workflow.md`（质量门控阈值）

