# DR-019: Haiku Summarizer 质量风险评估

## Executive Summary

建议将 Summarizer 从 Haiku 4.5 升级为 Sonnet 4.6。成本增量微小（+$0.02/章，300 章仅 +$6），但风险-收益严重不对称：Summarizer 是 context 链的信息瓶颈，任何遗漏通过滑动窗口不可逆累积。

## 核心发现

### 1. 中文能力差距

Anthropic 官方多语言 benchmark（MMLU 零样本）：

| 模型 | 中文相对英语表现 |
|------|----------------|
| Sonnet 4.5 | 96.9%（-3.1%）|
| Haiku 4.5 | 94.2%（-5.8%）|

Haiku 在中文上比 Sonnet 多损失 2.7% 推理能力。对于需要精确理解网文中隐喻、伏笔暗示、情绪变化的摘要任务，差距会体现在信息保留质量上。

### 2. 结构化输出能力

n8n AI Benchmark：
- Haiku 4.5 Structured Output：92/100（排名 #2）
- Hallucination：97/100（排名 #2）

JSON 格式可靠性高，但问题在于 **JSON 内容的完整性**。社区反馈：Haiku 在"明确任务"上表现好，但在"复杂多步判断"上质量下降。

### 3. 成本分析

| 项目 | Haiku | Sonnet | 差异 |
|------|-------|--------|------|
| Summarizer 单次（~5K in, ~1K out）| $0.01 | $0.03 | +$0.02 |
| 100 章总计 | $1.00 | $3.00 | +$2.00 |
| 300 章总计 | $3.00 | $9.00 | +$6.00 |
| 占单章总成本比 | 1.7% | 5.0% | +3.3% |

Summarizer 在流水线中成本占比极低。升级到 Sonnet 后，单章总成本从 $0.58 变为 $0.60，涨幅 3.4%。

### 4. 误差累积风险

学术研究（arXiv:2502.20258 "LLM as a Broken Telephone"）证实：LLM 迭代生成中信息失真累积，较弱模型失真速率更高。

Summarizer 的三重任务（摘要 + 状态 JSON + 伏笔变更）中，第 2/3 项是**信息抽取**而非压缩。Haiku 的风险：
- 遗漏微妙伏笔推进（角色一句暗示被忽略）
- 情绪状态粒度不够（"犹豫→决意"被概括为"心态变化"）
- 物品状态遗漏（战斗中折断的剑未记录）

错误传播：第 N 章遗漏 → 第 N+1 章 context 缺失 → 生成矛盾 → 摘要也不含纠正 → 错误永久固化。

## 建议

**升级 Summarizer 到 Sonnet 4.6**。

PRD 模型策略修正：
```
| Summarizer | Sonnet 4.6 | 信息保留关键，成本增量可忽略（+$0.02/章）|
```

## Sources

- Anthropic Multilingual Benchmarks (platform.claude.com)
- n8n AI Benchmark 2025
- arXiv:2502.20258 "LLM as a Broken Telephone"
