## Why

M2 开始系统需要更强的可靠性与安全边界：
- SessionStart 自动注入 checkpoint 与最近摘要，降低冷启动成本与上下文缺失风险
- PreToolUse 路径审计拦截 chapter pipeline 子代理写入非 `staging/**` 的操作，避免越界写入导致数据污染与不可恢复的状态错乱

## What Changes

- 启用并实现 SessionStart hook（`hooks/hooks.json` + `scripts/inject-context.sh`）
  - 在小说项目目录（存在 `.checkpoint.json`）中自动注入状态与最近摘要
  - 非项目目录静默退出
  - 摘要截断防止 token 浪费
- 启用并实现 PreToolUse 路径审计 hook
  - 仅允许 chapter pipeline 子代理（ChapterWriter/Summarizer/StyleRefiner）的 Write/Edit/MultiEdit 落在 `staging/**`
  - 违规操作自动拦截并记录 `logs/audit.jsonl`

## Capabilities

### New Capabilities

- `hooks-and-guardrails`: 提供 SessionStart 自动注入与 PreToolUse 写入边界审计，提升冷启动体验与写入安全。

### Modified Capabilities

- (none)

## Impact

- 影响范围：`hooks/hooks.json`、`scripts/inject-context.sh`、以及审计日志 `logs/audit.jsonl`
- 依赖关系：依赖插件骨架；与 staging→commit 事务模型强耦合
- 兼容性：新增 hook 行为；非项目目录不产生副作用

## Milestone Mapping

- Milestone 2: 2.12（SessionStart hook）、2.14（PreToolUse 路径审计 hook）。参见 `docs/dr-workflow/novel-writer-tool/final/milestones.md`。

## References

- `docs/dr-workflow/novel-writer-tool/final/spec/01-overview.md`（hooks.json 与 inject-context.sh 基线）
- `docs/dr-workflow/novel-writer-tool/final/prd/01-product.md`（hooks 增强可靠性：SessionStart/PreToolUse）
- `docs/dr-workflow/novel-writer-tool/final/spec/02-skills.md`（M2 路径审计说明）
- `docs/dr-workflow/novel-writer-tool/final/prd/10-protocols.md`（staging 写入边界与事务语义）
