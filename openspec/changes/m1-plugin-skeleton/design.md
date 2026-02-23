## Context

当前仓库以 `docs/dr-workflow/novel-writer-tool/final/` 为最终需求与实现规格来源，但尚未形成可被 Claude Code 直接加载的插件骨架。该 change 仅定义并落地“可安装/可发现/可引用”的插件结构与路径约定，为后续 Skills/Agents/模板/脚本实现提供稳定载体。

约束：
- 插件安装后会被复制到缓存目录；插件内部引用必须经 `${CLAUDE_PLUGIN_ROOT}` 解析。
- 插件自身文件为只读源；写作项目数据必须写入用户项目目录（不写入插件目录）。

## Goals / Non-Goals

**Goals:**
- 定义并创建 `novel` 插件的最小可用骨架与 manifest（`plugin.json`）
- 定义 hooks 的落点与调用方式（`hooks/hooks.json` + `scripts/`）
- 固化路径约定与只读/可写边界，避免后续实现出现“路径漂移/写入越界”

**Non-Goals:**
- 不实现任何写作业务逻辑（不实现 /novel:* 的具体行为）
- 不实现任何 agent prompt（agents/*.md）或 skill prompt（skills/*/SKILL.md）的正文内容
- 不引入外部依赖或 MCP server（M4+ 可选优化由后续 changes 覆盖）

## Decisions

1. **采用 OpenAI/Claude Code 插件目录约定**
   - 使用 `.claude-plugin/plugin.json` 作为插件 manifest。
   - `skills` 与 `hooks` 路径在 manifest 中以相对路径声明，运行时由宿主解析。

2. **强制 `${CLAUDE_PLUGIN_ROOT}` 解析插件内部资源路径**
   - 设计目的：插件被复制到缓存目录后，相对路径引用会失效；通过环境变量统一解析。
   - 影响：后续所有 Skills/脚本对 `templates/`、`references/` 等资源的访问都必须遵循该约定。

3. **“插件只读、项目可写”边界前置**
   - 插件目录仅作为 prompt/模板/脚本分发载体；运行时输出（章节、摘要、状态、日志）写入用户项目目录。
   - 为后续 staging→commit 与路径审计（M2）提供可验证边界。

## Risks / Trade-offs

- [Risk] 宿主对 hooks 的支持差异（例如 PostToolUse 可用性/事件名变更） → Mitigation：本 change 只创建 hooks 目录与基线 SessionStart 配置，具体启用策略由后续 changes 控制。
- [Risk] `${CLAUDE_PLUGIN_ROOT}` 在不同运行环境不可用 → Mitigation：在脚本/Skills 中提供显式错误提示或降级路径（后续 changes 负责）。

## References

- `docs/dr-workflow/novel-writer-tool/final/spec/01-overview.md`（plugin.json 与 hooks.json 的目标形态）
- `docs/dr-workflow/novel-writer-tool/final/prd/01-product.md`（交付结构与路径原则）
- `docs/dr-workflow/novel-writer-tool/final/milestones.md`（M1 1.0/1.2 对脚手架的要求）

