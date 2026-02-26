---
name: cli-step
description: >
  Use this skill to run exactly ONE deterministic pipeline step via the new `novel` CLI:
  next → instructions → execute subagent → stop for review (no auto-commit).
  Triggered by: "用CLI跑下一步", "novel next", "instruction packet", "/novel:cli-step".
---

# `novel` CLI 单步适配器（Claude Code）

你是 Claude Code 的执行器适配层：你不做确定性编排逻辑，只调用 `novel` CLI 获取 step + instruction packet，然后派发对应 subagent 写入 `staging/**`，最后在断点处停下让用户 review。

## 运行约束

- **可用工具**：Bash, Task, Read, Write, Edit, Glob, Grep
- **原则**：只跑 1 个 step；不自动 commit；执行完必须停在断点并提示用户下一条命令

## 执行流程

### Step 0: 前置检查

- 必须在小说项目目录内（存在 `.checkpoint.json`）
- 如不在项目目录：提示用户 `cd` 到项目根目录后重试

### Step 1: 计算下一步 step id

优先使用已安装的 `novel`：
```bash
novel next --json
```

若 `novel` 不在 PATH（开发态/未发布），使用仓库内 CLI：
```bash
node dist/cli.js next --json
```

解析 stdout 的单对象 JSON：取 `data.step` 得到类似 `chapter:048:draft` 的 step id。

### Step 2: 生成 instruction packet（并落盘 manifest）

```bash
novel instructions "<STEP_ID>" --json --write-manifest
```

同样解析 stdout JSON：取 `data.packet`（以及可选的 `data.written_manifest_path`）。

### Step 3: 派发 subagent 执行

从 `packet.agent.name` 读取 subagent 类型（例如 `chapter-writer`/`summarizer`/`style-refiner`/`quality-judge`）。

用 Task 派发，并把 `packet.manifest` 作为 user message 的 **context manifest**（JSON 原样传入即可）。

要求 subagent：
- 只写入 `staging/**`
- 写入路径以 `packet.expected_outputs[]` 为准
- 产出完成后停止，不要推进 checkpoint

### Step 4: 断点返回（必须）

subagent 结束后，你必须停下并提示用户下一步命令：

- 先校验：`novel validate "<STEP_ID>"`
- 再推进：`novel advance "<STEP_ID>"`
- 若 `novel next` 返回的是 `...:commit`：提示用户运行 `novel commit --chapter N`

