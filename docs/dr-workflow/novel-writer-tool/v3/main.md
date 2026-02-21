# 小说自动化创作工具 PRD v3

## 1. 产品概述

基于 Claude Code 的多 agent 协作小说创作系统，通过 skills 和 agent team 能力实现长篇小说的结构化、迭代式创作。

**核心价值**：
- 分层协作：世界观、角色、情节、章节四层 agent 分工
- 人机协同：关键决策点人工审核，细节自动生成
- 质量保证：6 维度 LLM-as-Judge 自动评估 + 一致性检查 + 伏笔追踪 [DR-015](../v2/dr/dr-015-quality-eval.md)
- 成本可控：混合模型策略（Opus + Sonnet），单部 5 万字小说 ~$16 [DR-013](../v2/dr/dr-013-api-cost.md)

**目标用户**：中文网文作者（MVP），后续扩展至业余爱好者 [DR-016](../v2/dr/dr-016-user-segments.md)

## 2. 用户画像与市场定位

### 2.1 目标用户：网文作者

**选择依据**（[DR-016](../v2/dr/dr-016-user-segments.md)）：AI 接受度高、产品匹配度高、市场规模大（中国 2000 万+ 网文作者）

**用户特征**：
- 日更 3000-6000 字，单部作品 100-500 万字
- 核心痛点：灵感枯竭、情节重复、前后矛盾、效率压力
- 付费意愿：$15-30/月，只要收入提升覆盖成本

**功能需求优先级**：
1. 自动章节生成（★★★★★）
2. 一致性检查（★★★★★）
3. 伏笔追踪（★★★★）
4. 章节大纲规划（★★★★）

### 2.2 差异化定位

**独特卖点**（[DR-017](../v2/dr/dr-017-competitors.md)）：
1. 端到端结构化创作（从世界观到成稿）
2. 自动一致性保证（状态管理 + NER 检查 + 伏笔追踪）
3. 多 agent 专业化分工
4. 中文原生支持

**竞品空白**：Sudowrite/NovelAI 未进入中文市场，国内无长篇结构化创作工具。

| 功能 | 本产品 | Sudowrite | NovelAI | ChatGPT |
|------|--------|-----------|---------|---------|
| 多 agent 协作 | ✅ | ❌ | ❌ | ❌ |
| 世界观管理 | ✅ 自动 | ❌ | ⚠️ 手动 | ❌ |
| 角色关系图 | ✅ 有向图 | ❌ | ❌ | ❌ |
| 一致性检查 | ✅ 自动 | ❌ | ❌ | ❌ |
| 伏笔追踪 | ✅ | ❌ | ❌ | ❌ |
| 中文支持 | ✅ | ❌ | ⚠️ | ✅ |
| 即开即用 | ❌（需 Claude Code） | ✅ | ✅ | ✅ |

## 3. 系统架构

### 3.1 Agent 团队结构

```
Team Lead (Orchestrator)
├── WorldBuilder Agent      # 世界观构建
├── CharacterWeaver Agent   # 角色网络
├── PlotArchitect Agent     # 情节架构
├── ChapterWriter Agent     # 章节写作
└── QualityJudge Agent      # 质量评估（新增）
```

**协作模式**（支持双模式）[DR-012](../v1/dr/dr-012-workflow-flexibility.md)：
- **引导式**（默认）：WorldBuilder → CharacterWeaver → PlotArchitect → ChapterWriter（适合新手/网文作者）
- **自由式**：允许任意顺序调用 agent，支持"先写后补"的探索式创作（适合有经验作者）

### 3.2 技术实现

**基础设施**：
- `TeamCreate` 创建 novel-project 团队
- `TaskCreate` 分解创作任务（世界观 → 角色 → 大纲 → 章节）
- `SendMessage` 实现 agent 间状态同步

