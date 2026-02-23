## Context

去 AI 化的长期有效性依赖两条“闭环”：
1) 风格基线（style-profile）与实际输出的偏差被持续监控并纠正；
2) AI 高频用语黑名单在新语料与模型行为变化下持续更新，同时避免误伤作者真实风格词汇。

M3 在不引入外部服务的前提下，通过“每 5 章检测 + 文件注入纠偏”实现闭环。

## Goals / Non-Goals

**Goals:**
- 每 5 章生成一次漂移检测结果（可解释、可追溯）
- 漂移超阈值时写入 `style-drift.json`，并自动注入后续生成调用
- 发现回归基线后自动清除纠偏文件（避免永久偏置）
- 黑名单动态更新，并提供误伤保护与用户可控入口

**Non-Goals:**
- 不追求精确的语言学统计（M3 以稳定启发式为主）
- 不把黑名单更新变成强制阻断（仍由 QualityJudge 评分与 StyleRefiner 替换为主）

## Decisions

1. **漂移检测以“最近 5 章”作为窗口**
   - 每 5 章触发一次（ch%5==0），对最近 5 章正文（或摘要代理特征）做统计；
   - 主要对齐两项硬指标：句长、对话比例；其余指标作为提示。

2. **阈值对齐 spec/04-quality.md**
   - 句长偏移 > 20% 或对话比例偏移 > 15%：判定漂移并生成纠偏 directive；
   - 回归判定：偏移 < 10%（连续一次检测通过即可清除）。

3. **纠偏注入是“正向指令”，不以负向惩罚为主**
   - `style-drift.json.drifts[].directive` 为可执行写作指令，注入 ChapterWriter/StyleRefiner；
   - 与 `writing_directives` 叠加，但优先级低于用户 override。

4. **黑名单更新以“建议追加”为主，并提供豁免机制**
   - QualityJudge 发现新高频 AI 用语时给出建议；
   - 入口 skill 负责写入 `ai-blacklist.json`，并维护 `exemptions/whitelist`（实现时确定字段）以避免误伤。

5. **脚本优先、LLM 回退**
   - 若存在 `scripts/lint-blacklist.sh <chapter.md> <blacklist.json>`，用于精确命中统计；
   - 否则由启发式/LLM 估计命中率（仅用于评分参考，不作为 hard gate）。

## Risks / Trade-offs

- [Risk] 漂移检测误报导致过度纠偏 → Mitigation：阈值保守；回归即清除；纠偏指令简短且可解释
- [Risk] 黑名单持续增长导致误伤率上升 → Mitigation：豁免机制 + 用户可编辑；新增词条需要 evidence（出现频次/例句）
- [Risk] 注入过多指令造成 prompt 负担 → Mitigation：仅注入偏离项（最多 3-5 条）

## References

- `docs/dr-workflow/novel-writer-tool/final/spec/04-quality.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/09-data.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/06-extensions.md`

