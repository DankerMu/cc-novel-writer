## Context

一致性检查需要在两种时机触发：
1) 周期性检查（每 10 章）用于早发现早修正
2) 卷末回顾用于总结与跨线对齐

输入来源优先使用 summaries 与 state（成本低且结构化），必要时回溯章节正文定位证据片段。

## Goals / Non-Goals

**Goals:**
- 输出可操作的矛盾列表（实体、位置、时间线、证据片段、严重级别、建议修复）
- 支持跨故事线的时间线一致性检查（LS-001 hard）
- 支持可回归运行（对同一批章节重复运行得到稳定输出）

**Non-Goals:**
- 不在 M3 强制自动修复全文（只输出报告与修复建议，修复流程由写作/重建 changes 处理）
- 不要求必须使用外部 NER 模型（优先可选脚本，缺失时回退 LLM）

## Decisions

1. **脚本优先、LLM 回退**
   - 若存在 `${CLAUDE_PLUGIN_ROOT}/scripts/run-ner.sh`，入口 Skill 用 Bash 调用获得实体 JSON；
   - 否则由 LLM（QualityJudge 或专用检查流程）提取实体（但需输出 confidence 并减少误报）。

2. **以 summaries 驱动对齐**
   - 默认从 `summaries/chapter-*-summary.md` 提取实体并做跨章比对，减少读取正文成本。

3. **时间线矛盾检测与 LS-001 对齐**
   - 将“时间 marker/顺序线索”结构化为可比对字段（初期可弱结构化），为后续 time_index 完整实现做铺垫。

## Risks / Trade-offs

- [Risk] NER 误报导致用户疲劳 → Mitigation：输出 confidence；仅 high-confidence 触发 hard gate，其他作为提示。
- [Risk] 缺少统一时间标尺导致跨线对齐困难 → Mitigation：先以 `world_state.time_marker` 与显式时间词为最小实现；后续引入 time_index。

## References

- `docs/dr-workflow/novel-writer-tool/final/prd/06-storylines.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/06-extensions.md`
- `docs/dr-workflow/novel-writer-tool/final/milestones.md`