**模型策略**（[DR-013](../v2/dr/dr-013-api-cost.md)）：
| 阶段 | 模型 | 原因 |
|------|------|------|
| 创意孵化/世界观/角色/情节 | Claude Opus 4.6 | 创意质量关键 |
| 章节写作 | Claude Sonnet 4.6 | 批量生成，成本敏感 |
| 质量评估 | Claude Sonnet 4.6 | 避免自我偏好 |
| 问题章节重写 | Claude Opus 4.6 | 需要高质量推理 |

**Skills 集成**：
- `brainstorming`：初始创意扩展
- `deep-research`：题材调研（历史背景、文化考据）
- Claude Opus 4.6：结构化数据处理（角色关系图 JSON、情节时间线）[DR-009](../v1/dr/dr-009-codeagent-backend.md), [DR-010](../v1/dr/dr-010-relationship-schema.md)

## 4. Agent Prompt 设计

各 agent 采用**角色-目标-约束-格式**四层结构 [DR-014](../v2/dr/dr-014-prompt-design.md)。

### 4.1 WorldBuilder Agent

```markdown
# Role
你是一位资深的奇幻/科幻世界观设计师。你擅长构建内部一致、逻辑自洽的虚构世界。

# Goal
基于以下创作纲领，构建完整的世界观设定。
创作纲领：{project_brief}

# Constraints
- 所有设定必须内部一致，不能自相矛盾
- 规则系统必须有明确的边界和代价
- 地理设定必须符合基本物理逻辑
- 每个设定必须服务于故事，避免无用细节

# Format
输出三个文件：geography.md、history.md（≥5 个时间节点）、rules.md（核心规则 ≤5 条）
```

### 4.2 CharacterWeaver Agent

```markdown
# Role
你是一位角色设计专家。你擅长创造立体、有深度的角色和复杂的关系网络。

# Goal
基于以下世界观和创作纲领，设计角色网络。
世界观：{world_docs}
创作纲领：{project_brief}

# Constraints
- 每个角色必须有明确的目标、动机和内在矛盾
- 角色行为必须符合世界观规则
- 主角必须有清晰的成长弧（起点 → 转变 → 终点）
- 对手方必须有合理动机，不能纯粹邪恶
- 关系图包含至少一组三角关系增加张力

# Format
1. 每角色独立 .md 文件（基本信息、背景 200 字内、目标动机、性格 3-5 关键词、口头禅）
2. relationships.json（有向图格式）
```

### 4.3 PlotArchitect Agent

```markdown
# Role
你是一位情节架构师。你擅长设计紧凑的叙事结构和精巧的伏笔。

# Goal
基于素材设计完整情节大纲。
世界观：{world_docs}  角色档案：{character_docs}  创作纲领：{project_brief}

# Constraints
- 三幕结构（建置 25%、对抗 50%、解决 25%）
- 每章至少一个核心冲突
- 伏笔在埋设后 3-10 章内回收
- 情节转折必须有前因后果

# Format
1. outline.md（每章含 POV、Location、Core Conflict、Character Arc、Foreshadowing、State Changes）
2. foreshadowing.json（含埋设章节、回收章节、状态）
```

### 4.4 ChapterWriter Agent

```markdown
# Role
你是一位小说写作大师。你擅长生动的场景描写、自然的对话和深入的心理刻画。

# Goal
撰写第 {chapter_num} 章。
章节大纲：{chapter_outline}  角色当前状态：{current_state}
前一章摘要：{prev_chapter_summary}  风格参考：{style_reference}

# Constraints
- 字数：2500-3500 字
- 推进大纲指定的核心冲突
- 角色言行符合档案设定和说话风格
- 不引入大纲外的重大转折
- 保持叙事视角和文风一致

# Format
1. 章节正文（markdown）
2. 状态更新 JSON（位置、情绪、关系变化、物品变化）
```

### 4.5 Prompt 管理

- Prompt 模板存储在 `prompts/` 目录，使用 `{variable}` 占位符
- 共享上下文逐层注入：WorldBuilder 无依赖 → CharacterWeaver 依赖世界观 → PlotArchitect 依赖角色+世界观 → ChapterWriter 依赖全部
- Few-shot 控制在 2K tokens 以内，每 agent 1 个完整示例 + 1 个边界案例

