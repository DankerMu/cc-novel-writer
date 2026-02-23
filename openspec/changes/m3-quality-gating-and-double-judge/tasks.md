## 1. Gate Decision Engine

- [ ] 1.1 固化门控决策函数：输入（violations+confidence、overall、chapter_type）→ 输出 gate_decision
- [ ] 1.2 对齐 PRD 门控阈值表：pass/polish/revise/pause，并明确每种决策的后续动作
- [ ] 1.3 记录门控结果：为 `logs/chapter-*-log.json` 与 eval metadata 定义字段（decision/revisions/force_passed）

## 2. Automated Revision Loop

- [ ] 2.1 设计“修订模式”输入：使用 QualityJudge `required_fixes` 作为最小修订指令
- [ ] 2.2 实现修订次数上限（max=2）与终止策略（force_pass / pause_for_user）
- [ ] 2.3 checkpoint/pipeline_stage 与修订循环一致（中断恢复不重复已完成阶段）

## 3. Key Chapter Double Judge

- [ ] 3.1 关键章识别：卷首/卷尾/交汇事件章（基于 `storyline-schedule.json`）
- [ ] 3.2 双裁判策略：第二裁判模型（Opus）+ 最坏情况合并（min score + violations union）
- [ ] 3.3 输出对照信息：记录 primary/secondary 的 score/model，便于回溯差异与成本

## 4. UX & Reporting

- [ ] 4.1 在 `/novel:continue` 输出中展示 gate 决策与修订次数（简洁）
- [ ] 4.2 在 `/novel:start` 质量回顾中汇总低分章、强制修订原因与关键章双裁判结果

## References

- `docs/dr-workflow/novel-writer-tool/final/prd/08-orchestrator.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/04-workflow.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/agents/quality-judge.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/10-protocols.md`

