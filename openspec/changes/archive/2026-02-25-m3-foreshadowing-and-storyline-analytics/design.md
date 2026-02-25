## Context

系统内“伏笔”存在两类信息源：
1) **计划层**：PlotArchitect 在卷规划阶段输出 `volumes/vol-{V:02d}/foreshadowing.json`，描述本卷新增/延续伏笔与章节范围（用于“写作任务注入”和“卷末盘点基线”）。
2) **事实层**：Summarizer 在每章完成后从正文权威提取 `foreshadow` ops（planted/advanced/resolved），commit 阶段据此更新 `foreshadowing/global.json`（跨卷事实索引）。

M3 的重点是把“计划层 × 事实层 × 故事线结构”联动起来，做到可盘点、可预警、可回归。

## Goals / Non-Goals

**Goals:**
- 以 `foreshadowing/global.json` 为跨卷事实源，稳定维护伏笔条目与 history
- 输出面向用户的两类报告：每 10 章简报 + 卷末回顾（伏笔完成度 + 风险项）
- 做跨故事线桥梁检查，避免 shared_foreshadowing 成为“空引用”
- 产出故事线节奏统计（出场频率、休眠时长、交汇达成率）用于诊断多线调度
- 支持可选确定性脚本（query-foreshadow.sh）来加速查询与减少上下文注入成本

**Non-Goals:**
- 不在 M3 自动“修复/改写章节”以回收伏笔（只做追踪、预警、报告）
- 不要求必须引入外部数据库或搜索引擎（仍以纯文件为主）

## Decisions

1. **事实源优先：global.json 由 commit 更新**
   - 章节的 planted/advanced/resolved 只以 Summarizer 的 `foreshadow` ops 为准；
   - 卷规划可新增“计划条目”，但不能在事实索引中伪造 planted/advanced/resolved（避免“计划当事实”）。

2. **计划层只服务两件事：任务注入 + 验收盘点**
   - `get_chapter_foreshadowing(chapter)` 只返回与本章有关、且尚未 resolved 的伏笔子集；
   - 卷末回顾对照计划（vol/foreshadowing.json）与事实（global.json）输出完成度与风险。

3. **桥梁检查以“引用可追溯”为最小可用**
   - 检查 relationships.bridges.shared_foreshadowing 的伏笔 ID 是否存在于 global 索引或本卷计划；
   - 缺失则在报告中标红并建议：补 plan / 补 planted 记录 / 修正 ID。

4. **节奏分析不追求完美推理，追求稳定统计**
   - 出场统计以 summaries 的 `storyline_id` 为准；
   - 交汇达成率以 storyline-schedule.json 的 convergence_events.chapter_range 与实际章节 storyline_id 序列做对齐统计（允许误差，但需报告偏差）。

5. **脚本优先、规则回退**
   - 若存在 `scripts/query-foreshadow.sh <chapter_num>`，用于快速返回“本章相关伏笔条目子集”；
   - 否则基于 JSON 过滤规则生成同等结构的子集。

## Outputs

- `foreshadowing/global.json`：跨卷事实索引（含 history）
- `reports/foreshadowing-check.md`（建议路径，可实现时确定）：每 10 章盘点报告
- `volumes/vol-{V:02d}/review.md` 的一个小节：卷末伏笔完成度 + 风险项
- `reports/storyline-rhythm.md`：节奏统计（可合并进 quality brief）

## Risks / Trade-offs

- [Risk] 伏笔 ID 不统一导致索引碎片化 → Mitigation：使用 slug ID；桥梁检查提供“疑似重复/近似”提示但不自动合并
- [Risk] 计划与事实不一致造成用户困惑 → Mitigation：报告明确区分“计划未发生”与“发生但未记录（Summarizer 漏提取）”
- [Risk] 节奏统计误判（storyline_id 标记质量不足）→ Mitigation：优先使用 Summarizer 输出的 storyline_id；异常率在报告中提示

## References

- `docs/dr-workflow/novel-writer-tool/final/prd/09-data.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/06-storylines.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/04-workflow.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/10-protocols.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/06-extensions.md`

