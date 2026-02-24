# 质量回顾

1. 使用 Glob + Read 收集近 10 章数据（按章节号排序取最新）：
   质量评估数据：
   - `evaluations/chapter-*-eval.json`（overall_final + contract_verification + gate metadata 如有）
   - `logs/chapter-*-log.json`（gate_decision/revisions/force_passed + key chapter judges 如有）
   一致性检查数据（Step 2 使用）：
   - `chapters/chapter-*.md`（一致性检查需要；只取最近 10 章）
   - `summaries/chapter-*-summary.md`（用于交叉验证与降级）
   - `volumes/vol-{V:02d}/chapter-contracts/chapter-*.json`（如存在：用于解析 concurrent_state 做 LS-001 对齐）
   - `storylines/storyline-spec.json` 与 `volumes/vol-{V:02d}/storyline-schedule.json`（如存在）
   - `characters/active/*.json` + `state/current-state.json`（display_name ↔ slug 映射核对）
   风格与黑名单（Step 3 使用）：
   - `style-drift.json`（如存在：active + drifts + detected_chapter）
   - `ai-blacklist.json`（version/last_updated/words/whitelist/update_log）
   - `style-profile.json`（preferred_expressions；用于解释黑名单豁免）
2. **一致性检查（NER，周期性每 10 章）**：
   - 章节范围：`[max(1, last_completed_chapter-9), last_completed_chapter]`
   - 实体抽取（优先确定性脚本，失败回退 LLM）：
     - 若存在 `${CLAUDE_PLUGIN_ROOT}/scripts/run-ner.sh`：
       - 逐章执行：`bash ${CLAUDE_PLUGIN_ROOT}/scripts/run-ner.sh chapters/chapter-{C:03d}.md`
       - stdout 必须为合法 JSON（schema 见 `skills/continue/references/continuity-checks.md`）；失败则记录原因并回退
     - 否则 / 脚本失败：基于 `summaries/`（必要时回看 `chapters/`）按同一 schema 抽取 entities，并为每类实体输出 `confidence`
   - 一致性规则（输出 issues，带 severity/confidence/evidence/suggestions）：
     - 角色一致性：display_name ↔ slug_id 映射冲突；state/档案 display_name 不一致；关系值单章剧烈跳变（仅标记，需 evidence）
     - 空间一致性：同一 time_marker 下同一角色出现在多个地点（高置信需同时具备 time_marker + 角色 + 地点的证据片段）
     - 时间线一致性（LS-001 hard 输入）：跨故事线并发状态（concurrent_state）与 time_marker/事件顺序矛盾（按 `timeline_contradiction` issue 输出）
   - 报告落盘（回归友好）：
     - 写入 `logs/continuity/continuity-report-vol-{V:02d}-ch{start:03d}-ch{end:03d}.json`
     - 同步写入/覆盖 `logs/continuity/latest.json`（供 `/novel:continue` 注入 QualityJudge LS-001 使用）
3. 生成质量报告（简洁但可追溯）：
   - 均分与趋势：近 10 章均分 vs 全局均分
   - 低分章节列表：overall_final < 3.5（按分数升序列出，展示 gate_decision + revisions）
   - 强制修订统计：revisions > 0 的章节占比；并区分原因：
     - `Spec/LS high-confidence violation`（contract_verification 中任一 violation 且 confidence="high"）
     - `score 3.0-3.4`（无 high-confidence violation 但 overall 落入区间）
   - force pass：force_passed=true 的章节列表（提示"已达修订上限后强制通过"）
   - 关键章双裁判：存在 secondary judge 的章节，展示 primary/secondary/overall_final（取 min）与使用的裁判（used）
   - 一致性检查简报（来自 `logs/continuity/latest.json`）：
     - issues_total + 按 severity 分布
     - 高严重级（severity=high）的前 3 条（含 evidence 与建议）
     - 若存在 `timeline_contradiction` 且 confidence=high：提示“可能触发 LS-001 hard”，建议优先修正或在后续章节补锚点
   - 风格漂移（每 5 章检测）：
     - 若 `style-drift.json.active=true`：展示 detected_chapter/window + drifts[].directive，并提示"后续章节会自动注入纠偏指令"
     - 否则：展示"未启用纠偏 / 已回归基线并清除"
   - AI 黑名单维护：
     - 展示 `ai-blacklist.json` 的 version/last_updated/words_count/whitelist_count
     - 若存在 `update_log[]`：展示最近 3 条变更摘要（added/exempted/removed），提醒用户可手动编辑 words/whitelist
4. 检查伏笔状态（Read `foreshadowing/global.json`）：未回收伏笔数量 + 超期（>10章）条目
5. 输出建议动作（不强制）：
   - 对低分/高风险章节：建议用户"回看/手动修订/接受并继续"
   - 若存在多章连续低分：建议先暂停写作，回到"更新设定/调整方向"
