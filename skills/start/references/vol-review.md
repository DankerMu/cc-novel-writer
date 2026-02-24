# 卷末回顾

1. 收集本卷 `evaluations/`、`summaries/`、`foreshadowing/global.json`、`storylines/`，生成本卷回顾要点（质量趋势、低分章节、未回收伏笔、故事线节奏）
2. 写入 `volumes/vol-{V:02d}/review.md`
3. State 清理（每卷结束时，`docs/prd/08-orchestrator.md` §8.5；生成清理报告供用户确认）：
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
4. AskUserQuestion 让用户确认"进入下卷规划 / 调整设定 / 导入研究资料"
5. 确认进入下卷规划后更新 `.checkpoint.json`：`current_volume += 1, orchestrator_state = "VOL_PLANNING"`（其余字段保持；`pipeline_stage=null`, `inflight_chapter=null`）
