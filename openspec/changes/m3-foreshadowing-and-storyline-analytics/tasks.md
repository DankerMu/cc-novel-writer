## 1. Global Index & Plan Alignment

- [ ] 1.1 明确 `foreshadowing/global.json` schema（字段、status 流转、history 规则）
- [ ] 1.2 明确 `volumes/vol-{V:02d}/foreshadowing.json` 的计划 schema（新增/延续/目标范围）
- [ ] 1.3 定义 commit 阶段：从 `staging/state/*-delta.json` 提取 `foreshadow` ops 更新 global.json 的合并策略（去重、幂等）

## 2. Bridge Checks

- [ ] 2.1 解析 `storylines/storylines.json.relationships[].bridges.shared_foreshadowing[]` 并校验可追溯性（global 或本卷计划）
- [ ] 2.2 定义“断链”报告格式：缺失 ID + from/to storyline + 建议修复动作

## 3. Rhythm Analytics

- [ ] 3.1 基于 `summaries/*` 的 `storyline_id` 统计出场频率与休眠时长（每卷与全局两种视角）
- [ ] 3.2 基于 `storyline-schedule.json.convergence_events` 统计交汇达成率（范围内是否达成/偏差）
- [ ] 3.3 输出节奏分析报告（Markdown/JSON 二选一）并可在卷末回顾汇总展示

## 4. UX Integration & Extensions

- [ ] 4.1 接入触发点：每 10 章定期检查 + 卷末回顾（通过 `/novel:start` 路由）
- [ ] 4.2 `foreshadowing_tasks` 组装：优先脚本 `scripts/query-foreshadow.sh`，缺失则规则过滤
- [ ] 4.3 `/novel:status` 输出伏笔与故事线摘要（未回收数量、超期 short 伏笔、休眠线提示）

## References

- `docs/dr-workflow/novel-writer-tool/final/prd/04-workflow.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/06-storylines.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/09-data.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/06-extensions.md`

