## 7. 确定性工具扩展接口（M3+ 预留）

> MVP（M1-M2）全部通过 Claude 原生工具（Read/Write/Glob/Grep）+ Bash 工具（系统命令，非外部脚本）完成。本节定义当 LLM 精度不足时，
> 在哪些具体位置插入确定性 CLI 脚本，以及未来可选的 MCP 包装路径。

### 7.1 扩展点清单

| 扩展点 | 当前实现（LLM） | CLI 脚本替代（M3+） | 触发位置 |
|--------|----------------|---------------------|---------|
| 黑名单统计 | QualityJudge 评估时人工计数 | `bash ${CLAUDE_PLUGIN_ROOT}/scripts/lint-blacklist.sh <chapter.md> <blacklist.json>` → 精确命中数 + 行号 | pipeline Step 4 之前，结果注入 QualityJudge context |
| 中文 NER | QualityJudge 从正文提取实体 | `bash ${CLAUDE_PLUGIN_ROOT}/scripts/run-ner.sh <chapter.md>` → JSON 实体列表 | pipeline Step 2（Summarizer）或 Step 4（QualityJudge）前 |
| 伏笔索引查询 | QualityJudge 读 global.json 全文 | `bash ${CLAUDE_PLUGIN_ROOT}/scripts/query-foreshadow.sh <chapter_num>` → 相关伏笔子集 | pipeline Step 1 context 组装时 |
| Schema 校验 | 无（信任 prompt 输出格式） | `bash ${CLAUDE_PLUGIN_ROOT}/scripts/validate-schema.sh <file> <schema>` → pass/fail | PostToolUse(Write) hook |

### 7.2 集成约定

```
CLI 脚本接口规范：
- 输入：命令行参数（文件路径）
- 输出：stdout JSON（供入口 Skill 解析注入 agent context）
- 退出码：0 = 成功，1 = 校验失败（附 stderr 错误详情），2 = 脚本异常
- 超时：10 秒（由 Bash 工具 timeout 控制）
- 依赖：脚本自行管理（shebang 声明 python3/node），plugin 不负责安装运行时
```

### 7.3 MCP 包装路径（M4+ 可选）

当 CLI 脚本数量 ≥3 且需要频繁调用时，可将脚本组统一包装为 MCP Server：

```json
// mcp-config.json（plugin.json 的 mcpServers 字段引用）
{
  "mcpServers": {
    "novel-tools": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/servers/novel-tools-server.js"],
      "env": { "PROJECT_ROOT": "." }
    }
  }
}
```

MCP 相比 Bash 的增量收益：结构化工具 schema（Claude 自动发现参数类型）、进程复用（避免每次 Bash 冷启动）。但不改变能力上限，仅是接口优化。

### 7.4 渐进启用策略

```
M1-M2: 纯 LLM + 原生工具（无外部脚本，Bash 仅用于系统命令如 mkdir/mv）
  ↓ M3 人工校准发现精度缺口
M3:    Bash + CLI 脚本（按需启用，scripts/ 目录下）
  ↓ 脚本 ≥3 个且调用频繁
M4+:   可选 MCP 包装（servers/ 目录下）
```

> 每个扩展点独立启用，不影响其他组件。入口 Skill 通过 `if file_exists(script_path)` 检测脚本是否存在，存在则调用，否则回退 LLM 路径。
