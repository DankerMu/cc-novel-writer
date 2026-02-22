# 小说自动化创作工具 PRD v4

## 1. 产品概述

基于 Claude Code 的多 agent 协作小说创作系统，面向中文网文作者，通过卷制滚动工作流实现长篇小说的高效续写和质量保证。

**核心价值**：
- **续写效率**：基于文件状态冷启动，随时续写下一章，无需重建上下文
- **一致性保证**：自动追踪角色状态、伏笔、世界观，跨 100+ 章维持一致
- **多线叙事**：支持多 POV 群像、势力博弈暗线、跨卷伏笔交汇等复杂叙事结构 [DR-021](../v5/dr/dr-021-llm-multi-thread-narrative.md)
- **去 AI 化**：4 层风格策略确保输出贴近用户个人文风，降低 AI 痕迹
- **成本可控**：混合模型策略（Opus + Sonnet），每章 ~$0.75

**目标用户**：中文网文作者（MVP）[DR-016](../v2/dr/dr-016-user-segments.md)

## 2. 产品形态：Claude Code Plugin

### 2.1 交付格式

本产品以 **Claude Code Plugin** 形式交付（plugin name: `novel`），包含 4 个技能（Skills）和 8 个专业 Agent。其中 3 个技能为用户入口（`/novel:start`、`/novel:continue`、`/novel:status`），1 个为共享知识库。Plugin skills 遵循官方命名空间规则 `/{plugin-name}:{skill-name}`。[DR-018](dr/dr-018-plugin-api.md) [DR-020](dr/dr-020-single-command-ux.md)

```
cc-novel-writer/
├── .claude-plugin/
│   └── plugin.json                    # 插件元数据
├── skills/                            # 4 个技能（3 入口 + 1 知识库）
│   ├── start/
│   │   └── SKILL.md                   # /novel:start     状态感知交互入口
│   ├── continue/
│   │   └── SKILL.md                   # /novel:continue  续写下一章（高频快捷）
│   ├── status/
│   │   └── SKILL.md                   # /novel:status    只读状态查看
│   └── novel-writing/                 # 共享知识库（Claude 按需自动加载）
│       ├── SKILL.md                   # 核心方法论 + 风格指南
│       └── references/
│           ├── style-guide.md         # 去 AI 化规则详解
│           └── quality-rubric.md      # 8 维度评分标准
├── agents/                            # 8 个专业 Agent（自动派生）
│   ├── world-builder.md               # 世界观构建
│   ├── character-weaver.md            # 角色网络
│   ├── plot-architect.md              # 情节架构
│   ├── chapter-writer.md              # 章节写作
│   ├── summarizer.md                  # 摘要生成
│   ├── style-analyzer.md              # 风格提取
│   ├── style-refiner.md               # 去 AI 化润色
│   └── quality-judge.md               # 质量评估
├── hooks/
│   └── hooks.json                     # 事件钩子配置（SessionStart 等）
├── scripts/
│   └── inject-context.sh              # SessionStart 注入项目状态摘要
└── templates/                         # 项目初始化模板
    ├── brief-template.md
    ├── ai-blacklist.json
    └── style-profile-template.json
```

### 2.2 入口技能（三命令混合模式）

采用"引导式入口 + 快捷命令"模式，以 Skills 形式实现（支持 supporting files 和 progressive disclosure），认知负载 < Miller 下限（4 项），新老用户均可高效使用。[DR-020](dr/dr-020-single-command-ux.md)

| 命令 | 用途 | 核心流程 |
|------|------|---------|
| `/novel:start` | 状态感知交互入口 | 读 checkpoint → 推荐下一步 → AskUserQuestion → Task 派发 agent |
| `/novel:continue [N]` | 续写 N 章（默认 1） | 读 checkpoint → ChapterWriter → Summarizer → StyleRefiner → QualityJudge → 更新 checkpoint |
| `/novel:status` | 只读状态查看 | 展示进度、评分均值、伏笔状态 |

**`/novel:start` 入口逻辑**：
```
1. 读取 .checkpoint.json
2. 状态感知推荐：
   - 不存在 checkpoint → 推荐"创建新项目 (Recommended)"
   - 当前卷未完成 → 推荐"继续写作 (Recommended)"
   - 当前卷已完成 → 推荐"规划新卷 (Recommended)"
3. AskUserQuestion(options=[推荐项, 质量回顾, 导入研究资料, 其余可用项])
   约束：2-4 选项，单次最多 2-3 个问题（留余量给写作决策）
4. 根据选择 → Task tool 派发对应 agent
```

**AskUserQuestion 约束**（[DR-020](dr/dr-020-single-command-ux.md)）：
- 每次 2-4 选项（主菜单恰好 ≤4 项，刚好在限制内）
- 60 秒超时 → 选项标记 "(Recommended)" 辅助快速决策
- 子代理不可用 → `/novel:start` 必须在主 command 中调用 AskUserQuestion
- 每会话 ~4-6 个问题 → 单次 `/novel:start` 最多用 2-3 个

**Command 文件格式**（YAML frontmatter，适用于 SKILL.md）：
```yaml
---
description: 小说创作主入口 — 状态感知交互引导
allowed-tools: Read, Write, Glob, Grep, Task, AskUserQuestion
model: sonnet
---
```

### 2.3 架构原则

- **Skills = 入口 + 调度**：`/novel:start` 做状态感知路由，`/novel:continue` 和 `/novel:status` 为高频快捷命令，均以 Skills 实现（支持 supporting files + progressive disclosure）。Plugin name 采用短名 `novel`，遵循 `/{plugin}:{skill}` 命名空间规则
- **Agents = 专业化执行**：每个 agent 有独立的 prompt 模板和 tools 权限，需包含 name/description/model/color/tools frontmatter
- **Skill = 共享知识**：`novel-writing` skill 提供去 AI 化规则、质量评分标准等共享上下文，Claude 按需自动加载
- **Checkpoint 是衔接点**：skills 之间通过 `.checkpoint.json` 传递状态，支持冷启动
- **Orchestrator 是逻辑抽象**：Section 8 定义的状态机是逻辑设计，实际由 3 个入口 skill 分布实现（`/novel:start` 覆盖 INIT/QUICK_START/VOL_PLANNING/VOL_REVIEW，`/novel:continue` 覆盖 WRITING 循环，`/novel:status` 只读），见 Section 8.2 映射表
- **插件资源路径**：插件安装后会被复制到缓存目录（`~/.claude/plugins/cache`），所有对插件内部文件（templates/、references/）的引用必须通过 `${CLAUDE_PLUGIN_ROOT}` 环境变量解析，禁止写死相对路径。项目运行时数据写入用户项目目录（稳定位置），插件自身文件为只读源
- **Hooks 增强可靠性**：Plugin 通过 `hooks/hooks.json` 注册事件钩子。M2 起启用 SessionStart hook，新 session 自动注入 `.checkpoint.json` + 最近摘要到 context，免除每次手动读取。后续可扩展 PostToolUse(Write/Edit) 做 schema 校验（需外部脚本，M3+ 视需求加入）
- **确定性工具演进路线**：MVP 阶段所有操作通过 Claude 原生工具（Read/Write/Grep/Glob）+ Bash 完成。当 LLM 精度不足时（如 NER、黑名单统计），通过 Bash 调用 CLI 脚本补充确定性能力。MCP 是此路径的包装升级（结构化接口 + 自动发现），作为 M4+ 可选优化，不作为核心依赖

### 2.4 用户体验示例

```
首次使用：
> /novel:start
Claude: 检测到无项目。推荐：创建新项目。
       [AskUserQuestion: 创建新项目(Recommended) / 查看帮助]
       [用户选择"创建新项目"]
       请输入小说类型（如：玄幻、都市、悬疑）：
       [用户输入：玄幻]
       [WorldBuilder → 核心设定]
       [CharacterWeaver → 主角+配角]
       请提供 1-3 章风格样本文件路径。

> @chapter-sample-1.md @chapter-sample-2.md
Claude: [StyleAnalyzer → 风格指纹提取]
       [ChapterWriter × 3 → StyleRefiner × 3]
       3 章已生成，评分均值 3.7/5.0。继续？

日常续写：
> /novel:continue
Claude: Vol 2 Ch 48 续写中...
       第 48 章已生成（3120 字），评分 3.9/5.0 ✅

> /novel:continue 3
Claude: Ch 49: 3050字 4.1 ✅ | Ch 50: 2890字 3.2→修订→3.6 ✅ | Ch 51: 3200字 3.8 ✅

卷末回顾（通过 /novel:start 进入）：
> /novel:start
Claude: Vol 2 已完成 51 章。推荐：规划新卷。
       [AskUserQuestion: 规划新卷(Recommended) / 质量回顾 / 继续写作]
       [用户选择"质量回顾"]
       [NER 一致性检查 + 伏笔盘点 + 风格漂移报告]

查看状态：
> /novel:status
Claude: Vol 2, Ch 51/50(超出), 总15万字, 均分3.7, 未回收伏笔3个
```

## 3. 用户画像与市场定位

### 3.1 目标用户：网文作者

**选择依据**（[DR-016](../v2/dr/dr-016-user-segments.md)）：AI 接受度高、产品匹配度高、市场规模大（中国 2000 万+ 网文作者）

