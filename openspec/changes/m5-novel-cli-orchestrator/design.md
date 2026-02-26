## Context

现状：仓库以 Claude Code plugin 形式提供能力（`agents/` + `skills/` + `hooks/` + `scripts/`），核心编排逻辑主要以“技能说明 + 约定目录结构”的方式存在。对于纯终端用户、Codex CLI 用户、CI/回归测试场景，缺少一个稳定的、可脚本化的入口来完成：

- 读 `.checkpoint.json` 并计算下一步（中断恢复）
- 生成可执行的、可审计的指令包（instruction packet）
- 对 staging 产物进行结构/存在性校验
- staging→正式目录的事务提交（含锁/幂等）

同时，我们希望保持 “OpenSpec 风格”的边界：工具本身不调用 LLM API，只输出结构化工件与确定性决策；LLM 生成由 Claude Code/Codex 等执行器负责，并允许用户随时中断/调整。

约束：
- 技术栈定位为 npm 包（Node.js/TypeScript），目标使用方式为 `npx novel`
- 允许引入必要的 npm 依赖（CLI 解析、schema 校验等），但保持依赖面最小、可审计
- 与现有数据协议对齐：目录结构与 `.checkpoint.json`、锁目录 `.novel.lock/`、staging 事务语义（`docs/dr-workflow/novel-writer-tool/final/prd/09-data.md`、`10-protocols.md`）
- 兼容现有 agent contract：context manifest 以“路径为主”（manifest mode），避免大段内容注入（见 `agents/chapter-writer.md` 的输入说明）

## Goals / Non-Goals

**Goals:**
- 提供 `novel` CLI 的确定性编排核心：`status/next/instructions/validate/advance/commit/lock`
- 以 instruction packet（JSON）作为 “编排→执行器” 的稳定接口，默认 manifest（路径）模式
- 可恢复：中断后基于 `.checkpoint.json` + `staging/**` 计算出确定性 next step
- 可审计：可选将 instruction packet 落盘到 `staging/manifests/` 便于回放/复现
- 适配 Claude Code 与 Codex CLI：提供最薄的 adapter，让用户可全自动执行但可随时停下 review

**Non-Goals:**
- 不在 M5 内把 `/novel:start` 的交互式规划完整搬到 CLI（AskUserQuestion 仍留在入口技能/执行器侧）
- 不在 CLI 内直接调用任何 LLM（包括 OpenAI/Claude/Gemini API）
- 不在本次 change 内重写全部现有 skills；优先新增 CLI，并逐步迁移关键路径

## Decisions

1. **语言与结构：Node.js/TypeScript 的 npm CLI**
   - 以 TypeScript 编写，编译到 `dist/`，通过 `package.json.bin` 暴露 `novel` 命令；
   - 目标用户体验：`npx novel --help` / `npx novel status --json`（发布到 npm 后），本仓库内开发使用 `npm run dev` 或 `npm run build && node dist/cli.js`；
   - 允许引入少量成熟依赖（如 CLI 框架、schema 校验），但核心编排保持“确定性 + 可测试”。

2. **稳定接口：instruction packet 作为跨执行器协议**
   - `novel instructions <step>` 输出结构化 JSON：包含 step、目标 agent、context manifest（paths + inline）、预期产物、后续建议动作；
   - 默认 manifest（路径）模式，不嵌入完整文件内容；必要时允许 `--embed` 输出简版内联（用于人读或调试），但不作为默认执行路径。

3. **恢复模型：以 `.checkpoint.json.pipeline_stage` + `inflight_chapter` 为主，staging 文件为辅**
   - next-step 计算遵循“幂等可重试”：当某阶段产物缺失时回退到能重建的最早阶段；
   - 规则对齐 `skills/continue` 的恢复策略与 PRD 的 staging→commit 事务语义。

4. **并发控制：沿用原子目录锁 `.novel.lock/`**
   - 写操作（`advance/commit`）在执行前检查锁；必要时自动获取/释放锁（或提供显式锁命令）；
   - `lock clear` 仅清理“过期/僵尸”锁（基于 `info.json.started` 超时阈值），避免误删活锁。

5. **适配策略：先提供“可组合”的最薄适配器**
   - Claude Code：以 project-level commands/skills 或脚本包装 `novel next` / `novel instructions`，然后调用对应 agent 执行；
   - Codex CLI：提供等价脚本/skill（或文档化流程）以调用 subagent；
   - 两类适配器都必须在每步后留“断点”（validate/advance/commit 前），便于用户 review 和打断调整。

## Risks / Trade-offs

- [Risk] CLI 与现有技能编排逻辑分叉（两套规则不一致） → Mitigation：以 PRD/agents contract 为单一真源；把关键规则（step id、next、packet schema）写入 specs，并在实现中加自检/fixtures
- [Risk] 无依赖实现导致 JSON schema 校验/错误提示较弱 → Mitigation：先做“必要字段 + 类型 + 取值枚举”的显式校验；后续如需再引入可选依赖
- [Risk] 适配器层引入新入口，用户不知从何开始 → Mitigation：CLI `--help` + 文档提供最短路径（next→instructions→execute→validate→advance→commit）

## Migration Plan

1. 在仓库内新增 `novel` CLI（不破坏现有 plugin 能力）
2. 先覆盖“写作流水线”最核心的 chapter pipeline：next / instructions / validate / commit
3. 引入 Claude/Codex adapter（最薄包装），跑通一次真实写作回路
4. 逐步把现有 `/novel:continue` 内的确定性部分下沉到 CLI（技能层只保留交互与执行器调度）

## Open Questions

- npm 包命名与发布策略：是否使用 scope（例如 `@scope/novel`）以避免 `novel` 名称冲突？
- 构建产物策略：仅 `tsc` 输出多文件 `dist/`，还是使用 bundler 打包为单文件 CLI（便于分发/启动速度/审计）？
- step id 是否需要覆盖“卷规划/卷回顾”等非 chapter pipeline 步骤（可能作为后续 change）
- 锁的获取/释放策略：完全显式（lock acquire/release）还是由 mutating 子命令隐式管理（倾向后者，但需要清晰文档）
