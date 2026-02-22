## 9. 数据结构

### 9.1 项目目录结构

```
novel-project/
├── .checkpoint.json                # Orchestrator 恢复点
├── brief.md                        # 创作纲领（精简，≤1000 字）
├── style-profile.json              # 用户风格指纹
├── ai-blacklist.json               # AI 用语黑名单
├── research/                       # 背景研究资料（doc-workflow 导入或手动放入）
│   └── *.md                        # 每个主题一个文件，WorldBuilder/CharacterWeaver 自动读取
├── prompts/                        # Prompt 模板
│   ├── world-builder.md
│   ├── character-weaver.md
│   ├── plot-architect.md
│   ├── chapter-writer.md
│   ├── summarizer.md
│   ├── style-refiner.md
│   └── quality-judge.md
├── world/                          # 世界观（活文档）
│   ├── geography.md
│   ├── history.md
│   ├── rules.md
│   └── changelog.md
├── characters/
│   ├── active/                     # 当前活跃角色
│   ├── retired/                    # 已退场角色
│   ├── relationships.json
│   └── changelog.md
├── storylines/                     # 多线叙事管理
│   ├── storylines.json             # 全局故事线定义
│   ├── storyline-spec.json         # LS 故事线规范
│   └── {storyline-id}/
│       └── memory.md               # 故事线独立记忆（≤500 字关键事实，Summarizer 每章更新）
├── volumes/                        # 卷制结构
│   ├── vol-01/
│   │   ├── outline.md
│   │   ├── storyline-schedule.json # 本卷故事线调度
│   │   ├── foreshadowing.json
│   │   ├── chapter-contracts/      # L3 章节契约（PlotArchitect 生成）
│   │   │   ├── chapter-001.json
│   │   │   └── ...
│   │   └── review.md
│   └── vol-02/ ...
├── chapters/
│   ├── chapter-001.md
│   └── ...
├── staging/                        # 写作流水线暂存区（事务语义）
│   ├── chapters/                   # draft → refined 章节
│   ├── summaries/                  # 章节摘要（Summarizer 产出，commit 时移入 summaries/）
│   ├── state/                      # state delta（Summarizer 产出）
│   ├── storylines/                 # 故事线记忆更新（Summarizer 产出，commit 时覆盖 storylines/*/memory.md）
│   └── evaluations/                # 评估结果
├── summaries/                      # 章节摘要（context 压缩核心）
│   ├── chapter-001-summary.md
│   └── ...
├── state/
│   ├── current-state.json          # 当前全局状态（含 schema_version + state_version）
│   ├── changelog.jsonl             # 状态变更审计日志（每行一条 ops 记录）
│   └── history/                    # 每卷存档
│       └── vol-01-final-state.json
├── foreshadowing/
│   └── global.json                 # 跨卷伏笔
├── evaluations/
│   ├── chapter-001-eval.json
│   └── ...
└── logs/                          # 流水线执行日志（调试 + 成本追踪）
    ├── chapter-001-log.json
    └── ...
```

### 9.2 关键数据格式

**Checkpoint** (`.checkpoint.json`):
```json
{
  "last_completed_chapter": 47,
  "current_volume": 2,
  "orchestrator_state": "WRITING",
  "pipeline_stage": "committed",
  "inflight_chapter": null,
  "pending_actions": [],
  "last_checkpoint_time": "2026-02-21T15:30:00"
}
```

