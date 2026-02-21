# DR-018: Claude Code Plugin API 格式验证

## Executive Summary

PRD Section 2 的 Plugin 目录结构存在 3 处与实际 API 规范不符的设计：(1) 用户命令应放在 `commands/` 而非 `skills/`；(2) skills 需使用 `skills/name/SKILL.md` 嵌套结构；(3) Agent 文件需要特定 frontmatter（name/description/model/color/tools）含 `<example>` 触发示例。

## 核心发现

### 1. Commands vs Skills 混淆

PRD 将 `/novel-create` 等 5 个斜杠命令放在 `skills/` 目录中。根据 Claude Code Plugin API：

- **Commands**（`commands/`）：用户通过 `/` 触发的斜杠命令，支持参数、model 指定、tools 限制
- **Skills**（`skills/`）：上下文知识库，由 Claude 根据对话内容自动触发，采用 `skills/name/SKILL.md` 嵌套结构

`/novel-create`、`/novel-continue` 等是明确的斜杠命令，应放在 `commands/` 目录。

### 2. 正确的目录结构

```
cc-novel-writer/
├── .claude-plugin/
│   └── plugin.json                    # 仅需 name 字段
├── commands/                          # 5 个斜杠命令
│   ├── novel-create.md
│   ├── novel-continue.md
│   ├── novel-plan.md
│   ├── novel-status.md
│   └── novel-review.md
├── agents/                            # 8 个专业 Agent
│   ├── world-builder.md
│   ├── character-weaver.md
│   ├── plot-architect.md
│   ├── chapter-writer.md
│   ├── summarizer.md
│   ├── style-analyzer.md
│   ├── style-refiner.md
│   └── quality-judge.md
├── skills/                            # 共享知识库
│   └── novel-writing/
│       ├── SKILL.md                   # 核心方法论
│       └── references/
│           ├── style-guide.md
│           └── quality-rubric.md
└── templates/
    ├── brief-template.md
    ├── ai-blacklist.json
    └── style-profile-template.json
```

### 3. Command 文件格式

```yaml
---
description: Brief description (shown in /help)
allowed-tools: Read, Write, Bash(git:*)
model: sonnet
argument-hint: [--genre genre-name]
---
```

### 4. Agent 文件格式

必须包含 name/description/model/color/tools，description 中需含 `<example>` 触发示例：

```yaml
---
name: chapter-writer
description: |
  Use this agent when writing novel chapters...
  <example>
  Context: User requests chapter continuation
  user: "续写下一章"
  assistant: "I'll use the chapter-writer agent."
  <commentary>Triggered by chapter writing request</commentary>
  </example>
model: sonnet
color: green
tools: ["Read", "Write", "Grep", "Glob"]
---
```

### 5. plugin.json 最小格式

```json
{
  "name": "cc-novel-writer"
}
```

完整版可包含 version, description, author, commands, agents, hooks, mcpServers。

## 影响

PRD Section 2 需要重写目录结构、命令格式、agent 格式说明。架构原则不变（commands = 入口 + 调度，agents = 专业执行，checkpoint = 衔接），但文件组织方式需修正。

## Sources

- Claude Code Plugin 开发工具包（plugin-dev 7 个 skills）
- 实际 Plugin 目录结构：~/.claude/plugins/cache/claude-plugins-official/
