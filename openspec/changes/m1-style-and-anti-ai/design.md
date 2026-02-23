## Context

系统采用“四层去 AI 化策略”：风格锚定（StyleAnalyzer）→ 约束注入（ChapterWriter）→ 后处理（StyleRefiner）→ 检测度量（QualityJudge）。本 change 在 M1 建立可被后续链路消费的“风格与黑名单资产”。

## Goals / Non-Goals

**Goals:**
- 统一 `style-profile.json` schema（含 `writing_directives`、`override_constraints`）
- 提供可维护的 `ai-blacklist.json` 初始版本（含 categories，便于后续动态更新）
- 提供共享知识库（novel-writing）与 references，作为所有 Agents 的共同方法论来源

**Non-Goals:**
- 不实现风格漂移检测与纠偏文件 `style-drift.json` 的生成（M3）
- 不实现黑名单动态学习与合并冲突策略（M3）
- 不实现确定性黑名单统计脚本（M3+ 扩展点）

## Decisions

1. **style-profile 以“正向指令”为核心**
   - `writing_directives[]` 作为可执行的风格指南，通过 Task `prompt` 参数传入 ChapterWriter，避免仅靠”禁忌词”做负向约束。

2. **黑名单以 versioned JSON 管理**
   - `version`/`last_updated`/`words[]`/`categories{}` 明确，可用于后续自动追加与手动审核。

3. **约束覆盖机制**
   - `override_constraints` 允许不同风格覆盖默认约束（例如反直觉细节/场景描写句数上限），避免“一刀切”导致风格不适配。

4. **共享知识库作为自动加载上下文**
   - 将去 AI 化规则与评分 rubrics 放入 `skills/novel-writing/**`，由宿主按需自动加载，减少入口 Skills/Agents 重复粘贴。

## Risks / Trade-offs

- [Risk] 黑名单过长导致风格僵硬、表达受限 → Mitigation：ChapterWriter 仅通过 Task prompt 接收 Top-10 提醒；全量替换由 StyleRefiner 后处理完成。
- [Risk] 参考作者样本可能引入版权/来源风险 → Mitigation：仅提取风格特征，不复制具体句子；并在 `source_type` 标注来源类型。

## References

- `docs/dr-workflow/novel-writer-tool/final/prd/07-anti-ai.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/05-templates.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/04-quality.md`

