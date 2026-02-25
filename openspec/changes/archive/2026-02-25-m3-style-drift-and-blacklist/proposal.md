## Why

长篇续写的风格会在“数十章尺度”出现缓慢漂移：句长变长、对话变少、修辞偏移、AI 高频用语悄然增加。若不监控与纠偏，前期提取的 style-profile 会逐渐失效，去 AI 化效果下降。M3 需要将风格漂移与黑名单维护从“偶尔人工看一眼”升级为自动化、可持续的质量机制。

## What Changes

- 风格漂移检测：每 5 章提取当前输出风格特征，与 `style-profile.json` 对比并输出漂移项
- 自动纠偏：漂移超阈值时生成 `style-drift.json`，注入后续 ChapterWriter/StyleRefiner context；回归基线后清除
- AI 黑名单动态更新：QualityJudge 检测到新高频 AI 用语时追加到 `ai-blacklist.json`
- 误伤保护：若黑名单词是用户样本的高频词（或显式白名单），自动豁免
- 预留确定性脚本：`scripts/lint-blacklist.sh`（存在则用于精确命中统计与行号定位）

## Capabilities

### New Capabilities

- `style-drift-and-blacklist`: 风格漂移监控与纠偏注入、AI 黑名单动态维护与误伤保护。

### Modified Capabilities

- (none)

## Impact

- 影响范围：`style-drift.json` 生命周期管理、`ai-blacklist.json` 更新策略、每 5 章质量简报、QualityJudge 风格自然度的可量化信号
- 依赖关系：依赖 `style-profile.json` 的基线指标、章节正文（或摘要）统计、QualityJudge 输出与可选 lint 脚本
- 兼容性：新增文件与注入；不改变章节正文/摘要的主格式

## Milestone Mapping

- Milestone 3: 3.4（风格漂移检测）、3.5（黑名单动态更新机制）。参见 `docs/dr-workflow/novel-writer-tool/final/milestones.md`。

## References

- `docs/dr-workflow/novel-writer-tool/final/milestones.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/07-anti-ai.md`（黑名单维护）
- `docs/dr-workflow/novel-writer-tool/final/prd/04-workflow.md`（每 5 章风格校准）
- `docs/dr-workflow/novel-writer-tool/final/prd/09-data.md`（style-drift.json、ai-blacklist.json）
- `docs/dr-workflow/novel-writer-tool/final/spec/04-quality.md`（漂移阈值 + 纠偏注入 + 误伤保护）
- `docs/dr-workflow/novel-writer-tool/final/spec/06-extensions.md`（lint-blacklist.sh）

