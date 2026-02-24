## Why

卷制写作过程中，世界观与角色网络需要持续增量更新：新增地点/规则、角色登场/退场/关系变化、契约变更都必须被结构化记录并可被后续章节一致地消费。缺少“生命周期管理”，会导致设定漂移、角色串味与状态膨胀不可控。

## What Changes

- 落地 WorldBuilder 的增量更新模式：更新 `world/*.md` + `world/rules.json` + `world/changelog.md`
- 落地 CharacterWeaver 的全生命周期：新增/更新/退场角色；输出 `.md` 档案 + `.json`（含 `id/display_name/contracts[]`）+ relationships/changelog 更新
- 落地 state 裁剪与归档策略：退场角色归档、保护规则（伏笔/故事线/交汇事件引用不可退场）、卷末清理报告

## Capabilities

### New Capabilities

- `world-and-character-lifecycle`: 提供世界观与角色的增量维护、结构化契约与归档裁剪策略，保证跨章一致性可持续。

### Modified Capabilities

- (none)

## Impact

- 影响范围：`world/`、`characters/`、`state/current-state.json` 与相关 changelog；WorldBuilder/CharacterWeaver prompts
- 依赖关系：依赖项目目录结构与 slug ID 约定；被 PlotArchitect/ChapterWriter/QualityJudge 在后续流程消费
- 兼容性：新增能力；要求未来实现遵循归档保护规则

## Milestone Mapping

- Milestone 2: 2.3（WorldBuilder 增量更新）、2.4（CharacterWeaver 生命周期）、2.7（state 裁剪）。参见 `docs/dr-workflow/novel-writer-tool/final/milestones.md`。

## References

- `docs/dr-workflow/novel-writer-tool/final/spec/agents/world-builder.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/agents/character-weaver.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/08-orchestrator.md`（state 裁剪策略）
- `docs/dr-workflow/novel-writer-tool/final/prd/09-data.md`（characters/world/state 目录与实体 ID 约定）

