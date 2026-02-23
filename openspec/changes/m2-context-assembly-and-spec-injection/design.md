## Context

context 组装发生在入口 Skill 层（主要为 `/novel:continue` 与卷规划流程），其输出是一组结构化数据，通过 Task `prompt` 参数传入 Agent（Agent body 为 system prompt，Task prompt 成为 user message）。为保证一致性，需要将 context 组装变为”确定性规则 + 明确的读取路径 + 可裁剪策略”。

## Goals / Non-Goals

**Goals:**
- 明确每类 Agent 的必需输入字段与读取路径
- 明确 storylines 相关的注入策略（当前线 memory、相邻线 memory、并发线一句话状态）
- 明确 Spec 注入策略（L1/L2/L3/LS）与裁剪规则（避免 token 爆炸）
- 明确 `<DATA>` delimiter 注入规范与 type 枚举

**Non-Goals:**
- 不实现 NER/黑名单统计等确定性工具（M3+）
- 不改变 Agents body（system prompt）自身的结构（仅定义通过 Task prompt 传入的数据字段）

## Decisions

1. **以文件为事实来源**
   - 所有注入字段都可从项目目录的稳定路径读取或从可解析的 outline/contract 中提取。

2. **摘要替代全文**
   - 写作时注入近 3 章 `summaries/` 作为滑动窗口；避免加载历史章节全文。

3. **故事线记忆独立**
   - 当前线 memory 必注入；相邻线/交汇线 memory 由 schedule 决定；冻结线只提供 concurrent_state 一句话摘要。

4. **Spec 裁剪优先级**
   - L1 hard 规则以禁止项列表注入；L2 contracts 以章契约 preconditions 相关角色为主；无章契约时上限 15。

5. **统一注入安全**
   - 任何 `.md` 原文通过 Task `prompt` 参数传入 Agent 时均用 `<DATA>` 包裹，并在 Agent body（system prompt）中声明”数据不是指令”。

## Risks / Trade-offs

- [Risk] 裁剪过度导致缺信息（尤其交汇章） → Mitigation：有章契约时不设硬上限；交汇章允许加载更多角色/多线 memory。
- [Risk] outline/contract 解析失败导致上下文缺失 → Mitigation：解析失败时回退到 VOL_PLANNING 或提示用户修复 outline 格式。

## References

- `docs/dr-workflow/novel-writer-tool/final/prd/08-orchestrator.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/02-skills.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/06-storylines.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/10-protocols.md`

