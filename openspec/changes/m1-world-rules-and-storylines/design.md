## Context

世界观与故事线属于“小说级基础设施”：
- 世界观：叙述性文档便于作者阅读与增量维护；结构化规则表便于自动验收（QualityJudge）与禁止项注入（ChapterWriter）。
- 故事线：在小说尺度上定义与持久化，卷级调度与章级上下文均以其为基础。

本 change 将 L1 与 storylines 的数据结构在 M1 固化，避免后续实现出现 schema 漂移。

## Goals / Non-Goals

**Goals:**
- WorldBuilder 初始化/增量输出：`world/*.md` + `world/rules.json` + `world/changelog.md`
- 初始化生成 `storylines/storylines.json`：最小 1 条主线 + 完整 `storyline_types`
- 固化“每条线一个 memory.md（≤500 字关键事实）”的落点与写入边界（写入由 Summarizer 负责，commit 由入口 Skill 负责）

**Non-Goals:**
- 不实现 LS 规则（`storylines/storyline-spec.json`）的具体条目与强制校验（M2）
- 不实现 PlotArchitect 的卷级调度与交汇事件规划（M2）

## Decisions

1. **L1 规则以 JSON 结构化存储**
   - 规则对象包含 `id/category/rule/constraint_type` 等字段，便于逐条验证与追踪引入/验证章节。

2. **storylines 以 slug id 作为稳定键**
   - 角色/故事线/伏笔等实体统一使用 slug ID，避免中文名在 ops path 中引入歧义与变更成本。

3. **line memory 限长且独立**
   - `storylines/{id}/memory.md` 用于控制上下文大小与防串线；每章仅保留该线关键事实（≤500 字）。

## Risks / Trade-offs

- [Risk] WorldBuilder 抽取规则不准确导致误拦截/漏拦截 → Mitigation：L1 初始由用户审核确认；QualityJudge 在 Track 1 输出 confidence 供门控使用。
- [Risk] storylines 类型过多导致复杂度上升 → Mitigation：M1 只要求最小主线 + 类型列表；活跃线数量约束与调度策略在 M2 引入。

## References

- `docs/dr-workflow/novel-writer-tool/final/prd/05-spec-system.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/06-storylines.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/agents/world-builder.md`

