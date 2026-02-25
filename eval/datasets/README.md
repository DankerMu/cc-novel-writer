# Datasets

本目录存放**人工标注**的评估数据集（JSONL）。每章一行，便于 diff/增量维护。

## 命名与版本

建议结构：

```
eval/datasets/<dataset_id>/v<schema_version>/
  labels-YYYY-MM-DD.jsonl
  README.md
```

- `dataset_id`：数据集标识（如 `m2-30ch` 表示基于 M2 产出的 30 章工程目录）
- `schema_version`：与 `eval/schema/labeled-chapter.schema.json.schema_version` 对齐（当前为 `1`）
- 文件名必须包含日期（`YYYY-MM-DD`），用于追踪“哪一批标注/修订”

## 最小字段要求

每行 JSON object **必须**包含：

- `schema_version`（int，当前为 1）
- `chapter`（int）
- `labels`（object）
  - `continuity_errors`（list）
  - `spec_violations`（list）
  - `storyline_issues`（list）
- `human_scores`（object）
  - `overall`（number，1.0-5.0）

详见：
- `eval/schema/labeled-chapter.schema.json`
- `eval/labeling-guide.md`

