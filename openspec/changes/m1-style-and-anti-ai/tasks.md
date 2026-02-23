## 1. Style Profile Schema & Template

- [ ] 1.1 固化 `style-profile.json` schema（包含 `writing_directives`、`override_constraints`、`source_type` 等关键字段）
- [ ] 1.2 新增 `templates/style-profile-template.json`（含字段注释与默认值）

## 2. AI Blacklist Asset

- [ ] 2.1 新增 `templates/ai-blacklist.json`（≥30 条 words + categories + version/last_updated）
- [ ] 2.2 定义黑名单维护流程（手动编辑 + 后续自动追加入口，M3 change 细化）

## 3. StyleAnalyzer Agent

- [ ] 3.1 落地 `agents/style-analyzer.md`（原创/仿写/模板三种输入模式）
- [ ] 3.2 输出 `style-profile.json`，保证 `source_type` 与 `reference_author` 语义一致

## 4. Shared Knowledge Base

- [ ] 4.1 新增 `skills/novel-writing/SKILL.md`（卷制工作流、Spec-Driven、去 AI 化四层、评分权重）
- [ ] 4.2 新增 `skills/novel-writing/references/style-guide.md`（去 AI 化规则详解）
- [ ] 4.3 新增 `skills/novel-writing/references/quality-rubric.md`（8 维度评分标准）

## 5. Integration Points (Contracts Only)

- [ ] 5.1 定义 ChapterWriter 注入规则：style-profile 全量 + blacklist Top-10
- [ ] 5.2 定义 StyleRefiner/QualityJudge 注入规则：blacklist 全量 + style-profile 全量

## References

- `docs/dr-workflow/novel-writer-tool/final/spec/agents/style-analyzer.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/04-quality.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/05-templates.md`

