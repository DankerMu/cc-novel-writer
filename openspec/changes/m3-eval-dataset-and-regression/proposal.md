## Why

M3 的质量保证能力（NER/伏笔/LS/门控/风格漂移等）只有在“可测量、可回归”的前提下才可持续迭代。仅靠主观观感无法校准阈值、无法比较改动影响。需要一个 30 章人工标注测试集 + 回归运行与报告体系，作为后续 issue 拆分与实现验收的基线。

## What Changes

- 定义人工标注测试集格式：30 章的“一致性错误/Spec 违反/故事线问题/人类评分”标注结构
- 定义 QualityJudge 校准流程：计算人工评分 vs Judge 评分相关性（Pearson > 0.6 为目标）并输出建议阈值
- 定义回归测试流程：对 M2 产出运行全部检查（含 Spec + LS 合规率统计）并生成报告
- 定义结果存档与对比机制：保存每次回归 run 的配置、时间、结果摘要，支持对比趋势

## Capabilities

### New Capabilities

- `eval-dataset-and-regression`: 评估数据集 schema、校准与回归运行/报告输出能力。

### Modified Capabilities

- (none)

## Impact

- 影响范围：质量体系的验收与迭代方式（回归报告成为 change/issue 的验收标准来源）
- 依赖关系：依赖 M2 的 30 章产出作为测试数据基线；依赖 QualityJudge 输出结构与各类检查报告
- 兼容性：新增测试与报告产物；不影响用户正常写作流程（可作为维护命令/开发模式工具）

## Milestone Mapping

- Milestone 3: 3.7（30 章人工标注测试集 + 校准）、3.8（回归测试 + Spec/LS 合规率统计）。参见 `docs/dr-workflow/novel-writer-tool/final/milestones.md`。

## References

- `docs/dr-workflow/novel-writer-tool/final/milestones.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/11-appendix.md`（指标：NER > 80%、相关系数 > 0.6、合规率统计）
- `docs/dr-workflow/novel-writer-tool/final/prd/04-workflow.md`（定期检查与回顾输出）
- `docs/dr-workflow/novel-writer-tool/final/prd/06-storylines.md`（LS/故事线问题分类）
- `docs/dr-workflow/novel-writer-tool/final/spec/agents/quality-judge.md`（评分结构）

