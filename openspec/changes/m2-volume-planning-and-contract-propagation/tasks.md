## 1. PlotArchitect Outputs

- [ ] 1.1 落地 `agents/plot-architect.md`（输入字段、约束、输出文件清单）
- [ ] 1.2 实现 `volumes/vol-{V:02d}/outline.md` 严格格式（`### 第 N 章:` + 固定 key 行）
- [ ] 1.3 生成 `volumes/vol-{V:02d}/storyline-schedule.json`（active_storylines + interleaving_pattern + convergence_events）
- [ ] 1.4 生成 `volumes/vol-{V:02d}/foreshadowing.json`（新增 + 延续）
- [ ] 1.5 批量生成 `volumes/vol-{V:02d}/chapter-contracts/chapter-{C:03d}.json`
- [ ] 1.6 生成 `volumes/vol-{V:02d}/new-characters.json`，并定义入口 Skill 的消费流程（批量调用 CharacterWeaver）

## 2. Parsing & Consumption

- [ ] 2.1 定义 outline 区块提取规则（按章节号提取至下一个 `###` 或 EOF）
- [ ] 2.2 定义 chapter-contract 与 outline 的一致性校验点（至少：storyline_id、核心 objectives）

## 3. Spec Change Propagation

- [ ] 3.1 定义“世界规则变更 → 受影响角色契约”的影响分析规则（基于 rule_id 引用与自然语言关键字的最小实现）
- [ ] 3.2 定义“角色契约变更 → 受影响章节契约”的影响分析规则（基于 preconditions/objectives 引用）
- [ ] 3.3 定义受影响条目的标记机制（例如写入 review checklist 或 metadata 字段），并在卷规划审核点提示用户

## References

- `docs/dr-workflow/novel-writer-tool/final/spec/agents/plot-architect.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/05-spec-system.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/09-data.md`

