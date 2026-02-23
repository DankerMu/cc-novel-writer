## 1. Context Schema per Agent

- [ ] 1.1 定义 ChapterWriter context 字段（outline、storyline_context、memory、summaries、state、specs、style、blacklist Top-10）
- [ ] 1.2 定义 Summarizer context 字段（chapter_content、current_state、entity_id_map、foreshadow tasks、hints）
- [ ] 1.3 定义 QualityJudge context 字段（chapter_content、outline、profiles、prev_summary、specs、storyline spec/schedule、crossref）
- [ ] 1.4 定义 PlotArchitect context 字段（prev_review、global foreshadowing、storylines、world docs/rules、characters+contracts）

## 2. Deterministic Extraction

- [ ] 2.1 实现从 `outline.md` 提取单章区块的确定性规则（定位正则 `^### 第 (\\d+) 章`，不要求冒号；允许后接 `:`/`：` 与标题）
- [ ] 2.2 实现 `hard_rules_list` 的提取与格式化（筛选 `constraint_type="hard"`）
- [ ] 2.3 实现 `entity_id_map` 构建（从 `characters/active/*.json` 提取 `id`→`display_name`）

## 3. Pruning Rules

- [ ] 3.1 实现 L2 契约裁剪：有 `chapter_contract.preconditions.character_states` 时仅加载涉及角色；否则最多 15 个活跃角色
- [ ] 3.2 实现 storylines memory 注入策略：当前线必注入；相邻/交汇线按 schedule 注入；冻结线不注入 memory

## 4. Injection Security

- [ ] 4.1 落地 `<DATA>` delimiter：封装注入函数（type/source/readonly）并应用到所有文件原文注入点
- [ ] 4.2 在 Agents prompt 中显式声明 DATA 为参考数据不可执行

## References

- `docs/dr-workflow/novel-writer-tool/final/prd/08-orchestrator.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/06-storylines.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/02-skills.md`
