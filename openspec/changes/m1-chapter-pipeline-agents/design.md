## Context

单章流水线是系统的核心执行路径，入口 Skill（通常为 `/novel:continue`）负责：
- 获取并发锁
- 逐阶段调用 Agents（Task 子代理）
- 将所有中间产物写入 `staging/`
- 读取 QualityJudge 结果做门控决策（pass/polish/revise/rewrite）
- 通过后执行 commit（移动文件 + 合并 state ops + 更新 checkpoint）

该 change 关注“流水线的事务语义与 agent 契约”，而非具体故事内容。

## Goals / Non-Goals

**Goals:**
- 固化 4 个 Agents 的输入/输出与硬约束（只读/可写目录、语义不变、结构化返回）
- 固化 staging→commit 的原子提交与幂等恢复（`pipeline_stage` + `inflight_chapter`）
- 固化门控决策规则与最大修订次数（避免无限循环）

**Non-Goals:**
- 不实现确定性 NER/黑名单统计脚本（M3+ 扩展点）
- 不实现跨卷/多线复杂调度（M2+）
- 不实现 UI 或外部服务

## Decisions

1. **staging-first 写入**
   - 所有 Agents（除 QualityJudge）只写入 `staging/**`。
   - commit 阶段由入口 Skill 单点完成，减少“部分写入”导致的不一致。

2. **checkpoint 驱动的幂等恢复**
   - `.checkpoint.json` 记录 `pipeline_stage` 与 `inflight_chapter`。
   - 冷启动时检查 staging 文件存在性，从可恢复阶段继续执行。

3. **Summarizer 为 ops 权威来源**
   - ChapterWriter 的 hints 仅作线索；最终 ops 以 Summarizer 基于正文提取为准。
   - 避免入口 Skill 直接推断状态变更造成漂移。

4. **QualityJudge 只读返回**
   - QualityJudge 不落盘，入口 Skill 写入 `staging/evaluations/**`，避免 agent 写盘越界。

5. **并发锁使用原子目录锁**
   - `mkdir .novel.lock` 作为原子锁；具备僵尸锁清理策略（后续 changes 可增强）。

## Risks / Trade-offs

- [Risk] StyleRefiner 改动语义导致 Summarizer ops 与最终正文不一致 → Mitigation：StyleRefiner 硬约束“语义不变 + 修改量 ≤15% + 对话语癖保护”；必要时增加语义一致性校验（后续）。
- [Risk] LLM 结构化输出不稳定导致 ops JSON 解析失败 → Mitigation：入口 Skill 按协议重试一次；连续失败走降级策略并记录 warn（参见协议）。
- [Risk] 门控策略导致成本不可控（反复修订） → Mitigation：最大修订次数 2；耗尽后按规则 force_pass 或暂停提示用户。

## References

- `docs/dr-workflow/novel-writer-tool/final/prd/10-protocols.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/09-data.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/agents/quality-judge.md`
- `docs/dr-workflow/novel-writer-tool/final/milestones.md`

