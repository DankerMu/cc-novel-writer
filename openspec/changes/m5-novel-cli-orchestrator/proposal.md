## Why

当前产品形态是 Claude Code plugin（以 `skills/`、`agents/`、`hooks/` 为主），对外部用户与其他执行器（Codex CLI、纯终端脚本、CI）不友好：编排逻辑散落在技能说明里，缺少一个可脚本化、可检查、可恢复的“确定性核心”。

M5 的目标是把“确定性编排”从“LLM 生成”中解耦：由通用 `novel` CLI 负责状态机/文件事务/锁/校验/下一步计算与指令包输出；实际写作与分析仍由 Claude Code/Codex 的 subagent（或用户选择的执行器）完成。这与 OpenSpec 的定位一致：工具提供方法论与结构化工件，不直接调用 LLM API。

## What Changes

- 新增通用命令行工具 `novel`（不调用 LLM）：
  - `status`：展示 checkpoint、锁、staging 状态与下一步建议
  - `next`：计算确定性的下一步 step id
  - `instructions`：为某个 step 生成机器可读的 instruction packet（可落盘）
  - `validate` / `advance`：校验 step 输出并推进 `.checkpoint.json`
  - `commit`：staging→正式目录的原子提交（事务语义，对齐 PRD）
  - `lock`：并发锁的状态/清理
- 以 `.checkpoint.json` 与目录结构作为冷启动恢复点，对齐现有数据协议（`docs/dr-workflow/novel-writer-tool/final/prd/09-data.md`、`10-protocols.md`）。
- 引入 instruction packet（JSON）作为“编排→执行器”的稳定边界：CLI 输出“做什么、读什么、写到哪、验什么”，执行器/子代理负责“怎么写”。
- 提供执行器适配层（Claude Code/Codex），让用户可全自动运行，但可随时中断并调整（由执行器提供中断能力，CLI 负责可恢复的状态）。

## Capabilities

### New Capabilities

- `novel-cli-core`: 项目根目录检测、checkpoint/锁管理、命令行与 JSON 输出契约
- `instruction-packets`: step id 语义、确定性 next、instruction packet schema、manifest（路径为主）生成
- `executor-adapters`: Claude Code/Codex 适配脚本/commands，让执行器按 packet 调度现有 `agents/` 与项目级 `skills/`

### Modified Capabilities

- （无）

## Impact

- 新增 npm 包形态的 `novel` CLI（Node.js/TypeScript），目标使用方式为 `npx novel`（或安装后直接 `novel`）。
- 新增 `openspec/changes/m5-novel-cli-orchestrator/specs/**`、`design.md`、`tasks.md`，作为后续实现与 review 的单一来源。
- 可能新增 `.claude/commands/` 或 `.codex/` 适配器文件；后续可逐步让现有 plugin skills 改为调用 `novel` CLI（不作为本次 change 的强制前置）。