## 5. 工作流设计

### Phase 1: 创意孵化（Ideation）
**输入**：用户提供核心创意（题材、主题、风格）
**流程**：
1. 调用 `brainstorming` skill 扩展创意
2. 用户确认：世界观类型、叙事视角、目标字数
3. 生成 `project-brief.md`（创作纲领）

**验收标准**：project-brief.md 包含题材、主题、风格、目标字数、核心冲突至少 1 个。

### Phase 2: 世界观构建（World Building）
**Agent**: WorldBuilder
**任务**：
- 地理设定：地图、气候、资源分布
- 历史脉络：重大事件时间线
- 规则系统：魔法/科技体系、社会结构
**输出**：`world/` 目录（geography.md, history.md, rules.md）
**验证**：内部一致性检查（规则冲突检测）
**验收标准**：3 个文件完整生成，无内部矛盾，规则系统有明确边界。

### Phase 3: 角色网络（Character Weaving）
**Agent**: CharacterWeaver
**任务**：
- 主角团：目标、动机、成长弧
- 对手方：冲突来源、价值观对立
- 关系图：初始关系 + 预期演变
**输出**：`characters/` 目录（每角色 .md + relationships.json）
**验证**：角色动机合理性、关系网完整性
**验收标准**：≥5 个角色档案，relationships.json 可被系统解析，每角色有目标+动机+矛盾。

### Phase 4: 情节架构（Plot Architecture）
**Agent**: PlotArchitect
**任务**：
- 三幕结构：起始事件、中点转折、高潮决战
- 章节大纲：每章核心冲突 + 角色状态变化
- 伏笔清单：需要埋设和回收的线索
**输出**：`plot/outline.md` + `plot/foreshadowing.json`
**验证**：情节逻辑链完整、伏笔闭环检查（准确率 75-85%，需人工辅助）[DR-007](../v1/dr/dr-007-foreshadowing.md)
**验收标准**：每章包含 6 要素（POV/Location/Conflict/Arc/Foreshadowing/StateChanges），所有伏笔有埋设和计划回收章节。

### Phase 5: 章节写作（Chapter Writing）
**Agent**: ChapterWriter（多实例，推荐 3-5 并行）[DR-002](../v1/dr/dr-002-agent-concurrency.md)
**任务**：
- 接收章节大纲 + 角色当前状态
- 生成初稿（对话、场景描写、心理活动）
- 更新角色状态（情绪、关系、物品）
**输出**：`chapters/chapter-{N}.md` + `state/chapter-{N}-state.json`
**验证**：
- 风格一致性（与前文对比）[DR-005](../v1/dr/dr-005-style-analysis.md)
- 角色行为符合人设
- 情节推进符合大纲
**验收标准**：QualityJudge 6 维度评分 ≥ 3.5/5.0（低于 3.0 强制重写）。

### Phase 6: 质量评估与迭代（Quality Evaluation）
**Agent**: QualityJudge（使用 Sonnet 评估，避免自我偏好）[DR-015](../v2/dr/dr-015-quality-eval.md)

**6 维度评估体系**：

| 维度 | 权重 | LLM 评估准确率 | 说明 |
|------|------|---------------|------|
| 情节连贯性 | 20% | ~80% | 是否符合大纲，逻辑通顺 |
| 角色一致性 | 20% | ~78% | 言行是否符合人设 |
| 伏笔/呼应 | 15% | ~70% | 是否正确处理伏笔 |
| 语言质量 | 15% | ~82% | 语法、词汇、句式 |
| 场景描写 | 15% | ~68% | 画面感、氛围 |
| 情感张力 | 15% | ~60% | 情感表达、节奏 |

**质量门控**：

