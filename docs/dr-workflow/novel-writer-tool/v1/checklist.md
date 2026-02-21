# Checklist v1

| # | Type | Suspicious Point | Research Direction |
|---|------|------------------|--------------------|
| 1 | tech | Claude Code context window 是否足够容纳完整世界观 + 角色档案？ | 调研 Claude Opus 4.6 实际 context window 限制，测试包含世界观文档（~5000 tokens）+ 角色档案（~3000 tokens）+ 章节大纲（~2000 tokens）的 prompt 是否可行 |
| 2 | tech | 并行写作 20 章时，agent 数量上限和性能表现？ | 调研 Claude Code TeamCreate 的 agent 并发上限，查找相关性能基准测试数据，验证是否支持 20+ agent 同时运行 |
| 3 | tech | 状态同步的实时性能否满足 agent 间依赖？ | 调研 SendMessage 和 TaskUpdate 的延迟特性，验证 ChapterWriter 读取 state.json 后其他 agent 更新是否会导致竞态条件 |
| 4 | feasibility | 生成 1 章（3000 字）耗时 < 5 分钟的目标是否现实？ | 基于 Claude API 实际生成速度（tokens/s）和 3000 字中文（约 4500 tokens）计算理论耗时，加上 prompt 构建和状态管理开销 |
| 5 | tech | 风格一致性检查的"每 5 章提取风格特征"技术可行性？ | 调研现有 LLM-based 风格分析方法（词汇分布、句式模式提取），验证是否有成熟工具或需要自研 |
| 6 | architecture | 状态管理的 JSON 文件方案在高并发写作时是否会冲突？ | 调研文件锁机制或替代方案（如 SQLite、Redis），评估 20 个 ChapterWriter 同时读写 state.json 的风险 |
| 7 | feasibility | 伏笔回收率 > 90% 的自动化检测准确度？ | 调研 NLP 中的指代消解和事件追踪技术，评估 LLM 能否准确识别"伏笔埋设"和"伏笔回收"的对应关系 |
| 8 | product | 人工审核时间占比 < 20% 是否符合用户期望？ | 调研现有 AI 写作工具的人机协同比例，验证用户是否接受 80% 自动化（可能担心失去创作控制权） |
| 9 | tech | codeagent skill 的 backend=codex 是否适合长文本重写任务？ | 调研 codeagent 的 codex backend 特性，验证其是否针对代码优化而非自然语言创作，是否应使用 claude backend |
| 10 | data | 角色关系图 JSON 和情节时间线的结构化数据格式设计？ | 调研图数据库 schema 设计最佳实践（节点、边属性），参考 Constella 论文中的角色关系建模方法 |
| 11 | feasibility | 一致性检查能否准确检测"角色名、地名拼写变化"（考虑同义词、简称）？ | 调研命名实体识别（NER）+ 实体链接技术，评估简单字符串匹配 vs. 语义相似度方法的准确率 |
| 12 | architecture | WorldBuilder → CharacterWeaver → PlotArchitect 的严格串行依赖是否过于刚性？ | 调研敏捷创作流程，验证是否应支持"先写部分章节再补充世界观"的迭代模式 |
