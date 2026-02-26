---
name: novel-cli-step
description: >
  Codex adapter: run ONE `novel` step via instruction packet (next → instructions → spawn subagent),
  then stop for human review (no auto-commit).
---

# Codex CLI 单步适配器

目标：把确定性编排交给 `novel` CLI，把生成执行交给 subagent；每步后都留断点给用户 review。

## 流程（单步）

1) 计算下一步：
```bash
node dist/cli.js next --json
```
取 `data.step`（例如 `chapter:048:draft`）。

2) 生成 instruction packet（可选落盘）：
```bash
node dist/cli.js instructions "<STEP>" --json --write-manifest
```
取 `data.packet`。

3) 执行 subagent：
- draft → `chapter-writer`
- summarize → `summarizer`
- refine → `style-refiner`
- judge → `quality-judge`（返回 JSON 后，执行器需写入 `staging/evaluations/chapter-XXX-eval.json`）

4) 断点返回：
```bash
node dist/cli.js validate "<STEP>"
node dist/cli.js advance "<STEP>"
```
若 `next` 返回 `...:commit`，则运行：
```bash
node dist/cli.js commit --chapter N
```

