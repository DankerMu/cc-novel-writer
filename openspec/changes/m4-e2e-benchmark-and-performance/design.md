## Context

“100 章端到端”是对系统架构的综合压力测试：
- 文件即状态的冷启动必须稳定
- context 组装不能随章数增长而线性爆炸
- 质量门控/修订闭环不能导致不可控成本或时间延迟

因此基准不仅要跑通，还要留下可审计的指标与性能数据。

## Goals / Non-Goals

**Goals:**
- 定义可重复的 E2E benchmark 运行方式（输入、模型、开关、章节数）
- 输出统一报告：质量指标 + 合规指标 + 多线指标 + 成本/耗时指标
- 输出性能指标并绑定目标：冷启动恢复 < 30s（PRD 目标）

**Non-Goals:**
- 不在 M4 必须引入外部 CI 平台（可本地运行）
- 不要求 E2E benchmark 自动生成高质量剧情（重点是系统正确性与可度量性）

## Benchmark Plan (Proposed)

1. 准备一个“基准项目”：
   - 固定题材/brief、固定风格样本或模板、固定 storylines 与卷级 outline
2. 运行 3 卷 / 100 章：
   - 每章执行完整流水线（含门控与必要修订）
3. 采集输出：
   - `evaluations/`：合规与评分
   - `logs/`：阶段耗时与 gate 决策
   - `foreshadowing/global.json`：回收率统计
   - `storyline-schedule.json`：交汇达成统计

## Performance Metrics

- 冷启动恢复时间：从启动到可给出“下一步推荐”的时间（目标 < 30s）
- context 组装耗时：按 agent 类型统计（重点 ChapterWriter/QualityJudge）
- pipeline stage 耗时：从 `logs/chapter-*-log.json.stages[]` 聚合

## Optional MCP Path

当确定性脚本 ≥3 且调用频繁时，允许提供 MCP 包装（见 `spec/06-extensions.md`），但 benchmark 与性能度量不应依赖 MCP 才能运行。

## Risks / Trade-offs

- [Risk] 基准项目不可复现 → Mitigation：固定输入与配置快照；报告记录配置
- [Risk] 指标过多导致维护成本高 → Mitigation：先收敛到验收必需指标（合规率、冷启动、修订次数、交汇达成）

## References

- `docs/dr-workflow/novel-writer-tool/final/prd/11-appendix.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/08-orchestrator.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/06-extensions.md`

