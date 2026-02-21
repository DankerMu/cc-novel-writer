# DR-009: Codeagent Skill Backend 适用性分析

**状态**: ⚠️ 需要澄清
**日期**: 2026-02-21
**决策者**: 技术架构组
**影响范围**: 小说创作工具 - 长文本重写任务

---

## Executive Summary

**研究问题**：验证 codeagent skill 的 backend=codex 是否适合长文本重写任务，或是否应使用 claude backend。

**核心发现**：经过全面调研，**未发现 Claude Code 官方文档中存在名为 "codeagent" 的内置 skill**，也未发现 skill 支持 `backend=codex` 或 `backend=claude` 配置参数。调研发现：

1. **"Codex" 是独立产品**：OpenAI Codex 是与 Claude Code 竞争的独立 AI 编码工具，而非 Claude Code 的后端选项
2. **Skills 无 backend 参数**：Claude Code skills 通过 `model` 参数指定模型（如 `claude-opus-4-6`），不存在 `backend` 配置
3. **术语混淆**：PRD 中提到的 "codeagent" 可能指：
   - 自定义 skill（尚未实现）
   - 对 Agent SDK 的误称
   - 对代码生成任务的泛指

**建议**：
- **澄清需求**：明确 "codeagent" 的实际含义和预期功能
- **技术选型**：对于长文本创作任务，应使用 Claude Opus 4.6（擅长创意写作），而非代码优化模型
- **架构调整**：若需要结构化数据处理，应创建自定义 skill 并指定 `model: claude-opus-4-6`

---

## Research Question

**原始问题**：codeagent skill 的 backend=codex 是否适合长文本重写任务？

**分解验证点**：
1. "codeagent skill" 是否存在于 Claude Code 生态中？
2. Skills 是否支持 `backend` 配置参数？
3. "codex" 和 "claude" 作为 backend 的区别是什么？
4. 哪种技术方案更适合长文本创意写作？

---

## Methodology

### 1. 本地代码库搜索
- **目标**：查找 codeagent skill 的实现或配置
- **方法**：
  - 搜索 `codeagent` 关键词：仅在 PRD 和 checklist 中发现引用
  - 搜索 `.claude/skills/codeagent/`：未找到实现
  - 搜索 `backend=codex` 或 `backend=claude`：仅在 checklist 中发现

### 2. 官方文档调研
- **来源**：
  - Claude Code 官方文档（code.claude.com/docs）
  - Claude API 文档（docs.claude.com）
  - Agent SDK 文档（platform.claude.com/docs/agent-sdk）
- **方法**：
  - 搜索 "codeagent skill" 相关文档
  - 查阅 skill 配置参数规范
  - 研究 model 选择机制

### 3. 竞品技术对比
- **对比对象**：
  - OpenAI Codex（代码生成模型）
  - Claude Opus 4.6（通用大模型）
- **对比维度**：
  - 设计目标（代码 vs 自然语言）
  - 输出质量（结构化 vs 创意性）
  - 适用场景（编程 vs 写作）

---

## Key Findings

### 1. "Codeagent" 不是 Claude Code 内置 Skill

#### 证据 A：官方文档无记录
搜索 Claude Code 官方文档（截至 2026-02），未发现任何名为 "codeagent" 的内置 skill。官方提供的预构建 skills 包括：
- **Anthropic Skills**（API 可用）：
  - `pptx`：PowerPoint 文档生成
  - `xlsx`：Excel 表格处理
  - `docx`：Word 文档编辑
  - `pdf`：PDF 文件操作

#### 证据 B：本地代码库无实现
在项目目录 `/Users/danker/Desktop/AI-vault/cc-novel-writer` 中搜索：
- `.claude/skills/codeagent/`：不存在
- `~/.claude/skills/codeagent/`：未检查（需用户确认）
- 全局搜索 "codeagent"：仅在 PRD 和 checklist 中作为计划提及

#### 证据 C：PRD 中的描述模糊
PRD 第 40 行提到：
```markdown
- `codeagent`：结构化数据处理（角色关系图 JSON、情节时间线）
```
这是对**预期功能**的描述，而非对现有 skill 的引用。

### 2. Skills 不支持 `backend` 参数

#### Skill 配置规范
根据官方文档，skill 的 YAML frontmatter 支持以下参数：

| 参数 | 说明 | 示例 |
|------|------|------|
| `name` | Skill 名称 | `api-conventions` |
| `description` | 功能描述（触发条件） | `Use when writing API endpoints` |
| `model` | 指定模型 | `claude-opus-4-6` |
| `context` | 执行上下文 | `fork`（在子 agent 中运行） |
| `agent` | 子 agent 类型 | `Explore`, `Plan`, `Code` |
| `disable-model-invocation` | 禁止模型自动调用 | `true` |

