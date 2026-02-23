## Why

M4 的验收需要“真实规模”验证：3 卷 / 100 章、至少 3 条故事线交织与交汇事件，且 Spec+LS 合规率与一致性错误指标满足目标。同时，冷启动恢复与 context 组装性能决定了日更体验。需要一个可重复的端到端基准与性能度量方案，避免只在小样本上“看起来可用”。

## What Changes

- 端到端基准方案：定义 3 卷 / 100 章的运行方式、输入配置与验收指标输出
- 指标汇总报告：Spec+LS 合规率、NER/一致性错误计数、伏笔回收率、交汇事件达成率、均分与修订次数
- 性能度量：冷启动恢复时间、context 组装耗时、各 pipeline stage 耗时（来自 logs）
- 可选扩展路径：当确定性脚本增多时，提供 MCP 包装的启用准则（不作为硬依赖）

## Capabilities

### New Capabilities

- `e2e-benchmark-and-performance`: 端到端基准/报告与性能度量、可选 MCP 包装演进路径。

### Modified Capabilities

- (none)

## Impact

- 影响范围：测试/基准执行方式、报告产物、日志字段的使用规范、性能目标与优化优先级
- 依赖关系：依赖 logs、evaluations、storylines schedule、foreshadowing/global 等结构化输出
- 兼容性：以测试与度量为主，不改变用户写作主流程（可作为维护/开发工具）

## Milestone Mapping

- Milestone 4: 4.4（3 卷 100 章端到端测试）、4.5（性能优化：冷启动速度、context 组装效率）。参见 `docs/dr-workflow/novel-writer-tool/final/milestones.md`。

## References

- `docs/dr-workflow/novel-writer-tool/final/milestones.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/11-appendix.md`（成功指标与性能指标）
- `docs/dr-workflow/novel-writer-tool/final/prd/08-orchestrator.md`（冷启动原则）
- `docs/dr-workflow/novel-writer-tool/final/spec/06-extensions.md`（MCP 可选路径）

