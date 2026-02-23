## 1. Agents (Prompt + IO Contracts)

- [x] 1.1 落地 `agents/chapter-writer.md`（输入变量、L1/L2/L3/故事线边界约束、hints 输出格式）
- [x] 1.2 落地 `agents/summarizer.md`（摘要 + ops patch + crossref + memory + unknown_entities 输出格式）
- [x] 1.3 落地 `agents/style-refiner.md`（黑名单替换、句式调整、语义不变、≤15% 修改量、变更日志 JSON）
- [x] 1.4 落地 `agents/quality-judge.md`（双轨验收 JSON：contract_verification + scores + overall + recommendation）

## 2. Staging Outputs

- [x] 2.1 定义并创建 staging 子目录：`staging/chapters/`、`staging/summaries/`、`staging/state/`、`staging/storylines/`、`staging/evaluations/`
- [x] 2.2 固化每阶段输出路径命名（`chapter-{C:03d}` 零填充一致）

## 3. Transaction: staging → commit

- [x] 3.1 实现 commit 步骤：移动章节/摘要/评估到正式目录 + 覆盖 storylines/*/memory.md
- [x] 3.2 实现 state 合并：校验 ops → 应用 → `state_version += 1` → 追加 `state/changelog.jsonl`
- [x] 3.3 实现 foreshadowing/global.json 更新（从 `foreshadow` ops 提取）
- [x] 3.4 更新 `.checkpoint.json`（`pipeline_stage="committed"`、`inflight_chapter=null`、章节计数推进）
- [x] 3.5 清理本章 staging 文件（幂等）

## 4. Gate & Revision Loop

- [x] 4.1 实现门控阈值（≥4.0 pass；3.5-3.9 polish；3.0-3.4 revise；<3.0 通知/暂停；有 high-confidence violation 强制修订）
- [x] 4.2 实现最大修订次数与耗尽后的处理（force_passed / 暂停提示）

## 5. Concurrency & Recovery

- [x] 5.1 实现 `.novel.lock/` 原子目录锁（获取/释放/冲突提示）
- [x] 5.2 实现 `pipeline_stage` 恢复策略（drafting/drafted/refined/judged → 从对应阶段继续）

## References

- `docs/dr-workflow/novel-writer-tool/final/prd/10-protocols.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/09-data.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/agents/summarizer.md`
