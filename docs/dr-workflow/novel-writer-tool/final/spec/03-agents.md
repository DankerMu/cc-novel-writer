## 4. Agents

> **通用约束：交互边界**
>
> - AskUserQuestion **仅可在入口 Skill（Section 3）中调用**，所有 Agent 均不得直接向用户提问。
> - 当 Agent 产出需要用户确认时，必须以结构化 JSON 返回（含 `type: "requires_user_decision"` + `recommendation` + `options` + `rationale`），由调用方（入口 Skill）解析后统一 AskUserQuestion。
> - 8 个 Agent 的 `tools` 字段均不包含 AskUserQuestion，这是硬约束。

### Agent 清单

| # | Agent | 文件 | 模型 | 功能 |
|---|-------|------|------|------|
| 4.1 | WorldBuilder | [world-builder.md](agents/world-builder.md) | Opus | 世界观构建 + L1 规则抽取 + storylines 初始化 |
| 4.2 | CharacterWeaver | [character-weaver.md](agents/character-weaver.md) | Opus | 角色网络 + L2 契约生成 |
| 4.3 | PlotArchitect | [plot-architect.md](agents/plot-architect.md) | Opus | 卷级大纲 + L3 章节契约 + 故事线调度 |
| 4.4 | ChapterWriter | [chapter-writer.md](agents/chapter-writer.md) | Sonnet | 章节续写 + 去 AI 化约束 + 防串线 |
| 4.5 | Summarizer | [summarizer.md](agents/summarizer.md) | Sonnet | 摘要 + 状态增量 + 串线检测 + 线级记忆更新 |
| 4.6 | StyleAnalyzer | [style-analyzer.md](agents/style-analyzer.md) | Sonnet | 风格指纹提取 |
| 4.7 | StyleRefiner | [style-refiner.md](agents/style-refiner.md) | Opus | 去 AI 化润色 |
| 4.8 | QualityJudge | [quality-judge.md](agents/quality-judge.md) | Sonnet | 双轨验收（L1/L2/L3/LS 合规 + 8 维度评分） |
