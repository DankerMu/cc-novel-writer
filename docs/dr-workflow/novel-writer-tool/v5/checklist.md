# Checklist v5

| # | Type | Suspicious Point | Research Direction |
|---|------|------------------|--------------------|
| 1 | tech | LLM 在多故事线切换场景下能否维持正确的时间/空间/状态一致性？concurrent_state 注入是否足以防止串线？ | 设计实验：给 LLM 3 条交替故事线的 context，测试切线后的状态记忆准确率。调研已有的 multi-thread narrative AI 研究。 |
| 2 | product | 快速起步（Layer 1）时用户何时定义初始故事线？30 分钟内增加此步骤是否影响首次体验流畅度？ | 编辑修复：在 Layer 1 流程中增加 storyline 初始化步骤，无需 DR |
| 3 | architecture | storyline_coherence 维度权重 0.08 从现有维度"匀出"——具体从哪个维度扣？8 维度总和是否 = 1.0？ | 编辑修复：明确权重重分配方案，无需 DR |
