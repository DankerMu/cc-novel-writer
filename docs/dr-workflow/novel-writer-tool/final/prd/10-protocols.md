## 10. Agent 协作协议

### 10.1 Agent 返回值规范

Agent 通过 Task 子代理执行，结果以结构化文本返回给入口 Skill，由入口 Skill 解析并推进流程。

**续写完成返回**：
```json
{
  "status": "completed",
  "chapter": 48,
  "word_count": 3120,
  "quality_score": 3.8,
  "summary": "第48章完成，状态已更新"
}
```

**情节冲突检测返回**：
```json
{
  "status": "conflict_detected",
  "chapter": 48,
  "detail": "主角使用了 Chapter 35 已丢失的魔杖，需要修正",
  "severity": "high"
}
```

### 10.2 任务依赖（卷制模式）

```
快速起步：
  Task 1: 粗略设定 → Task 2: 风格提取 → Task 3-5: 试写 3 章

卷内循环：
  Task N: 本卷大纲 → Task N+1..N+50: 逐章续写
  每 10 章触发：一致性检查
  卷末：回顾 + 下卷规划
```

### 10.3 错误处理与重试

| 错误类型 | 处理策略 | 最大重试 |
|---------|---------|---------|
| API 超时 | 等待 30s 后重试 | 2 次 |
| 生成质量低（<3.0） | 标记问题，通知用户 | - |
| 状态冲突 | 获取 .novel.lock → 串行执行 → 释放（见 §10.7） | - |
| Agent 崩溃 | 入口 Skill 重派 Task | 2 次 |
| 一致性检查失败 | 标记冲突，暂停后续章节，人工介入 | - |
| Session 中断 | 保存 checkpoint，下次冷启动恢复 | - |
| ops JSON 格式错误 | 按 10.6 规则校验并重试 | 1 次 |

### 10.4 原子性保证

章节写入采用 **staging → validate → commit** 事务模式：

1. **Staging**：流水线各阶段输出写入 `staging/` 暂存目录
   - `staging/chapters/chapter-N.md`（初稿 → 润色覆盖）
   - `staging/summaries/chapter-N-summary.md`（摘要，由 Summarizer 产出）
   - `staging/state/chapter-N-delta.json`（状态增量，由 Summarizer 产出）
   - `staging/storylines/{storyline_id}/memory.md`（故事线记忆更新，由 Summarizer 产出）
   - `staging/evaluations/chapter-N-eval.json`（评估结果）
   - 每步完成更新 `.checkpoint.json` 的 `pipeline_stage`
2. **Validate**：QualityJudge Track 1 合规（仅 `confidence: "high"` 的 violation 触发强制修订）+ Track 2 评分通过质量门控
3. **Commit**（原子提交）：
   - 将 staging 文件移入正式目录（`chapters/`、`summaries/`、`evaluations/`）
   - 移动 `staging/storylines/{storyline_id}/memory.md` → `storylines/{storyline_id}/memory.md`
   - 合并 state delta → `state/current-state.json`（经 §10.6 校验）
   - 更新 `foreshadowing/global.json`
   - 更新 `.checkpoint.json`（`last_completed_chapter + 1`、`pipeline_stage = committed`、`inflight_chapter = null`）
   - 释放并发锁（`rm -rf .novel.lock`，见 §10.7）
4. **中断恢复**：冷启动时检查 `pipeline_stage` + `inflight_chapter` + `staging/` 目录 + `.novel.lock` 状态，从中断阶段幂等恢复；staging 文件可安全重试或清理

### 10.5 交互边界规则

**AskUserQuestion 仅限主技能层**：所有用户交互（确认、选择、审核）必须在 `/novel:start` 主技能中完成，subagent（Task 派生的子代理）不可调用 AskUserQuestion。

**Agent 返回结构化建议**：当 agent 的产出需要用户确认时（如大纲、契约变更、冲突检测），agent 必须返回结构化 JSON，由主技能解析后通过 AskUserQuestion 呈现：

