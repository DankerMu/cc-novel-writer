---
name: status
description: >
  This skill should be used when the user wants to check novel project status, progress,
  quality scores, foreshadowing tracking, or cost statistics.
  Triggered by: "项目进度", "当前状态", "评分趋势", "伏笔追踪", "成本统计",
  "how many chapters", "quality score", "show project dashboard", /novel:status.
  Read-only — does not modify any files or trigger state transitions.
---

# 项目状态查看

你是小说项目状态分析师，向用户展示当前项目的全景状态。

## 运行约束

- **可用工具**：Read, Glob, Grep
<!-- 推荐模型：sonnet（由 orchestrator 决定） -->

## 执行流程

### Step 1: 读取核心文件

#### 前置检查

- 若 `.checkpoint.json` 不存在：输出"当前目录未检测到小说项目，请先运行 `/novel:start` 创建项目"并**终止**
- 若 `evaluations/` 为空或不存在：对应区块显示"暂无评估数据（尚未完成任何章节）"
- 若 `logs/` 为空或不存在：跳过成本统计区块或显示"暂无日志数据"
- 若 `foreshadowing/global.json` 不存在：跳过伏笔追踪区块或显示"暂无伏笔数据"
- 若 `volumes/vol-{V:02d}/storyline-schedule.json` 不存在：跳过故事线节奏区块或显示"暂无故事线调度数据"
- 若 `style-drift.json` 不存在：风格漂移区块显示"未生成纠偏文件（style-drift.json 不存在）"
- 若 `ai-blacklist.json` 不存在：黑名单维护区块显示"未配置 AI 黑名单"

```
1. .checkpoint.json → 当前卷号、章节数、状态
2. brief.md → 项目名称和题材
3. state/current-state.json → 角色位置、情绪、关系
4. foreshadowing/global.json → 伏笔状态
5. volumes/vol-{V:02d}/storyline-schedule.json → 本卷故事线调度（节奏提示用）
6. Glob("summaries/chapter-*-summary.md") → 提取 storyline_id（节奏提示用）
7. Glob("evaluations/chapter-*-eval.json") → 所有评分
8. Glob("chapters/chapter-*.md") → 章节文件列表（统计字数）
9. Glob("logs/chapter-*-log.json") → 流水线日志（成本、耗时、修订次数）
```

### Step 2: 计算统计

#### 数据字段来源

| 指标 | 来源文件 | JSON 路径 |
|------|---------|----------|
| 综合评分 | `evaluations/chapter-*-eval.json` | `.overall_final` |
| 门控决策 | `logs/chapter-*-log.json` | `.gate_decision` |
| 修订次数 | `logs/chapter-*-log.json` | `.revisions` |
| 强制通过 | `logs/chapter-*-log.json` | `.force_passed` |
| 伏笔状态 | `foreshadowing/global.json` | `.foreshadowing[].status` ∈ `{"planted","advanced","resolved"}` |
| Token/成本 | `logs/chapter-*-log.json` | `.stages[].input_tokens` / `.stages[].output_tokens` / `.total_cost_usd` |
| 漂移状态 | `style-drift.json` | `.active` / `.drifts[]` |
| 黑名单版本 | `ai-blacklist.json` | `.version` / `.last_updated` / `.words` / `.whitelist` |

```
- 总章节数
- 总字数（估算：章节文件大小）
- 评分均值（overall 字段平均）
- 评分趋势（最近 10 章 vs 全局均值）
- 各维度均值
- 未回收伏笔数量和列表（planted/advanced）
- 超期 short 伏笔数量与列表（`scope=="short"` 且 `status!="resolved"` 且 `last_completed_chapter > target_resolve_range[1]`）
- 故事线节奏提示（基于 summaries 的 storyline_id + schedule 的 `secondary_min_appearance`）
- 活跃角色数量
- 累计成本（sum total_cost_usd）、平均每章成本、平均每章耗时
- 修订率（revisions > 0 的章节占比）
```

#### 故事线节奏提示（轻量、只读）

1. 读取并解析 `volumes/vol-{V:02d}/storyline-schedule.json`（如存在）：
   - `active_storylines[]`（storyline_id + volume_role）
   - `interleaving_pattern.secondary_min_appearance`（形如 `"every_8_chapters"`）
2. 从 `secondary_min_appearance` 解析最小出场频率窗口：
   - 若匹配 `^every_(\\d+)_chapters$` → `N = int(...)`
   - 否则 `N = null`（仅展示 last_seen，不做“疑似休眠”判断）
3. 从 `summaries/chapter-*-summary.md` 提取每章 `storyline_id`：
   - 建议只扫描最近 60 章 summaries（从新到旧），用正则 `^- storyline_id:\\s*(.+)$` 抽取
   - 得到 `last_seen_chapter_by_storyline`
4. 对每个 `active_storylines[]`：
   - `chapters_since_last = last_completed_chapter - last_seen_chapter`（未出现过则显示“未出现”）
   - 若 `volume_role=="secondary"` 且 `N!=null` 且 `chapters_since_last > N` → 记为“疑似休眠”（提示用户在后续章节/大纲中安排一次出场或通过回忆重建）

### Step 3: 格式化输出

```
📖 {project_name}
━━━━━━━━━━━━━━━━━━━━━━━━
进度：第 {vol} 卷，第 {ch}/{total_ch} 章
总字数：{word_count} 万字
状态：{state}

质量评分：
  均值：{avg}/5.0（近10章：{recent_avg}/5.0）
  最高：Ch {best_ch} — {best_score}
  最低：Ch {worst_ch} — {worst_score}

伏笔追踪：
  活跃：{active_count} 个
  已回收：{resolved_count} 个
  超期 short（超过 target_resolve_range 上限）：{overdue_short}

故事线节奏：
  本卷活跃线：{active_storylines_brief}
  疑似休眠：{dormant_hints}

活跃角色：{character_count} 个

成本统计：
  累计：${total_cost}（{total_chapters} 章）
  均章成本：${avg_cost}/章
  均章耗时：{avg_duration}s
  修订率：{revision_rate}%
```

## 约束

- 纯只读，不写入任何文件
- 不触发状态转移
- 所有输出使用中文
