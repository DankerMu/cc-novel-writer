# Implementation Tech Spec — novel Plugin

> **路径约定**：本文档中所有 `templates/`、`skills/`、`agents/` 路径均相对于插件根目录。
> 运行时必须通过 `${CLAUDE_PLUGIN_ROOT}` 解析为绝对路径（插件安装后被复制到缓存目录）。
> 项目数据（章节、checkpoint、state）写入用户项目目录，插件内部文件为只读源。

## 1. 概述

### 1.1 文件清单

| # | 路径 | 用途 | 依赖 |
|---|------|------|------|
| 1 | `.claude-plugin/plugin.json` | 插件元数据 | 无 |
| 2 | `skills/start/SKILL.md` | `/novel:start` 状态感知交互入口 | plugin.json |
| 3 | `skills/continue/SKILL.md` | `/novel:continue [N]` 续写 N 章 | plugin.json |
| 4 | `skills/status/SKILL.md` | `/novel:status` 只读状态展示 | plugin.json |
| 5 | `agents/world-builder.md` | 世界观构建 Agent（Opus） | SKILL.md |
| 6 | `agents/character-weaver.md` | 角色网络 Agent（Opus） | SKILL.md, world-builder |
| 7 | `agents/plot-architect.md` | 情节架构 Agent（Opus） | SKILL.md, world-builder, character-weaver |
| 8 | `agents/chapter-writer.md` | 章节写作 Agent（Sonnet） | SKILL.md, plot-architect |
| 9 | `agents/summarizer.md` | 摘要生成 Agent（Sonnet） | chapter-writer |
| 10 | `agents/style-analyzer.md` | 风格提取 Agent（Sonnet） | SKILL.md |
| 11 | `agents/style-refiner.md` | 去 AI 化润色 Agent（Opus） | SKILL.md, style-analyzer |
| 12 | `agents/quality-judge.md` | 质量评估 Agent（Sonnet） | SKILL.md |
| 13 | `skills/novel-writing/SKILL.md` | 核心方法论（自动加载） | 无 |
| 14 | `skills/novel-writing/references/style-guide.md` | 去 AI 化规则详解 | SKILL.md |
| 15 | `skills/novel-writing/references/quality-rubric.md` | 8 维度评分标准详解 | SKILL.md |
| 16 | `templates/brief-template.md` | 项目简介模板 | 无 |
| 17 | `templates/ai-blacklist.json` | AI 用语黑名单（≥30 条） | 无 |
| 18 | `templates/style-profile-template.json` | 风格指纹空模板 | 无 |
| 19 | `hooks/hooks.json` | 事件钩子配置（SessionStart） | plugin.json |
| 20 | `scripts/inject-context.sh` | SessionStart 注入项目状态摘要 | hooks.json |

### 1.2 开发顺序

```
Phase 1: 基础设施
  plugin.json → SKILL.md（novel-writing）→ references/ → templates/

Phase 2: Agent 层（按依赖序）
  world-builder → character-weaver → plot-architect
  → style-analyzer → chapter-writer → summarizer
  → style-refiner → quality-judge

Phase 3: 入口 Skill 层
  status → continue → start
```

---

## 2. plugin.json

## 文件路径：`.claude-plugin/plugin.json`

````markdown
```json
{
  "name": "novel",
  "version": "0.1.0",
  "description": "中文网文多 Agent 协作创作系统 — 卷制滚动工作流 + 去 AI 化输出",
  "author": {
    "name": "DankerMu",
    "email": "mumzy@mail.ustc.edu.cn"
  },
  "skills": "./skills/",
  "agents": "./agents/",
  "hooks": "./hooks/hooks.json"
}
```
````

---

## 2.1 Hooks 配置

## 文件路径：`hooks/hooks.json`

````markdown
```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bash ${CLAUDE_PLUGIN_ROOT}/scripts/inject-context.sh",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```
````

## 文件路径：`scripts/inject-context.sh`

````bash
#!/usr/bin/env bash
# SessionStart hook: 注入项目状态摘要到 context
# 仅在小说项目目录内生效（检测 .checkpoint.json 存在）

CHECKPOINT=".checkpoint.json"

if [ ! -f "$CHECKPOINT" ]; then
  exit 0
fi

echo "=== 小说项目状态（自动注入） ==="
cat "$CHECKPOINT"

# 注入最近一章摘要（如存在，截断至 2000 字符防止 token 浪费）
LAST_CH=$(python3 -c "import json; print(json.load(open('$CHECKPOINT'))['last_completed_chapter'])" 2>/dev/null || jq -r '.last_completed_chapter' "$CHECKPOINT" 2>/dev/null)
if [ -n "$LAST_CH" ]; then
  SUMMARY="summaries/chapter-$(printf '%03d' "$LAST_CH")-summary.md"
  if [ -f "$SUMMARY" ]; then
    echo "--- 最近章节摘要 (第 ${LAST_CH} 章) ---"
    head -c 2000 "$SUMMARY"
  fi
fi
echo "=== 状态注入完毕 ==="
````

> SessionStart hook 在每次新 session 进入项目目录时自动执行。输出内容注入到 Claude 的 system context，使后续 `/novel:continue` 可跳过 checkpoint 读取步骤。hook 超时 5 秒，无 checkpoint 文件时静默退出（非小说项目不触发）。JSON 解析优先使用 python3，降级至 jq；摘要截断至 2000 字符避免大文件浪费 token。

---
