# 小说自动化创作工具 PRD

## 1. 产品概述

基于 Claude Code 的多 agent 协作小说创作系统，通过 skills 和 agent team 能力实现长篇小说的结构化、迭代式创作。

**核心价值**：
- 分层协作：世界观、角色、情节、章节四层 agent 分工
- 人机协同：关键决策点人工审核，细节自动生成
- 质量保证：内置一致性检查、风格校准、情节验证

## 2. 系统架构

### 2.1 Agent 团队结构

```
Team Lead (Orchestrator)
├── WorldBuilder Agent      # 世界观构建
├── CharacterWeaver Agent   # 角色网络
├── PlotArchitect Agent     # 情节架构
└── ChapterWriter Agent     # 章节写作
```

**协作模式**（支持双模式）[DR-012](dr/dr-012-workflow-flexibility.md)：
- **引导式**（默认）：WorldBuilder → CharacterWeaver → PlotArchitect → ChapterWriter（适合新手）
- **自由式**：允许任意顺序调用 agent，支持"先写后补"的探索式创作（适合有经验作者）

### 2.2 技术实现

**基础设施**：
- `TeamCreate` 创建 novel-project 团队
- `TaskCreate` 分解创作任务（世界观 → 角色 → 大纲 → 章节）
- `SendMessage` 实现 agent 间状态同步

**Skills 集成**：
- `brainstorming`：初始创意扩展
- `deep-research`：题材调研（历史背景、文化考据）
- Claude Opus 4.6：结构化数据处理（角色关系图 JSON、情节时间线）[DR-009](dr/dr-009-codeagent-backend.md), [DR-010](dr/dr-010-relationship-schema.md)

## 3. 工作流设计

### Phase 1: 创意孵化（Ideation）
**输入**：用户提供核心创意（题材、主题、风格）
**流程**：
1. 调用 `brainstorming` skill 扩展创意
2. 用户确认：世界观类型、叙事视角、目标字数
3. 生成 `project-brief.md`（创作纲领）

### Phase 2: 世界观构建（World Building）
**Agent**: WorldBuilder
**任务**：
- 地理设定：地图、气候、资源分布
- 历史脉络：重大事件时间线
- 规则系统：魔法/科技体系、社会结构
**输出**：`world/` 目录（geography.md, history.md, rules.md）
**验证**：内部一致性检查（规则冲突检测）

### Phase 3: 角色网络（Character Weaving）
**Agent**: CharacterWeaver
**任务**：
- 主角团：目标、动机、成长弧
- 对手方：冲突来源、价值观对立
- 关系图：初始关系 + 预期演变
**输出**：`characters/` 目录（每个角色独立 .md 文件 + relationships.json）
**验证**：角色动机合理性、关系网完整性

### Phase 4: 情节架构（Plot Architecture）
**Agent**: PlotArchitect
**任务**：
- 三幕结构：起始事件、中点转折、高潮决战
- 章节大纲：每章核心冲突 + 角色状态变化
- 伏笔清单：需要埋设和回收的线索
**输出**：`plot/outline.md`（章节级大纲）+ `plot/foreshadowing.json`
**验证**：情节逻辑链完整、伏笔闭环检查（准确率 75-85%，需人工辅助）[DR-007](dr/dr-007-foreshadowing.md)

### Phase 5: 章节写作（Chapter Writing）
**Agent**: ChapterWriter（多实例并行）
**任务**：
- 接收章节大纲 + 角色当前状态
- 生成初稿（对话、场景描写、心理活动）
- 更新角色状态（情绪、关系、物品）
**输出**：`chapters/chapter-{N}.md` + `state/chapter-{N}-state.json`
**验证**：
- 风格一致性（与前文对比）[DR-005](dr/dr-005-style-analysis.md)
- 角色行为符合人设
- 情节推进符合大纲

### Phase 6: 迭代优化（Refinement）
**流程**：
1. 全局一致性检查（角色名、地名、时间线）[DR-011](dr/dr-011-ner-consistency.md)
2. 情节张力分析（识别平淡章节）
3. 用户审阅标记问题章节
4. ChapterWriter 定向重写

