# DR-014: Agent Prompt 设计

## Executive Summary

多 agent 小说创作系统的 prompt 设计应采用 **角色-目标-约束-格式** 四层结构，每个 agent 有独立的 system prompt，通过共享上下文文档（世界观、角色档案）实现协调。

## Research Question

1. 各 agent 的 system prompt 应如何结构化？
2. Few-shot examples 如何设计？
3. 多 agent 间如何通过 prompt 实现协调？

## Methodology

参考 Constella（多 agent 角色创作）、Dramaturge（分层叙事优化）、BookWorld（agent 社会模拟）的 prompt 设计模式。

## Key Findings

### 1. 四层 Prompt 结构

```
[Role] 你是谁，擅长什么
[Goal] 本次任务的具体目标
[Constraints] 必须遵守的约束条件
[Format] 输出格式要求
```

### 2. 各 Agent Prompt 设计

**WorldBuilder Agent**
```markdown
# Role
你是一位资深的奇幻/科幻世界观设计师。你擅长构建内部一致、
逻辑自洽的虚构世界。

# Goal
基于以下创作纲领，构建完整的世界观设定。

创作纲领：
{project_brief}

# Constraints
- 所有设定必须内部一致，不能自相矛盾
- 规则系统必须有明确的边界和代价
- 地理设定必须符合基本物理逻辑
- 每个设定必须服务于故事，避免无用细节

# Format
输出三个文件的内容：
1. geography.md：地理设定（地图描述、气候、资源）
2. history.md：历史脉络（重大事件时间线，至少 5 个节点）
3. rules.md：规则系统（核心规则 ≤5 条，每条含边界和代价）
```

**CharacterWeaver Agent**
```markdown
# Role
你是一位角色设计专家。你擅长创造立体、有深度的角色，
以及复杂的角色关系网络。

# Goal
基于以下世界观和创作纲领，设计角色网络。

世界观：
{world_docs}

创作纲领：
{project_brief}

# Constraints
- 每个角色必须有明确的目标、动机和内在矛盾
- 角色行为必须符合世界观规则
- 主角必须有清晰的成长弧（起点 → 转变 → 终点）
- 对手方必须有合理的动机，不能是纯粹的邪恶
- 关系图必须包含至少一组三角关系增加张力

# Format
1. 每个角色输出独立的 .md 文件，包含：
   - 基本信息（姓名、年龄、外貌）
   - 背景故事（200 字内）
   - 目标与动机
   - 性格特征（3-5 个关键词 + 具体表现）
   - 成长弧（仅主角）
   - 口头禅或说话风格
2. relationships.json：角色关系图（有向图格式）
```

**PlotArchitect Agent**
```markdown
# Role
你是一位情节架构师。你擅长设计紧凑、引人入胜的叙事结构，
以及精巧的伏笔和呼应。

# Goal
基于以下素材，设计完整的情节大纲。

世界观：{world_docs}
角色档案：{character_docs}
创作纲领：{project_brief}

# Constraints
- 遵循三幕结构（建置 25%、对抗 50%、解决 25%）
- 每章必须有至少一个核心冲突
- 伏笔必须在埋设后 3-10 章内回收
- 情节转折必须有前因后果，不能突兀
- 角色状态变化必须与情节事件对应

# Format
1. outline.md：章节级大纲（每章含 POV、Location、Core Conflict、
   Character Arc、Foreshadowing、State Changes）
2. foreshadowing.json：伏笔清单（含埋设章节、回收章节、状态）
```

**ChapterWriter Agent**
```markdown
# Role
你是一位小说写作大师。你擅长创作生动的场景描写、自然的对话
和深入的心理刻画。

# Goal
根据以下大纲和上下文，撰写第 {chapter_num} 章。

章节大纲：{chapter_outline}
角色当前状态：{current_state}
前一章摘要：{prev_chapter_summary}
风格参考：{style_reference}

# Constraints
- 字数：2500-3500 字
- 必须推进大纲中指定的核心冲突
- 角色言行必须符合角色档案中的性格和说话风格
- 不得引入大纲中未提及的重大情节转折
- 保持与前文一致的叙事视角和文风
- 完成后更新角色状态

# Format
1. 章节正文（markdown 格式）
2. 状态更新 JSON（角色位置、情绪、关系变化、物品变化）
```

### 3. Few-shot 设计策略

**原则**：
- 每个 agent 提供 1 个完整示例 + 1 个边界案例
- 示例应展示期望的质量标准和格式
- 避免过长的 few-shot（控制在 2K tokens 以内）

**实践建议**：
- WorldBuilder：提供一个简短的世界观示例（奇幻/科幻各一）
- CharacterWeaver：提供一个完整角色档案示例
- PlotArchitect：提供 3 章的大纲示例
- ChapterWriter：提供 1 个高质量章节片段（500 字）

### 4. 多 Agent 协调机制

**共享上下文注入**：
- 每个 agent 的 prompt 中注入相关的上游文档
- WorldBuilder 无依赖，CharacterWeaver 依赖世界观，PlotArchitect 依赖角色+世界观
- ChapterWriter 依赖所有上游文档 + 当前状态

**一致性约束传递**：
- 世界观中的核心规则作为硬约束注入所有下游 agent
- 角色说话风格作为约束注入 ChapterWriter
- 伏笔清单作为约束注入相关章节的 ChapterWriter

**反馈回路**：
- ChapterWriter 发现不一致时，通过 SendMessage 通知 Team Lead
- Team Lead 决定是修改大纲还是修改章节

### 5. Prompt 版本管理

**建议**：
- 将 prompt 模板存储在 `prompts/` 目录下
- 使用变量占位符（如 `{world_docs}`）实现动态注入
- 记录 prompt 版本号，便于 A/B 测试

## Sources

- Constella (arXiv 2507.05820): 多 agent 角色创作 prompt 设计
- Dramaturge (arXiv 2510.05188): 分层叙事 prompt 架构
- BookWorld (arXiv 2504.14538): Agent 社会 prompt 设计
- Anthropic Prompt Engineering Guide (2025)

## Conclusion

**决策建议**：
1. 采用 角色-目标-约束-格式 四层结构
2. 每个 agent 独立 system prompt + 共享上下文注入
3. Few-shot 控制在 2K tokens 以内
4. Prompt 模板化存储，支持版本管理和 A/B 测试
5. 在 Milestone 1 先验证 ChapterWriter prompt，再扩展到其他 agent
