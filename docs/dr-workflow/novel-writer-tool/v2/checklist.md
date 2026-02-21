# Checklist v2

| # | Type | Suspicious Point | Research Direction |
|---|------|------------------|--------------------|
| 1 | feasibility | 单部 5 万字小说的 API 成本是多少？ | 基于 DR-001（context window）和 DR-004（生成速度）计算 tokens 消耗，结合 Claude API 定价估算成本 |
| 2 | tech | WorldBuilder、CharacterWeaver 等 agent 的 prompt 结构如何设计？ | 调研 prompt engineering 最佳实践，参考 Constella 论文中的 agent prompt 设计 |
| 3 | methodology | 如何自动化评估生成章节的质量（情节连贯性、角色一致性）？ | 调研 LLM-as-judge 方法，评估其在文学创作中的适用性 |
| 4 | product | 目标用户是网文作者、传统文学作者还是业余爱好者？不同群体需求差异？ | 细分小说作家群体，分析各群体对 AI 辅助的接受度和需求 |
| 5 | market | NovelAI、Sudowrite 的具体功能和用户反馈？本产品的差异化优势？ | 深度调研竞品功能、定价、用户评价，明确差异化定位 |
