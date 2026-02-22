## 8. Orchestrator 设计

### 8.1 核心原则：无状态冷启动

Orchestrator 不依赖会话历史。每次启动（新 session 或 context 压缩后）：
1. 读 `.checkpoint.json` → 当前位置（Vol N, Chapter M, 状态 X）
2. 读 `state/current-state.json` → 世界/角色/伏笔当前状态
3. 读近 3 章 `summaries/` → 近期剧情
4. 读 `volumes/vol-N/outline.md` → 当前卷计划
5. 无需读任何章节全文

### 8.2 状态机

```
INIT → QUICK_START → VOL_PLANNING → WRITING ⟲ (每章：写→摘要→润色→门控→[修订])
                                      ↓ (卷末)
                                  VOL_REVIEW → VOL_PLANNING (下一卷)
```

**状态转移规则**：

| 当前状态 | 触发条件 | 目标状态 | 动作 |
|---------|---------|---------|------|
| INIT | `/novel:start create` | QUICK_START | 创建项目目录 |
| QUICK_START | 用户提供设定 | QUICK_START | WorldBuilder(轻量) + CharacterWeaver(主角) |
| QUICK_START | 风格样本提交 | QUICK_START | StyleAnalyzer 提取 profile |
| QUICK_START | 试写确认 | VOL_PLANNING | 标记试写为 Vol 1 前 3 章 |
| VOL_PLANNING | 大纲确认 | WRITING | 保存大纲，准备续写 |
| WRITING | 续写请求 | WRITING | ChapterWriter → Summarizer → StyleRefiner → QualityJudge → 门控 |
| WRITING | 门控通过（≥ 3.5 且无 violation） | WRITING | 提交章节，更新 checkpoint |
| WRITING | 门控修订（3.0-3.4 或有 violation） | CHAPTER_REWRITE | Opus 修订（最多 2 次） |
| WRITING | 门控失败（< 3.0） | WRITING(暂停) | 通知用户 |
| WRITING | 每 5 章（last_completed % 5 == 0） | WRITING | 输出质量简报（均分+问题章节），用户可选择继续/回看/调整 |
| CHAPTER_REWRITE | 修订完成 | WRITING | 重新走门控（最多 2 次修订后强制通过并标记） |
| WRITING | 本卷最后一章 | VOL_REVIEW | 全卷检查 |
| VOL_REVIEW | 完成 | VOL_PLANNING | 下卷规划 |
| 任意 | 错误 | ERROR_RETRY | 重试 1 次，失败则保存 checkpoint 暂停 |

**Skill → 状态映射**：

| Skill | 负责状态 | 说明 |
|-------|---------|------|
| `/novel:start` | INIT → QUICK_START, VOL_PLANNING, VOL_REVIEW | 状态感知交互入口：通过 AskUserQuestion 识别用户意图后派发对应 agent |
| `/novel:continue` | WRITING（含内嵌门控 + 修订循环） | 核心续写循环：每章流水线含 QualityJudge 门控，不通过则自动修订（高频快捷命令） |
| `/novel:status` | 任意（只读） | 读取 checkpoint 展示状态，不触发转移 |

### 8.3 Context 组装规则

```python
def assemble_context(agent_type, chapter_num, volume):
    base = {
        "project_brief": read("brief.md"),
        "style_profile": read("style-profile.json"),
        "ai_blacklist": read("ai-blacklist.json"),
    }

    if agent_type == "ChapterWriter":
        return base | {
            "volume_outline": read(f"volumes/vol-{volume}/outline.md"),
            "chapter_outline": extract_chapter(volume, chapter_num),
            "storyline_context": get_storyline_context(chapter_num, volume),
            "concurrent_state": get_concurrent_storyline_states(chapter_num, volume),
            "recent_summaries": read_last_n("summaries/", n=3),
            "current_state": read("state/current-state.json"),
            "foreshadowing_tasks": get_chapter_foreshadowing(chapter_num),
        }

    elif agent_type == "QualityJudge":
        return base | {
            "chapter_content": read(f"chapters/chapter-{chapter_num}.md"),
            "chapter_outline": extract_chapter(volume, chapter_num),
            "character_profiles": read("characters/active/*.md"),
            "prev_summary": read_last_n("summaries/", n=1),
            "storyline_spec": read("storylines/storyline-spec.json"),
            "storyline_schedule": read(f"volumes/vol-{volume}/storyline-schedule.json"),
        }

    elif agent_type == "PlotArchitect":
        return base | {
            "world_docs": read("world/*.md"),
            "characters": read("characters/active/*.md"),
            "prev_volume_review": read(f"volumes/vol-{volume-1}/review.md"),
            "global_foreshadowing": read("foreshadowing/global.json"),
            "storylines": read("storylines/storylines.json"),
        }
    # WorldBuilder/CharacterWeaver: base + existing docs + update request
```

### 8.4 Context 预算（每次 agent 调用）

| 组件 | Token 估算 | 说明 |
|------|-----------|------|
| System prompt | ~5K | 固定 |
| style-profile + blacklist | ~2K | 固定 |
| 当前卷大纲 | ~3K | 每卷固定 |
| 近 3 章摘要 | ~3K | 滑动窗口 |
| current-state.json | ~3-5K | 需定期裁剪 |
| 角色档案（活跃） | ~5K | 只加载相关角色 |
| 本章大纲 + 伏笔 | ~1K | 每章固定 |
| **合计** | **~22-25K** | 即使第 500 章也稳定 |

### 8.5 State 裁剪策略

- 超过 N 章未出现的角色：状态归档至 `characters/retired/`
- current-state.json 仅保留活跃角色 + 近期相关物品/位置
- 每卷结束时执行一次全局 state 清理

