## Why

卷制滚动的效率来自“卷级规划 → 章级执行”的确定性接口：PlotArchitect 必须输出可程序化提取的大纲区块、章节契约与故事线调度，才能让后续的 ChapterWriter 逐章续写与 QualityJudge 合规验收形成闭环。同时，Spec 变更需要可追溯传播，避免规则改动后产生隐性矛盾。

## What Changes

- 落地 PlotArchitect 的卷规划产物与格式约束：
  - `volumes/vol-{V:02d}/outline.md`（严格区块格式，可正则提取）
  - `volumes/vol-{V:02d}/storyline-schedule.json`
  - `volumes/vol-{V:02d}/foreshadowing.json`
  - `volumes/vol-{V:02d}/chapter-contracts/chapter-{C:03d}.json`
  - `volumes/vol-{V:02d}/new-characters.json`
- 固化 L3 章节契约结构（preconditions/objectives/postconditions/acceptance_criteria + storyline 字段）
- 固化 Spec 变更传播链：世界规则变更 → 受影响角色契约 → 受影响章节契约（标记需更新/重生成）

## Capabilities

### New Capabilities

- `volume-planning-and-contract-propagation`: 提供卷规划与 L3 契约产物的确定性格式，以及 Spec 变更传播的可追溯机制。

### Modified Capabilities

- (none)

## Impact

- 影响范围：`volumes/vol-*/` 目录下的规划产物与契约文件；PlotArchitect prompt 与入口 `/novel:start` 的卷规划审核流程
- 依赖关系：依赖 storylines/world/characters 基础文件；被 `/novel:continue` 的 context 组装与 QualityJudge 合规检查消费
- 兼容性：新增规划产物；不改变已提交章节格式

## Milestone Mapping

- Milestone 2: 2.5（PlotArchitect）、2.8（大纲/调度审核点）、2.9（Spec 变更传播链）、2.15（30 章循环验证）。参见 `docs/dr-workflow/novel-writer-tool/final/milestones.md`。

## References

- `docs/dr-workflow/novel-writer-tool/final/spec/agents/plot-architect.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/05-spec-system.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/06-storylines.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/09-data.md`
- `docs/dr-workflow/novel-writer-tool/final/milestones.md`

