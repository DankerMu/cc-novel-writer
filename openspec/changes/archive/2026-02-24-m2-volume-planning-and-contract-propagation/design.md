## Context

PlotArchitect 是卷级规划的单一责任者。其输出必须满足两个目标：
1) 人类可读（作者能审核与调整）
2) 机器可解析（入口 Skill 可按正则提取单章区块与派生契约，避免自由散文导致断链）

此外，Spec-Driven Writing 要求变更可追溯：规则变更必须能定位影响范围并触发重生成/审核。

## Goals / Non-Goals

**Goals:**
- 固化 outline.md 的确定性格式（每章一个 `###` 区块 + 固定 key 行）
- 固化 L3 chapter-contract 的 JSON schema（含 storylines 扩展字段）
- 固化 `new-characters.json` 的生成逻辑与入口 Skill 的消费方式
- 定义并实现 Spec 变更传播的“标记与再生成”策略（而非 silent overwrite）

**Non-Goals:**
- 不实现 NER 驱动的实体校验（M3）
- 不实现多卷跨卷的全局优化算法（只需能规划下一卷）

## Decisions

1. **outline.md 采用严格 key-value 行**
   - 每章以 `### 第 {C} 章` 开头（可选后接 `:`/`：` + 标题），并跟随 7-8 行 `- **Key**:`。
   - 入口 Skill 使用正则定位并提取，保证章节级 context 可构建。

2. **L3 契约批量生成**
   - PlotArchitect 在卷规划时一次性生成本卷所有章节的契约文件，保证写作循环中可稳定读取。

3. **变更传播以“影响标记”为主**
   - 当 L1 规则变更或角色契约变更发生时，不强制自动覆盖全部后续契约；先标记受影响范围并在卷规划/质量回顾时提示审核与重生成。

## Risks / Trade-offs

- [Risk] 严格格式降低 PlotArchitect 创作自由度 → Mitigation：格式约束只作用于结构化 key 行，正文叙述仍可自由；且带来可解析性收益。
- [Risk] 契约生成与大纲偏离 → Mitigation：用户审核点必须显示“契约摘要”（至少 objectives），允许修改后再生成。

## References

- `docs/dr-workflow/novel-writer-tool/final/spec/agents/plot-architect.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/05-spec-system.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/06-storylines.md`
