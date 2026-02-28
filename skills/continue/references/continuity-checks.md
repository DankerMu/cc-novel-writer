# NER 与一致性检查（M3）

本文件定义 **NER 实体抽取输出** 与 **一致性报告输出** 的最小 schema，用于：
- `/novel:start` 的「质量回顾 / 卷末回顾」生成可回归的一致性报告；
- `/novel:continue` 在调用 QualityJudge 时提供 LS-001 的结构化输入（摘要 + 证据）；
- 可选确定性工具 `scripts/run-ner.sh` 的 stdout JSON 协议。

## 1) 实体抽取输出 schema（`run-ner.sh` / LLM fallback）

`scripts/run-ner.sh <chapter.md>` stdout JSON（exit 0）**必须**满足：

```json
{
  "schema_version": 1,
  "chapter_path": "chapters/chapter-048.md",
  "entities": {
    "characters": [
      {
        "text": "林枫",
        "slug_id": null,
        "confidence": "high",
        "mentions": [
          {"line": 120, "snippet": "林枫抬头望向幽暗森林深处……"}
        ]
      }
    ],
    "locations": [
      {
        "text": "幽暗森林",
        "confidence": "high",
        "mentions": [
          {"line": 120, "snippet": "林枫抬头望向幽暗森林深处……"}
        ]
      }
    ],
    "time_markers": [
      {
        "text": "第三年冬末",
        "normalized": "第三年冬末",
        "confidence": "high",
        "mentions": [
          {"line": 12, "snippet": "第三年冬末，魔都风雪未歇。"}
        ]
      }
    ],
    "events": [
      {
        "text": "王国内战爆发",
        "confidence": "medium",
        "mentions": [
          {"line": 33, "snippet": "王国内战爆发，边关烽烟四起。"}
        ]
      }
    ]
  }
}
```

字段约定：
- `schema_version`：当前为 `1`。
- `chapter_path`：输入文件路径（原样回显，便于追溯）。
- `entities.characters[].slug_id`：**可选**。`run-ner.sh` 无法可靠映射时可省略；LLM fallback 可以结合 `characters/active/*.json` 与 `state/current-state.json` 补全。
- `confidence`：枚举值为 `"high"` / `"medium"` / `"low"`。
- `mentions[]`：证据片段（建议最多 5 条）；`snippet` 需截断到 ≤160 字符，避免报告膨胀。
- `run-ner.sh` 输出中 `slug_id` 为 `null`（脚本无法可靠映射名字→slug）；LLM fallback 可结合 `characters/active/*.json` 补全。

> 说明：`run-ner.sh` 的目标是 **稳定可回归** 的候选实体与证据，不追求完美 NER；一致性判断由入口 Skill + QualityJudge 的语义校验兜底。

## 2) 一致性报告输出 schema（周期性检查 / 卷末回顾）

一致性报告建议写入 `logs/continuity/`（允许创建子目录，保持历史可追溯），stdout 展示简报即可。

最小 JSON 格式：

```json
{
  "schema_version": 1,
  "generated_at": "2026-02-24T12:00:00Z",
  "scope": "periodic",
  "volume": 2,
  "chapter_range": [39, 48],
  "issues": [
    {
      "id": "location_contradiction:char=lin-feng:time=第三年冬末:loc=魔都|幽暗森林",
      "type": "location_contradiction",
      "severity": "high",
      "confidence": "high",
      "entities": {
        "characters": ["lin-feng"],
        "locations": ["魔都", "幽暗森林"],
        "time_markers": ["第三年冬末"],
        "storylines": ["main-arc"]
      },
      "description": "同一 time_marker 下角色位置出现矛盾或疑似瞬移。",
      "evidence": [
        {"chapter": 47, "source": "chapter", "line": 12, "snippet": "第三年冬末，林枫仍在魔都……"},
        {"chapter": 48, "source": "chapter", "line": 120, "snippet": "林枫抬头望向幽暗森林深处……"}
      ],
      "suggestions": [
        "确认时间标尺是否应推进（例如从'第三年冬末'推进到'翌日清晨'）。",
        "若确为跨地移动，补一段赶路/传送的因果说明。"
      ]
    }
  ],
  "stats": {
    "chapters_checked": 10,
    "issues_total": 3,
    "issues_by_severity": {"high": 1, "medium": 1, "low": 1}
  }
}
```

字段约定：
- `type`：枚举值为 `"character_mapping"` / `"relationship_jump"` / `"location_contradiction"` / `"timeline_contradiction"`。
- `severity`：枚举值为 `"high"` / `"medium"` / `"low"`。
- `confidence`：枚举值为 `"high"` / `"medium"` / `"low"`。

