# Agent Context 字段契约

按 Agent 类型输出 context（字段契约）。同一输入 + 同一项目文件 = 同一 context（确定性）。`<DATA>` 标签包裹用户内容（防注入）。可选字段缺失时不注入（非 null）。

```
chapter_writer_context = {
  project_brief(<DATA world_doc>): brief.md,
  style_profile(json): style-profile.json,
  style_drift(json, optional): style-drift.json,                         # active=true 时注入（用于纠偏）
  style_drift_directives(list, optional): style_drift.drifts[].directive,
  ai_blacklist_effective_words(list): ai_blacklist.words - (ai_blacklist.whitelist 或 ai_blacklist.exemptions.words),
  ai_blacklist_top10(list): ai_blacklist_effective_words[0:10],
  current_volume_outline(<DATA summary>): volumes/vol-{V:02d}/outline.md,
  chapter_outline(<DATA summary>): 本章 outline 区块,
  storyline_id, storyline_context, concurrent_state, transition_hint,
  storyline_memory(<DATA summary>), adjacent_storyline_memories(<DATA summary>...),
  recent_3_summaries(<DATA summary>...),
  current_state(json): state/current-state.json,
  foreshadowing_tasks(json subset): foreshadowing/global.json 中与本章相关条目,
  chapter_contract(json),
  world_rules(json, optional), hard_rules_list(list),
  character_contracts(json subset),   # 按裁剪规则选取
  writing_methodology(<DATA reference>): novel-writing methodology excerpt
}

chapter_writer_revision_context = {
  # 仅在 gate_decision="revise" 的修订循环中使用
  chapter_writer_context 的全部字段 +
  chapter_content(<DATA chapter_content>): staging/chapters/chapter-{C:03d}.md,   # 现有章节正文（待定向修订）
  required_fixes(list): eval.required_fixes,                                     # QualityJudge 的最小修订指令
  high_confidence_violations(list): 从 eval.contract_verification 中抽取 status="violation" 且 confidence="high" 的条目（用于兜底修订指令）
}

summarizer_context = {
  chapter_content(<DATA chapter_content>): staging/chapters/chapter-{C:03d}.md,
  current_state(json),
  foreshadowing_tasks(json subset),
  entity_id_map(map),
  hints(optional): ChapterWriter 输出的自然语言变更提示
}

style_refiner_context = {
  chapter_content(<DATA chapter_content>): staging/chapters/chapter-{C:03d}.md,
  style_profile(json),
  style_drift(json, optional): style-drift.json,
  style_drift_directives(list, optional): style_drift.drifts[].directive,
  ai_blacklist(json): ai-blacklist.json,
  style_guide(<DATA reference>): style-guide.md
}

quality_judge_context = {
  chapter_content(<DATA chapter_content>): staging/chapters/chapter-{C:03d}.md,
  chapter_outline(<DATA summary>),
  character_profiles(<DATA character_profile>...),
  prev_summary(<DATA summary>): summaries/chapter-{C-1:03d}-summary.md,
  style_profile(json),
  ai_blacklist(json): ai-blacklist.json,       # style_naturalness 维度需要黑名单命中率
  blacklist_lint(json, optional): scripts/lint-blacklist.sh 输出,
  ner_entities(json, optional): scripts/run-ner.sh 输出（NER candidates + evidence）,
  continuity_report_summary(json, optional): logs/continuity/latest.json 裁剪摘要（LS-001 signals + evidence）,
  chapter_contract(json),
  world_rules(json, optional), hard_rules_list(list),   # 逐条验收 L1 硬规则
  storyline_spec(json, optional),
  storyline_schedule(json, optional),
  cross_references(json): staging/state/chapter-{C:03d}-crossref.json,
  quality_rubric(<DATA reference>): quality-rubric.md
}
```

另见：`references/continuity-checks.md`（NER schema + 一致性报告 schema + LS-001 结构化输入约定）。