| 总分 | 行动 |
|------|------|
| 4.0-5.0 | 直接通过 |
| 3.0-3.9 | 标记问题，Opus 自动修订 |
| 2.0-2.9 | 人工审核，决定重写范围 |
| < 2.0 | 强制全章重写 |

**校准机制**：
- 使用不同模型生成（Sonnet）和评估（Sonnet），分离生成和评审
- 维度间评分差异 >2 分时触发人工审核
- 每 5 章进行一次人工抽检校准

### Phase 7: 迭代优化（Refinement）
**流程**：
1. 全局一致性检查（角色名、地名、时间线）[DR-011](../v1/dr/dr-011-ner-consistency.md)
2. 情节张力分析（识别平淡章节）
3. 用户审阅标记问题章节
4. ChapterWriter 定向重写

## 6. 数据结构

### 6.1 项目目录结构
```
novel-project/
├── brief.md                    # 创作纲领
├── prompts/                    # Prompt 模板（新增）
│   ├── world-builder.md
│   ├── character-weaver.md
│   ├── plot-architect.md
│   ├── chapter-writer.md
│   └── quality-judge.md
├── world/                      # 世界观
│   ├── geography.md
│   ├── history.md
│   └── rules.md
├── characters/                 # 角色档案
│   ├── protagonist.md
│   ├── antagonist.md
│   └── relationships.json
├── plot/                       # 情节设计
│   ├── outline.md
│   └── foreshadowing.json
├── chapters/                   # 章节内容
│   ├── chapter-001.md
│   └── ...
├── state/                      # 状态快照
│   ├── chapter-001-state.json
│   └── ...
├── evaluations/                # 质量评估记录（新增）
│   ├── chapter-001-eval.json
│   └── ...
└── reviews/                    # 审阅记录
    └── iteration-1-review.md
```

### 6.2 关键数据格式

**角色状态** (`state/chapter-N-state.json`):
```json
{
  "chapter": 1,
  "characters": {
    "protagonist": {
      "location": "王都",
      "emotional_state": "焦虑",
      "relationships": {"mentor": "信任+10"},
      "inventory": ["魔法书", "信物"]
    }
  },
  "plot_progress": {
    "foreshadowing_planted": ["ancient_prophecy"],
    "conflicts_resolved": []
  }
}
```

**章节质量评估** (`evaluations/chapter-N-eval.json`)（新增）:
```json
{
  "chapter": 1,
  "model_used": "claude-sonnet-4-6",
  "scores": {
    "plot_coherence": {"score": 4, "reason": "符合大纲，逻辑通顺"},
    "character_consistency": {"score": 4, "reason": "角色言行符合人设"},
    "foreshadowing": {"score": 3, "reason": "伏笔处理基本正确"},
    "language_quality": {"score": 4, "reason": "语言流畅"},
    "scene_description": {"score": 3, "reason": "画面感一般"},
    "emotional_tension": {"score": 3, "reason": "节奏略平"}
  },
  "overall": 3.55,
  "issues": ["场景描写可加强"],
  "recommendation": "pass"
}
```

## 7. Agent 协作协议

### 7.1 消息传递规范
**场景 1**：CharacterWeaver 完成角色创建
```json
{
  "type": "message",
  "recipient": "plot-architect",
  "content": "角色网络已完成，主角成长弧为复仇→救赎，详见 characters/",
  "summary": "角色网络完成"
}
```

**场景 2**：ChapterWriter 发现情节冲突
```json
{
  "type": "message",
  "recipient": "team-lead",
  "content": "Chapter 8 中主角使用了 Chapter 5 已丢失的魔法书，需要修正大纲或前文",
  "summary": "检测到情节冲突"
}
```

**场景 3**：QualityJudge 评估低分（新增）
```json
{
  "type": "message",
  "recipient": "team-lead",
  "content": "Chapter 12 总分 2.8/5.0，角色一致性 2 分（主角性格突变），建议重写",
  "summary": "章节质量低于门槛"
}
```