**用户特征**：
- 日更 3000-6000 字，单部作品 100-500 万字
- 核心痛点：灵感枯竭、情节重复、前后矛盾、日更效率压力
- 创作模式：边写边想，每卷（30-50 章）滚动规划，根据读者反馈调整走向
- 付费意愿：$15-30/月

**功能需求优先级**：
1. 续写效率（基于已有内容续写下一章）★★★★★
2. 一致性检查（跨百章的角色/地名/时间线）★★★★★
3. 伏笔追踪（埋设和回收提醒）★★★★
4. 卷级大纲规划★★★★
5. 去 AI 化（输出贴近个人文风）★★★★

### 3.2 差异化定位

**独特卖点**（[DR-017](../v2/dr/dr-017-competitors.md)）：
1. 卷制滚动工作流（适配网文"边写边想"模式）
2. 自动一致性保证（状态管理 + NER 检查 + 伏笔追踪）
3. 多 agent 专业化分工 + 去 AI 化输出
4. 中文原生支持

**竞品空白**：Sudowrite/NovelAI 未进入中文市场，国内无长篇结构化创作工具。

| 功能 | 本产品 | Sudowrite | NovelAI | ChatGPT |
|------|--------|-----------|---------|---------|
| 续写模式 | ✅ 卷制滚动 | ⚠️ Story Engine | ⚠️ 基础续写 | ⚠️ 对话续写 |
| 多 agent 协作 | ✅ | ❌ | ❌ | ❌ |
| 一致性检查 | ✅ 自动 | ❌ | ❌ | ❌ |
| 伏笔追踪 | ✅ | ❌ | ❌ | ❌ |
| 去 AI 化 | ✅ 4 层策略 | ❌ | ❌ | ❌ |
| 中文支持 | ✅ | ❌ | ⚠️ | ✅ |

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

**模型策略**（[DR-013](../v2/dr/dr-013-api-cost.md)）：

| 组件 | 模型 | 原因 |
|------|------|------|
| WorldBuilder / CharacterWeaver / PlotArchitect | Opus 4.6 | 创意质量关键 |
| ChapterWriter | Sonnet 4.6 | 批量生成，成本敏感 |
| StyleRefiner | Opus 4.6 | 需要高质量语言感知 |
| QualityJudge | Sonnet 4.6（普通章）/ Opus 4.6（关键章双裁判） | 结构化评估；关键章取双裁判较低分 |
| Summarizer | Sonnet 4.6 | 信息保留关键，成本增量可忽略（+$0.02/章）[DR-019](dr/dr-019-haiku-summarizer.md) |
| 问题章节重写 | Opus 4.6 | 需要高质量推理 |

## 5. Agent Prompt 设计

各 agent 采用**角色-目标-约束-格式**四层结构 [DR-014](../v2/dr/dr-014-prompt-design.md)。

### 5.1 WorldBuilder Agent

```markdown
# Role
你是一位资深的世界观设计师。你擅长构建内部一致的虚构世界。

# Goal
{mode} 世界观设定。
模式：
- 初始化：基于创作纲领生成核心设定
- 增量更新：基于剧情需要扩展已有设定

创作纲领：{project_brief}
已有设定：{existing_world_docs}  （增量模式时提供）
新增需求：{update_request}       （增量模式时提供）

# Constraints
- 新增设定必须与已有设定一致
- 规则系统边界和代价明确
- 每个设定服务于故事，避免无用细节

# Format
输出变更文件 + changelog 条目
```

### 5.2 CharacterWeaver Agent

```markdown
# Role
你是一位角色设计专家。

# Goal
{mode} 角色。
模式：
- 新增角色：创建完整档案
- 更新角色：修改已有角色属性
- 退场角色：标记退场，移至 retired/

世界观：{world_docs}
已有角色：{existing_characters}

# Constraints
- 每个角色有目标、动机和内在矛盾
- 角色行为符合世界观规则
- 关系图实时更新

# Format
角色 .md 文件 + relationships.json 更新
```

### 5.3 PlotArchitect Agent

```markdown
# Role
你是一位情节架构师。

# Goal
规划第 {volume_num} 卷大纲（{chapter_start}-{chapter_end} 章）。

上卷回顾：{prev_volume_review}
全局伏笔状态：{global_foreshadowing}
故事线定义：{storylines}
世界观：{world_docs}
角色档案：{active_characters}

# Constraints
- 每章至少一个核心冲突
- 伏笔在 3-10 章内回收
- 承接上卷未完结线索
- 预留卷末钩子（吸引读者追更）
- 选取本卷活跃故事线，规划交织节奏和交汇事件

# Format
1. outline.md（每章含 Storyline/POV/Location/Conflict/Arc/Foreshadowing/StateChanges）
2. storyline-schedule.json（本卷故事线调度）
3. foreshadowing.json（本卷新增 + 上卷延续）
```

### 5.4 ChapterWriter Agent

```markdown
# Role
你是一位小说写作大师。擅长生动的场景描写、自然的对话和心理刻画。

# Goal
续写第 {chapter_num} 章。

# Context（增量式）
本卷大纲：{current_volume_outline}
本章大纲：{chapter_outline}
本章故事线：{storyline_id}
故事线上下文：{storyline_context}
其他线并发状态：{concurrent_state}
近 3 章摘要：{recent_3_summaries}
角色当前状态：{current_state}
本章伏笔任务：{foreshadowing_tasks}
风格参考：{style_profile}

# Constraints
- 字数：2500-3500 字
- 推进大纲指定的核心冲突
- 角色言行符合档案设定和说话风格
- 自然衔接前一章结尾
- 保持叙事视角和文风一致
- 切线章遵循 transition_hint 过渡
- 可在文中自然植入其他线的暗示
- 禁止使用以下 AI 高频用语：{ai_blacklist}
- 对话带角色语癖（每角色至少 1 个口头禅）
- 每章至少 1 处"反直觉"细节
- 场景描写 ≤2 句，优先动作推进
- 禁止连续 3 句相同句式

# Format
1. 章节正文（markdown）
2. 状态更新 JSON（位置、情绪、关系变化、物品变化）
```

### 5.5 Summarizer

```markdown
# Role
你是一位精准的文本摘要专家。

# Goal
为第 {chapter_num} 章生成摘要和状态更新。

章节全文：{chapter_content}
当前状态：{current_state}

# Format
1. 300 字章节摘要（保留关键情节、对话、转折）
2. 状态增量 JSON（仅包含本章变更的字段）
3. 伏笔变更（新埋设/推进/回收）
```

### 5.6 StyleAnalyzer Agent

```markdown
# Role
你是一位文本风格分析专家，擅长识别作者的独特写作指纹。

# Goal
分析风格样本，提取可量化的风格特征。

输入模式：
- 用户自有样本：分析用户提供的 1-3 章原创文本
- 仿写模式：分析指定网文作者的公开章节，提取其风格特征

风格样本：{style_samples}
参考作者（仿写模式）：{reference_author}

# Constraints
- 提取可量化的指标（句长、比例、频率），非主观评价
- 禁忌词表只收录作者明显不使用的词，不过度泛化
- 角色语癖需有具体示例支撑
- 仿写模式下，标注"参考风格"而非"用户原创风格"

# Format
输出 style-profile.json，包含：
1. avg_sentence_length（平均句长，字数）
2. dialogue_ratio（对话/叙述比例）
3. rhetoric_preferences（修辞偏好列表）
4. forbidden_words（禁忌词表）
5. character_speech_patterns（角色语癖，如有）
6. source_type（"original" | "reference"）
```

### 5.7 StyleRefiner Agent

```markdown
# Role
你是一位文风润色专家。你的唯一任务是消除 AI 痕迹，使文本贴近目标风格。

# Goal
对 ChapterWriter 初稿进行去 AI 化润色。

初稿：{chapter_draft}
风格指纹：{style_profile}
AI 黑名单：{ai_blacklist}

# Constraints
- 替换所有命中黑名单的用语，用风格相符的表达替代
- 调整句式匹配 style-profile 的平均句长和修辞偏好
- 严禁改变情节、对话内容、角色行为等语义要素
- 保留所有伏笔暗示和状态变更细节
- 修改量控制在原文 15% 以内（避免过度润色）

# Format
1. 润色后全文（markdown）
2. 修改日志 JSON：[{"original": "...", "refined": "...", "reason": "黑名单/句式/风格"}]
```

### 5.8 QualityJudge Agent

