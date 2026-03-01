# novel-writer-cli — 中文网文 AI 协作创作 CLI

确定性编排 CLI + 9 个 AI Agent 协作完成网文创作全流程：世界观构建 → 卷级规划 → 章节续写 → 风格润色 → 质量验收 → 周期性一致性审计。内置去 AI 化四层策略和 Spec-Driven 规范体系，产出接近人类写手的长篇中文网络小说。

> **注**：本仓库为 CLI 版本，负责确定性编排与多 Agent 调度。Claude Code Plugin 版本见 [novel-writer-plugin](https://github.com/DankerMu/novel-writer-plugin)。

## 快速开始

### 前置条件

- Node.js 18+
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) 已安装并登录
- Python 3.10+（评估脚本需要）

### 安装



### 基本用法



`novel` CLI **不调用任何 LLM API**，只负责确定性编排：读取 checkpoint、生成 instruction packet、校验产物、推进状态。LLM 执行由 Claude Code 或 Codex 等外部执行器完成。

详见 [CLI 完整文档](docs/user/novel-cli.md)。

### 三个入口命令（Claude Code 集成）

在 Claude Code 中可直接使用 Skill 命令：

| 命令 | 用途 |
|------|------|
| `/novel:start` | 从创作纲领（brief）冷启动一个新项目 |
| `/novel:continue` | 续写下一章 / 推进到下一卷 |
| `/novel:status` | 查看当前项目进度、状态与统计 |

**30 秒体验**：执行 `/novel:start`，按提示填写题材、主角和核心冲突，系统自动创建项目结构并试写 3 章。详见 [快速起步指南](docs/user/quick-start.md)。

### 推荐配套

以下技能非必须，但能显著提升创作质量：

| 技能 | 用途 | 安装 |
|------|------|------|
| `doc-workflow` | 深度背景研究（历史/科幻/军事题材推荐） | 见 [CCskill 仓库](https://github.com/DankerMu/CCskill) |
| `brainstorming` | 结构化脑暴（世界观/角色/情节设计） | 同上 |
| `deep-research` | 多源信息综合研究 | 同上 |

## 架构概览

### CLI 编排层

`novel` CLI 是确定性编排核心，不依赖 LLM：



- **next**：从 `.checkpoint.json` + `staging/` 计算下一步
- **instructions**：生成 instruction packet（JSON），作为编排→执行器的稳定边界
- **validate**：校验 staging 产物合规性
- **advance**：推进 checkpoint 状态
- **commit**：将 staging 事务提交到正式目录，更新 `state/` 与 `foreshadowing/`

### 9 Agent 协作体系

| Agent | 模型 | 职责 |
|-------|------|------|
| **WorldBuilder** | Opus | 世界观构建 + L1 硬规则（物理/魔法/社会） |
| **CharacterWeaver** | Opus | 角色网络 + L2 契约（能力边界/行为模式） |
| **PlotArchitect** | Opus | 卷级大纲 + L3 章节契约 + 故事线调度 |
| **ChapterWriter** | Sonnet | 章节续写 + 多线叙事 + 防串线 |
| **Summarizer** | Sonnet | 摘要 + 状态增量 + 串线检测 |
| **StyleAnalyzer** | Sonnet | 用户样本 → 风格指纹 (`style-profile.json`) |
| **StyleRefiner** | Opus | 去 AI 化润色（黑名单替换 + 风格匹配） |
| **QualityJudge** | Sonnet | 双轨验收：合规检查 + 8 维度评分 |
| **ConsistencyAuditor** | Sonnet | 滑动窗口一致性审计（stride=5, window=10）+ 卷末全卷审计 |

### Spec-Driven 四层规范

写小说如同写代码——规范先行，验收对齐规范：

| 层级 | 内容 | 约束强度 |
|------|------|----------|
| **L1** 世界规则 | `rules.json` — 不可违反的硬约束 | 铁律 |
| **L2** 角色契约 | `contracts/` — 能力/行为边界 | 可变更需走协议 |
| **L3** 章节契约 | `chapter-contracts/` — 前/后置条件 | 可协商须留痕 |
| **LS** 故事线 | `storylines.json` — 多线叙事约束 | 跨线泄漏为硬违规 |

### 卷制滚动工作流

网文采用「边写边想」模式，以卷（30-50 章）为单位滚动推进：



每章经过完整流水线：



### 质量门控

8 维度加权评分（1-5 分）：



五档门控决策：≥4.0 通过 → ≥3.5 二次润色 → ≥3.0 自动修订 → ≥2.0 人工审核 → <2.0 强制重写。关键章节启用 Sonnet + Opus 双裁判。

### 去 AI 化策略

四层流水线确保输出像人写的：

1. **风格锚定**：从用户样本提取风格指纹
2. **约束注入**：AI 黑名单 + 语癖 + 句式多样化
3. **后处理**：StyleRefiner 替换 AI 用语 + 匹配风格
4. **检测度量**：黑名单命中 < 3 次/千字，相邻 5 句重复句式 < 2

## 项目结构



## 评估与回归

项目内置完整的评估基础设施，用于校准 QualityJudge 并跟踪质量回归：



## CI

PR 合入 `main` 自动触发：

- **Markdown lint** — `npx markdownlint-cli2 "docs/**/*.md"`
- **链接检查** — `lychee` 死链扫描
- **Manifest 校验** — `manifest.json` 结构完整性

## 开发进度

| 里程碑 | 描述 | 状态 |
|--------|------|------|
| **M1** | 续写引擎基础（9 Agent + 3 Entry Skill + 模板） | 已完成 |
| **M2** | Context 组装与状态机（Orchestrator + Spec 注入 + Hooks） | 已完成 |
| **M3** | 质量门控与分析（5 档门控 + 双裁判 + NER + 伏笔 + 回归） | 已完成 |
| **M4** | 端到端打磨（Quick Start + 跨卷 + E2E 基准） | 进行中 |
| **M5** | CLI 编排核心（确定性编排 + instruction packet + Codex 集成） | 进行中 |

详见 [progress.md](progress.md)。

## 许可

本项目尚未选定开源许可证。如需使用请先联系作者。

## 作者

**DankerMu** — [mumzy@mail.ustc.edu.cn](mailto:mumzy@mail.ustc.edu.cn)