### 7.2 任务依赖管理
```
Task 1: 世界观构建 (owner: world-builder)
Task 2: 角色创建 (owner: character-weaver, blockedBy: [1])
Task 3: 情节大纲 (owner: plot-architect, blockedBy: [2])
Task 4-23: 章节写作 (owner: chapter-writer-*, blockedBy: [3])
Task 24-43: 质量评估 (owner: quality-judge, blockedBy: [4-23 对应])
```

### 7.3 错误处理与重试

| 错误类型 | 处理策略 | 最大重试 |
|---------|---------|---------|
| API 超时 | 等待 30s 后重试 | 2 次 |
| 生成质量低（<2.0） | 更换 Opus 模型重写 | 1 次 |
| 状态冲突 | 锁定文件 → 串行执行 → 释放 | - |
| Agent 崩溃 | Team Lead 重启 agent | 2 次 |
| 一致性检查失败 | 标记冲突，暂停后续章节，人工介入 | - |

## 8. 技术可行性分析

### 8.1 已验证技术
- **多 agent 协作**：BookWorld 论文证明 agent 社会可模拟复杂角色关系
- **分层写作**：Dramaturge 系统的 Global Review → Scene Review 模式可复用
- **状态管理**：Constella 的 JOURNALS 功能证明可追踪多角色内心状态

### 8.2 技术假设验证状态

| 假设 | 状态 | 结论 | DR |
|------|------|------|-----|
| Context window 容量 | ✅ 已验证 | 200K tokens 完全满足，10K 仅占 5% | [DR-001](../v1/dr/dr-001-context-window.md) |
| 生成速度 | ✅ 已验证 | 单章 1.2 分钟，远低于 5 分钟目标 | [DR-004](../v1/dr/dr-004-generation-speed.md) |
| Agent 并发 | ⚠️ 有约束 | 技术支持 20+，推荐 3-5 分批执行 | [DR-002](../v1/dr/dr-002-agent-concurrency.md) |
| 状态同步 | ⚠️ 需优化 | JSON 有竞态风险，推荐 SQLite + WAL | [DR-003](../v1/dr/dr-003-state-sync.md), [DR-006](../v1/dr/dr-006-state-concurrency.md) |
| 风格分析 | ✅ 已验证 | BiberPlus/NeuroBiber 成熟可用 | [DR-005](../v1/dr/dr-005-style-analysis.md) |
| 伏笔检测 | ⚠️ 有上限 | 准确率 75-85%，需人工辅助 | [DR-007](../v1/dr/dr-007-foreshadowing.md) |
| NER 一致性 | ✅ 可用 | 分层策略，准确率 85-92% | [DR-011](../v1/dr/dr-011-ner-consistency.md) |
| API 成本 | ✅ 已验证 | 混合策略 ~$16/部（5 万字） | [DR-013](../v2/dr/dr-013-api-cost.md) |
| Prompt 设计 | ✅ 已定义 | 四层结构 + 共享上下文注入 | [DR-014](../v2/dr/dr-014-prompt-design.md) |
| 质量评估 | ✅ 可行 | LLM-as-Judge 6 维度，与人工相关 0.7-0.8 | [DR-015](../v2/dr/dr-015-quality-eval.md) |

## 9. 成本分析

### 9.1 API 成本估算（[DR-013](../v2/dr/dr-013-api-cost.md)）

**混合模型策略（推荐）**：

| 阶段 | 模型 | Token 消耗 | 成本 |
|------|------|-----------|------|
| Phase 1-4（创意/世界观/角色/情节） | Opus 4.6 | 输入 145K + 输出 122K | $11.33 |
| Phase 5（章节写作 ×20） | Sonnet 4.6 | 输入 240K + 输出 90K | $2.07 |
| Phase 6-7（评估/优化） | 混合 | ~60K 输入+输出 | $2.50 |
| **总计** | | 输入 ~495K + 输出 ~239K | **~$16** |

**按规模**：