```markdown
# Role
你是一位严格的小说质量评审员。你按 8 个维度独立评分，不受其他 agent 影响。

# Goal
评估第 {chapter_num} 章的质量。

章节全文：{chapter_content}
本章大纲：{chapter_outline}
角色档案：{character_profiles}
前一章摘要：{prev_summary}
风格指纹：{style_profile}
AI 黑名单：{ai_blacklist}
故事线规范：{storyline_spec}
本卷故事线调度：{storyline_schedule}

# Constraints
- 每个维度独立评分（1-5），附具体理由和引用原文
- 不给"面子分"：明确指出问题而非回避
- 风格自然度评分基于可量化指标（黑名单命中率、句式重复率）
- 故事线连贯度评估切线流畅度、跟线难度、并发线暗示自然度
- 综合分 = 8 维度加权均值（权重见 Section 6.6.5）
- risk_flags：输出结构化风险标记（character_speech_missing、foreshadow_premature、storyline_contamination 等）
- required_fixes：当建议修订时，必须给出定向修订指令（target 段落 + instruction）
- 关键章双裁判：卷首章、卷尾章、故事线交汇事件章使用 Opus 复核，取两者较低分

# Format
输出 JSON：
{
  "chapter": N,
  "contract_verification": {"W-001": "pass", "C-XXX-001": "pass", "LS-001": "pass", ...},
  "scores": {
    "plot_logic": {"score": N, "weight": 0.18, "reason": "...", "evidence": "原文引用"},
    "character": {"score": N, "weight": 0.18, "reason": "...", "evidence": "原文引用"},
    "immersion": {"score": N, "weight": 0.15, "reason": "...", "evidence": "原文引用"},
    "foreshadowing": {"score": N, "weight": 0.10, "reason": "...", "evidence": "原文引用"},
    "pacing": {"score": N, "weight": 0.08, "reason": "...", "evidence": "原文引用"},
    "style_naturalness": {"score": N, "weight": 0.15, "reason": "...", "evidence": "原文引用"},
    "emotional_impact": {"score": N, "weight": 0.08, "reason": "...", "evidence": "原文引用"},
    "storyline_coherence": {"score": N, "weight": 0.08, "reason": "...", "evidence": "原文引用"}
  },
  "overall": 加权均值,
  "recommendation": "pass|polish|revise|rewrite",
  "violations": [],
  "risk_flags": ["character_speech_missing:角色名", "foreshadow_premature:伏笔ID"],
  "required_fixes": [{"target": "段落位置", "instruction": "修订指令"}],
  "issues": ["具体问题描述"]
}
```

### 5.9 Prompt 管理

- Prompt 模板存储在 `prompts/` 目录，使用 `{variable}` 占位符
- 共享上下文按需注入（详见 Section 8 context 组装规则）
- Few-shot 控制在 2K tokens 以内

## 6. 工作流设计

### Layer 1: 快速起步（首次使用，30 分钟内产出）

```
用户提供：题材 + 主角概念 + 核心冲突
  ↓
1a. WorldBuilder（轻量模式）→ 核心规则 ≤3 条
1b. CharacterWeaver → 主角 + 1-2 配角
1c. WorldBuilder 协助初始化 storylines.json（从设定中派生初始故事线，默认 1 条主线）
1d. 用户提供 1-3 章风格样本 → StyleAnalyzer 提取 style-profile
  ↓
1e. ChapterWriter 试写 3 章 → StyleRefiner 润色 → QualityJudge 评分
  ↓
1f. 用户确认：继续 / 调整风格 / 换题材
```

**说明**：步骤 1c 的 storylines 初始化默认最小化——仅创建一条 `main_arc` 主线。用户可在后续卷规划时通过 PlotArchitect 逐步增加副线/暗线，无需在快速起步阶段定义完整的故事线体系。同时活跃故事线建议 ≤ 4 条 [DR-021](../v5/dr/dr-021-llm-multi-thread-narrative.md)。

**验收标准**：30 分钟内输出 3 章（含设定 + 初始 storylines.json），用户确认后进入卷制循环。

### Layer 2: 卷制循环（每卷 30-50 章）

```
2a. 卷规划
    PlotArchitect → 本卷大纲 + 伏笔计划
    用户审核大纲（可调整）

2b. 日更续写（核心循环，每次 1-3 章）
    用户请求 → Orchestrator 组装 context
    → ChapterWriter 生成初稿
    → Summarizer 生成摘要 + 更新状态
    → StyleRefiner 去 AI 化润色
    → QualityJudge 评分
    → 通过 → 保存 + 更新 checkpoint
    → 未通过 → 质量门控处理

2c. 定期检查（每 10 章）
    一致性检查（NER）
    伏笔状态盘点
    风格漂移监控

2d. 卷末回顾
    全卷一致性报告
    伏笔完成度统计
    下卷铺垫建议
    用户审核 + 决定下卷方向
```

### Layer 3: 全局维护（跨卷、按需调用）

- **世界观扩展**：随剧情需要，调用 WorldBuilder 增量更新
- **角色管理**：新增角色 / 退场角色 / 更新关系
- **全局伏笔**：跨卷伏笔状态追踪
- **风格校准**：每 5 章提取风格特征，检测漂移并自动纠偏——偏离项写入 `style-drift.json`，注入后续 ChapterWriter/StyleRefiner context，持续到回归基线

### 质量门控

| QualityJudge 评分 | 行动 |
|-------------------|------|
| 4.0-5.0 | 直接通过 |
| 3.5-3.9 | StyleRefiner 二次润色后通过 |
| 3.0-3.4 | 标记问题，ChapterWriter（Opus）自动修订 |
| 2.0-2.9 | 通知用户，人工审核决定重写范围 |
| < 2.0 | 强制全章重写 |

### 用户审核点

| 触发条件 | 展示内容 | 用户选项 |
|---------|---------|---------|
| 快速起步完成 | 3 章试写 + 设定 + 风格分析 | 继续 / 调整 / 重来 |
| 卷规划完成 | 本卷大纲 | 确认 / 修改 / 调整章数 |
| 每 5 章 | 质量简报（均分+问题章节） | 继续 / 回看 / 调整方向 |
| 低分章节 | 章节 + 评分详情 | 自动修订 / 手动改 / 接受 |
| 卷末 | 一致性报告 + 伏笔 + 铺垫 | 确认 / 修改 / 加角色 |

### 6.5 规范驱动写作体系（Spec-Driven Writing）

小说创作与软件开发共享同一核心范式：**规范先行，实现随后，验收对齐规范**。设定是架构文档，角色是接口定义，大纲是需求规格，章节是实现，质量检查是测试套件。

#### 6.5.1 三层 Spec 体系

| 层级 | 内容 | 格式 | 生成者 | 验证者 | 约束强度 | 软件类比 |
|------|------|------|--------|--------|---------|---------|
| **L1 世界规则** | 物理/魔法/地理/社会硬约束 | `world/rules.json` | WorldBuilder 抽取 | QualityJudge 逐条 | 不可违反 | 系统架构约束 |
| **L2 角色契约** | 能力边界/行为模式/关系规则 | `characters/active/NAME.json` | CharacterWeaver 生成 | QualityJudge 逐条 | 可变更但需走协议 | 接口定义 |
| **L3 章节契约** | 前置条件/目标/后置条件/验收标准 | `chapter-contracts/chapter-N.json` | PlotArchitect 派生 | QualityJudge 逐条 | 可协商但须留痕 | 函数签名+测试用例 |

约束强度说明：
- **L1 不可违反**（硬约束）：类似编译错误，违反即阻塞
- **L2 可扩展但不可矛盾**（契约）：类似接口变更需要版本管理
- **L3 可协商但须留痕**（任务单）：类似 ticket 可以调整 scope 但要记录原因

#### 6.5.2 L1 世界规则 — 结构化规则表

WorldBuilder 在生成叙述性文档的同时，抽取可验证的规则：

```json
// world/rules.json
{
  "rules": [
    {
      "id": "W-001",
      "category": "magic_system",
      "rule": "修炼者突破金丹期需要天地灵气浓度 ≥ 3级",
      "constraint_type": "hard",
      "exceptions": [],
      "introduced_chapter": 1,
      "last_verified": 47
    }
  ]
}
```

- `constraint_type`: `hard`（不可违反）/ `soft`（可有例外但需说明）
- ChapterWriter 收到时，`hard` 规则以禁止项注入：`"违反以下规则的内容将被自动拒绝"`
- QualityJudge 逐条验证，不是"感觉世界观一致"，而是"W-001 是否被违反"

#### 6.5.3 L2 角色契约 — 行为边界定义

CharacterWeaver 在生成角色档案的同时，输出可验证的契约：

```json
// characters/active/protagonist.json 中的 contracts 字段
{
  "contracts": [
    {
      "id": "C-LUCHEN-001",
      "type": "capability",
      "rule": "当前修为：筑基后期，无法使用金丹期以上法术",
      "valid_from_chapter": 1,
      "valid_until": null,
      "update_requires": "PlotArchitect 在大纲中标注突破事件"
    },
    {
      "id": "C-LUCHEN-002",
      "type": "personality",
      "rule": "面对强敌时倾向智取而非硬碰，除非保护身边人",
      "exceptions": ["极度愤怒时可能失控（需要前文铺垫 ≥2 章）"]
    }
  ]
}
```

**契约变更协议**：角色能力/性格变化必须通过 PlotArchitect 在大纲中预先标注 → CharacterWeaver 更新契约 → 章节实现 → 验收确认。类似 API 接口变更需要先写 RFC。

#### 6.5.4 L3 章节契约 — 前置/后置条件 + 验收标准

PlotArchitect 从叙述性大纲自动派生每章的结构化契约：

