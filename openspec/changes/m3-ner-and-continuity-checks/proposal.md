## Why

跨 30-100 章的长篇续写中，“一致性错误”是最常见且最破坏体验的问题：角色位置/称呼/关系、地点名、时间线矛盾会迅速累积。M3 需要将一致性检查从“人工感觉”升级为可度量、可回归的检测能力，并支撑 LS-001（时间线一致性 hard）落地。

## What Changes

- 增加 NER 一致性检查能力：从章节/摘要中提取角色名、地名、时间线线索，检测跨章矛盾
- 增加跨故事线时间线矛盾检测：对并发线的 time marker/事件顺序进行比对，作为 LS-001 hard 检查的重要输入
- 定义一致性报告输出（可供 `/novel:start` 质量回顾/卷末回顾展示），并支持回归运行
- 预留确定性工具脚本接口（run-ner.sh），存在则调用，不存在则回退 LLM 路径

## Capabilities

### New Capabilities

- `ner-and-continuity-checks`: 提供中文 NER 与一致性/时间线矛盾检测，并可生成可回归的报告。

### Modified Capabilities

- (none)

## Impact

- 影响范围：质量回顾/卷末回顾流程、QualityJudge LS-001 的输入增强、可选 CLI 脚本扩展点
- 依赖关系：依赖 summaries/state/storylines 等结构化持久化；与 `m3-eval-dataset-and-regression` 联动验证指标
- 兼容性：新增检测能力；不改变写作流水线的核心输出格式

## Milestone Mapping

- Milestone 3: 3.1（NER 一致性检查 + 跨故事线时间线矛盾检测）。参见 `docs/dr-workflow/novel-writer-tool/final/milestones.md`。

## References

- `docs/dr-workflow/novel-writer-tool/final/milestones.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/04-workflow.md`（每 10 章一致性检查）
- `docs/dr-workflow/novel-writer-tool/final/prd/06-storylines.md`（LS-001 hard 与 time_index 规划）
- `docs/dr-workflow/novel-writer-tool/final/spec/06-extensions.md`（run-ner.sh 扩展点）
- `docs/dr-workflow/novel-writer-tool/final/prd/11-appendix.md`（NER 检出率目标）

