# 交互式门控（`NOVEL_ASK`）

`NOVEL_ASK` 是一种**工具无关**的问卷/提问中间表示（IR），用于把“必须由用户确认/选择的信息”从自然语言模板中抽离出来，变成：

- 可审计：落盘为标准化 AnswerSpec JSON
- 可恢复：重跑执行器时若答案已存在且校验通过，跳过重复提问
- 可跨执行器：Claude Code / Codex 以不同交互能力呈现，但产出相同 AnswerSpec

## 端到端最短示例（InstructionPacket → AnswerSpec → main step）

### 1) InstructionPacket 里声明 gate

当 instruction packet 同时包含 `novel_ask` + `answer_path` 时，表示该 step 在执行 agent 之前有一个前置 gate：

```json
{
  "version": 1,
  "step": "chapter:048:draft",
  "agent": { "kind": "subagent", "name": "chapter-writer" },
  "manifest": { "mode": "paths", "inline": {}, "paths": {} },
  "novel_ask": {
    "version": 1,
    "topic": "platform binding",
    "questions": [
      {
        "id": "platform",
        "header": "Platform",
        "question": "你准备发布到哪个平台？",
        "kind": "single_choice",
        "required": true,
        "options": [
          { "label": "qidian", "description": "起点" },
          { "label": "jjwxc", "description": "晋江" },
          { "label": "web", "description": "自建站/博客" }
        ],
        "default": "qidian"
      }
    ]
  },
  "answer_path": "staging/novel-ask/chapter-048-draft.answers.json",
  "expected_outputs": [
    {
      "path": "staging/novel-ask/chapter-048-draft.answers.json",
      "required": true,
      "note": "AnswerSpec JSON record for the NOVEL_ASK gate (written before main step execution)."
    },
    { "path": "staging/chapters/chapter-048.md", "required": true }
  ],
  "next_actions": [
    { "kind": "command", "command": "novel validate chapter:048:draft" },
    { "kind": "command", "command": "novel advance chapter:048:draft" }
  ]
}
```

### 2) 执行器完成提问后，写入 AnswerSpec 到 answer_path

```json
{
  "version": 1,
  "topic": "platform binding",
  "answers": {
    "platform": "qidian"
  },
  "answered_at": "2026-02-27T10:12:34.000Z",
  "answered_by": "claude_code"
}
```

> `answered_by` 是审计字段：建议在 Claude Code 适配器写入 `claude_code`，在 Codex 适配器写入 `codex`（也可以用 `human` 等）。

### 3) gate 通过后再执行主 agent

- 若 `answer_path` 已存在且校验通过：直接执行主 agent（可恢复语义）
- 若缺失：执行器必须先完成提问并写入 AnswerSpec
- 若存在但无效：该 step 视为 **blocked**，不得继续执行主 agent（需修复/删除 AnswerSpec 后重试）

## `answer_path` 约定与校验行为

### `answer_path` 约定（推荐）

`answer_path` 由编排器提供，且必须是 **project-relative** 路径。

推荐放在 `staging/novel-ask/` 下，并在文件名中包含 step 信息，便于审计与回放，例如：

- `staging/novel-ask/chapter-048-draft.answers.json`
- `staging/novel-ask/novel-init.answers.json`

> 需要重做 gate 时：删除该 AnswerSpec 文件，重新运行执行器即可触发再次提问。

### 校验行为（摘要）

执行器在进入主 agent 之前必须确保：

- `answer_path` 必须是非空的项目相对路径：不允许绝对路径、`..` 段，且解析后不得逃出项目根目录
- AnswerSpec 是合法 JSON object
- `version/topic` 与 QuestionSpec 一致
- `answers` 的 key 必须是 `snake_case`，且必须能在 QuestionSpec 里找到同名 question id（不允许多写未知字段）
- required=true 的问题必须回答
- `allow_other`（可选，默认 false）：设为 `true` 时允许 choice 问题回答不在 option labels 内的自定义字符串
- choice 问题：当 `allow_other` 不是 `true` 时，答案必须落在 option labels 内
- multi_choice：
  - required=true：至少选 1 个
  - required=false：若 0 选择，**必须完全不写入该 question id**（写空数组会被校验拒绝）
  - 不允许重复选项（数组内 duplicate 会被校验拒绝）

## Claude Code vs Codex：交互差异与降级策略

目标是：**交互体验可以不同，但最终落盘的 AnswerSpec 必须一致**。

### Claude Code（`AskUserQuestion`）

- 优先编译为一个或多个 `AskUserQuestion`
- `options[]` 每次有数量上限（2-4），选项过多时需要分页/循环
- `free_text` 可能需要依赖 UI 的 “Other” 输入；若不可用可提示用户用普通消息输入再由适配器写入 AnswerSpec

详见：`skills/cli-step/SKILL.md`

### Codex（Plan Mode `request_user_input` + JSON fallback）

- Plan Mode 下优先用 `request_user_input`（每题选项上限更低，且为互斥选项）
- 若工具不可用或无法可靠表达语义（例如 `free_text`）：退化为严格 JSON 回答格式，由适配器构造 + 校验 AnswerSpec 后落盘

详见：`.codex/skills/novel-cli-step/SKILL.md`
