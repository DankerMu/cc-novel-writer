## 1. Entity Extraction

- [ ] 1.1 定义实体输出 schema（characters/locations/time_markers/events + evidence）
- [ ] 1.2 集成可选脚本：`scripts/run-ner.sh <chapter.md>` → JSON 实体列表（存在则调用）
- [ ] 1.3 LLM 回退路径：从 summary/正文提取实体（输出 confidence）

## 2. Consistency Rules

- [ ] 2.1 角色一致性：同一角色 display_name/slug 映射、称谓、关系值变化的异常检测
- [ ] 2.2 空间一致性：同一时间 marker 下角色出现在多个地点的矛盾检测
- [ ] 2.3 时间线一致性：跨故事线并发状态的时间线矛盾（对齐 LS-001 hard）

## 3. Reporting & Hooks

- [ ] 3.1 定义报告输出格式（JSON/Markdown 二选一，包含 issues + severity + suggestions）
- [ ] 3.2 接入触发点：每 10 章周期性检查 + 卷末回顾（`/novel:start` 路由）
- [ ] 3.3 为 QualityJudge LS-001 提供结构化输入（检查结果摘要 + 证据）

## References

- `docs/dr-workflow/novel-writer-tool/final/prd/04-workflow.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/06-storylines.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/06-extensions.md`

