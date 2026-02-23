## Why

多线叙事与 Spec-Driven Writing 的可靠性主要由 context 工程决定：如果每次调用遗漏关键状态/契约/故事线记忆，LLM 将出现串线、设定违背与质量漂移。需要在 M2 将 context 组装规则确定化、可复用、可审计。

## What Changes

- 固化按 agent 类型的 context 组装规则（ChapterWriter / Summarizer / StyleRefiner / QualityJudge / PlotArchitect）
- 引入 Spec 注入链路：L1 世界规则、L2 角色契约、L3 章节契约、LS 故事线规范（读取路径与注入位置）
- 引入故事线 context 组装：`storyline_context`、`concurrent_state`、`transition_hint`、line memory（`storylines/{id}/memory.md`）
- 引入实体映射与裁剪：`entity_id_map`、L2 契约裁剪（有章契约→按 preconditions 选择；否则上限 15）
- 强制 `<DATA>` delimiter：任何文件原文注入均按协议包裹，降低 prompt 注入风险

## Capabilities

### New Capabilities

- `context-assembly-and-spec-injection`: 提供确定性的上下文组装与注入安全规范，支撑多线叙事调度与 Spec 合规验收。

### Modified Capabilities

- (none)

## Impact

- 影响范围：`/novel:continue` 的 context 组装与 `Task` 派发输入；间接影响所有 Agents 的输出质量
- 依赖关系：依赖 `m1-world-rules-and-storylines`、`m1-style-and-anti-ai`、`m2-volume-planning-and-contract-propagation` 等提供数据文件
- 兼容性：新增能力；不改变已落盘章节/摘要格式

## Milestone Mapping

- Milestone 2: 2.2（context 组装规则）、2.10（LS 规范注入与检查输入）、2.11（故事线 context 组装）。参见 `docs/dr-workflow/novel-writer-tool/final/milestones.md`。

## References

- `docs/dr-workflow/novel-writer-tool/final/prd/08-orchestrator.md`（Context 组装伪代码与 token 参考）
- `docs/dr-workflow/novel-writer-tool/final/spec/02-skills.md`（continue 的 context 字段清单）
- `docs/dr-workflow/novel-writer-tool/final/prd/05-spec-system.md`（L1/L2/L3 注入与验收）
- `docs/dr-workflow/novel-writer-tool/final/prd/06-storylines.md`（storyline_context/concurrent_state/transition_hint 与防串线）
- `docs/dr-workflow/novel-writer-tool/final/prd/10-protocols.md`（DATA delimiter）

