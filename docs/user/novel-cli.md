# `novel` CLI（确定性编排核心）

`novel` CLI **不调用任何 LLM API**。它只负责：

- 读取 `.checkpoint.json` 和 `staging/**` 计算确定性的下一步（可中断/可恢复）
- 生成 instruction packet（JSON），作为“编排 → 执行器（Claude Code / Codex）”的稳定边界
- 校验 `staging/**` 产物（validate）并推进 checkpoint（advance）
- 将 `staging/**` 事务提交到正式目录（commit），并更新 `state/` 与 `foreshadowing/`

## 本仓库开发态使用

```bash
# 帮助
npm run dev -- --help

# 或构建后运行
npm run build
node dist/cli.js --help
```

> 发布到 npm 后，目标体验是 `npx novel ...` / `novel ...`。

## 最短路径：跑通“一章的确定性编排”

以下示例假设你已在**小说项目根目录**（含 `.checkpoint.json`），或使用 `--project <dir>` 指定根目录。

### 1) 计算下一步

```bash
novel next
# 或：novel next --json
```

输出类似：

```
chapter:003:draft
```

### 2) 获取 instruction packet

```bash
novel instructions "chapter:003:draft" --json
```

可选：落盘到 `staging/manifests/`（便于审计/回放）：

```bash
novel instructions "chapter:003:draft" --json --write-manifest
```

### 3) 用执行器跑这一步（Claude Code / Codex）

执行器读取 instruction packet：

- `packet.agent.name`：要运行的 subagent（如 `chapter-writer`）
- `packet.manifest`：context manifest（以路径为主）
- `packet.expected_outputs[]`：该步必须写入的 `staging/**` 目标文件

执行器跑完后应回到终端断点（不要自动 commit）。

### 4) 校验并推进 checkpoint

```bash
novel validate "chapter:003:draft"
novel advance "chapter:003:draft"
```

然后再次运行：

```bash
novel next
```

它会基于 `.checkpoint.json.pipeline_stage` + `inflight_chapter` + `staging/**` 的存在性，返回确定性的下一步（例如 `chapter:003:summarize`）。

### 5) 提交事务（commit）

当 `novel next` 返回 `chapter:003:commit`（或你已经完成 judge 阶段）：

```bash
novel commit --chapter 3
```

可先看计划但不落盘：

```bash
novel commit --chapter 3 --dry-run
```

commit 会执行（见 PRD §10.4）：

- 移动 staging 产物到正式目录：`chapters/`、`summaries/`、`evaluations/`、`storylines/`、`state/`
- 合并 `staging/state/chapter-XXX-delta.json` → `state/current-state.json`（并 append `state/changelog.jsonl`）
- 从 delta 的 `foreshadow` ops 更新 `foreshadowing/global.json`
- 更新 `.checkpoint.json`：`last_completed_chapter`、`pipeline_stage="committed"`、`inflight_chapter=null`

## 中断恢复示例

场景：你在 `chapter:048:draft` 后中断了执行器。

1) 重新进入项目目录后直接运行：
```bash
novel next
```

2) 若 `staging/chapters/chapter-048.md` 不存在，会回到：
```
chapter:048:draft
```

3) 若章节已写到 staging，但 summary/delta/crossref 不完整，会返回：
```
chapter:048:summarize
```

4) 若已 refined 但 eval 缺失，会返回：
```
chapter:048:judge
```

5) 若 eval 已存在，会返回：
```
chapter:048:commit
```

> 这使得你可以在任何时刻中断并恢复：只要 `.checkpoint.json` 和 `staging/**` 未被破坏，`novel next` 就能给出确定性的下一步。
