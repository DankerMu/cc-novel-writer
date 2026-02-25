# Evaluation & Regression (M3)

本目录用于支持 Milestone 3 的“可测量、可回归”的质量保证迭代方式（**不影响日常写作流程**）：

- 人工标注评估数据集（30 章）
- QualityJudge 与人工评分的校准（Pearson 相关性、误差分布、阈值建议）
- 回归运行与报告（Spec+LS 合规率、NER/伏笔/风格等检查汇总）
- 回归 run 的存档与对比

## 目录约定

```
eval/
  datasets/               # 人工标注数据集（JSONL）
  schema/                 # JSON schema（用于文档与工具校验）
  runs/                   # 回归运行输出（默认输出位置，可改）
```

## 入口脚本（repo root 下）

- `scripts/calibrate-quality-judge.sh`：对齐标注集与 QualityJudge 输出，生成校准报告
- `scripts/run-regression.sh`：对一个项目目录生成回归报告并归档
- `scripts/compare-regression-runs.sh`：对比两个归档 run 的 summary 指标差异

