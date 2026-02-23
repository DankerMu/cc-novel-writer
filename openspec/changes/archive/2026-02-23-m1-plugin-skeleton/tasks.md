## 1. Plugin Skeleton

- [x] 1.1 创建插件根目录结构：`.claude-plugin/`、`skills/`、`agents/`、`templates/`、`hooks/`、`scripts/`
- [x] 1.2 新增 `.claude-plugin/plugin.json`（name=`novel`，并声明 skills 与 hooks 路径）
- [x] 1.3 新增 `hooks/hooks.json`，包含 SessionStart hook 的基线配置（command 指向 `${CLAUDE_PLUGIN_ROOT}/scripts/inject-context.sh`，timeout=5）
- [x] 1.4 新增 `scripts/inject-context.sh` 的占位实现（至少包含 checkpoint 存在性检测与安全退出；完整注入逻辑由 M2 change 细化）
- [x] 1.5 新增 `templates/brief-template.md`（项目 brief 的种子模板，供 `/novel:start` 初始化复制）

## 2. Path & Write Boundaries

- [x] 2.1 在插件文档/注释中明确 `${CLAUDE_PLUGIN_ROOT}` 的使用约定（禁止写死相对路径）
- [x] 2.2 明确插件只读/项目可写边界：插件目录不写入，项目输出写入用户项目目录

## 3. Verification

- [x] 3.1 手动验证 Claude Code 能识别插件 manifest（可看到 `novel` 命名空间下的 skills/agents 目录结构）
- [x] 3.2 校验 hooks 配置文件可被读取（不要求启用所有事件，仅保证路径/JSON 合法）

## References

- `docs/dr-workflow/novel-writer-tool/final/spec/01-overview.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/01-product.md`
- `docs/dr-workflow/novel-writer-tool/final/milestones.md`
