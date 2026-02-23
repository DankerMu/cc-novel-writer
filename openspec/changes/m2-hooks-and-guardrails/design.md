## Context

hooks 是“非交互增强层”，用于在不改变三命令 UX 的前提下提升可靠性：
- SessionStart：每次新 session 进入项目目录时执行，注入项目状态到宿主上下文
- PostToolUse：拦截工具写入事件，对路径做白名单校验

## Goals / Non-Goals

**Goals:**
- SessionStart：快速、可降级、只在小说项目目录生效
- PostToolUse：强制 Agents 写入边界（仅 `staging/**`），并提供可审计日志

**Non-Goals:**
- 不在 hook 中执行复杂计算（必须在严格超时内完成）
- 不做 schema 校验/NER 等扩展点（M3+）

## Decisions

1. **SessionStart 5 秒超时与静默退出**
   - 仅在 `.checkpoint.json` 存在时输出；否则 exit 0，不污染非项目目录体验。

2. **摘要注入截断**
   - 最近摘要最多注入 2000 字符，避免大文件导致 token 浪费或 hook 超时。

3. **路径审计白名单**
   - 对 Agent 的 Write/Edit 只允许 `staging/**`；入口 Skill 的 commit 阶段仍可写正式目录（不在审计拦截范围内或通过不同身份区分）。

4. **审计日志 append-only**
   - 违规拦截写入 `logs/audit.jsonl`，便于后续排查与安全回溯。

## Risks / Trade-offs

- [Risk] hook 机制在不同宿主版本不可用 → Mitigation：Skills 仍能独立读取 checkpoint；hook 只是加速与增强。
- [Risk] 路径审计误拦截导致流水线卡住 → Mitigation：白名单规则清晰、日志可追；并允许在开发阶段以配置开关临时关闭（后续）。

## References

- `docs/dr-workflow/novel-writer-tool/final/spec/01-overview.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/10-protocols.md`
- `docs/dr-workflow/novel-writer-tool/final/milestones.md`

