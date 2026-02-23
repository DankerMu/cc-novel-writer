## 1. WorldBuilder (L1 Rules)

- [x] 1.1 落地 `agents/world-builder.md`（初始化/增量模式、输入/输出、规则抽取约束）
- [x] 1.2 定义并实现 `world/rules.json` schema（rules[]：id/category/rule/constraint_type/exceptions[]/introduced_chapter/last_verified）
- [x] 1.3 定义并实现 world 活文档输出：`world/geography.md`、`world/history.md`、`world/rules.md`、`world/changelog.md`

## 2. Storylines Foundation

- [x] 2.1 定义并实现 `storylines/storylines.json` schema（storylines[]/relationships[]/storyline_types[]）
- [x] 2.2 初始化阶段生成至少 1 条 `type=main_arc` 的主线（scope=novel，status=active）
- [x] 2.3 为每条已定义故事线创建 `storylines/{id}/memory.md`（初始可为空或最小摘要）

## 3. Integration Contracts

- [x] 3.1 约定 ChapterWriter/PlotArchitect/QualityJudge 的输入读取路径（rules.json/storylines.json/memory.md）
- [x] 3.2 约定 Summarizer 线记忆更新写入 staging 的路径：`staging/storylines/{storyline_id}/memory.md`（commit 时覆盖正式目录）

## References

- `docs/dr-workflow/novel-writer-tool/final/prd/09-data.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/05-spec-system.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/06-storylines.md`