```json
// volumes/vol-02/chapter-contracts/chapter-048.json
{
  "chapter": 48,
  "preconditions": {
    "character_states": {"陆尘": {"location": "魔都外城", "修为": "筑基后期"}},
    "required_world_rules": ["W-001", "W-002"]
  },
  "objectives": [
    {"id": "OBJ-048-1", "type": "plot", "required": true,
     "description": "陆尘发现密信中的暗号指向城北废墟"},
    {"id": "OBJ-048-2", "type": "foreshadowing", "action": "advance",
     "target": "ancient_prophecy", "description": "废墟中发现与预言相关的符文"}
  ],
  "postconditions": {
    "state_changes": {"陆尘": {"location": "城北废墟", "emotional_state": "疑虑"}},
    "foreshadowing_updates": {"ancient_prophecy": "advanced"}
  },
  "acceptance_criteria": [
    "OBJ-048-1 在正文中明确体现",
    "不违反 W-001, W-002",
    "不违反 C-LUCHEN-001",
    "postconditions 中的状态变更在正文中有因果支撑"
  ]
}
```

#### 6.5.5 Spec 生成流程

三层 Spec 均为 **Agent 自动生成 + 用户审核**：

| Spec | 生成方式 | 审核点 |
|------|---------|--------|
| L1 规则 | WorldBuilder 从自由文本抽取结构化规则 | 首次生成 + 每次增量更新 |
| L2 契约 | CharacterWeaver 从角色描述提取行为边界 | 新角色创建 + 能力变更 |
| L3 章节契约 | PlotArchitect 从卷纲自动派生（前章 postconditions → 本章 preconditions） | 卷规划审核时一并展示 |

**变更传播链**（可追溯性核心）：
```
世界规则变更 → 检查哪些角色契约受影响
  → CharacterWeaver 更新受影响 contracts
  → 检查哪些待写章节的 preconditions 受影响
  → PlotArchitect 更新相关 chapter-contracts
```

类似改了接口定义，编译器告诉你哪些调用方需要适配。

#### 6.5.6 QualityJudge 双轨验收

QualityJudge 从"单一评分"升级为"合规检查 + 质量评分"双轨制：

```
验收流程：
1. Contract Verification（硬门槛 — 逐条检查 L1/L2/L3）
   输出：{"OBJ-048-1": "pass", "W-001": "pass", ...} + violations 列表

2. Quality Scoring（软评估 — 保留现有 7 维度评分）
   输出：7 维度加权均值

门控决策：
├── 有 violation → 强制修订（不管印象分多高）
├── 无 violation + 印象分 ≥ 3.5 → 通过
└── 无 violation + 印象分 < 3.5 → 走现有质量门控（Section 6 质量门控表）
```

合规是编译通过，质量是 code review。两者独立，缺一不可。

### 6.6 多线叙事体系（Multi-Thread Narrative）

现代网文的叙事结构远非单线连续——多 POV 群像、势力博弈暗线、跨百万字伏笔交汇、回忆/平行时间线交错是常态（如《赤心巡天》的"靖海计划"从第二卷埋线到第十三卷交汇，跨 700 万字）。系统需要在**小说级定义故事线、卷级调度交织节奏、章级注入上下文**。[DR-021](../v5/dr/dr-021-llm-multi-thread-narrative.md)

**可行性结论**：LLM 多线叙事一致性为**有条件可行**。裸调用串线率 8-20%，通过三层防护（Context 工程 + 指令约束 + 后验校验）可降至 ≤2-3%。关键约束：同时活跃故事线 ≤ 4 条，每次续写为独立 LLM 调用（分治架构）。

#### 6.6.1 故事线数据模型

小说级 `storylines/storylines.json` 定义所有故事线，类似 `characters/` 管理角色：

```json
{
  "storylines": [
    {
      "id": "jiangwang_dao",
      "name": "主角证道之路",
      "type": "main_arc",
      "scope": "novel",
      "pov_characters": ["主角"],
      "affiliated_factions": ["齐国", "太虚阁"],
      "timeline": "present",
      "status": "active",
      "description": "核心成长线"
    },
    {
      "id": "jinghai_plan",
      "name": "靖海计划",
      "type": "conspiracy",
      "scope": "multi_volume",
      "pov_characters": ["许象乾", "主角"],
      "affiliated_factions": ["景国", "佑国", "海族"],
      "timeline": "present",
      "status": "dormant",
      "introduced_volume": 2,
      "description": "跨国海权博弈暗线，多势力交织"
    },
    {
      "id": "zhonggu_secret",
      "name": "中古之秘",
      "type": "mystery",
      "scope": "novel",
      "pov_characters": [],
      "affiliated_factions": ["长河龙宫", "人皇烈山"],
      "timeline": "past",
      "status": "planned",
      "description": "历史真相揭示线，无固定POV，通过多角色碎片拼凑"
    }
  ],
  "relationships": [
    {
      "from": "jiangwang_dao",
      "to": "jinghai_plan",
      "type": "entangled",
      "bridges": {
        "shared_characters": ["主角", "许象乾", "李龙川"],
        "shared_foreshadowing": ["巨龟初现", "天地斩衰"],
        "shared_events": []
      },
      "convergence_condition": "主角卷入海域事件时自然交汇",
      "narrative_function": "主线角色因副线事件承受命运反噬"
    }
  ],
  "storyline_types": [
    "main_arc",
    "faction_conflict",
    "conspiracy",
    "mystery",
    "character_arc",
    "parallel_timeline"
  ]
}
```

核心设计点：
- **type** 覆盖所有叙事模式：主角成长线、势力博弈线、阴谋暗线（长跨度）、真相揭示线（碎片拼凑）、配角独立成长线、回忆/平行时间线
- **scope**：`novel`（全书贯穿）/ `multi_volume`（跨卷）/ `single_volume`（卷内），标识生命周期
- **affiliated_factions**：故事线绑定势力而非单一角色，支持群像叙事
- **无固定 POV 线**：`pov_characters` 为空的线通过多角色视角碎片拼凑
- **bridges**：角色 + 伏笔 + 事件三维桥梁，比简单的"共享角色"更完整
- **narrative_function**：描述两条线交汇的叙事意义，指导 PlotArchitect

#### 6.6.2 卷级调度机制

PlotArchitect 在卷规划时，从 `storylines.json` 选取本卷活跃线，生成卷级故事线编排（写入 `volumes/vol-N/storyline-schedule.json`）：

```json
{
  "volume": 3,
  "volume_theme": "豪杰举",
  "active_storylines": [
    {
      "storyline_id": "jiangwang_dao",
      "volume_role": "primary",
      "target_chapters": 20,
      "arc_goal": "主角在本卷突破境界"
    },
    {
      "storyline_id": "jinghai_plan",
      "volume_role": "secondary",
      "target_chapters": 6,
      "arc_goal": "靖海计划第一次浮出水面"
    },
    {
      "storyline_id": "zhonggu_secret",
      "volume_role": "seasoning",
      "target_chapters": 2,
      "arc_goal": "通过遗迹探索揭示一个中古碎片"
    }
  ],
  "interleaving_pattern": {
    "strategy": "primary_dominant",
    "primary_max_consecutive": 5,
    "secondary_min_appearance": "every_8_chapters",
    "seasoning_placement": "mid_volume_and_climax"
  },
  "convergence_events": [
    {
      "chapter_range": [25, 28],
      "involved_storylines": ["jiangwang_dao", "jinghai_plan"],
      "trigger": "关键角色之死将主线与暗线强制交汇",
      "aftermath": "主线承受副线余波"
    }
  ],
  "dormant_storylines": ["faction_internal"],
  "newly_activated": ["jinghai_plan"]
}
```

- **volume_role** 三档：`primary`（主推进）/ `secondary`（穿插）/ `seasoning`（点缀）
- **interleaving_pattern**：给 PlotArchitect 节奏约束而非精确排布，具体在大纲中动态决定
- **convergence_events**：带章节范围的交汇预规划，PlotArchitect 根据剧情微调

#### 6.6.3 章节契约扩展

现有 L3 chapter-contract 增加故事线上下文：

```json
{
  "chapter": 26,
  "storyline_id": "jinghai_plan",
  "storyline_context": {
    "last_chapter_on_this_line": 18,
    "last_chapter_summary": "许象乾秘密接触佑国使者，巨龟异动被主角察觉",
    "chapters_since_last": 8,
    "line_arc_progress": "40%",
    "concurrent_state": {
      "jiangwang_dao": "主角正在闭关冲击新境界（ch25）",
      "zhonggu_secret": "遗迹线索指向龙宫（ch22）"
    }
  },
  "transition_hint": {
    "next_storyline": "jiangwang_dao",
    "bridge": "主角闭关被海域震动打断，自然切回主线"
  }
}
```

- **concurrent_state**：其他活跃线此刻的一句话进展，ChapterWriter 可植入暗示
- **transition_hint**：本章结尾如何过渡到下一条线，保证切线不突兀

#### 6.6.4 LS 故事线规范（Storyline Spec）

与 L1/L2/L3 平行的独立 Spec 层，**以 soft 约束为主，仅时间线一致性为 hard**：

```json
{
  "spec_version": 1,
  "rules": [
    {
      "id": "LS-001",
      "category": "continuity",
      "rule": "同一时间发生的不同线事件，时间线不得矛盾",
      "constraint_type": "hard"
    },
    {
      "id": "LS-002",
      "category": "transition",
      "rule": "故事线切换时，建议在开头 200 字内建立时空锚点",
      "constraint_type": "soft"
    },
    {
      "id": "LS-003",
      "category": "convergence",
      "rule": "交汇事件前建议在涉及的线各铺垫至少一次",
      "constraint_type": "soft"
    },
    {
      "id": "LS-004",
      "category": "dormancy",
      "rule": "休眠线重新激活时，建议通过角色回忆或对话重建读者记忆",
      "constraint_type": "soft"
    }
  ]
}
```