## 4. 数据结构

### 4.1 项目目录结构
```
novel-project/
├── brief.md                    # 创作纲领
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
└── reviews/                    # 审阅记录
    └── iteration-1-review.md
```

### 4.2 关键数据格式

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

**章节大纲** (`plot/outline.md`):
```markdown
## Chapter 5: 背叛的真相
**POV**: 主角
**Location**: 地下密室
**Core Conflict**: 发现导师隐瞒的秘密
**Character Arc**: 主角从依赖转向独立
**Foreshadowing**: 揭示 ancient_prophecy 第一层含义
**State Changes**:
- 主角情绪：信任 → 怀疑
- 关系变化：mentor 信任-30
```

## 5. Agent 协作协议

### 5.1 消息传递规范
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

### 5.2 任务依赖管理
```
Task 1: 世界观构建 (owner: world-builder)
Task 2: 角色创建 (owner: character-weaver, blockedBy: [1])
Task 3: 情节大纲 (owner: plot-architect, blockedBy: [2])
Task 4-23: 章节写作 (owner: chapter-writer-*, blockedBy: [3])
```

## 6. 质量保证机制

### 6.1 自动化检查
- **一致性检查**：扫描全文，检测角色名、地名拼写变化
- **时间线验证**：根据 state 文件重建时间线，检测逻辑矛盾
- **伏笔追踪**：对比 foreshadowing.json 和章节内容，标记未回收伏笔

### 6.2 人工审核点
1. **Phase 2 结束**：审核世界观设定
2. **Phase 4 结束**：审核章节大纲
3. **每 5 章完成**：审核章节质量
4. **Phase 6 开始前**：全局审阅

## 7. 技术可行性分析

### 7.1 已验证技术
- **多 agent 协作**：BookWorld 论文证明 agent 社会可模拟复杂角色关系
- **分层写作**：Dramaturge 系统的 Global Review → Scene Review 模式可复用
- **状态管理**：Constella 的 JOURNALS 功能证明可追踪多角色内心状态

### 7.2 技术挑战
| 挑战 | 解决方案 | 验证 |
|------|---------|------|
| 长文本一致性 | 每章生成后更新 state.json，后续章节强制读取 | [DR-003](dr/dr-003-state-sync.md), [DR-006](dr/dr-006-state-concurrency.md) |
| 风格漂移 | 每 5 章提取风格特征（词汇、句式），注入后续 prompt | [DR-005](dr/dr-005-style-analysis.md) |
| Agent 协调开销 | 使用 TaskList 而非频繁消息，减少通信成本 | [DR-002](dr/dr-002-agent-concurrency.md) |

### 7.3 已验证技术假设
- ✅ **Context window 容量**：Claude Opus 4.6 的 200K tokens 完全满足需求（世界观 5K + 角色 3K + 大纲 2K 仅占 5%）[DR-001](dr/dr-001-context-window.md)
- ✅ **生成速度**：单章（3000 字）实际耗时 1.2 分钟，远低于 5 分钟目标 [DR-004](dr/dr-004-generation-speed.md)
- ⚠️ **Agent 并发**：技术上支持 20+ agents，但推荐 3-5 agents 分批执行以控制成本和协调开销 [DR-002](dr/dr-002-agent-concurrency.md)
- ⚠️ **状态同步**：存在竞态风险，推荐使用 SQLite + WAL 模式替代 JSON 文件 [DR-003](dr/dr-003-state-sync.md), [DR-006](dr/dr-006-state-concurrency.md)

## 8. 实施路线图

### Milestone 1: 单 Agent 原型（2 周）
- 实现 ChapterWriter agent，输入大纲输出单章
- 验证：生成 3 章测试小说，人工评估质量

### Milestone 2: 多 Agent 协作（3 周）
- 实现 WorldBuilder、CharacterWeaver、PlotArchitect
- 验证：完整生成 10 章中篇小说

