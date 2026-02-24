# 卷末回顾

1. 收集本卷 `evaluations/`、`summaries/`、`foreshadowing/global.json`、`storylines/`，生成本卷回顾要点（质量趋势、低分章节、未回收伏笔、故事线节奏）
2. **全卷一致性报告（NER）**：
   - 章节范围：优先使用本卷 `outline.md` 解析得到的 `[chapter_start, chapter_end]`；若解析失败则退化为”本卷 evaluations/ 与 summaries/ 中匹配 `chapter-(\d{3})` 的章节号集合，取 min/max 作为范围”
   - 实体抽取与报告 schema：见 `skills/continue/references/continuity-checks.md`
   - 若存在 `${CLAUDE_PLUGIN_ROOT}/scripts/run-ner.sh`：逐章执行抽取；否则回退 LLM（优先 summaries，必要时回看 chapters），按同一 schema 抽取 entities，并为每类实体输出 confidence
   - 输出 timeline/location/relationship/mapping 等 issues（含 severity/confidence/evidence/suggestions）
   - 落盘：
     - 写入 `volumes/vol-{V:02d}/continuity-report.json`
     - 同步写入/覆盖 `logs/continuity/latest.json`（供后续 `/novel:continue` 注入 QualityJudge LS-001）
3. 写入 `volumes/vol-{V:02d}/review.md`（在回顾中增加“一致性报告摘要”小节：issues_total、high 严重级列表、LS-001 风险提示）
4. State 清理（每卷结束时，`docs/dr-workflow/novel-writer-tool/final/prd/08-orchestrator.md` §8.5；生成清理报告供用户确认）：
   - Read `state/current-state.json`（如存在）
   - Read `world/rules.json`（如存在；用于辅助判断"持久化属性"vs"临时条目"；缺失时该判断无法执行，相关条目一律归为候选）
   - Read `characters/retired/*.json`（如存在；若 `characters/retired/` 目录不存在则先创建）并构建 `retired_ids`
   - **确定性安全清理（可直接执行）**：
     - 从 `state/current-state.json.characters` 移除 `retired_ids` 的残留条目
   - **候选清理（默认不自动删除）**：
     - 标记并汇总"过期临时条目"候选，判断规则：
       1. `state/current-state.json.world_state` 中的临时标记（如活动状态、事件标志）：无活跃伏笔引用 AND 无故事线引用 AND 不属于 L1 rules 中定义的持久化属性
       2. `state/current-state.json.characters.{id}` 中的临时属性（如 inventory 中的一次性物品、临时 buff）：无伏笔引用 AND 无故事线引用
       3. 不确定的条目一律归为"候选"而非"确定性清理"，由用户决定
   - 在 `volumes/vol-{V:02d}/review.md` 追加 "State Cleanup" 段落：已清理项 + 候选项 + 删除理由
   - AskUserQuestion 让用户确认是否应用候选清理（不确定项默认保留）
5. AskUserQuestion 让用户确认"进入下卷规划 / 调整设定 / 导入研究资料"
6. 确认进入下卷规划后更新 `.checkpoint.json`：`current_volume += 1, orchestrator_state = "VOL_PLANNING"`（其余字段保持；`pipeline_stage=null`, `inflight_chapter=null`）
