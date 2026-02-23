## Context

评估与回归的目标不是“替代创作判断”，而是为 M3 的自动化检测提供：
- 统一问题分类（continuity/spec/storyline/style）
- 可重复的度量（命中率、合规率、相关性）
- 可追溯的阈值调整依据（为什么改阈值、改了会影响什么）

数据集由人工标注产生，回归运行由工具读取现有项目文件（M2 产出）执行检查并生成报告。

## Goals / Non-Goals

**Goals:**
- 定义最小可用的标注 schema（JSONL/JSON 皆可），覆盖：NER 一致性错误、Spec/LS violation、故事线问题、人类评分
- 提供校准输出：相关系数、误差分布、建议阈值调整（不自动改配置）
- 提供回归输出：Spec+LS 合规率统计、NER 检出率估计、伏笔追踪准确率（如有标注）

**Non-Goals:**
- 不强制把所有检查都变成确定性脚本（允许 LLM-as-judge，但必须输出可对比的结构化结果）
- 不在 M3 构建大规模数据集（仅 30 章作为校准与回归起点）

## Dataset Format (Proposed)

建议以 `jsonl` 存储（每章一行，便于 diff 与增量维护），字段示例：

```json
{
  "chapter": 48,
  "labels": {
    "continuity_errors": [{"type": "location_conflict", "entity": "lin-feng", "detail": "..."}],
    "spec_violations": [{"layer": "L1", "rule_id": "W-001", "confidence": "high", "detail": "..."}],
    "storyline_issues": [{"rule_id": "LS-001", "detail": "..."}]
  },
  "human_scores": {"overall": 3.8, "style_naturalness": 4, "plot_logic": 4},
  "notes": "人工标注备注"
}
```

> 实现时可拆分为：labels 文件 + human_scores 文件，避免单文件冲突；此处先定义最小可用结构。

## Calibration Output

- Pearson 相关系数（human overall vs judge overall）
- per-dimension 相关性（可选）
- 推荐调整项：门控阈值、confidence 策略、双裁判触发范围（只输出建议，不自动更改）

## Regression Output

- Spec + LS 合规率：违规章数 / 总章数 + rule 分布
- NER 检查：检出/漏检统计（以标注集为准）
- 伏笔追踪：准确率估计（以标注集或人工抽样为准）
- 报告存档：带时间戳与配置快照，支持对比趋势

## Risks / Trade-offs

- [Risk] 人工标注一致性差 → Mitigation：提供标注指南与示例；先做 10 章试标注再扩展到 30
- [Risk] LLM 评估不稳定影响回归 → Mitigation：固定提示词与输入裁剪；报告输出尽量结构化并允许“模糊区间”

## References

- `docs/dr-workflow/novel-writer-tool/final/milestones.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/11-appendix.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/agents/quality-judge.md`