设计原则：**创作不是编译，过度约束限制发挥**。hard 只留"不可违反的逻辑错误"（时间线矛盾），其余均为建议性 soft 约束，QualityJudge 对 soft 只报告不阻断。

#### 6.6.5 QualityJudge 扩展

Track 1（合规检查）新增 LS 层：
- LS-001（hard）：检查本章事件时间是否与并发线矛盾
- LS-002~004（soft）：报告但不阻断

Track 2（质量评分）新增维度：
- `storyline_coherence`（权重 0.08）：切线流畅度、读者跟线难度、并发线暗示自然度

**权重重分配方案**（8 维度总和 = 1.0）：

| 维度 | v4 权重 | v5 权重 | 调整说明 |
|------|---------|---------|---------|
| plot_logic（情节逻辑） | 0.20 | 0.18 | -0.02，部分逻辑检查转移到 storyline_coherence |
| character（角色塑造） | 0.20 | 0.18 | -0.02，跨线角色一致性转移到 storyline_coherence |
| immersion（沉浸感） | 0.15 | 0.15 | 不变 |
| foreshadowing（伏笔） | 0.10 | 0.10 | 不变 |
| pacing（节奏） | 0.10 | 0.08 | -0.02，多线节奏转移到 storyline_coherence |
| style_naturalness（风格自然度） | 0.15 | 0.15 | 不变 |
| emotional_impact（情感冲击） | 0.10 | 0.08 | -0.02，跨线情感衔接转移到 storyline_coherence |
| **storyline_coherence（故事线连贯）** | — | **0.08** | 新增 |

#### 6.6.6 Agent 职责扩展

| Agent | 新增职责 | 新增输入/输出 |
|-------|---------|-------------|
| PlotArchitect | 卷规划时选取活跃线、规划交织节奏、标记交汇事件 | 输入：`storylines.json`；输出：`storyline-schedule.json` |
| ChapterWriter | 意识到"我在写哪条线"，可植入其他线暗示，遵循 transition_hint | 输入：`storyline_context` + `concurrent_state` |
| QualityJudge | LS 合规检查 + storyline_coherence 评分 | 输入：`storyline-spec.json` + `storyline-schedule.json` |
| WorldBuilder | 初始化时协助定义 storylines.json（势力关系 → 派生故事线） | 输出：`storylines.json`（协作） |
| Summarizer | 摘要标记 storyline_id，便于按线检索 | 输出增加 `storyline_id` 字段 |

不新增 agent，不改变现有工作流骨架。StyleAnalyzer、StyleRefiner、CharacterWeaver 无需变动。

#### 6.6.7 防串线策略（Anti-Contamination）[DR-021]

DR-021 调研表明，LLM 多线叙事的五类串线风险（实体属性泄漏 10-15%、事件时间线错乱 8-12%、空间位置混淆 5-8%、语气风格串线 15-20%、因果链断裂 8-10%）需要三层工程化防护：

**Layer 1: 结构化 Context 注入**
- ChapterWriter 的故事线 context 采用结构化格式（XML/JSON），显式标记活跃线 vs 冻结线
- 每条线维护独立的 `storylines/{id}/memory.md`（≤500 字关键事实），Summarizer 每章自动更新
- 写章时注入：当前线 memory + 相邻线 memory（schedule 指定）+ 交汇线 memory（交汇事件章）
- 冻结线仅提供 concurrent_state 一句话摘要，不注入 memory（降低"全局信息涌入"风险）
- Context 位置优化：活跃线状态放在 context 开头（利用 "Lost in the Middle" 研究，开头召回率最高）

**Layer 2: 反串线指令**
- ChapterWriter prompt 嵌入显式线边界约束："只使用当前线的角色/地点/事件"
- 明确告知"当前 POV 角色不知道其他线角色的行动和发现"
- 跨线信息传递必须有叙事合理的机制（信使、书信、偶遇等）

**Layer 3: 后验校验（QualityJudge 扩展）**
- Summarizer 输出 `cross_references[]`（本章提及的非本线实体）和 `leak_risk` 标记
- QualityJudge 对每次续写结果提取实体（角色名、地名、事件引用），与活跃线白名单交叉比对
- LS-005（hard）：非交汇事件章中，`leak_risk: high` 的跨线实体泄漏强制修正
- 检测到外线实体泄漏时标记为 LS violation

**分治续写架构**：每条故事线的续写是独立的 LLM 调用，不在同一 conversation 中混合多条线的正文。与 Agents' Room（Huot et al., 2024）等多智能体叙事框架的设计理念一致。

## 7. 去 AI 化策略

### Layer 1: 风格锚定（输入层）

快速起步时，用户提供 1-3 章自己写的风格样本。StyleAnalyzer 提取：
- 平均句长、对话/叙述比例、常用词频
- 修辞偏好（比喻频率、排比、短句切换）
- 禁忌词表（用户不会用的词）
- **正向写作指令**（`writing_directives`）：从样本归纳出可执行的风格指南（如"偏短句、动作推进"、"对话中多插一句生活化吐槽"），直接注入 ChapterWriter prompt

输出 `style-profile.json`，注入所有 ChapterWriter 和 StyleRefiner 调用。

**风格样本降级方案**（无自有样本时）：
1. **仿写模式**（推荐）：用户指定喜欢的网文作者，StyleAnalyzer 分析其公开章节提取风格指纹，标记为 `source_type: "reference"`
2. **先写后提**：用户在工具辅助下先写 1 章，再提取风格
3. **预置模板**：提供 3-5 种常见网文风格模板（如"轻松幽默"、"热血少年"、"细腻言情"），用户选择后微调

### Layer 2: 约束注入（生成层）

ChapterWriter prompt 增加反 AI 约束：
- 禁用 AI 高频用语黑名单（`ai-blacklist.json`）
- 对话带角色语癖
- 每章 ≥1 处反直觉细节
- 场景描写 ≤2 句
- 禁止连续 3 句相同句式

### Layer 3: 后处理（StyleRefiner）

ChapterWriter 初稿 → StyleRefiner（Opus）：
1. 替换命中黑名单的用语
2. 调整句式匹配 style-profile
3. 保留语义不变

单章额外成本 ~$0.08-0.12。

### Layer 4: 检测度量

QualityJudge 新增第 7 维度"风格自然度"：
- AI 黑名单词命中率 < 3 次/千字
- 句式重复率（相邻 5 句中重复句式 < 2）
- 与 style-profile 的匹配度

### 黑名单维护

- 初始化：收集 LLM 高频用语
- 持续更新：QualityJudge 检测到新高频 AI 用语时追加
- 用户自定义：允许添加/删除

## 8. Orchestrator 设计

### 8.1 核心原则：无状态冷启动

Orchestrator 不依赖会话历史。每次启动（新 session 或 context 压缩后）：
1. 读 `.checkpoint.json` → 当前位置（Vol N, Chapter M, 状态 X）
2. 读 `state/current-state.json` → 世界/角色/伏笔当前状态
3. 读近 3 章 `summaries/` → 近期剧情
4. 读 `volumes/vol-N/outline.md` → 当前卷计划
5. 无需读任何章节全文

### 8.2 状态机

```
INIT → QUICK_START → VOL_PLANNING → WRITING ⟲ (每章：写→摘要→润色→门控→[修订])
                                      ↓ (卷末)
                                  VOL_REVIEW → VOL_PLANNING (下一卷)
```

**状态转移规则**：

| 当前状态 | 触发条件 | 目标状态 | 动作 |
|---------|---------|---------|------|
| INIT | `/novel:start create` | QUICK_START | 创建项目目录 |
| QUICK_START | 用户提供设定 | QUICK_START | WorldBuilder(轻量) + CharacterWeaver(主角) |
| QUICK_START | 风格样本提交 | QUICK_START | StyleAnalyzer 提取 profile |
| QUICK_START | 试写确认 | VOL_PLANNING | 标记试写为 Vol 1 前 3 章 |
| VOL_PLANNING | 大纲确认 | WRITING | 保存大纲，准备续写 |
| WRITING | 续写请求 | WRITING | ChapterWriter → Summarizer → StyleRefiner → QualityJudge → 门控 |
| WRITING | 门控通过（≥ 3.5 且无 violation） | WRITING | 提交章节，更新 checkpoint |
| WRITING | 门控修订（3.0-3.4 或有 violation） | CHAPTER_REWRITE | Opus 修订（最多 2 次） |
| WRITING | 门控失败（< 3.0） | WRITING(暂停) | 通知用户 |
| WRITING | 每 5 章（last_completed % 5 == 0） | WRITING | 输出质量简报（均分+问题章节），用户可选择继续/回看/调整 |
| CHAPTER_REWRITE | 修订完成 | WRITING | 重新走门控（最多 2 次修订后强制通过并标记） |
| WRITING | 本卷最后一章 | VOL_REVIEW | 全卷检查 |
| VOL_REVIEW | 完成 | VOL_PLANNING | 下卷规划 |
| 任意 | 错误 | ERROR_RETRY | 重试 1 次，失败则保存 checkpoint 暂停 |