```json
{
  "type": "requires_user_decision",
  "recommendation": "推荐选项描述",
  "options": ["选项A", "选项B", "选项C"],
  "rationale": "推荐理由",
  "data": { /* agent 产出的完整数据 */ }
}
```

适用场景：PlotArchitect 大纲确认、CharacterWeaver 契约变更审核、QualityJudge 低分章节处置、故事线调度冲突。

### 10.6 状态 ops 校验规则

Summarizer 输出的 ops 在合并至 `state/current-state.json` 前，由入口 Skill 执行以下校验（M1 即启用，纯字符串/JSON 校验，不依赖确定性工具）：

**1. JSON 格式校验**
- `JSON.parse()` 失败 → 重试一次（要求 Summarizer 重新输出 ops 部分）
- 重试仍失败 → 跳过本章 ops，记录 warn 到 `pipeline.log`，不阻断流水线
- **累积跳过 ≥ 3 次**时，在下一次质量简报中提示用户执行 state 重建（从 `state/changelog.jsonl` 回放或从最近 N 章正文重新提取）

**2. op 枚举校验**
- 合法值：`set`、`inc`、`add`、`remove`、`foreshadow`
- `foreshadow` op 的 path 为伏笔 ID（单层，如 `ancient_prophecy`），不适用通用 path 规则
- 其他非法 op → 丢弃该条 ops entry，记录 warn

**3. path 格式校验**
- 通用 ops（set/inc/add/remove）：path 深度 2-4 层，如 `characters.lin-feng.location` 或 `characters.lin-feng.relationships.chen-lao`（使用实体 slug ID，非中文显示名）
- 顶层类别白名单：`characters`、`items`、`locations`、`factions`、`world_state`、`active_foreshadowing`
- `foreshadow` op 豁免此规则（其 path 为伏笔 ID，无层级结构）
- 不匹配 → 丢弃该条 ops entry，记录 warn

**4. ChapterWriter hints 处理**
- ChapterWriter 的 `hints` 字段仅用于 Summarizer 交叉参考，不直接合并到 state
- 当 Summarizer ops 与 Writer hints 存在明显矛盾时，以 Summarizer 为准（Summarizer 基于正文提取）

### 10.7 并发锁机制

防止多个 `/novel:continue` 同时执行导致 staging 写入冲突。采用**原子目录锁**，零外部依赖：

**获取锁**：
```
mkdir <project_root>/.novel.lock   # 原子操作，已存在则失败
echo '{"pid": <PID>, "started": "<ISO-8601>", "chapter": <N>}' > .novel.lock/info.json
```

**释放锁**：
```
rm -rf <project_root>/.novel.lock
```

**规则**：
1. 入口 Skill 在流水线开始前获取锁，pipeline 全部完成（commit 或失败）后释放
2. `mkdir` 失败 → 读取 `info.json` 获取持有者信息，向用户报告冲突并拒绝执行
3. 过期保护：若 `info.json` 的 `started` 距当前时间 > 30 分钟，视为僵尸锁，强制清除后重新获取
4. Session 中断恢复：冷启动时检查 `.novel.lock` 是否存在，存在则提示用户确认是否为僵尸锁

### 10.8 手动改稿后的状态重建（M3 完整实现）

用户手动编辑章节正文后，摘要、state ops、changelog、storyline memory 可能与正文不一致。重建流程：

1. **识别变更范围**：用户通过 `/novel:start` 指定被修改的章节号
2. **重跑 Summarizer**：对修改后的正文重新生成 summary + state delta + memory
3. **回放 state**：从上一个一致的 `state_version` 开始，按 `changelog.jsonl` 回放至修改章前一章，再应用新的 delta
4. **级联检查**：如修改章之后还有已完成章节，检查后续章节的 summary/state 是否仍一致（如有大改，提示用户逐章重建）

> M1/M2 阶段暂不实现自动重建。用户手动改稿后需自行确保一致性，或删除后续章节从修改点重新续写。M3 实现完整的重建命令。

