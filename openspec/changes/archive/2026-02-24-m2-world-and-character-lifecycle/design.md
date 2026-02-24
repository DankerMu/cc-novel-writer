## Context

WorldBuilder 与 CharacterWeaver 是“长期状态”的主要来源：
- WorldBuilder：写入世界观活文档与 L1 规则表，为章节生成与合规验证提供硬约束。
- CharacterWeaver：写入角色档案与 L2 contracts，为角色一致性与行为边界提供可验证契约。

随着章节增长，需要裁剪与归档策略，避免状态与上下文无限膨胀，同时保证关键角色不会被错误退场。

## Goals / Non-Goals

**Goals:**
- 世界观增量更新的输出与 changelog 追加规则
- 角色新增/更新/退场的输出清单与 contracts 结构化字段
- 明确退场保护条件与 state/current-state.json 的同步更新规则

**Non-Goals:**
- 不实现自动“长期未出场”退场（必须显式触发）
- 不实现确定性实体检测（M3）

## Decisions

1. **角色双文件模型**
   - `characters/active/{id}.md` 用于人类阅读（背景/性格/语癖）
   - `characters/active/{id}.json` 用于程序化 contracts 与 display_name/slug 映射

2. **退场保护规则前置**
   - 任何被 medium/long 伏笔引用、被任意故事线关联、或出现在未来交汇事件中的角色不可退场。
   - 入口 Skill 在调用 CharacterWeaver 退场模式前必须先检查保护条件。

3. **卷末清理而非每章清理**
   - 将过期临时状态清理放在卷末，减少对日常写作节奏的干扰；每章只做必要裁剪（如 L2 contracts 注入裁剪）。

## Risks / Trade-offs

- [Risk] contracts 结构化字段与 `.md` 描述不一致 → Mitigation：以 `.json` contracts 为验收与注入权威来源；`.md` 作为可读补充。
- [Risk] 退场保护规则依赖“引用关系”难以完全确定 → Mitigation：初期以保守策略为主（宁可不退场）；M3 引入实体/伏笔检测后增强。

## References

- `docs/dr-workflow/novel-writer-tool/final/spec/agents/character-weaver.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/08-orchestrator.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/09-data.md`