`pipeline_stage` 取值：`null`（空闲）→ `drafting`（初稿生成中）→ `drafted`（初稿 + 摘要 + delta 已生成）→ `refined`（润色完成）→ `judged`（评估完成）→ `committed`（已提交到正式目录）。`inflight_chapter` 记录当前正在处理的章节号。冷启动恢复时：若 `pipeline_stage != committed && inflight_chapter != null`，检查 `staging/` 子目录并从对应阶段恢复：
- `drafting` 且 `staging/chapters/` 无对应文件 → 重启整章
- `drafting` 且 `staging/chapters/` 有初稿但 `staging/summaries/` 无摘要 → 从 Summarizer 恢复
- `drafted` → 跳过 ChapterWriter 和 Summarizer，从 StyleRefiner 恢复
- `refined` → 从 QualityJudge 恢复
- `judged` → 执行 commit 阶段
```

**角色状态** (`state/current-state.json`):
```json
{
  "schema_version": 1,
  "state_version": 47,
  "last_updated_chapter": 47,
  "characters": {
    "protagonist": {
      "location": "魔都",
      "emotional_state": "决意",
      "relationships": {"mentor": 50, "rival": -30},
      "inventory": ["破碎魔杖", "密信"]
    }
  },
  "world_state": {
    "ongoing_events": ["王国内战"],
    "time_marker": "第三年冬"
  },
  "active_foreshadowing": ["ancient_prophecy", "betrayal_hint"]
}
```

**状态变更 Patch**（Summarizer 权威输出格式，ChapterWriter 仅输出自然语言 hints）：
```json
{
  "chapter": 48,
  "base_state_version": 47,
  "storyline_id": "main_arc",
  "ops": [
    {"op": "set", "path": "characters.protagonist.location", "value": "幽暗森林"},
    {"op": "set", "path": "characters.protagonist.emotional_state", "value": "警觉"},
    {"op": "inc", "path": "characters.protagonist.relationships.mentor", "value": 10},
    {"op": "add", "path": "characters.protagonist.inventory", "value": "密信"},
    {"op": "remove", "path": "characters.protagonist.inventory", "value": "破碎魔杖"},
    {"op": "set", "path": "world_state.time_marker", "value": "第三年冬末"},
    {"op": "foreshadow", "path": "ancient_prophecy", "value": "advanced", "detail": "主角梦见预言碎片"}
  ]
}
```

操作类型：`set`（覆盖字段）、`add`（追加到数组）、`remove`（从数组移除）、`inc`（数值增减）、`foreshadow`（伏笔状态变更：planted/advanced/resolved）。合并器在写入前校验 `base_state_version` 匹配当前 `state_version`，应用后 `state_version += 1`，变更记录追加到 `state/changelog.jsonl`。

**风格指纹** (`style-profile.json`):
```json
{
  "avg_sentence_length": 18,
  "dialogue_ratio": 0.4,
  "rhetoric_preferences": ["短句切换", "少用比喻"],
  "forbidden_words": ["莫名的", "不禁", "嘴角微微上扬"],
  "character_speech_patterns": {
    "protagonist": "喜欢用反问句，口头禅'有意思'",
    "mentor": "文言腔，爱说'善'"
  }
}
```

**质量评估** (`evaluations/chapter-N-eval.json`):
```json
{
  "chapter": 47,
  "contract_verification": {"l1_checks": [], "l2_checks": [], "l3_checks": [], "ls_checks": [], "has_violations": false},
  "scores": {
    "plot_logic": {"score": 4, "weight": 0.18, "reason": "...", "evidence": "原文引用"},
    "character": {"score": 4, "weight": 0.18, "reason": "...", "evidence": "原文引用"},
    "immersion": {"score": 4, "weight": 0.15, "reason": "...", "evidence": "原文引用"},
    "foreshadowing": {"score": 3, "weight": 0.10, "reason": "...", "evidence": "原文引用"},
    "pacing": {"score": 4, "weight": 0.08, "reason": "...", "evidence": "原文引用"},
    "style_naturalness": {"score": 4, "weight": 0.15, "reason": "AI 黑名单命中 1 次/千字", "evidence": "原文引用"},
    "emotional_impact": {"score": 3, "weight": 0.08, "reason": "...", "evidence": "原文引用"},
    "storyline_coherence": {"score": 4, "weight": 0.08, "reason": "...", "evidence": "原文引用"}
  },
  "overall": 3.78,
  "recommendation": "pass",
  "risk_flags": [],
  "required_fixes": [],
  "issues": [],
  "strengths": ["情节节奏张弛得当"]
}
```

**Pipeline Log** (`logs/chapter-N-log.json`):
```json
{
  "chapter": 47,
  "storyline_id": "main-quest",
  "started_at": "2026-03-15T14:30:00+08:00",
  "stages": [
    {"name": "draft", "model": "sonnet", "input_tokens": 12000, "output_tokens": 3500, "duration_ms": 45000},
    {"name": "summarize", "model": "sonnet", "input_tokens": 4000, "output_tokens": 800, "duration_ms": 8000},
    {"name": "refine", "model": "opus", "input_tokens": 8000, "output_tokens": 3500, "duration_ms": 42000},
    {"name": "judge", "model": "sonnet", "input_tokens": 6000, "output_tokens": 1200, "duration_ms": 15000}
  ],
  "gate_decision": "pass",
  "revisions": 0,
  "total_duration_ms": 110000,
  "total_cost_usd": 0.72
}
```

> 每章流水线完成后由入口 Skill 写入 `logs/chapter-N-log.json`。用于调试（定位哪个阶段耗时/耗 token 异常）、成本追踪（累计 cost）、质量回顾（门控决策 + 修订次数统计）。`/novel:status` 可读取汇总展示。

