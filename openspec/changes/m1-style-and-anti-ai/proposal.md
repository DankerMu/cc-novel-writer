## Why

“去 AI 化”是该工具的差异化核心：如果输出持续命中 AI 高频用语、句式重复、风格漂移，作者会快速放弃使用。需要在 M1 就建立风格指纹与黑名单的基础能力，为 ChapterWriter/StyleRefiner/QualityJudge 提供统一的风格与检测输入。

## What Changes

- 定义并实现 StyleAnalyzer Agent：从用户样本/参考作者/预置模板中提取 `style-profile.json`
- 固化 `style-profile.json` 的关键字段（含 `writing_directives` 与 `override_constraints`），用于正向风格引导与约束覆盖
- 提供 AI 高频用语黑名单模板 `ai-blacklist.json`（≥30 条，含分类），供 ChapterWriter（Top-10 提醒）与 StyleRefiner（全量替换）使用
- 提供共享知识库 `skills/novel-writing/**`：去 AI 化规则详解与 8 维度质量评分标准（供全体 Agents 参考）

## Capabilities

### New Capabilities

- `style-and-anti-ai`: 统一风格指纹、黑名单与去 AI 化方法论资产，支撑生成与评估链路的风格一致性。

### Modified Capabilities

- (none)

## Impact

- 影响范围：StyleAnalyzer prompt、style-profile 与 blacklist 模板、共享知识库与 references
- 依赖关系：与 `m1-chapter-pipeline-agents` 在 context 注入处对接（ChapterWriter/StyleRefiner/QualityJudge 读取）
- 兼容性：新增文件与 schema；后续 M3 扩展风格漂移与黑名单动态更新在此基础上演进

## Milestone Mapping

- Milestone 1: 1.5（StyleAnalyzer）、去 AI 化基线（PRD §7）、模板与评分标准（spec/04-quality、spec/05-templates）。参见 `docs/dr-workflow/novel-writer-tool/final/milestones.md`。

## References

- `docs/dr-workflow/novel-writer-tool/final/prd/07-anti-ai.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/agents/style-analyzer.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/04-quality.md`（novel-writing 知识库、style-guide、quality-rubric）
- `docs/dr-workflow/novel-writer-tool/final/spec/05-templates.md`（ai-blacklist.json、style-profile-template.json）
- `docs/dr-workflow/novel-writer-tool/final/milestones.md`