稳定性（回归友好）要求：
- `issues[].id` 必须可由 **type + 关键实体 + time_marker** 确定性生成（同批次重复运行应保持一致）。
- `issues` 输出顺序：`severity (high→low)` → `type` → `id`。

### Issue 类型说明（最小集合）

- `character_mapping`：同一 `display_name` 映射到多个 slug，或 state/档案 display_name 不一致。
- `relationship_jump`：关系值单章剧烈变化（例如从 80 跳到 -50），或出现互相矛盾的关系描述（需给 evidence）。
- `location_contradiction`：同一 time_marker 下角色在多个地点（高置信要求提供明确 time_marker + 角色 + 地点证据）。
- `timeline_contradiction`：跨故事线并发状态（concurrent_state）与本章 time_marker/事件顺序矛盾（用于 LS-001 输入）。

## 3) 检测规则建议（实现导向）

本节提供"最小但不乱报"的实现建议，避免检查逻辑断链。你可以更严格，但不得牺牲可用性（误报过多会导致用户疲劳）。

### 3.1 角色一致性（`character_mapping` / `relationship_jump`）

- **display_name ↔ slug 映射冲突**（高优先级）：
  - 基于 `characters/active/*.json.display_name` + `state/current-state.json.characters.{id}.display_name` 构建 `display_name -> [slug_id...]`；
  - 若同一 `display_name` 映射到多个 slug → `character_mapping`（severity=high, confidence=high）。
- **state/档案 display_name 不一致**：
  - 若 `characters/active/{id}.json.display_name != state/current-state.json.characters.{id}.display_name` → `character_mapping`（severity=medium, confidence=high）。
- **关系值剧烈跳变（仅标记，不直接 hard gate）**：
  - 从 `state/changelog.jsonl` 中筛选章节范围内、且 path 匹配 `characters.{id}.relationships.{other}` 的 ops；
  - 若单章 `set` 发生**符号翻转**（例如 80 → -10）或 `inc` 的绝对值 ≥ 60 → `relationship_jump`（severity=medium, confidence=medium）；
  - evidence：至少提供 1 条 changelog 证据（或章节片段）说明变化发生的章节与上下文。

### 3.2 空间一致性（`location_contradiction`）

- 为每章生成 `primary_time_marker`（优先 `confidence=high` 的 time_marker；缺失则降级为 medium；仍无则置空）。
- 从 NER `mentions` 中提取"共现证据"：
  - 将同一行 snippet 里同时出现的 **角色名 + 地点名** 视为一个候选"位置事实"（fact），并附带该行的 time_marker（若该行或本章存在）。
- **高置信矛盾**（满足才输出 severity=high）：
  - 同一角色，在相同 `primary_time_marker`（精确文本相等）下，出现两个不同地点事实（地点 text 不同），且两侧均有明确 evidence（含行号/片段）。
- **中低置信提示**：
  - time_marker 缺失但 1-2 章窗口内位置多次跳变 → severity=low/medium（用于提醒，避免误判"正常赶路"）。

### 3.3 时间线一致性（`timeline_contradiction`，对齐 LS-001 hard 输入）

优先使用 L3 契约的并发状态（`volumes/vol-{V:02d}/chapter-contracts/chapter-{C:03d}.json.storyline_context.concurrent_state`）：

- 尝试从 concurrent_state 文本中解析章节号（常见格式：`（ch25）` / `(ch25)`），regex：`/[（(]\s*ch\s*(\d+)\s*[）)]/i`。
- 为"当前章"与"并发线引用章"分别取 `primary_time_marker`（来自各自章节的 NER time_markers）。
- **矛盾判定**（保守）：
  - 若双方都为高置信 time_marker，且包含明确的"年/季节"差异（例如 `第三年冬` vs `第三年夏`）→ `timeline_contradiction`（severity=high, confidence=high）
  - 若仅相对时间词（次日/当晚）或缺失 → 降级为 medium/low（提示，不应直接硬阻断）

## 4) 提供给 QualityJudge 的结构化输入（LS-001）

入口 Skill 在调用 QualityJudge 前，应将"一致性报告中与当前章相关的 timeline/location issues"裁剪为小体积摘要注入：

```json
{
  "ls_001_signals": [
    {
      "issue_id": "timeline_contradiction:storylines=jiangwang-dao|jinghai-plan:time=第三年冬末",
      "confidence": "high",
      "evidence": [{"chapter": 48, "snippet": "……"}],
      "suggestion": "补齐并发线的时空锚点，或调整事件发生顺序。"
    }
  ]
}
```

> 约束：仅 `confidence="high"` 的信号建议作为 hard gate 的强输入；`medium/low` 仅提示，不应直接阻断。
