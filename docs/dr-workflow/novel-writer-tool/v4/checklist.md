# Checklist v4

v4 新增内容：Section 2 Plugin 形态、Section 7 去 AI 化 4 层策略、Section 8 Orchestrator 完整规格、无状态冷启动架构。以下为针对 v4 全文的可疑点分析。

| # | Type | Suspicious Point | Research Direction |
|---|------|------------------|--------------------|
| 1 | tech | **Plugin API 格式未验证**：Section 2 定义了 Claude Code Plugin 交付格式（.claude-plugin/plugin.json + skills/*.md + agents/*.md），但未引用 Claude Code Plugin 官方文档。skill .md 是否需要特定 frontmatter？agent .md 支持哪些 tools 声明？plugin.json schema 是什么？ | 调研 Claude Code Plugin 实际 API 规范，验证 Section 2 的目录结构、文件格式和 frontmatter 要求是否正确 |
| 2 | architecture | **Orchestrator 架构自相矛盾**：Section 2.3 明确声明"无中央 Orchestrator：状态机分布在各 skill 中"，但 Section 8 标题为"Orchestrator 设计"并定义了完整的集中式状态机（8 个状态 + 13 条转移规则）。读者无法确定 Orchestrator 是逻辑概念还是独立实体 | 明确二者关系：如果 Orchestrator 是逻辑抽象分布在 skills 中实现，需要说明每个 skill 对应哪些状态转移；如果是独立 agent，需要移除 Section 2.3 的"无中央"声明 |
| 3 | tech | **3 个关键 Agent Prompt 缺失**：Section 2 列出 8 个 agents（含 style-analyzer、style-refiner、quality-judge），Section 5 仅提供 5 个 prompt 模板（WorldBuilder/CharacterWeaver/PlotArchitect/ChapterWriter/Summarizer）。缺少 StyleAnalyzer、StyleRefiner、QualityJudge 的完整 prompt 模板 | 补全 3 个 agent 的四层结构 prompt 模板（Role/Goal/Constraints/Format），特别是 QualityJudge 的 7 维度评分标准和 StyleRefiner 的去 AI 化规则 |
| 4 | data | **成本数据内部不一致**：Section 1 声称"每章 ~$0.80"，Section 12 计算单章合计 $0.58（含 15% 重写 = $0.67），Section 12.3 质量评估额外成本 < 5%（约 $0.03）。$0.67 + $0.03 = $0.70，与 $0.80 存在 ~15% 差距。此外 v3 brainstorming 识别的隐成本（一致性检查 +10%、上下文膨胀 +30-50%）未纳入计算 | 统一成本口径：明确 $0.80 的构成，或修正 Section 1 与 Section 12 的数字使其一致 |
| 5 | tech | **Haiku 做 Summarizer 的质量风险**：Section 4.3 将 Summarizer 分配给 Haiku 4.5（最便宜模型），但 Section 4.1 声明 Summarizer 是"context 管理的核心"。摘要质量直接决定后续所有章节的 context 质量 — 如果 Haiku 漏掉关键情节或角色状态变化，错误会在 100+ 章中复合累积 | 评估 Haiku 在中文小说摘要任务上的表现：关键信息保留率、状态变更提取准确度。与 Sonnet 对比，计算质量差 vs. 成本差的 ROI |
| 6 | architecture | **SQLite + WAL 与纯文件架构的矛盾**：Section 11.2 引用 DR-003/DR-006 推荐 SQLite + WAL 解决状态同步和并发问题，Milestone 3 任务列表提到"SQLite + WAL 可选"。但 Section 8/9 整体设计完全基于 JSON + Markdown 文件，没有任何 SQLite 集成点。这是一个悬而未决的架构决策 | 明确立场：(a) 纯文件方案是否足够（考虑 Claude Code Plugin 实际并发场景），还是 (b) 需要引入 SQLite。如果是 (a)，更新 DR-003/006 的结论；如果是 (b)，在 Section 9 增加 SQLite schema 设计 |
| 7 | product | **风格样本冷启动问题**：Section 7 Layer 1 要求用户提供 1-3 章自己写的风格样本，Section 2.4 UX 示例也展示了 `@chapter-sample-1.md`。但目标用户中可能有新人作者（第一本书）或从其他平台转来没有电子稿的作者 — 他们没有现成的风格样本 | 设计降级方案：无样本时如何处理？选项包括 (a) 预置风格模板库让用户选择，(b) 先写 1 章再提取，(c) 跳过风格锚定使用默认 |
