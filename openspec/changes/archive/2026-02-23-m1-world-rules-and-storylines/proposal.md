## Why

Spec-Driven Writing 体系要求在 M1 就能产出可验证的 L1 世界规则（`world/rules.json`），并建立多线叙事的最小数据骨架（`storylines/storylines.json` + line memory）。否则 QualityJudge 的合规检查无法落地，多线叙事也缺少“小说级实体”的持久载体。

## What Changes

- 定义并实现 WorldBuilder Agent：输出世界观活文档（`world/*.md`）与结构化 L1 规则表（`world/rules.json`）
- 固化 L1 规则 schema（rule id/category/constraint_type/exceptions/introduced_chapter/last_verified）
- 在初始化阶段协助生成 `storylines/storylines.json`（至少 1 条 `main_arc` 主线），并约定每条线的 `storylines/{id}/memory.md` 独立记忆文件

## Capabilities

### New Capabilities

- `world-rules-and-storylines`: 产出并维护 L1 世界规则与 storylines 基础结构，为合规验收与多线调度提供持久数据层。

### Modified Capabilities

- (none)

## Impact

- 影响范围：`world/`、`storylines/` 的数据模型与初始化流程；WorldBuilder prompt 与其输出文件契约
- 依赖关系：依赖入口 `/novel:start` 的项目初始化路由；被 PlotArchitect/ChapterWriter/QualityJudge 在后续里程碑消费
- 兼容性：新增文件与目录；对后续 changes 提供稳定 schema

## Milestone Mapping

- Milestone 1: 1.10（L1 世界规则 Spec）、1.11（storylines.json 基础结构）；并为 M2 的多线调度与 LS 规范提供基础。参见 `docs/dr-workflow/novel-writer-tool/final/milestones.md`。

## References

- `docs/dr-workflow/novel-writer-tool/final/spec/agents/world-builder.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/05-spec-system.md`（L1 世界规则）
- `docs/dr-workflow/novel-writer-tool/final/prd/06-storylines.md`（storylines 数据模型与类型）
- `docs/dr-workflow/novel-writer-tool/final/prd/09-data.md`（world/ 与 storylines/ 目录结构与文件命名）
- `docs/dr-workflow/novel-writer-tool/final/milestones.md`

