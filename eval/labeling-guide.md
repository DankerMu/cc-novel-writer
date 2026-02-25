# 标注指南（30 章人工校准集）

> 目标：给 M3 的自动化检测（NER/continuity、Spec/LS 合规、故事线节奏、伏笔追踪、门控阈值）提供**可回归**的人工基线。
>
> 建议流程：先试标注 10 章（确保多人标注一致性与 schema 可用），再扩展到 30 章。

## 1) 标注文件与位置

- 数据集文件必须是 JSONL（每章一行 JSON）：
  - 位置：`eval/datasets/<dataset_id>/v1/labels-YYYY-MM-DD.jsonl`
  - schema：`eval/schema/labeled-chapter.schema.json`

每行最小结构：

```json
{
  "schema_version": 1,
  "chapter": 48,
  "labels": {
    "continuity_errors": [],
    "spec_violations": [],
    "storyline_issues": []
  },
  "human_scores": {"overall": 3.8},
  "notes": "可选备注"
}
```

## 2) continuity_errors（一致性错误）

**来源对齐**：类型枚举与说明以 `skills/continue/references/continuity-checks.md` 为准（回归友好）。

### 2.1 类型枚举（最小集合）

- `character_mapping`：display_name ↔ slug 映射冲突、state/档案 display_name 不一致
- `relationship_jump`：关系值单章剧烈变化/符号翻转，或关系描述自相矛盾
- `location_contradiction`：同一 time_marker 下角色在多个地点（疑似瞬移/矛盾）
- `timeline_contradiction`：跨故事线并发状态与本章 time_marker/事件顺序矛盾（对齐 LS-001 hard）

### 2.2 粒度与证据要求

- 粒度：**每章一条或多条**（同章可有多类错误）
- 每条建议包含：
  - `detail`：一句话描述矛盾点
  - `evidence[]`：尽量提供 1-2 条可定位证据（chapter/summary/contract/log），包含 `path` + `line` + `snippet`（snippet ≤160 字）
- `severity/confidence`：
  - 人工标注默认 `confidence="high"`；如你也不确定，可降级为 medium/low（用于“争议样本”统计）

示例：

```json
{
  "type": "location_contradiction",
  "severity": "high",
  "confidence": "high",
  "detail": "同一 time_marker 下主角同时在两个地点。",
  "evidence": [
    {"source": "chapter", "chapter": 47, "path": "chapters/chapter-047.md", "line": 12, "snippet": "第三年冬末，林枫仍在魔都……"},
    {"source": "chapter", "chapter": 48, "path": "chapters/chapter-048.md", "line": 120, "snippet": "林枫抬头望向幽暗森林深处……"}
  ]
}
```

## 3) spec_violations（Spec/LS 违反）

用于与 QualityJudge 的 `contract_verification` 对齐（L1/L2/L3/LS）。

### 3.1 layer 与 rule_id

- `layer="L1"`：世界规则（`W-XXX`）
- `layer="L2"`：角色契约（`C-角色ID-XXX` 或实际 contract_id）
- `layer="L3"`：章节契约 objective/acceptance（`OBJ-{C}-X` 或 objective_id）
- `layer="LS"`：故事线规范（`LS-001`~`LS-005`）

### 3.2 标注建议

- 只标注你能提供清晰证据的 violation；争议项可用低置信标注（confidence=low）
- `constraint_type`：仅对 LS 建议填（hard/soft）；其他层可省略

示例：

```json
{
  "layer": "LS",
  "rule_id": "LS-001",
  "constraint_type": "hard",
  "confidence": "high",
  "detail": "时间线矛盾：并发线显示'冬末'，本章锚点为'盛夏'且未解释。",
  "evidence": [{"source": "contract", "path": "volumes/vol-02/chapter-contracts/chapter-048.json", "snippet": "concurrent_state: ... (ch25)"}]
}
```

## 4) storyline_issues（故事线问题）

用于标注“非严格 violation，但影响跟线体验/节奏”的问题，或对 LS soft 的问题进行更细化归类。

建议 `rule_id`：

- `LS-002`：切线锚点不足（开头 200 字未建立时空锚点）
- `LS-003`：交汇事件铺垫不足（交汇前未在各线铺垫）
- `LS-004`：休眠线重启缺少读者记忆重建
- `LS-005`：非交汇章跨线信息泄漏（若你认为属于硬错误，也应同时在 spec_violations 标注）
- `rhythm:dormancy`：节奏问题（副线休眠过久）
- `convergence:missed`：交汇事件未在计划范围内达成（偏差说明）

示例：

```json
{
  "rule_id": "rhythm:dormancy",
  "severity": "medium",
  "detail": "副线连续 10+ 章未出现，读者记忆断裂风险高。"
}
```

## 5) human_scores（人工评分）

用于校准 QualityJudge。分数范围建议与 QualityJudge 一致：`1.0`（很差）到 `5.0`（极佳）。

- `overall` 必填（可为一位小数）
- 维度分（可选）建议使用与 QualityJudge 对齐的 8 维度键：
  - `plot_logic`
  - `character`
  - `immersion`
  - `foreshadowing`
  - `pacing`
  - `style_naturalness`
  - `emotional_impact`
  - `storyline_coherence`

评分参考材料：
- `skills/novel-writing/references/quality-rubric.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/agents/quality-judge.md`（评分结构与权重）

## 6) 试标注（前 10 章）

建议创建一份“试标注模板”文件（10 行）并先跑一遍校准与回归脚本，确保：

- schema 可解析
- chapter 编号能与 eval/logs 对齐
- 报告输出满足预期（相关性、合规率、问题汇总）

## References

- `skills/continue/references/continuity-checks.md`
- `skills/novel-writing/references/quality-rubric.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/agents/quality-judge.md`
- `docs/dr-workflow/novel-writer-tool/final/milestones.md`