### Milestone 3: 质量保证系统（2 周）
- 实现一致性检查、状态管理、伏笔追踪
- 验证：对 Milestone 2 产出进行自动化检查

### Milestone 4: 人机协同界面（2 周）
- 实现审核点交互、问题标记、定向重写
- 验证：用户完成一部 5 万字小说创作

## 9. 成功指标

**功能指标**：
- 自动生成 5 万字小说，一致性错误 < 5 处
- 伏笔回收率 > 90%
- 角色行为符合人设比例 > 85%

**效率指标**：
- 生成 1 章（3000 字）耗时 < 2 分钟（实测 1.2 分钟）[DR-004](dr/dr-004-generation-speed.md)
- 人工审核时间占比：30-50%（分阶段可调）[DR-008](dr/dr-008-user-acceptance.md)

**质量指标**（人工评估）：
- 情节逻辑性：4/5 分
- 角色立体度：4/5 分
- 文笔流畅度：3.5/5 分

## 10. 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| Agent 生成内容质量不稳定 | 高 | 增加人工审核点，建立质量评分机制 |
| 状态同步失败导致情节矛盾 | 高 | 实现状态版本控制，支持回滚 |
| 用户学习成本过高 | 中 | 提供模板项目，简化配置流程 |
| Claude API 成本过高 | 中 | 优化 prompt 长度，缓存世界观数据 |

## 11. 附录

### 11.1 深度调研报告索引

| ID | 主题 | 核心结论 | 文档 |
|----|------|---------|------|
| DR-001 | Context Window 容量 | 200K tokens 完全满足，10K tokens 仅占 5% | [查看](dr/dr-001-context-window.md) |
| DR-002 | Agent 并发上限 | 技术支持 20+ agents，推荐 3-5 agents 分批 | [查看](dr/dr-002-agent-concurrency.md) |
| DR-003 | 状态同步延迟 | 存在竞态风险，需版本控制或强制顺序 | [查看](dr/dr-003-state-sync.md) |
| DR-004 | 生成速度基准 | 单章 1.2 分钟，远低于 5 分钟目标 | [查看](dr/dr-004-generation-speed.md) |
| DR-005 | 风格分析方法 | BiberPlus/NeuroBiber 成熟可用 | [查看](dr/dr-005-style-analysis.md) |
| DR-006 | 状态并发冲突 | JSON 文件高危，推荐 SQLite + WAL | [查看](dr/dr-006-state-concurrency.md) |
| DR-007 | 伏笔检测准确度 | >90% 不可行，推荐 75-85% + 人工 | [查看](dr/dr-007-foreshadowing.md) |
| DR-008 | 用户接受度 | 80% 自动化不符合期望，建议 30-40% 可调 | [查看](dr/dr-008-user-acceptance.md) |
| DR-009 | Backend 选型 | "codeagent" 不存在，统一使用 Claude Opus 4.6 | [查看](dr/dr-009-codeagent-backend.md) |
| DR-010 | 关系图 Schema | 有向图 + JSON，支持 MongoDB 迁移 | [查看](dr/dr-010-relationship-schema.md) |
| DR-011 | NER 一致性检查 | 分层策略，准确率 85-92% | [查看](dr/dr-011-ner-consistency.md) |
| DR-012 | 工作流灵活性 | 严格串行过刚，推荐双模式支持 | [查看](dr/dr-012-workflow-flexibility.md) |

### 11.2 参考文献
- BookWorld: 基于小说的 agent 社会模拟（arXiv 2504.14538）
- Constella: 多 agent 角色创作工具（arXiv 2507.05820）
- Dramaturge: 分层叙事脚本优化（arXiv 2510.05188）

### 11.2 竞品对比
| 产品 | 优势 | 劣势 |
|------|------|------|
| NovelAI | 风格化插图生成 | 无结构化创作流程 |
| Sudowrite | 句子级改写建议 | 不支持长篇规划 |
| 本产品 | 端到端多 agent 协作 | 需要 Claude Code 环境 |
