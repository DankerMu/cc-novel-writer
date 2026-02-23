## 1. Benchmark Definition

- [ ] 1.1 定义基准项目输入（brief/样本/模板/storylines/outline）与固定配置快照
- [ ] 1.2 定义 3 卷/100 章运行步骤与可复现约束（模型、阈值、开关）
- [ ] 1.3 定义验收指标清单与计算口径（合规率/一致性错误/交汇达成/伏笔回收）

## 2. Report Generation

- [ ] 2.1 汇总 `evaluations/` 输出 Spec+LS 合规率与违反分布
- [ ] 2.2 汇总 `logs/` 输出修订次数、gate 决策分布、各阶段耗时
- [ ] 2.3 生成基准报告（Markdown/JSON）并存档（timestamp + config snapshot）

## 3. Performance Targets

- [ ] 3.1 冷启动恢复计时：从启动到下一步推荐（目标 <30s）
- [ ] 3.2 context 组装耗时度量：按 agent 类型聚合并输出热点
- [ ] 3.3 优化清单输出（不实现）：明确优先级（IO/cache/裁剪）

## 4. Optional MCP Path

- [ ] 4.1 定义 MCP 启用准则（脚本 ≥3 且调用频繁）与切换策略
- [ ] 4.2 基准执行不依赖 MCP：无 MCP 时仍可跑通并产出同口径报告

## References

- `docs/dr-workflow/novel-writer-tool/final/milestones.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/11-appendix.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/06-extensions.md`

