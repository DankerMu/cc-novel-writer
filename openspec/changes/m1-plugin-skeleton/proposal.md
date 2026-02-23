## Why

需要先具备可被 Claude Code 识别的 `novel` 插件骨架（manifest + hooks + 目录约定），后续的 Skills/Agents/模板才能以稳定路径被加载与执行；否则后续任何里程碑实现都缺乏“可安装、可调用”的载体。

## What Changes

- 新增 Claude Code Plugin 最小骨架与路径约定：`.claude-plugin/plugin.json`、`hooks/`、`scripts/`、`skills/`、`agents/`、`templates/`
- 明确插件内资源访问规则：所有对插件内部文件的引用必须通过 `${CLAUDE_PLUGIN_ROOT}` 解析（避免缓存目录复制后路径失效）
- 建立“插件只读、项目数据写入用户项目目录”的边界，为后续 staging→commit 事务写入打基础

## Capabilities

### New Capabilities

- `plugin-scaffold`: 提供 `novel` 插件的 manifest、hooks 入口与目录骨架，使 Claude Code 能发现并加载后续的 Skills/Agents/模板/脚本。

### Modified Capabilities

- (none)

## Impact

- 影响范围：插件包结构与入口清单（不包含具体写作逻辑实现）
- 依赖关系：作为后续所有 changes 的基础前置（Skills/Agents/模板均依赖该骨架）
- 兼容性：不引入破坏性变更（新增文件/目录）

## Milestone Mapping

- Milestone 1: 任务 1.0（脚手架）、1.2（Prompt 管理的路径与载体）为主；为 1.9（hooks/脚本）预留落点。参见 `docs/dr-workflow/novel-writer-tool/final/milestones.md`。

## References

- `docs/dr-workflow/novel-writer-tool/final/prd/01-product.md`（交付形态：Claude Code Plugin，目录结构、命名空间）
- `docs/dr-workflow/novel-writer-tool/final/spec/01-overview.md`（文件清单、plugin.json、hooks.json、inject-context.sh 样例与路径约定）
- `docs/dr-workflow/novel-writer-tool/final/prd/10-protocols.md`（工具边界与安全约定的背景：staging/事务、注入安全）
- `docs/dr-workflow/novel-writer-tool/final/milestones.md`（Milestone 1 脚手架拆分）