**Skill → 状态映射**：

| Skill | 负责状态 | 说明 |
|-------|---------|------|
| `/novel:start` | INIT → QUICK_START, VOL_PLANNING, VOL_REVIEW | 状态感知交互入口：通过 AskUserQuestion 识别用户意图后派发对应 agent |
| `/novel:continue` | WRITING（含内嵌门控 + 修订循环） | 核心续写循环：每章流水线含 QualityJudge 门控，不通过则自动修订（高频快捷命令） |
| `/novel:status` | 任意（只读） | 读取 checkpoint 展示状态，不触发转移 |

### 8.3 Context 组装规则

```python
def assemble_context(agent_type, chapter_num, volume):
    base = {
        "project_brief": read("brief.md"),
        "style_profile": read("style-profile.json"),
        "ai_blacklist": read("ai-blacklist.json"),
    }

    if agent_type == "ChapterWriter":
        return base | {
            "volume_outline": read(f"volumes/vol-{volume}/outline.md"),
            "chapter_outline": extract_chapter(volume, chapter_num),
            "storyline_context": get_storyline_context(chapter_num, volume),
            "concurrent_state": get_concurrent_storyline_states(chapter_num, volume),
            "recent_summaries": read_last_n("summaries/", n=3),
            "current_state": read("state/current-state.json"),
            "foreshadowing_tasks": get_chapter_foreshadowing(chapter_num),
        }

    elif agent_type == "QualityJudge":
        return base | {
            "chapter_content": read(f"chapters/chapter-{chapter_num}.md"),
            "chapter_outline": extract_chapter(volume, chapter_num),
            "character_profiles": read("characters/active/*.md"),
            "prev_summary": read_last_n("summaries/", n=1),
            "storyline_spec": read("storylines/storyline-spec.json"),
            "storyline_schedule": read(f"volumes/vol-{volume}/storyline-schedule.json"),
        }

    elif agent_type == "PlotArchitect":
        return base | {
            "world_docs": read("world/*.md"),
            "characters": read("characters/active/*.md"),
            "prev_volume_review": read(f"volumes/vol-{volume-1}/review.md"),
            "global_foreshadowing": read("foreshadowing/global.json"),
            "storylines": read("storylines/storylines.json"),
        }
    # WorldBuilder/CharacterWeaver: base + existing docs + update request
```

### 8.4 Context 预算（每次 agent 调用）

| 组件 | Token 估算 | 说明 |
|------|-----------|------|
| System prompt | ~5K | 固定 |
| style-profile + blacklist | ~2K | 固定 |
| 当前卷大纲 | ~3K | 每卷固定 |
| 近 3 章摘要 | ~3K | 滑动窗口 |
| current-state.json | ~3-5K | 需定期裁剪 |
| 角色档案（活跃） | ~5K | 只加载相关角色 |
| 本章大纲 + 伏笔 | ~1K | 每章固定 |
| **合计** | **~22-25K** | 即使第 500 章也稳定 |

### 8.5 State 裁剪策略

- 超过 N 章未出现的角色：状态归档至 `characters/retired/`
- current-state.json 仅保留活跃角色 + 近期相关物品/位置
- 每卷结束时执行一次全局 state 清理

## 9. 数据结构

### 9.1 项目目录结构

```
novel-project/
├── .checkpoint.json                # Orchestrator 恢复点
├── brief.md                        # 创作纲领（精简，≤1000 字）
├── style-profile.json              # 用户风格指纹
├── ai-blacklist.json               # AI 用语黑名单
├── research/                       # 背景研究资料（doc-workflow 导入或手动放入）
│   └── *.md                        # 每个主题一个文件，WorldBuilder/CharacterWeaver 自动读取
├── prompts/                        # Prompt 模板
│   ├── world-builder.md
│   ├── character-weaver.md
│   ├── plot-architect.md
│   ├── chapter-writer.md
│   ├── summarizer.md
│   ├── style-refiner.md
│   └── quality-judge.md
├── world/                          # 世界观（活文档）
│   ├── geography.md
│   ├── history.md
│   ├── rules.md
│   └── changelog.md
├── characters/
│   ├── active/                     # 当前活跃角色
│   ├── retired/                    # 已退场角色
│   ├── relationships.json
│   └── changelog.md
├── storylines/                     # 多线叙事管理
│   ├── storylines.json             # 全局故事线定义
│   ├── storyline-spec.json         # LS 故事线规范
│   └── {storyline-id}/
│       └── memory.md               # 故事线独立记忆（≤500 字关键事实，Summarizer 每章更新）
├── volumes/                        # 卷制结构
│   ├── vol-01/
│   │   ├── outline.md
│   │   ├── storyline-schedule.json # 本卷故事线调度
│   │   ├── foreshadowing.json
│   │   └── review.md
│   └── vol-02/ ...
├── chapters/
│   ├── chapter-001.md
│   └── ...
├── staging/                        # 写作流水线暂存区（事务语义）
│   ├── chapters/                   # draft → refined 章节
│   ├── state/                      # state delta
│   └── evaluations/                # 评估结果
├── summaries/                      # 章节摘要（context 压缩核心）
│   ├── chapter-001-summary.md
│   └── ...
├── state/
│   ├── current-state.json          # 当前全局状态（含 schema_version + state_version）
│   ├── changelog.jsonl             # 状态变更审计日志（每行一条 ops 记录）
│   └── history/                    # 每卷存档
│       └── vol-01-final-state.json
├── foreshadowing/
│   └── global.json                 # 跨卷伏笔
├── evaluations/
│   ├── chapter-001-eval.json
│   └── ...
└── logs/                          # 流水线执行日志（调试 + 成本追踪）
    ├── chapter-001-log.json
    └── ...
```

### 9.2 关键数据格式

**Checkpoint** (`.checkpoint.json`):
```json
{
  "last_completed_chapter": 47,
  "current_volume": 2,
  "orchestrator_state": "WRITING",
  "pipeline_stage": "committed",
  "inflight_chapter": null,
  "pending_actions": [],
  "last_checkpoint_time": "2026-02-21T15:30:00"
}
```

