## 1. State Machine Definition

- [ ] 1.1 固化状态枚举与转移表（INIT/QUICK_START/VOL_PLANNING/WRITING/CHAPTER_REWRITE/VOL_REVIEW/ERROR_RETRY）
- [ ] 1.2 固化 Skill→状态映射：`/novel:start` 覆盖 INIT/QUICK_START/VOL_PLANNING/VOL_REVIEW；`/novel:continue` 覆盖 WRITING/CHAPTER_REWRITE

## 2. Checkpoint Updates

- [ ] 2.1 定义 checkpoint 写入时机（commit 成功/卷规划确认/卷末回顾完成/错误重试）
- [ ] 2.2 定义错误处理状态：ERROR_RETRY 的重试次数与失败后暂停策略

## 3. Cold-start Recovery

- [ ] 3.1 定义冷启动恢复读取集合：`.checkpoint.json`、`state/current-state.json`、近 3 章 `summaries/`、当前卷 `outline.md`
- [ ] 3.2 定义缺文件时的降级策略与用户提示（例如缺 outline → 强制回到 VOL_PLANNING）
- [ ] 3.3 定义 `pipeline_stage != committed` 的恢复入口（与 staging/ 文件存在性联动，依赖 M1 流水线契约）

## 4. Review & Routing

- [ ] 4.1 定义质量回顾触发（每 5 章输出简报；用户可选继续/回看/调整方向）
- [ ] 4.2 定义卷末回顾触发与完成后的状态转移（VOL_REVIEW → VOL_PLANNING）
- [ ] 4.3 `/novel:start` 增加“导入研究资料”路由入口（具体扫描/复制逻辑见 spec/02-skills）

## 5. Integration Test Plan

- [ ] 5.1 定义 1 卷 30 章的端到端验收脚本/步骤（含至少 2 条故事线交织）

## References

- `docs/dr-workflow/novel-writer-tool/final/prd/08-orchestrator.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/04-workflow.md`
- `docs/dr-workflow/novel-writer-tool/final/milestones.md`

