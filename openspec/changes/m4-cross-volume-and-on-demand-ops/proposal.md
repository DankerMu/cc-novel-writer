## Why

写到 100 章尺度的核心挑战不在“单章生成”，而在“跨卷衔接 + 按需维护”：卷末回顾如何传递到下卷规划、世界观/角色/伏笔/故事线如何在写作中按需更新并触发 Spec 传播链。如果缺少这些操作入口与规则约束，项目会在 2-3 卷后出现设定碎片化、契约失效、故事线断链的问题。

## What Changes

- 跨卷衔接：卷末回顾 → 下卷规划 → 续写的完整链路（含 Spec + 故事线传递）
- 按需工具调用：新增角色/世界观更新/伏笔查询/故事线管理等，通过 `/novel:start` 入口路由
- Spec 变更传播：按需更新触发 L1→L2→L3 受影响项标记与再生成建议
- 事务与安全：按需操作同样遵循 staging→validate→commit，并使用 `<DATA>` delimiter 注入外部文本

## Capabilities

### New Capabilities

- `cross-volume-and-on-demand-ops`: 跨卷生命周期衔接与按需维护操作（world/character/foreshadow/storylines），并保证 Spec 传播与事务一致性。

### Modified Capabilities

- (none)

## Impact

- 影响范围：`/novel:start` 的路由与菜单、VOL_REVIEW→VOL_PLANNING 转移、增量更新的 staging/commit 事务、Spec 传播标记
- 依赖关系：依赖 volumes/review.md、state/history、storylines 与 global foreshadowing、协议 §10.5/§10.9
- 兼容性：新增交互入口与维护命令；不改变既有文件的核心 schema

## Milestone Mapping

- Milestone 4: 4.2（跨卷衔接）、4.3（按需工具调用）。参见 `docs/dr-workflow/novel-writer-tool/final/milestones.md`。

## References

- `docs/dr-workflow/novel-writer-tool/final/milestones.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/04-workflow.md`（Layer 3 全局维护）
- `docs/dr-workflow/novel-writer-tool/final/prd/05-spec-system.md`（变更传播链）
- `docs/dr-workflow/novel-writer-tool/final/prd/08-orchestrator.md`（状态机与卷末回顾）
- `docs/dr-workflow/novel-writer-tool/final/prd/09-data.md`（volumes/state/storylines/foreshadowing 结构）
- `docs/dr-workflow/novel-writer-tool/final/prd/10-protocols.md`（事务与 DATA 注入安全）

