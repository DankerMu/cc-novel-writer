## Context

当前流水线在每章都执行 QualityJudge（双轨验收：合规检查 + 8 维度评分），但 M3 需要把“评估结果”转化为“可自动执行的门控行为”，并对关键章（卷首/卷尾/交汇章）增加更严格的复核。

门控的关键输入：
- Track 1: `contract_verification`（L1/L2/L3/LS）+ `confidence`
- Track 2: `overall` 评分（加权均值）
- chapter type：普通章 vs 关键章（卷首/卷尾/交汇）

## Goals / Non-Goals

**Goals:**
- 将门控决策逻辑固化为可复用的决策函数，输出结构化 `gate_decision`
- 自动修订闭环（revise/rewrite），并与 checkpoint/pipeline_stage 一致
- 关键章双裁判：第二裁判采用更强模型（Opus）复核，采用“最坏情况”策略
- 全过程可审计：日志与评估文件包含修订次数与裁判信息

**Non-Goals:**
- 不在 M3 追求“零人工介入”：2.0-2.9 与 <2.0 仍需要用户确认/暂停（按 PRD）
- 不在门控阶段引入复杂的多轮对话（交互边界遵循 §10.5）

## Decisions

1. **confidence=high 才能触发 hard gate**
   - 仅当 violation 且 `confidence="high"` 时强制修订；
   - `medium/low` 仅记录警告，不阻断（避免误报疲劳）。

2. **修订最多 2 次，之后进入可解释的终止策略**
   - 0-2 次自动修订；
   - 达到上限后：若无 high-confidence violation 且 `overall >= 3.0` → `force_passed=true`；否则暂停并提示用户处理。

3. **关键章识别规则**
   - 卷首章：本卷 chapter_start
   - 卷尾章：本卷 chapter_end（或由配置给出）
   - 交汇事件章：`storyline-schedule.json.convergence_events.chapter_range` 覆盖的章节

4. **双裁判采用最坏情况合并**
   - `overall_final = min(overall_primary, overall_secondary)`
   - violation 合并：任一裁判出现 `confidence="high"` 的 hard violation → 视为 hard gate
   - 评估文件记录两次裁判的 `model` 与 `overall`，便于回溯成本与差异

## Gate Decision Table (Normative)

```
if has_high_confidence_violation:
  decision = "revise"
else:
  if overall >= 4.0: decision = "pass"
  elif overall >= 3.5: decision = "polish"
  elif overall >= 3.0: decision = "revise"
  elif overall >= 2.0: decision = "pause_for_user"
  else: decision = "pause_for_user_force_rewrite"
```

> 说明：`pause_for_user*` 不自动继续写下一章，等待 `/novel:start` 交互。

## Risks / Trade-offs

- [Risk] 双裁判成本上升 → Mitigation：严格限定为卷首/卷尾/交汇章；并在日志中可见
- [Risk] 修订循环导致内容漂移 → Mitigation：修订指令最小化（required_fixes），并限制修订次数
- [Risk] hard gate 误报造成阻塞 → Mitigation：只认 `confidence="high"`；其余仅警告

## References

- `docs/dr-workflow/novel-writer-tool/final/spec/agents/quality-judge.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/04-workflow.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/08-orchestrator.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/10-protocols.md`