| 规模 | 字数 | 混合策略成本 |
|------|------|------------|
| 短篇（5 章） | 1.5 万字 | ~$6 |
| 中篇（20 章） | 5 万字 | ~$16 |
| 长篇（50 章） | 15 万字 | ~$35 |
| 超长篇（100 章） | 30 万字 | ~$65 |

### 9.2 质量评估额外成本

- 单章评估：~$0.04（Sonnet）
- 20 章全评估：~$0.80
- 占总成本 < 5%，可全量评估

## 10. 实施路线图

### Milestone 1: 单 Agent 原型（2 周）
- 实现 ChapterWriter agent + QualityJudge agent
- 实现 Prompt 模板系统（`prompts/` 目录）
- **验收标准**：
  - 输入手写大纲，生成 3 章测试小说
  - QualityJudge 评分 ≥ 3.5/5.0
  - 实测单章生成成本与 DR-013 估算偏差 < 20%

### Milestone 2: 多 Agent 协作（3 周）
- 实现 WorldBuilder、CharacterWeaver、PlotArchitect
- 实现 agent 间消息传递和任务依赖
- **验收标准**：
  - 端到端生成 10 章中篇小说（仅引导式流程）
  - 状态文件正确传递（无丢失或冲突）
  - 各 agent 输出格式符合规范

### Milestone 3: 质量保证系统（2 周）
- 实现 NER 一致性检查（目标准确率 85%+）
- 实现伏笔追踪系统
- 实现状态管理（优先 SQLite + WAL）
- **验收标准**：
  - 一致性检查检出率 > 80%（人工标注测试集）
  - 伏笔回收率 > 75%
  - 并发写入无数据损坏

### Milestone 4: 人机协同与双模式（2 周）
- 实现审核点交互、问题标记、定向重写
- 实现自由式工作流
- **验收标准**：
  - 用户完成一部 5 万字小说创作
  - 人工审核时间占比 30-50%（可调）[DR-008](../v1/dr/dr-008-user-acceptance.md)
  - 自由式和引导式均可完成完整创作流程

## 11. 成功指标

**功能指标**：
- 自动生成 5 万字小说，一致性错误 < 5 处
- 伏笔回收率 > 75%（自动）+ 人工补充至 > 90%
- 角色行为符合人设比例 > 85%
- QualityJudge 章节平均分 ≥ 3.5/5.0

**效率指标**：
- 生成 1 章（3000 字）耗时 < 2 分钟（实测 1.2 分钟）[DR-004](../v1/dr/dr-004-generation-speed.md)
- 人工审核时间占比：30-50%（可调）[DR-008](../v1/dr/dr-008-user-acceptance.md)
- 单部 5 万字小说 API 成本 ≤ $20（混合策略）

**商业指标**（MVP 后）：
- 目标定价：$29/月（专业版）[DR-017](../v2/dr/dr-017-competitors.md)
- 网文作者 NPS > 30

## 12. 风险与缓解

| 风险 | 影响 | 缓解措施 | 相关 DR |
|------|------|---------|---------|
| Agent 生成质量不稳定 | 高 | 6 维度自动评估 + 质量门控 + 人工抽检 | DR-015 |
| 状态同步失败导致情节矛盾 | 高 | SQLite + WAL 替代 JSON，版本控制，支持回滚 | DR-003, DR-006 |
| 用户学习成本过高 | 中 | 提供模板项目，引导式默认，未来考虑 Web UI | DR-008, DR-017 |
| API 成本过高 | 中 | 混合模型策略节省 37%，章节写作用 Sonnet | DR-013 |
| LLM-as-Judge 评分偏差 | 中 | 分离生成/评估模型，每 5 章人工校准 | DR-015 |
| 大厂快速跟进 | 中 | 聚焦中文网文垂直场景，积累数据和工具链壁垒 | DR-017 |
| 需要 Claude Code 环境 | 高 | 短期接受，长期规划 Web UI 降低门槛 | DR-017 |

## 13. 附录

### 13.1 深度调研报告索引

#### v1 调研（技术可行性）

