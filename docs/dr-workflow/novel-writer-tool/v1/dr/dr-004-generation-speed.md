# DR-004: Claude API 章节生成速度验证

## Executive Summary

**研究问题**：验证"生成 1 章（3000 字中文）耗时 < 5 分钟"的目标是否现实。

**核心发现**：该目标**完全可行且保守**。基于 Claude Opus 4.6 实际性能数据：
- **标准模式**：单章生成耗时约 **1.2-1.5 分钟**（远低于 5 分钟目标）
- **Fast Mode**：单章生成耗时约 **0.5-0.8 分钟**（可选，成本增加 5 倍）

**建议**：采用标准模式即可满足性能需求，无需启用 Fast Mode。5 分钟目标可下调至 2 分钟以提升用户体验预期。

---

## Research Question

基于 Claude API 实际生成速度（tokens/s）和 3000 字中文（约 4500 tokens）计算理论耗时，加上 prompt 构建和状态管理开销，验证"生成 1 章耗时 < 5 分钟"是否现实。

---

## Methodology

### 数据来源
1. **Artificial Analysis** (2026-02)：独立第三方 AI 模型性能基准测试平台
2. **OpenRouter API Stats**：实时 API 提供商性能监控
3. **Anthropic 官方文档**：Fast Mode 技术规格

### 计算模型
```
总耗时 = TTFT + 纯生成时间 + 状态管理开销 + 网络延迟
```

**假设条件**：
- 章节长度：3000 中文字符 ≈ 4500 output tokens
- Prompt 大小：世界观（5000 tokens）+ 角色档案（3000 tokens）+ 章节大纲（2000 tokens）= 10000 input tokens
- 网络环境：正常公网连接（非极端弱网）

---

## Key Findings

### 1. Claude Opus 4.6 基准性能

#### 输出速度（Output Tokens Per Second）
| 提供商 | 速度 (t/s) | 数据来源 |
|--------|-----------|---------|
| Amazon Bedrock | 70.2 | Artificial Analysis |
| Anthropic Direct | 68.5 | Artificial Analysis |
| Azure | 66.6 | Artificial Analysis |
| Google Vertex AI | 59.4 | Artificial Analysis |
| **平均值** | **67.1** | Artificial Analysis |

#### 延迟指标
- **Time to First Token (TTFT)**：1.06s - 2.10s（取决于提供商）
- **Throughput**：42-70 tokens/s（实际吞吐量受并发影响）

### 2. 单章生成耗时计算

#### 标准模式（Standard Opus 4.6）
```
纯生成时间 = 4500 tokens ÷ 67 t/s = 67 秒
TTFT 延迟 = 2 秒（保守估计）
状态管理 = 2 秒（读取 state.json + 写入新状态）
网络往返 = 2 秒（API 请求 + 响应传输）
-------------------------------------------
总耗时 ≈ 73 秒 ≈ 1.2 分钟
```

**考虑波动后的范围**：1.0 - 1.5 分钟

#### Fast Mode（可选加速）
```
纯生成时间 = 4500 tokens ÷ (67 × 2.5) t/s = 27 秒
其他开销 = 6 秒（同上）
-------------------------------------------
总耗时 ≈ 33 秒 ≈ 0.55 分钟
```

**成本对比**：
- 标准模式：$5/M input + $25/M output = 单章约 $0.16
- Fast Mode：$30/M input + $150/M output = 单章约 $0.98（**6 倍成本**）

### 3. 并发写作场景（20 章同时生成）

#### 理论瓶颈
- **API 速率限制**：Anthropic Tier 3 账户支持 4000 RPM（Requests Per Minute）
- **并发请求**：20 个 ChapterWriter 同时调用 API 不会触发限流
- **总耗时**：仍为 1.2-1.5 分钟（并行执行，非串行累加）

#### 实际考虑
- **Token 配额**：Tier 3 支持 4M tokens/min，20 章并发消耗约 290K tokens（10K input + 4.5K output）× 20 = 远低于限额
- **网络拥塞**：多个并发请求可能导致 TTFT 略微增加（+1-2 秒）

### 4. 影响因素分析

| 因素 | 影响程度 | 说明 |
|------|---------|------|
| 提供商选择 | 中等 | Amazon Bedrock 比 Google Vertex 快 18% |
| 网络质量 | 低 | 正常网络下延迟差异 < 1 秒 |
| Prompt 长度 | 低 | TTFT 对 10K input 不敏感（< 0.5s 差异）|
| 并发数量 | 低 | 20 并发不会显著影响单请求速度 |
| 时段负载 | 低-中 | 高峰期可能降速 5-10% |

---

## Sources

1. **Artificial Analysis - Claude Opus 4.6 Performance Benchmarking**
   https://artificialanalysis.ai/models/claude-opus-4-6/providers
   数据时间：2026-02，包含 4 家主流提供商的实测速度

2. **OpenRouter - Claude Sonnet 4.6 Stats**
   https://openrouter.ai/anthropic/claude-sonnet-4.6
   实时监控数据：42 tps throughput, 2.10s latency

3. **Anthropic Official Docs - Fast Mode Specification**
   https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-latency
   Fast Mode 技术细节：2.5x 速度提升，成本增加 5-6 倍

4. **Reddit - Claude Code TPS Viewer Discussion**
   https://www.reddit.com/r/ClaudeAI/comments/1pxjhme/claude_code_tokens_per_second_viewer/
   社区实测数据验证官方基准

---

## Conclusion

### 核心结论
**"生成 1 章耗时 < 5 分钟"的目标不仅现实，而且过于保守**。实际耗时约为目标的 **20-30%**（1.2 分钟 vs 5 分钟）。

### 技术可行性
1. **标准模式已足够**：67 t/s 的输出速度可在 1.5 分钟内完成单章生成
2. **Fast Mode 非必需**：除非用户对实时性有极端要求（< 1 分钟），否则 6 倍成本增加不值得
3. **并发无瓶颈**：20 章并行写作不会触发 API 限流或显著降速

### 架构建议
1. **默认使用标准模式**：成本效益最优
2. **提供 Fast Mode 开关**：让用户在"快速迭代"场景下按需启用
3. **调整性能目标**：将"< 5 分钟"下调至"< 2 分钟"，提升用户体验预期
4. **监控实际耗时**：在 ChapterWriter agent 中记录生成时间，识别异常慢的请求

### 风险提示
1. **网络环境依赖**：弱网环境下延迟可能翻倍（但仍 < 3 分钟）
2. **API 降级**：Anthropic 服务故障时可能触发降速或排队
3. **Prompt 膨胀**：若世界观文档超过 20K tokens，TTFT 可能增加 1-2 秒

### 下一步行动
- [ ] 在 Milestone 1 原型中实测单章生成耗时
- [ ] 验证 20 章并发场景的实际性能
- [ ] 建立性能监控机制（记录 TTFT、生成速度、总耗时）
- [ ] 评估是否需要实现 Fast Mode 切换功能
