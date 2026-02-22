## 4. 系统架构

### 4.1 Agent 团队结构

```
Team Lead (Orchestrator)         # 调度核心 + 状态机
├── WorldBuilder Agent           # 世界观构建（增量式）
├── CharacterWeaver Agent        # 角色网络（动态增删）
├── PlotArchitect Agent          # 卷级大纲规划
├── ChapterWriter Agent          # 章节写作（含续写模式）
├── Summarizer                   # 章节摘要 + 状态更新（后处理）
├── StyleRefiner Agent           # 去 AI 化润色（后处理）
└── QualityJudge Agent           # 8 维度质量评估
```

**关键组件说明**：
- **Orchestrator**：无状态设计，从文件冷启动，管理卷制循环状态机（详见 Section 8）
- **Summarizer**：每章写完后自动生成摘要 + 更新状态，是 context 管理的核心
- **StyleRefiner**：ChapterWriter 后处理，替换 AI 用语、调整句式（详见 Section 7）

### 4.2 协作模式

**引导式**（默认，适合新卷开头）：Orchestrator 按流程调度
**续写式**（日常，最常用）：用户请求续写 → ChapterWriter → Summarizer → StyleRefiner → QualityJudge
**工具式**（按需）：用户直接调用 WorldBuilder / CharacterWeaver 更新设定或新增角色

### 4.3 技术实现

**基础设施**（默认模式 — Task 子代理）：
- `Task` 工具派发专业 agent（稳定、默认可用）
- `TaskCreate` / `TaskUpdate` 跟踪多步任务进度
- Agent 通过 Task 返回值向调用方（入口 Skill）回传结果，所有协调由入口 Skill 完成

> **高级模式 — Agent Teams**（可选，需用户启用 experimental 特性）：
> `TeamCreate` + `SendMessage` 可实现 agent 间直接通信，适用于大规模并行规划/批量修订场景。
> 核心流程不依赖此特性，确保在 Teams 未启用时仍可完整运行。

**模型策略**（[DR-013](../../v2/dr/dr-013-api-cost.md)）：

| 组件 | 模型 | 原因 |
|------|------|------|
| WorldBuilder / CharacterWeaver / PlotArchitect | Opus 4.6 | 创意质量关键 |
| ChapterWriter | Sonnet 4.6 | 批量生成，成本敏感 |
| StyleRefiner | Opus 4.6 | 需要高质量语言感知 |
| QualityJudge | Sonnet 4.6（普通章）/ Opus 4.6（关键章双裁判） | 结构化评估；关键章取双裁判较低分 |
| Summarizer | Sonnet 4.6 | 信息保留关键，成本增量可忽略（+$0.02/章）[DR-019](../../v4/dr/dr-019-haiku-summarizer.md) |
| 问题章节重写 | Opus 4.6 | 需要高质量推理 |

