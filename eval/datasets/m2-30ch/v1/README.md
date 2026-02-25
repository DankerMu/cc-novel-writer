# m2-30ch (v1)

用于 Milestone 3 的 30 章人工标注校准集（基于某个 M2 产出项目目录的章节集合）。

## 文件

- `labels-2026-02-25.template.jsonl`：试标注模板（10 章，占位 + 空 labels），用于跑通工具链

## 下一步

1. 复制模板为新的日期文件并开始标注（目标 30 章）：

```
cp eval/datasets/m2-30ch/v1/labels-2026-02-25.template.jsonl eval/datasets/m2-30ch/v1/labels-YYYY-MM-DD.jsonl
```

2. 运行校准：

```
bash scripts/calibrate-quality-judge.sh --project <novel_project_dir> --labels eval/datasets/m2-30ch/v1/labels-YYYY-MM-DD.jsonl
```

3. 运行回归：

```
bash scripts/run-regression.sh --project <novel_project_dir> --labels eval/datasets/m2-30ch/v1/labels-YYYY-MM-DD.jsonl
```