`pipeline_stage` 取值：`null`（空闲）→ `drafting`（初稿生成中）→ `drafted`（初稿已生成）→ `refined`（润色完成）→ `judged`（评估完成）→ `committed`（已提交到正式目录）。`inflight_chapter` 记录当前正在处理的章节号。冷启动恢复时：若 `pipeline_stage != committed && inflight_chapter != null`，检查 `staging/` 目录并从对应阶段恢复（`drafting` 且无 staging 文件 → 重启整章；`drafted` → 跳过 ChapterWriter 从 Summarizer 恢复；以此类推）。
```

**角色状态** (`state/current-state.json`):
```json
{
  "schema_version": 1,
  "state_version": 47,
  "last_updated_chapter": 47,
  "characters": {
    "protagonist": {
      "location": "魔都",
      "emotional_state": "决意",
      "relationships": {"mentor": 50, "rival": -30},
      "inventory": ["破碎魔杖", "密信"]
    }
  },
  "world_state": {
    "ongoing_events": ["王国内战"],
    "time_marker": "第三年冬"
  },
  "active_foreshadowing": ["ancient_prophecy", "betrayal_hint"]
}
```

**状态变更 Patch**（ChapterWriter / Summarizer 统一输出格式）：
```json
{
  "chapter": 48,
  "base_state_version": 47,
  "storyline_id": "main_arc",
  "ops": [
    {"op": "set", "path": "characters.protagonist.location", "value": "幽暗森林"},
    {"op": "set", "path": "characters.protagonist.emotional_state", "value": "警觉"},
    {"op": "inc", "path": "characters.protagonist.relationships.mentor", "value": 10},
    {"op": "add", "path": "characters.protagonist.inventory", "value": "密信"},
    {"op": "remove", "path": "characters.protagonist.inventory", "value": "破碎魔杖"},
    {"op": "set", "path": "world_state.time_marker", "value": "第三年冬末"},
    {"op": "foreshadow", "path": "ancient_prophecy", "value": "advanced", "detail": "主角梦见预言碎片"}
  ]
}
```

操作类型：`set`（覆盖字段）、`add`（追加到数组）、`remove`（从数组移除）、`inc`（数值增减）、`foreshadow`（伏笔状态变更：planted/advanced/resolved）。合并器在写入前校验 `base_state_version` 匹配当前 `state_version`，应用后 `state_version += 1`，变更记录追加到 `state/changelog.jsonl`。

**风格指纹** (`style-profile.json`):
```json
{
  "avg_sentence_length": 18,
  "dialogue_ratio": 0.4,
  "rhetoric_preferences": ["短句切换", "少用比喻"],
  "forbidden_words": ["莫名的", "不禁", "嘴角微微上扬"],
  "character_speech_patterns": {
    "protagonist": "喜欢用反问句，口头禅'有意思'",
    "mentor": "文言腔，爱说'善'"
  }
}
```

**质量评估** (`evaluations/chapter-N-eval.json`):
```json
{
  "chapter": 47,
  "contract_verification": {"l1_checks": [], "l2_checks": [], "l3_checks": [], "ls_checks": [], "has_violations": false},
  "scores": {
    "plot_logic": {"score": 4, "weight": 0.18, "reason": "...", "evidence": "原文引用"},
    "character": {"score": 4, "weight": 0.18, "reason": "...", "evidence": "原文引用"},
    "immersion": {"score": 4, "weight": 0.15, "reason": "...", "evidence": "原文引用"},
    "foreshadowing": {"score": 3, "weight": 0.10, "reason": "...", "evidence": "原文引用"},
    "pacing": {"score": 4, "weight": 0.08, "reason": "...", "evidence": "原文引用"},
    "style_naturalness": {"score": 4, "weight": 0.15, "reason": "AI 黑名单命中 1 次/千字", "evidence": "原文引用"},
    "emotional_impact": {"score": 3, "weight": 0.08, "reason": "...", "evidence": "原文引用"},
    "storyline_coherence": {"score": 4, "weight": 0.08, "reason": "...", "evidence": "原文引用"}
  },
  "overall": 3.78,
  "recommendation": "pass",
  "risk_flags": [],
  "required_fixes": [],
  "issues": [],
  "strengths": ["情节节奏张弛得当"]
}
```

**Pipeline Log** (`logs/chapter-N-log.json`):
```json
{
  "chapter": 47,
  "storyline_id": "main-quest",
  "started_at": "2026-03-15T14:30:00+08:00",
  "stages": [
    {"name": "draft", "model": "sonnet", "input_tokens": 12000, "output_tokens": 3500, "duration_ms": 45000},
    {"name": "summarize", "model": "haiku", "input_tokens": 4000, "output_tokens": 800, "duration_ms": 8000},
    {"name": "refine", "model": "sonnet", "input_tokens": 8000, "output_tokens": 3500, "duration_ms": 42000},
    {"name": "judge", "model": "sonnet", "input_tokens": 6000, "output_tokens": 1200, "duration_ms": 15000}
  ],
  "gate_decision": "pass",
  "revisions": 0,
  "total_duration_ms": 110000,
  "total_cost_usd": 0.72
}
```

> 每章流水线完成后由入口 Skill 写入 `logs/chapter-N-log.json`。用于调试（定位哪个阶段耗时/耗 token 异常）、成本追踪（累计 cost）、质量回顾（门控决策 + 修订次数统计）。`/novel:status` 可读取汇总展示。

## 10. Agent 协作协议

### 10.1 Agent 返回值规范

Agent 通过 Task 子代理执行，结果以结构化文本返回给入口 Skill，由入口 Skill 解析并推进流程。

**续写完成返回**：
```json
{
  "status": "completed",
  "chapter": 48,
  "word_count": 3120,
  "quality_score": 3.8,
  "summary": "第48章完成，状态已更新"
}
```

**情节冲突检测返回**：
```json
{
  "status": "conflict_detected",
  "chapter": 48,
  "detail": "主角使用了 Chapter 35 已丢失的魔杖，需要修正",
  "severity": "high"
}
```
```

### 10.2 任务依赖（卷制模式）

```
快速起步：
  Task 1: 粗略设定 → Task 2: 风格提取 → Task 3-5: 试写 3 章

卷内循环：
  Task N: 本卷大纲 → Task N+1..N+50: 逐章续写
  每 10 章触发：一致性检查
  卷末：回顾 + 下卷规划
```

### 10.3 错误处理与重试

| 错误类型 | 处理策略 | 最大重试 |
|---------|---------|---------|
| API 超时 | 等待 30s 后重试 | 2 次 |
| 生成质量低（<3.0） | 标记问题，通知用户 | - |
| 状态冲突 | 锁定文件 → 串行执行 → 释放 | - |
| Agent 崩溃 | 入口 Skill 重派 Task | 2 次 |
| 一致性检查失败 | 标记冲突，暂停后续章节，人工介入 | - |
| Session 中断 | 保存 checkpoint，下次冷启动恢复 | - |

### 10.4 原子性保证

章节写入采用 **staging → validate → commit** 事务模式：

1. **Staging**：流水线各阶段输出写入 `staging/` 暂存目录
   - `staging/chapters/chapter-N.md`（初稿 → 润色覆盖）
   - `staging/state/chapter-N-delta.json`（状态增量）
   - `staging/evaluations/chapter-N-eval.json`（评估结果）
   - 每步完成更新 `.checkpoint.json` 的 `pipeline_stage`
2. **Validate**：QualityJudge Track 1 合规 + Track 2 评分通过质量门控
3. **Commit**（原子提交）：
   - 将 staging 文件移入正式目录（`chapters/`、`summaries/`、`evaluations/`）
   - 合并 state delta → `state/current-state.json`
   - 更新 `foreshadowing/global.json`
   - 更新 `.checkpoint.json`（`last_completed_chapter + 1`、`pipeline_stage = committed`、`inflight_chapter = null`）
4. **中断恢复**：冷启动时检查 `pipeline_stage` + `inflight_chapter` + `staging/` 目录，从中断阶段幂等恢复；staging 文件可安全重试或清理

### 10.5 交互边界规则

**AskUserQuestion 仅限主技能层**：所有用户交互（确认、选择、审核）必须在 `/novel:start` 主技能中完成，subagent（Task 派生的子代理）不可调用 AskUserQuestion。

**Agent 返回结构化建议**：当 agent 的产出需要用户确认时（如大纲、契约变更、冲突检测），agent 必须返回结构化 JSON，由主技能解析后通过 AskUserQuestion 呈现：

```json
{
  "type": "requires_user_decision",
  "recommendation": "推荐选项描述",
  "options": ["选项A", "选项B", "选项C"],
  "rationale": "推荐理由",
  "data": { /* agent 产出的完整数据 */ }
}
```

适用场景：PlotArchitect 大纲确认、CharacterWeaver 契约变更审核、QualityJudge 低分章节处置、故事线调度冲突。

## 11. 技术可行性分析

### 11.1 已验证技术

- **多 agent 协作**：BookWorld 论文证明 agent 社会可模拟复杂角色关系
- **分层写作**：Dramaturge 的 Global Review → Scene Review 模式可复用
- **状态管理**：Constella 的 JOURNALS 证明可追踪多角色内心状态

### 11.2 技术假设验证状态

| 假设 | 状态 | 结论 | DR |
|------|------|------|-----|
| Context window | ✅ 已验证 | 200K tokens 满足，增量 context ~25K/次 | [DR-001](../v1/dr/dr-001-context-window.md) |
| 生成速度 | ✅ 已验证 | 单章 1.2 分钟 | [DR-004](../v1/dr/dr-004-generation-speed.md) |
| Agent 并发 | ⚠️ 有约束 | 推荐 3-5 分批执行 | [DR-002](../v1/dr/dr-002-agent-concurrency.md) |
| 状态同步 | ⚠️ 需优化 | 推荐 SQLite + WAL | [DR-003](../v1/dr/dr-003-state-sync.md), [DR-006](../v1/dr/dr-006-state-concurrency.md) |
| 风格分析 | ✅ 已验证 | BiberPlus/NeuroBiber 可用 | [DR-005](../v1/dr/dr-005-style-analysis.md) |
| 伏笔检测 | ⚠️ 有上限 | 75-85% + 人工 | [DR-007](../v1/dr/dr-007-foreshadowing.md) |
| NER 一致性 | ✅ 可用 | 分层策略 85-92% | [DR-011](../v1/dr/dr-011-ner-consistency.md) |
| API 成本 | ✅ 已验证 | 混合策略 ~$0.80/章 | [DR-013](../v2/dr/dr-013-api-cost.md) |
| Prompt 设计 | ✅ 已定义 | 四层结构 + 增量 context | [DR-014](../v2/dr/dr-014-prompt-design.md) |
| 质量评估 | ✅ 可行 | LLM-as-Judge 8 维度 + 关键章双裁判 + 人工校准集 | [DR-015](../v2/dr/dr-015-quality-eval.md) |

**状态存储决策**：MVP 阶段采用纯文件方案（JSON + Markdown），原因：
1. Claude Code Plugin 环境为单用户单进程，无并发写入场景
2. 章节写入采用 staging → validate → commit 事务模式，已避免数据损坏和中途 crash 不一致
3. DR-003/006 推荐的 SQLite + WAL 适用于多进程并发场景，MVP 暂不需要
4. 如未来引入 Web UI 或多设备同步，在 Milestone 3 评估是否升级

## 12. 成本分析

### 12.1 单章成本（混合策略）

| 组件 | 模型 | 输入 tokens | 输出 tokens | 成本 |
|------|------|-----------|-----------|------|
| ChapterWriter | Sonnet | ~12K | ~4.5K | $0.10 |
| Summarizer | Sonnet | ~5K | ~1K | $0.03 |
| StyleRefiner | Opus | ~6K | ~4.5K | $0.43 |
| QualityJudge | Sonnet | ~8K | ~1K | $0.04 |
| **单章合计** | | | | **~$0.60** |

（含重写预算 15% + 质量评估开销 ~5%）**实际均摊 ~$0.75/章**

### 12.2 按规模估算

