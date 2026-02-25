## 1. Drift Detection

- [x] 1.1 定义风格漂移统计窗口与输入来源（最近 5 章正文/摘要）
- [x] 1.2 实现基线对比：对齐 `style-profile.json` 的 avg_sentence_length、dialogue_ratio
- [x] 1.3 阈值与回归规则：漂移触发（>20%/>15%）与回归清除（<10%）

## 2. Drift Injection Lifecycle

- [x] 2.1 定义并生成 `style-drift.json` 格式（metric/baseline/current/directive）
- [x] 2.2 Task prompt 传入：ChapterWriter/StyleRefiner 通过 Task `prompt` 参数接收 drift directives
- [x] 2.3 生命周期管理：回归基线后清除/停用 drift 文件并记录原因

## 3. Dynamic Blacklist Updates

- [x] 3.1 定义黑名单更新协议：新增词条需 evidence（频次/例句）+ 版本/时间戳
- [x] 3.2 误伤保护：从 style 样本提取可豁免词（或显式 whitelist）并在更新时校验
- [x] 3.3 用户可控入口：允许手动添加/删除并在评估中提示变更

## 4. Deterministic Tooling (Optional)

- [x] 4.1 集成 `scripts/lint-blacklist.sh`（存在则调用，不存在回退）
- [x] 4.2 将精确 hit count/行号注入 QualityJudge context（用于可量化评分理由）

## References

- `docs/dr-workflow/novel-writer-tool/final/spec/04-quality.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/09-data.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/07-anti-ai.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/06-extensions.md`
