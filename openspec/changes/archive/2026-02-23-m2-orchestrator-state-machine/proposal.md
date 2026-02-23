## Why

卷制滚动工作流需要一个可恢复、可验证的状态机，才能在“新 session / context 压缩 / 中断恢复”情况下仍然知道当前处于：快速起步、卷规划、写作循环、卷末回顾的哪一步，并据此给出下一步推荐与正确的 gate/回顾触发。

## What Changes

- 将 PRD §8.2 的 Orchestrator 状态机落地到入口 Skills 的行为契约中（状态写入 `.checkpoint.json`）
- 明确状态转移触发条件（卷规划确认、门控通过、卷末、错误重试、修订循环）
- 明确冷启动恢复规则：从文件状态恢复（checkpoint + state + summaries + outline），不依赖会话历史
- 明确用户审核点触发（大纲确认、质量回顾、卷末回顾），并为研究资料导入入口提供稳定路由

## Capabilities

### New Capabilities

- `orchestrator-state-machine`: 提供 INIT→QUICK_START→VOL_PLANNING→WRITING→VOL_REVIEW 的状态机与恢复规则，支撑 30 章一卷的完整循环。

### Modified Capabilities

- (none)

## Impact

- 影响范围：`.checkpoint.json` 的状态字段语义、`/novel:start` 与 `/novel:continue` 的路由与转移规则
- 依赖关系：依赖 M1 的入口 Skills 与章节流水线；与 M2 的 volume planning/context injection changes 强耦合
- 兼容性：新增能力；不会改变已完成章节文件格式

## Milestone Mapping

- Milestone 2: 2.1（状态机）、2.6（冷启动恢复）、2.8（用户审核点交互）、2.13（导入研究资料入口）、2.15（完成 1 卷 30 章循环）。参见 `docs/dr-workflow/novel-writer-tool/final/milestones.md`。

## References

- `docs/dr-workflow/novel-writer-tool/final/prd/08-orchestrator.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/04-workflow.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/02-skills.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/09-data.md`
- `docs/dr-workflow/novel-writer-tool/final/milestones.md`

