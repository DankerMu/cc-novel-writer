## 1. SessionStart Hook

- [x] 1.1 在 `hooks/hooks.json` 中注册 SessionStart hook（matcher `*`，command `bash ${CLAUDE_PLUGIN_ROOT}/scripts/inject-context.sh`，timeout=5）
- [x] 1.2 实现 `scripts/inject-context.sh`：
  - 检测 `.checkpoint.json` 是否存在；不存在则静默退出
  - 输出 checkpoint 内容
  - 读取最近一章摘要（按 `last_completed_chapter`），并截断至 2000 字符
  - JSON 解析优先 python3，降级 jq

## 2. PreToolUse Path Audit Hook

- [x] 2.1 注册 PreToolUse hook（Write/Edit/MultiEdit）并实现 staging 路径白名单校验（仅 chapter pipeline 子代理：ChapterWriter/Summarizer/StyleRefiner）
- [x] 2.2 违规写入：自动拦截 + 记录 `logs/audit.jsonl`（包含时间、tool、path、allowed=false、reason）

## 3. Verification

- [x] 3.1 验证在非项目目录（无 `.checkpoint.json`）SessionStart 无输出/无报错
- [x] 3.2 验证在项目目录 SessionStart 可注入 checkpoint + 最近摘要
- [x] 3.3 验证 Agent 写入非 `staging/**` 会被拦截并产生 audit 记录

## References

- `docs/dr-workflow/novel-writer-tool/final/spec/01-overview.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/02-skills.md`
- `docs/dr-workflow/novel-writer-tool/final/milestones.md`
