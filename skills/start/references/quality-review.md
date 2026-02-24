# 质量回顾

1. 使用 Glob + Read 收集近 10 章数据（按章节号排序取最新）：
   - `evaluations/chapter-*-eval.json`（overall_final + contract_verification + gate metadata 如有）
   - `logs/chapter-*-log.json`（gate_decision/revisions/force_passed + key chapter judges 如有）
   - `style-drift.json`（如存在：active + drifts + detected_chapter）
   - `ai-blacklist.json`（version/last_updated/words/whitelist/update_log）
   - `style-profile.json`（preferred_expressions；用于解释黑名单豁免）
2. 生成质量报告（简洁但可追溯）：
   - 均分与趋势：近 10 章均分 vs 全局均分
   - 低分章节列表：overall_final < 3.5（按分数升序列出，展示 gate_decision + revisions）
   - 强制修订统计：revisions > 0 的章节占比；并区分原因：
     - `Spec/LS high-confidence violation`（contract_verification 中任一 violation 且 confidence="high"）
     - `score 3.0-3.4`（无 high-confidence violation 但 overall 落入区间）
   - force pass：force_passed=true 的章节列表（提示"已达修订上限后强制通过"）
   - 关键章双裁判：存在 secondary judge 的章节，展示 primary/secondary/overall_final（取 min）与使用的裁判（used）
   - 风格漂移（每 5 章检测）：
     - 若 `style-drift.json.active=true`：展示 detected_chapter/window + drifts[].directive，并提示"后续章节会自动注入纠偏指令"
     - 否则：展示"未启用纠偏 / 已回归基线并清除"
   - AI 黑名单维护：
     - 展示 `ai-blacklist.json` 的 version/last_updated/words_count/whitelist_count
     - 若存在 `update_log[]`：展示最近 3 条变更摘要（added/exempted/removed），提醒用户可手动编辑 words/whitelist
3. 检查伏笔状态（Read `foreshadowing/global.json`）：未回收伏笔数量 + 超期（>10章）条目
4. 输出建议动作（不强制）：
   - 对低分/高风险章节：建议用户"回看/手动修订/接受并继续"
   - 若存在多章连续低分：建议先暂停写作，回到"更新设定/调整方向"