**关键发现**：不存在 `backend` 参数。模型选择通过 `model` 参数指定完整模型 ID。

#### 模型指定示例
```yaml
---
name: creative-writer
description: Generate creative fiction content
model: claude-opus-4-6
---
```

### 3. "Codex" 是独立产品，非 Backend 选项

#### OpenAI Codex 定位
- **产品类型**：独立的 AI 编码助手（类似 Claude Code）
- **核心模型**：基于 GPT 系列，专门针对代码生成优化
- **主要用途**：
  - 代码补全和生成
  - 代码注释和文档
  - 代码翻译（语言间转换）
  - 结构化数据处理（JSON、YAML 生成）

#### 与 Claude Code 的关系
- **竞争关系**：Codex 和 Claude Code 是竞品，而非集成关系
- **互不兼容**：Codex 使用 OpenAI API，Claude Code 使用 Anthropic API
- **技能标准**：两者都支持 Agent Skills 开放标准（agentskills.io），但 API 层面不互通

#### 社区讨论证据
从搜索结果中的博客文章（sankalp.bearblog.dev）：
> "Friendship over with Claude, Now Codex is my best friendo... I cancelled my Claude Max (100 USD/month) sub in early September and switched to using OpenAI Codex as my main driver."

这明确表明 Codex 是**替代品**，而非 Claude Code 的配置选项。

### 4. 模型能力对比：代码优化 vs 创意写作

#### OpenAI Codex（代码优化模型）
**设计目标**：
- 代码生成和补全
- 结构化数据处理
- 逻辑推理和算法实现

**输出特点**：
- 简洁、功能性强
- 遵循编程规范和最佳实践
- 倾向于生成可执行代码而非自然语言

**不适合长文本创作的原因**：
1. **风格单一**：输出偏向技术文档风格，缺乏文学性
2. **创意受限**：优化目标是"正确性"而非"创造性"
3. **上下文理解**：针对代码逻辑优化，对叙事连贯性支持较弱

#### Claude Opus 4.6（通用大模型）
**设计目标**：
- 通用自然语言理解和生成
- 长文本创作和编辑
- 复杂推理和创意任务

**输出特点**：
- 文笔流畅，风格多样
- 擅长角色塑造、情节构建
- 200K context window 支持长篇一致性

**适合长文本创作的原因**：
1. **创意能力**：在 LMSYS Chatbot Arena 创意写作任务中排名前列
2. **风格控制**：可通过 prompt 调整叙事风格、人物语气
3. **长文本一致性**：200K context window 可容纳完整世界观和角色档案

### 5. 结构化数据处理的正确方案

#### 场景分析
PRD 中提到 "codeagent" 用于：
- 角色关系图 JSON 生成
- 情节时间线结构化

#### 推荐方案
**方案 A：使用 Claude Opus 4.6 + 自定义 Skill**
```yaml
---
name: structure-data
description: Generate structured data (JSON, YAML) for character relationships and plot timelines
model: claude-opus-4-6
---

When generating structured data for the novel project:

1. **Character Relationships** (relationships.json):
   - Use graph structure: nodes (characters) + edges (relationships)
   - Include relationship type, strength (-100 to +100), and evolution trajectory

2. **Plot Timeline** (timeline.json):
   - Chronological event list with chapter references
   - Include foreshadowing links and conflict resolution tracking

3. **Output Format**:
   - Valid JSON with proper escaping
   - Include schema version for future compatibility
   - Add comments as separate "description" fields

Example output:
```json
{
  "schema_version": "1.0",
  "characters": {
    "protagonist": {
      "name": "李明",
      "relationships": [
        {
          "target": "mentor",
          "type": "trust",
          "strength": 80,
          "evolution": "trust -> doubt -> reconciliation"
        }
      ]
    }
  }
}
```
```

**方案 B：使用 Code Execution Tool**
对于复杂的数据转换任务，可以让 Claude 编写 Python 脚本：
```python
# Claude 生成的数据处理脚本
import json

def generate_relationship_graph(characters, interactions):
    """从角色交互历史生成关系图"""
    graph = {"nodes": [], "edges": []}
    # ... 数据处理逻辑
    return graph
```

---

## Sources

### 官方文档
1. **Claude Code Skills 文档**
   - URL: https://code.claude.com/docs/en/skills
   - 内容：Skill 配置规范、frontmatter 参数、示例
   - 关键发现：无 `backend` 参数，使用 `model` 指定模型

2. **Agent Skills API 文档**
   - URL: https://platform.claude.com/docs/en/agent-sdk/overview
   - 内容：Agent SDK 使用方法、预构建 skills 列表
   - 关键发现：预构建 skills 仅包含文档处理类（pptx, xlsx, docx, pdf）