| 规模 | 章数 | 字数 | 成本 |
|------|------|------|------|
| 试写 | 3 章 | 1 万字 | ~$3（含初始设定） |
| 一卷 | 30 章 | 9 万字 | ~$27（含卷规划+回顾） |
| 中篇 | 100 章 | 30 万字 | ~$85 |
| 长篇 | 300 章 | 90 万字 | ~$250 |

### 12.3 质量评估额外成本

- 每 10 章一致性检查：~$0.30
- 风格漂移监控（每 5 章）：~$0.10
- 占总成本 < 5%

## 13. 实施路线图

### Milestone 1: 续写引擎原型（2 周）

**目标**：验证核心续写能力 + 去 AI 化 + 质量评估

**任务**：
- 实现 ChapterWriter + Summarizer + StyleRefiner + QualityJudge
- 实现 Prompt 模板系统
- 实现 StyleAnalyzer（风格提取）
- 实现 checkpoint 机制

**验收标准**：
- [ ] 输入风格样本 + 手写大纲 → 续写 3 章
- [ ] QualityJudge 7 维度评分 ≥ 3.5/5.0
- [ ] 风格自然度维度 ≥ 3.5（AI 黑名单命中 < 3 次/千字）
- [ ] 每章生成摘要 + 状态更新
- [ ] checkpoint 可正确恢复

### Milestone 2: 卷制循环（3 周）

**目标**：实现完整的卷规划 → 日更续写 → 卷末回顾循环

**任务**：
- 实现 Orchestrator 状态机
- 实现 WorldBuilder + CharacterWeaver + PlotArchitect
- 实现 context 组装和 state 裁剪
- 实现卷规划和卷末回顾

**验收标准**：
- [ ] 完成一卷 30 章的完整循环（规划→续写→回顾）
- [ ] 在第 30 章时 context 仍在 25K tokens 以内
- [ ] Orchestrator 冷启动正确恢复状态
- [ ] 状态文件跨章正确传递

### Milestone 3: 质量保证系统（2 周）

**目标**：自动化质量检测

**任务**：
- 实现 NER 一致性检查
- 实现伏笔追踪系统（卷内 + 跨卷）
- 实现状态管理（SQLite + WAL 可选）
- 实现质量门控自动流程

**验收标准**：
- [ ] NER 检出率 > 80%
- [ ] 伏笔追踪准确率 > 75%
- [ ] 质量门控正确触发（低分→修订→通过）

### Milestone 4: 完整体验（2 周）

**目标**：用户可完成一部完整网文

**任务**：
- 实现快速起步流程
- 实现用户审核点和交互
- 实现按需工具调用（新增角色/世界观更新）
- 端到端测试：完成 3 卷 / 100 章

**验收标准**：
- [ ] 快速起步 30 分钟内输出 3 章
- [ ] 3 卷 100 章端到端完成，一致性错误 < 10 处
- [ ] 人工审核时间占比 30-50%

## 14. 成功指标

**功能指标**：
- 一致性错误 < 10 处（100 章尺度，含跨故事线时间线一致性）
- 伏笔回收率 > 75%（自动）
- 角色行为符合人设 > 85%
- QualityJudge 章节均分 ≥ 3.5/5.0（8 维度加权）
- 风格自然度 ≥ 3.5/5.0
- Spec + LS 合规率 > 95%（100 章中 violation < 5 处）
- 交汇事件达成率 > 80%（预规划交汇在预定章节范围内触发）
- 故事线串线率 ≤ 3%（跨线实体泄漏检测）[DR-021]

**效率指标**：
- 单章续写耗时 < 3 分钟（含摘要+润色+评估）
- 人工审核占比 30-50%（可调）
- 冷启动恢复 < 30 秒

**成本指标**：
- 单章均摊成本 ≤ $0.75

## 15. 风险与缓解

| 风险 | 影响 | 缓解措施 | 相关 DR |
|------|------|---------|---------|
| AI 味明显 | 高 | 4 层去 AI 化策略（风格锚定+约束+润色+检测） | DR-015 |
| 跨百章一致性崩塌 | 高 | 增量 state + 摘要滑动窗口 + 每 10 章 NER 检查 | DR-003, DR-011 |
| Agent 生成质量不稳定 | 高 | 8 维度评估 + Spec 双轨验收 + 质量门控 + 自动修订 | DR-015 |
| API 成本过高 | 中 | 混合模型 + Haiku 摘要 + 按需调用 | DR-013 |
| Context 超限 | 高 | 增量 context ~25K/次，摘要替代全文 | DR-001 |
| Session 中断 | 中 | 文件即状态 + checkpoint + 冷启动 | - |
| 需要 Claude Code 环境 | 高 | MVP 面向技术型用户，长期考虑 Web UI | DR-017 |
| 大厂快速跟进 | 中 | 聚焦中文网文垂直场景 | DR-017 |

## 16. 附录

### 16.1 深度调研报告索引

#### v1 调研（技术可行性）

| ID | 主题 | 核心结论 | 文档 |
|----|------|---------|------|
| DR-001 | Context Window | 200K tokens 满足，增量 context ~25K | [查看](../v1/dr/dr-001-context-window.md) |
| DR-002 | Agent 并发 | 推荐 3-5 分批 | [查看](../v1/dr/dr-002-agent-concurrency.md) |
| DR-003 | 状态同步 | 竞态风险，推荐 SQLite + WAL | [查看](../v1/dr/dr-003-state-sync.md) |
| DR-004 | 生成速度 | 单章 1.2 分钟 | [查看](../v1/dr/dr-004-generation-speed.md) |
| DR-005 | 风格分析 | BiberPlus/NeuroBiber 可用 | [查看](../v1/dr/dr-005-style-analysis.md) |
| DR-006 | 状态并发 | JSON 高危，推荐 SQLite | [查看](../v1/dr/dr-006-state-concurrency.md) |
| DR-007 | 伏笔检测 | 75-85% + 人工 | [查看](../v1/dr/dr-007-foreshadowing.md) |
| DR-008 | 用户接受度 | 30-40% 人工可调 | [查看](../v1/dr/dr-008-user-acceptance.md) |
| DR-009 | Backend 选型 | Claude Opus 4.6 | [查看](../v1/dr/dr-009-codeagent-backend.md) |
| DR-010 | 关系图 Schema | 有向图 + JSON | [查看](../v1/dr/dr-010-relationship-schema.md) |
| DR-011 | NER 一致性 | 分层 85-92% | [查看](../v1/dr/dr-011-ner-consistency.md) |
| DR-012 | 工作流灵活性 | 推荐双模式 | [查看](../v1/dr/dr-012-workflow-flexibility.md) |

#### v2 调研（产品与市场）

| ID | 主题 | 核心结论 | 文档 |
|----|------|---------|------|
| DR-013 | API 成本 | 混合策略 ~$0.80/章 | [查看](../v2/dr/dr-013-api-cost.md) |
| DR-014 | Prompt 设计 | 四层结构 + 增量 context | [查看](../v2/dr/dr-014-prompt-design.md) |
| DR-015 | 质量评估 | LLM-as-Judge 8 维度 + 关键章双裁判 | [查看](../v2/dr/dr-015-quality-eval.md) |
| DR-016 | 用户细分 | MVP 聚焦网文作者 | [查看](../v2/dr/dr-016-user-segments.md) |
| DR-017 | 竞品分析 | 差异化：卷制循环+去AI化 | [查看](../v2/dr/dr-017-competitors.md) |

#### v4 调研（Plugin 与质量）

| ID | 主题 | 核心结论 | 文档 |
|----|------|---------|------|
| DR-018 | Plugin API 格式 | commands/ vs skills/ 区分，agent 需 frontmatter | [查看](dr/dr-018-plugin-api.md) |
| DR-019 | Haiku Summarizer | 升级为 Sonnet，成本 +$0.02/章，避免误差累积 | [查看](dr/dr-019-haiku-summarizer.md) |
| DR-020 | 单主命令 UX | 三命令混合模式：/novel:start + /novel:continue + /novel:status | [查看](dr/dr-020-single-command-ux.md) |

#### v5 调研（多线叙事）

| ID | 主题 | 核心结论 | 文档 |
|----|------|---------|------|
| DR-021 | LLM 多线叙事一致性 | 有条件可行：裸调用串线率 8-20%，三层防护降至 ≤2-3%，≤4 条活跃线 | [查看](../v5/dr/dr-021-llm-multi-thread-narrative.md) |

### 16.2 参考文献

- BookWorld: agent 社会模拟（arXiv 2504.14538）
- Constella: 多 agent 角色创作（arXiv 2507.05820）
- Dramaturge: 分层叙事优化（arXiv 2510.05188）
- MT-Bench: LLM-as-Judge（Zheng et al., 2023）
- Chatbot Arena: LLM 评估（Chiang et al., 2024）
- Lost in the Middle: LLM 长上下文信息召回（Liu et al., 2023, arXiv 2307.03172）
- FABLES: 书级摘要忠实性评估（Kim et al., 2024, arXiv 2404.01261）
- Agents' Room: 多智能体叙事生成（Huot et al., 2024, arXiv 2410.02603）
- TimeChara: 角色时间线幻觉评估（Ahn et al., 2024, arXiv 2405.18027）
- StoryWriter: 多 agent 长篇故事框架（2025, arXiv 2506.16445）
