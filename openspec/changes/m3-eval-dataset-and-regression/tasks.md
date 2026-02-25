## 1. Dataset Schema & Labeling Guide

- [x] 1.1 定义 30 章标注 schema（continuity/spec/storyline/human_scores）
- [x] 1.2 输出标注指南：错误类型枚举、标注粒度、示例（先 10 章试标注）
- [x] 1.3 定义数据存储位置与命名（jsonl + 版本号/日期）

## 2. Calibration

- [x] 2.1 读取标注集与 QualityJudge 输出对齐（按 chapter 编号匹配）
- [x] 2.2 计算 Pearson 相关系数（overall 与可选维度）并生成校准报告
- [x] 2.3 输出阈值调整建议（不自动修改配置），并记录建议依据

## 3. Regression Runner & Reports

- [x] 3.1 定义回归输入：M2 产出项目目录（30 章）+ 检查开关/阈值
- [x] 3.2 生成 Spec+LS 合规率统计（违规章数、rule 分布、confidence 分布）
- [x] 3.3 汇总 NER/伏笔/风格等检查结果（如存在）并输出结构化报告（JSON/Markdown）

## 4. Archiving & Comparison

- [x] 4.1 回归 run 存档：timestamp + config snapshot + summary metrics
- [x] 4.2 提供对比输出：同一数据集上不同 run 的指标差异摘要

## References

- `docs/dr-workflow/novel-writer-tool/final/milestones.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/11-appendix.md`
- `docs/dr-workflow/novel-writer-tool/final/spec/agents/quality-judge.md`