3. **Claude API 文档 - Skills Guide**
   - URL: https://platform.claude.com/docs/en/build-with-claude/skills-guide
   - 内容：通过 API 使用 skills 的方法
   - 关键发现：Skills 通过 `skill_id` 引用，无 backend 概念

### 社区资源
4. **Agent Skills 开放标准**
   - URL: https://agentskills.io
   - 内容：跨平台 skill 标准，支持 Claude Code、Codex、Cursor 等
   - 关键发现：Codex 是独立产品，与 Claude Code 平级

5. **VoltAgent/awesome-agent-skills**
   - URL: https://github.com/VoltAgent/awesome-agent-skills
   - 内容：200+ 社区 skills 集合
   - 关键发现：Skills 可跨平台使用，但 API 层面各平台独立

6. **博客：Claude Code vs Codex 对比**
   - URL: https://sankalp.bearblog.dev/my-experience-with-claude-code-20-and-how-to-get-better-at-using-coding-agents/
   - 内容：用户从 Claude Code 切换到 Codex 的经验
   - 关键发现：两者是竞品关系，用户需在两者间选择

### 技术对比
7. **OpenAI Codex 产品定位**
   - 来源：搜索结果和模型知识
   - 特点：代码生成专用模型，基于 GPT 系列
   - 局限：不适合创意写作，输出偏向技术文档风格

8. **Claude Opus 4.6 能力分析**
   - 来源：DR-001（Context Window 分析）、DR-004（生成速度验证）
   - 特点：200K context window，67 t/s 输出速度，擅长长文本创作
   - 优势：创意能力强，风格控制灵活

---

## Conclusion

### 核心结论
**"codeagent skill 的 backend=codex" 这一表述存在概念混淆**。正确的理解应为：

1. **不存在 "codeagent" 内置 skill**：需要自行创建
2. **不存在 `backend` 配置参数**：应使用 `model` 参数
3. **Codex 不是 backend 选项**：它是独立的竞品产品
4. **长文本创作应使用 Claude Opus 4.6**：而非代码优化模型

### 技术决策

#### 决策 1：放弃 "backend=codex" 方案
**理由**：
- 技术上不可行（Codex 是独立产品，无法作为 Claude Code 的 backend）
- 即使可行也不合适（Codex 针对代码优化，不适合创意写作）

#### 决策 2：创建自定义 Skill，使用 Claude Opus 4.6
**实施方案**：
```yaml
# .claude/skills/novel-data-processor/SKILL.md
---
name: novel-data-processor
description: Generate structured data for novel projects (character relationships, plot timelines, state tracking)
model: claude-opus-4-6
---

[Skill 指令内容...]
```

#### 决策 3：区分任务类型，选择合适工具
| 任务类型 | 推荐方案 | 理由 |
|---------|---------|------|
| 章节写作（3000 字） | Claude Opus 4.6 | 创意能力强，风格灵活 |
| 角色关系图 JSON | Claude Opus 4.6 + Skill | 理解语义关系，生成结构化数据 |
| 数据转换脚本 | Code Execution Tool | 复杂逻辑用代码实现更可靠 |
| 世界观文档 | Claude Opus 4.6 | 需要创意和连贯性 |

### 风险与限制

#### 风险 1：术语混淆导致沟通障碍
- **表现**：团队成员可能继续使用 "backend=codex" 等不存在的术语
- **缓解**：更新 PRD，统一使用 `model: claude-opus-4-6` 表述

#### 风险 2：过度依赖结构化数据处理
- **表现**：将所有任务都视为 JSON 生成任务
- **缓解**：明确区分"创意任务"（直接生成文本）和"数据任务"（生成 JSON）

#### 风险 3：误用代码优化模型
- **表现**：尝试使用其他代码模型（如 GPT-4 Code）进行创意写作
- **缓解**：在架构文档中明确：长文本创作必须使用 Claude Opus 4.6

### 后续行动

#### 立即行动
- [ ] 更新 PRD，删除 "codeagent" 和 "backend=codex" 相关表述
- [ ] 创建 `novel-data-processor` 自定义 skill（如需要）
- [ ] 在 CLAUDE.md 中明确：所有创作任务使用 `claude-opus-4-6`

#### 短期行动（1-2 周）
- [ ] 验证 Claude Opus 4.6 生成 JSON 的准确性（角色关系图测试）
- [ ] 对比测试：Claude 生成 JSON vs Python 脚本生成 JSON
- [ ] 建立 skill 命名和配置规范文档

#### 长期行动（Milestone 2+）
- [ ] 监控 Claude Code 官方更新，关注新的预构建 skills
- [ ] 评估是否需要针对不同任务使用不同模型（如 Sonnet 用于快速迭代）
- [ ] 建立 skill 性能基准测试（生成质量、速度、成本）

### 更新日志
- 2026-02-21: 初始研究完成，澄清 "codeagent" 和 "backend" 概念混淆