| ID | 主题 | 核心结论 | 文档 |
|----|------|---------|------|
| DR-001 | Context Window 容量 | 200K tokens 完全满足，10K 仅占 5% | [查看](../v1/dr/dr-001-context-window.md) |
| DR-002 | Agent 并发上限 | 技术支持 20+，推荐 3-5 分批 | [查看](../v1/dr/dr-002-agent-concurrency.md) |
| DR-003 | 状态同步延迟 | 存在竞态风险，需版本控制或强制顺序 | [查看](../v1/dr/dr-003-state-sync.md) |
| DR-004 | 生成速度基准 | 单章 1.2 分钟，远低于 5 分钟目标 | [查看](../v1/dr/dr-004-generation-speed.md) |
| DR-005 | 风格分析方法 | BiberPlus/NeuroBiber 成熟可用 | [查看](../v1/dr/dr-005-style-analysis.md) |
| DR-006 | 状态并发冲突 | JSON 高危，推荐 SQLite + WAL | [查看](../v1/dr/dr-006-state-concurrency.md) |
| DR-007 | 伏笔检测准确度 | >90% 不可行，推荐 75-85% + 人工 | [查看](../v1/dr/dr-007-foreshadowing.md) |
| DR-008 | 用户接受度 | 80% 自动化不符合期望，建议 30-40% 可调 | [查看](../v1/dr/dr-008-user-acceptance.md) |
| DR-009 | Backend 选型 | 统一使用 Claude Opus 4.6 | [查看](../v1/dr/dr-009-codeagent-backend.md) |
| DR-010 | 关系图 Schema | 有向图 + JSON，支持 MongoDB 迁移 | [查看](../v1/dr/dr-010-relationship-schema.md) |
| DR-011 | NER 一致性检查 | 分层策略，准确率 85-92% | [查看](../v1/dr/dr-011-ner-consistency.md) |
| DR-012 | 工作流灵活性 | 严格串行过刚，推荐双模式 | [查看](../v1/dr/dr-012-workflow-flexibility.md) |

#### v2 调研（产品与市场）

| ID | 主题 | 核心结论 | 文档 |
|----|------|---------|------|
| DR-013 | API 成本估算 | 混合策略 ~$16/部（5 万字），章节写作占 60%+ | [查看](../v2/dr/dr-013-api-cost.md) |
| DR-014 | Agent Prompt 设计 | 四层结构 + 共享上下文 + Few-shot | [查看](../v2/dr/dr-014-prompt-design.md) |
| DR-015 | 质量评估方法 | LLM-as-Judge 6 维度，与人工相关 0.7-0.8 | [查看](../v2/dr/dr-015-quality-eval.md) |
| DR-016 | 用户细分分析 | MVP 聚焦网文作者，AI 接受度高 | [查看](../v2/dr/dr-016-user-segments.md) |
| DR-017 | 竞品分析 | 多 agent 协作 + 一致性保证是独特卖点 | [查看](../v2/dr/dr-017-competitors.md) |

### 13.2 参考文献
- BookWorld: 基于小说的 agent 社会模拟（arXiv 2504.14538）
- Constella: 多 agent 角色创作工具（arXiv 2507.05820）
- Dramaturge: 分层叙事脚本优化（arXiv 2510.05188）
- MT-Bench: LLM-as-a-Judge 评估框架（Zheng et al., 2023）
- Chatbot Arena: 大规模 LLM 评估（Chiang et al., 2024）

### 13.3 定价参考
| 层级 | 价格 | 功能 | 目标用户 |
|------|------|------|----------|
| 免费 | $0 | 3 章试用 | 所有 |
| 基础版 | $15/月 | 单部小说，基础 agent | 业余爱好者 |
| 专业版 | $29/月 | 多部小说，全部 agent，一致性检查 | 网文作者 |
| 团队版 | $49/月 | 多用户协作，API 接入 | 工作室 |

（注：以上不含 Claude API 成本，需额外收费或包含在订阅中）
