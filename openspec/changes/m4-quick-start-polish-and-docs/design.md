## Context

快速起步是 M4 的“第一性体验”：用户不需要先读完所有 Spec，只要输入题材/主角/冲突与少量样本，就能立刻得到可继续写作的项目结构与 3 章试写结果。此阶段同时要兼容无样本的降级路径（reference/template/先写后提）。

## Goals / Non-Goals

**Goals:**
- 30 分钟内跑通：设定 → 风格提取 → 试写 3 章 → 用户确认
- 默认最小化：storylines 初始化仅 1 条主线（main_arc），后续卷规划逐步扩展
- 中断可恢复：基于 `.checkpoint.json` 与目录结构能继续完成 quick start
- 文档可执行：用户按文档即可完成常见操作（继续写、规划新卷、质量回顾、按需更新）

**Non-Goals:**
- 不在 M4 把所有高级功能塞进 quick start（例如完整多线体系初始化）
- 不强制一次 quick start 覆盖所有世界/角色细节（以可写为先）

## Decisions

1. **交互轮次受控**
   - `/novel:start` 在 QUICK_START 阶段遵循 2-4 选项限制；
   - 单次流程尽量 ≤5 次问答，避免“问卷式”体验。

2. **默认输出对齐工作流**
   - WorldBuilder 轻量模式只输出 ≤3 条核心规则；
   - WorldBuilder 协助初始化最小 storylines.json（1 条 main_arc）；
   - StyleAnalyzer 产出 style-profile（含 writing_directives）后再试写 3 章。

3. **清晰的下一步提示**
   - 试写完成后给出：继续进入 VOL_PLANNING / 调整风格 / 重来 的明确选项；
   - `status` 展示“当前阶段 + 下一步建议”，减少用户记忆负担。

## Docs Deliverable (Proposed)

- `docs/user/quick-start.md`: 30 分钟跑通指南（含示例命令与常见错误）
- `docs/user/ops.md`: 常用操作（继续写、规划新卷、质量回顾、导入 research）
- `docs/user/spec-system.md`: L1/L2/L3/LS 体系与门控解释
- `docs/user/storylines.md`: 多线叙事与 schedule/convergence 的使用说明

> 文档内容以 `docs/dr-workflow/novel-writer-tool/final/` 为准，面向用户做“可执行重述”而不是再发明规则。

## Risks / Trade-offs

- [Risk] quick start 过于简化导致后续大纲难对齐 → Mitigation：明确“最小可写”，并在进入 VOL_PLANNING 时补充卷级大纲与契约
- [Risk] 无样本降级导致风格不稳定 → Mitigation：文档明确三种降级路径并提示用户尽早补样本

## References

- `docs/dr-workflow/novel-writer-tool/final/prd/04-workflow.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/01-product.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/09-data.md`

