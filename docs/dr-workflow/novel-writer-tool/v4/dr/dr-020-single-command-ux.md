# DR-020: 单主命令 + AskUserQuestion 交互流设计模式评估

## Executive Summary

基于对 Claude Code 插件生态、CLI UX 研究文献、AskUserQuestion 工具限制及认知负载理论的系统调研，**推荐采用三命令混合方案：`/novel` 作为主交互入口（合并 create/plan/review），保留 `/novel-continue [N]` 和 `/novel-status` 作为快捷命令**。这种"引导式入口 + 快捷命令"模式与 CLI 设计最佳实践高度吻合——交互向导降低新用户门槛，快捷命令满足高频效率需求。但 AskUserQuestion 存在硬性限制（每次 2-4 选项、60 秒超时、子代理不可用），需要在设计中显式规避。

## 核心发现

### 1. Claude Code 插件生态命令模式

两种模式并存：
- **多命令模式**（主流）：wshobson/commands 提供 57 个命令，Claude-Command-Suite 按 `/namespace:command` 分组
- **单入口交互模式**（有先例）：RIPER Workflow 通过阶段式状态机驱动，ccexp 提供交互式配置管理

Claude Code 官方指导建议 "multiple focused skills"，但不排斥入口合并 — `/novel` 做调度路由，实际工作由独立 agent 完成，符合这一原则。

### 2. 交互向导 vs 显式子命令

业界共识：**两者互补而非互斥**。

| 工具 | 向导模式 | 直接模式 |
|------|---------|---------|
| npm | `npm init`（交互） | `npm init -y`（跳过） |
| gh | `gh pr create`（交互） | `gh pr create --title X --body Y` |
| AWS CLI | `aws configure`（向导） | 所有操作的完整 flag 路径 |

clig.dev 核心原则："An interactive command does not replace a non-interactive one."

### 3. AskUserQuestion 硬性限制

| 限制 | 值 | 影响 |
|------|-----|------|
| 每次选项数 | 2-4 个 | `/novel` 主菜单恰好 4 选项（继续/规划/回顾/创建），刚好在限制内 |
| 超时 | 60 秒 | 选项需标记 "(Recommended)" 辅助快速决策 |
| 每会话问题数 | ~4-6 个 | 单次 `/novel` 最多用 2-3 个问题，其余留给写作决策 |
| 子代理可用性 | **不可用** | `/novel` 必须在主会话调用，不能从子代理触发 |
| 已知 Bug | Plan mode 冲突 | 需避免在 plan mode 中使用 |

关键约束：AskUserQuestion 在子代理中不可用（GitHub Issue #18721），意味着只有 command 文件中的主 Claude 能提问。

### 4. 有状态 CLI 的检查点恢复

Terraform 模式（`terraform.tfstate` → `plan` → `apply`）验证了"从检查点自动恢复并建议下一步"的可行性。关键设计原则：
- 检查点只在已知一致状态写入（原子操作）
- `plan` 和 `apply` 分离——从不自动执行破坏性操作
- 检查点损坏时提供恢复选项

cc-novel-writer 的 `.checkpoint.json` 设计已符合这些原则。

### 5. 认知负载

Miller's Law 现代修正：工作记忆约 4 项（非传统 7±2）。

5 个命令本身不超限，但问题在于 **"plan" 和 "review" 的触发时机不直观** — 用户需要判断"我现在该 plan 还是 continue？"。这正是交互入口要解决的问题。

3 个命令（/novel + /novel-continue + /novel-status）< Miller 下限（4），认知负载最优。

### 6. 可发现性

clig.dev："Discoverable CLIs suggest what command to run next."

`/novel` 的状态感知推荐（"你在 Vol 2 Ch 48，建议续写"）比静态列表更有发现价值。首次运行展示所有功能概览，后续基于状态推荐。

### 7. 高级用户逃逸通道

| 用户类型 | 路径 | 触发 |
|---------|------|------|
| 新用户 | `/novel` → 交互引导 | AskUserQuestion |
| 日常用户 | `/novel-continue` | 直接命令 |
| 高级用户 | `/novel-continue 5` | 带参数 |
| 查看状态 | `/novel-status` | 直接命令 |
| 周期操作 | `/novel` → "规划新卷" | 交互选择 |

## 推荐方案

**三命令混合模式**：

```
/novel              # 状态感知交互入口（合并 create/plan/review）
/novel-continue [N] # 高频直接命令（日常续写）
/novel-status       # 只读快速查看
```

`/novel` 入口逻辑：
```
1. 读取 .checkpoint.json
2. 判断状态：
   - 不存在 → 推荐"创建新项目"
   - 当前卷未完成 → 推荐"继续写作"
   - 当前卷已完成 → 推荐"规划新卷"
   - 任何状态 → 可选"质量回顾"
3. AskUserQuestion(options=[推荐项, 其他 2-3 项])
4. 根据选择 → Task tool 派发对应 agent
```

### 风险

| 风险 | 缓解 |
|------|------|
| AskUserQuestion 60 秒超时 | 选项标记 "(Recommended)"，默认选最安全的下一步 |
| 每会话 4-6 问题限制 | 单次 `/novel` 最多 2-3 个问题 |
| 合并导致 command .md 过大 | `/novel` 只做路由调度，逻辑放在 agent/skill 中 |

## Sources

- [clig.dev - Command Line Interface Guidelines](https://clig.dev/)
- [Laws of UX - Miller's Law / Hick's Law](https://lawsofux.com/)
- [Lucas F. Costa - UX Patterns for CLI Tools](https://lucasfcosta.com/2022/06/01/ux-patterns-cli-tools.html)
- [AskUserQuestion in Subagents (Issue #18721)](https://github.com/anthropics/claude-code/issues/18721)
- [SmartScope - AskUserQuestion Tool Guide (Archived)](https://web.archive.org/web/20260112214813/https://smartscope.blog/en/generative-ai/claude/claude-code-askuserquestion-tool-guide/)
- [Terraform State Documentation](https://developer.hashicorp.com/terraform/language/state)
- [awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code)
