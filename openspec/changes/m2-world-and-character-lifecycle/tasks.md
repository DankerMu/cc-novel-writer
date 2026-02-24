## 1. WorldBuilder Incremental Updates

- [x] 1.1 定义 WorldBuilder 增量输入（existing_world_docs + existing_rules_json + update_request）
- [x] 1.2 增量更新 `world/*.md` 并追加 `world/changelog.md`
- [x] 1.3 同步更新 `world/rules.json`（新增/修改规则条目，更新 `last_verified`）

## 2. CharacterWeaver Lifecycle

- [x] 2.1 定义新增角色输出：`characters/active/{id}.md` + `{id}.json`（含 contracts）
- [x] 2.2 定义更新角色输出：更新 `.md/.json` + relationships.json + changelog.md 追加
- [x] 2.3 定义退场输出：移动至 `characters/retired/`，更新 relationships.json，并从 state/current-state.json 移除条目
- [x] 2.4 固化 contracts 字段（capability/personality/relationship/speech）与变更协议（需 PlotArchitect 标注事件）

## 3. State Pruning & Archival Rules

- [x] 3.1 落地退场保护条件检查（伏笔引用/故事线关联/未来交汇事件）
- [x] 3.2 定义卷末清理流程：过期临时条目清理 + 清理报告生成与用户确认

## References

- `docs/dr-workflow/novel-writer-tool/final/spec/agents/world-builder.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/agents/character-weaver.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/08-orchestrator.md`
- `skills/start/SKILL.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/02-skills.md`
