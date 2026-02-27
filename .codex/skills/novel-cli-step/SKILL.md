---
name: novel-cli-step
description: >
  Codex adapter: run ONE `novel` step via instruction packet (next → instructions → spawn subagent),
  then stop for human review (no auto-commit).
---

# Codex CLI 单步适配器

目标：把确定性编排交给 `novel` CLI，把生成执行交给 subagent；每步后都留断点给用户 review。

## 流程（单步）

前置：若 `dist/` 不存在，先执行：
```bash
npm ci
npm run build
```

1) 计算下一步：
```bash
node dist/cli.js next --json
```
取 `data.step`（例如 `chapter:048:draft`）。

2) 生成 instruction packet（必须落盘，便于 gate 恢复/审计）：
```bash
node dist/cli.js instructions "<STEP>" --json --write-manifest
```
取：
- `data.packet`（InstructionPacket）
- `data.written_manifest_path`（packet JSON 路径）

3) **（可选）NOVEL_ASK gate：Plan Mode 优先，工具不可用则 JSON fallback**

如果 `data.packet` 同时包含：
- `novel_ask`（QuestionSpec）
- `answer_path`（project-relative）

则该 step 在执行 agent 之前 **必须** 先满足 gate：

**3.1 先检查是否已存在可用 AnswerSpec（可恢复语义）**

- 若 `answer_path` 已存在且能通过校验：直接继续执行 step
- 若缺失：进入提问采集
- 若存在但无效：停止并提示用户修复/删除该文件后重试（不得继续执行 step）

校验命令（会做 questionSpec↔answerSpec cross-validate）：
```bash
PACKET_JSON="<data.written_manifest_path>" node --input-type=module - <<'EOF'
import fs from "node:fs/promises";
import { extractNovelAskGate, loadNovelAskAnswerIfPresent } from "./dist/instruction-gates.js";

const packet = JSON.parse(await fs.readFile(process.env.PACKET_JSON, "utf8"));
const gate = extractNovelAskGate(packet);
if (!gate) process.exit(0);
const answer = await loadNovelAskAnswerIfPresent(process.cwd(), gate);
if (answer) {
  console.error("NOVEL_ASK gate: OK");
  process.exit(0);
}
console.error(`NOVEL_ASK gate: missing AnswerSpec at ${gate.answer_path}`);
process.exit(2);
EOF
```

**3.2 Plan Mode（推荐）：用 `request_user_input` 采集**

- `single_choice`：直接用 `request_user_input`（将 `default` 对应选项放到 options 第一项，并标注 Recommended）
- `multi_choice`：循环调用 `request_user_input`，每轮让用户 pick 1 个 option（外加一个保留 label `__done__` 的结束项；该项不写入 answers），累积为 string[]
  - required=true：必须至少选 1 个再选择 `__done__`，否则视为未回答（blocked）
  - required=false：若最终 0 选择，则**不要写入该 question id**（而不是写入空数组）
- `free_text`：改用下方 JSON fallback（保持语义，不做不可靠映射）
- 注意：UI 可能会自动提供 “Other” 自定义输入；若 question 未设置 `allow_other=true`，则校验会拒绝该输入，需要重新回答

采集完成后：将 answers 写入 `answer_path` 的 AnswerSpec（见 3.3 的“构造 + 写入 AnswerSpec”命令；仅替换其中的 `raw.answers` 为采集到的 answers 映射）。

**3.3 工具不可用：严格 JSON fallback**

向用户输出严格合约，让用户只回复一段 JSON（不要夹杂解释文字）：
```json
{
  "answers": {
    "question_id": "value",
    "multi_choice_id": ["a", "b"]
  }
}
```

然后由适配器构造并落盘 AnswerSpec（`answered_by="codex"`）：
```json
{
  "version": "<copied from QuestionSpec.version>",
  "topic": "<copied from QuestionSpec.topic>",
  "answers": { "...": "..." },
  "answered_at": "<ISO-8601>",
  "answered_by": "codex"
}
```

写入后再次运行 3.1 的校验命令（exit code 0 才算通过）；通过后才允许继续执行 step。

（建议）把 fallback JSON 先落盘为 `staging/novel-ask/answers.json`，再用以下命令构造 + 写入 AnswerSpec：
```bash
mkdir -p staging/novel-ask
PACKET_JSON="<data.written_manifest_path>" ANSWERS_JSON="staging/novel-ask/answers.json" node --input-type=module - <<'EOF'
import fs from "node:fs/promises";
import { dirname } from "node:path";
import { extractNovelAskGate, requireNovelAskAnswer } from "./dist/instruction-gates.js";
import { parseNovelAskAnswerSpec, validateNovelAskAnswerAgainstQuestionSpec } from "./dist/novel-ask.js";
import { resolveProjectRelativePath } from "./dist/safe-path.js";

const packet = JSON.parse(await fs.readFile(process.env.PACKET_JSON, "utf8"));
const gate = extractNovelAskGate(packet);
if (!gate) process.exit(0);

const raw = JSON.parse(await fs.readFile(process.env.ANSWERS_JSON, "utf8"));
if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error("ANSWERS_JSON must be a JSON object.");
if (typeof raw.answers !== "object" || raw.answers === null || Array.isArray(raw.answers)) throw new Error("ANSWERS_JSON.answers must be an object.");

const answerSpec = parseNovelAskAnswerSpec({
  version: gate.novel_ask.version,
  topic: gate.novel_ask.topic,
  answers: raw.answers,
  answered_at: new Date().toISOString(),
  answered_by: "codex"
});
validateNovelAskAnswerAgainstQuestionSpec(gate.novel_ask, answerSpec);

const absAnswer = resolveProjectRelativePath(process.cwd(), gate.answer_path, "answer_path");
await fs.mkdir(dirname(absAnswer), { recursive: true });
await fs.writeFile(absAnswer, `${JSON.stringify(answerSpec, null, 2)}\n`, "utf8");
await requireNovelAskAnswer(process.cwd(), gate);
console.error(`NOVEL_ASK gate: wrote AnswerSpec to ${gate.answer_path}`);
EOF
```

4) 执行 subagent：
- draft → `chapter-writer`
- summarize → `summarizer`
- refine → `style-refiner`
- judge → `quality-judge`（返回 JSON 后，执行器需写入 `staging/evaluations/chapter-XXX-eval.json`）

5) 断点返回：
```bash
node dist/cli.js validate "<STEP>"
node dist/cli.js advance "<STEP>"
```
若 `next` 返回 `...:commit`，则运行：
```bash
node dist/cli.js commit --chapter N
```
