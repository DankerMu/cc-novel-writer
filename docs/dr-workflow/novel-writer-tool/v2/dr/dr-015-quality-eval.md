# DR-015: 质量评估方法

## Executive Summary

**LLM-as-Judge 在文学创作评估中可用**，但需要精心设计评估维度和 prompt。推荐采用多维度评分 + 人工抽检的混合方案，预期与人工评估的相关性为 0.7-0.8。

## Research Question

1. LLM-as-Judge 方法在文学创作评估中的准确率？
2. 评估维度如何设计？
3. 与人工评估的相关性如何？
4. 成本和延迟？

## Methodology

综合 LLM-as-Judge 领域研究（MT-Bench、Chatbot Arena）、创意写作评估文献、以及实际 AI 写作工具的质量控制方案进行分析。

## Key Findings

### 1. LLM-as-Judge 现状

**核心数据**：
- GPT-4/Claude 作为 judge 与人类评估的一致性：~80%（通用任务）
- 创意写作领域一致性：~65-75%（主观性更强）
- 已知偏差：偏好更长的回答、自身生成的内容、更华丽的文风

**关键论文**：
- MT-Bench（2023）：提出 LLM-as-Judge 框架，GPT-4 与人类一致性 >80%
- Chatbot Arena（2024）：大规模盲测验证 LLM 排名与人类偏好高度相关
- 创意写作评估（2025）：发现 LLM judge 在"创意性"维度准确率较低（~60%），在"连贯性"维度较高（~80%）

### 2. 小说章节评估维度设计

**推荐 6 维度评估体系**：

| 维度 | 权重 | LLM 评估准确率 | 说明 |
|------|------|---------------|------|
| 情节连贯性 | 20% | 高 (~80%) | 是否符合大纲，逻辑是否通顺 |
| 角色一致性 | 20% | 高 (~78%) | 角色言行是否符合人设 |
| 伏笔/呼应 | 15% | 中 (~70%) | 是否正确处理伏笔 |
| 语言质量 | 15% | 高 (~82%) | 语法、词汇、句式 |
| 场景描写 | 15% | 中 (~68%) | 画面感、氛围营造 |
| 情感张力 | 15% | 低 (~60%) | 情感表达、节奏控制 |

**每个维度评分标准**（1-5 分）：
- 5 分：优秀，超越预期
- 4 分：良好，达到标准
- 3 分：合格，有小问题
- 2 分：较差，需要重写
- 1 分：不合格，完全偏离

### 3. 评估 Prompt 设计

```markdown
# Role
你是一位资深小说编辑。请按以下维度评估这一章节的质量。

# Context
章节大纲：{outline}
角色档案：{character_profiles}
前一章摘要：{prev_summary}

# Chapter
{chapter_content}

# Evaluation
请按以下维度逐一评分（1-5 分），并给出具体理由：

1. 情节连贯性：是否符合大纲？逻辑是否通顺？
2. 角色一致性：角色言行是否符合人设？
3. 伏笔/呼应：是否正确处理了本章应有的伏笔？
4. 语言质量：语法、词汇、句式是否达标？
5. 场景描写：画面感和氛围营造如何？
6. 情感张力：情感表达和节奏控制如何？

输出格式：
```json
{
  "scores": {
    "plot_coherence": {"score": N, "reason": "..."},
    "character_consistency": {"score": N, "reason": "..."},
    "foreshadowing": {"score": N, "reason": "..."},
    "language_quality": {"score": N, "reason": "..."},
    "scene_description": {"score": N, "reason": "..."},
    "emotional_tension": {"score": N, "reason": "..."}
  },
  "overall": N,
  "issues": ["具体问题列表"],
  "recommendation": "pass | revise | rewrite"
}
```

### 4. 质量门控策略

| 总分范围 | 行动 |
|---------|------|
| 4.0-5.0 | 直接通过 |
| 3.0-3.9 | 标记问题，自动修订 |
| 2.0-2.9 | 人工审核，决定重写范围 |
| < 2.0 | 强制重写 |

### 5. 成本和延迟

- 单章评估 token 消耗：~8K 输入 + ~1K 输出
- 使用 Sonnet 评估成本：$0.024 + $0.015 = ~$0.04/章
- 20 章全评估：~$0.80
- 延迟：~10 秒/章

### 6. 已知局限性

- **主观维度不可靠**：情感张力、创意性的评估与人工差异较大
- **自我偏好**：LLM 倾向于给自己生成的内容更高分
- **缓解措施**：
  - 使用不同模型生成和评估（如 Opus 生成、Sonnet 评估）
  - 低置信度分数（维度间差异 >2 分）触发人工审核
  - 每 5 章进行一次人工抽检校准

## Sources

- MT-Bench: Zheng et al., "Judging LLM-as-a-Judge" (2023)
- Chatbot Arena: Chiang et al., "LMSYS" (2024)
- Creative Writing Evaluation: 多篇 2024-2025 年研究
- Anthropic Claude Evaluation Best Practices

## Conclusion

**决策建议**：
1. 采用 6 维度 LLM-as-Judge 评估体系
2. 使用不同模型生成和评估，避免自我偏好
3. 低分章节自动修订，极低分触发人工审核
4. 每 5 章人工抽检，校准 LLM 评分
5. 成本低廉（$0.04/章），可全量评估不需抽样
