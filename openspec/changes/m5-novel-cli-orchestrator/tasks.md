## 1. CLI Scaffold & Output Contract

- [x] 1.1 添加 npm CLI 工程骨架（`package.json`/`tsconfig.json`/`src/`，可 `npm run dev -- --help` 或 `npm run build && node dist/cli.js --help`）
- [x] 1.2 实现全局参数：`--json`（单对象 JSON 输出）与 `--project`（项目根目录覆写）
- [x] 1.3 建立子命令骨架：`status/next/instructions/validate/advance/commit/lock`（均有 `--help`）

## 2. Project Root & Checkpoint

- [x] 2.1 实现项目根目录自动探测：向上查找 `.checkpoint.json`（`--project` 优先）
- [x] 2.2 实现 `.checkpoint.json` 解析与必要字段校验（缺失/类型错误给出明确错误）
- [x] 2.3 实现路径安全：标准化路径并拒绝 `..` 等 traversal，所有读写限定在 project root

## 3. Locking

- [x] 3.1 实现 `.novel.lock/` 的 `status/clear`（对齐 PRD §10.7，含僵尸锁超时策略）
- [x] 3.2 将锁检查/获取集成到写操作命令（至少 `advance` 与 `commit`）

## 4. Step Model & Deterministic Next

- [x] 4.1 定义 step id 语法与解析（例如 `chapter:048:draft|summarize|refine|judge|commit`）
- [x] 4.2 实现 `novel next`：基于 checkpoint + staging 文件存在性做中断恢复决策（确定性）
- [x] 4.3 实现 `novel status`：输出当前状态、inflight、锁状态与 next step（人读 + `--json`）

## 5. Instruction Packets

- [x] 5.1 定义 instruction packet JSON schema（version/step/agent/manifest/expected_outputs/next_actions）
- [x] 5.2 实现 `novel instructions <step>`：按 step 映射到 agent（chapter-writer/summarizer/style-refiner/quality-judge）
- [x] 5.3 实现 `--write-manifest`：将 packet 写入 `staging/manifests/`（可审计/可恢复）
- [x] 5.4 实现 `--embed`（可选）：用于人读/调试的简版内联信息（默认仍为路径 manifest）

## 6. Validate / Advance / Commit

- [x] 6.1 实现 `validate`：按 step 校验 staging 产物存在性与最小结构（JSON 可解析、字段存在等）
- [x] 6.2 实现 `advance`：在 validate 通过后推进 `.checkpoint.json`（pipeline_stage/inflight_chapter/revision_count）
- [x] 6.3 实现 `commit --chapter N`：staging→正式目录事务提交（chapters/summaries/evaluations/storylines/state/foreshadowing）
- [x] 6.4 为 `commit` 添加 `--dry-run`（输出计划动作，不落盘）

## 7. Executor Adapters (Claude Code / Codex)

- [x] 7.1 提供 Claude Code 适配器（commands/skills 或脚本）：next→instructions→执行 agent→写入 staging→断点返回
- [x] 7.2 提供 Codex CLI 适配器（skill 或脚本）：读取 packet 并调用 subagent，执行后返回给用户 review

## 8. Docs & Examples

- [x] 8.1 补充最短使用路径文档（从 `novel --help` 到跑通一章：next→instructions→execute→validate→advance→commit）
- [x] 8.2 给出“可中断/可恢复”示例（演示中断后继续：再次运行 `novel next`）

## References

- `openspec/changes/m5-novel-cli-orchestrator/proposal.md`
- `openspec/changes/m5-novel-cli-orchestrator/design.md`
- `openspec/changes/m5-novel-cli-orchestrator/specs/novel-cli-core/spec.md`
- `openspec/changes/m5-novel-cli-orchestrator/specs/instruction-packets/spec.md`
- `openspec/changes/m5-novel-cli-orchestrator/specs/executor-adapters/spec.md`
