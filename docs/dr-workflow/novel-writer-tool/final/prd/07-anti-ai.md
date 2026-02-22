## 7. 去 AI 化策略

### Layer 1: 风格锚定（输入层）

快速起步时，用户提供 1-3 章自己写的风格样本。StyleAnalyzer 提取：
- 平均句长、对话/叙述比例、常用词频
- 修辞偏好（比喻频率、排比、短句切换）
- 禁忌词表（用户不会用的词）
- **正向写作指令**（`writing_directives`）：从样本归纳出可执行的风格指南（如"偏短句、动作推进"、"对话中多插一句生活化吐槽"），直接注入 ChapterWriter prompt

输出 `style-profile.json`，注入所有 ChapterWriter 和 StyleRefiner 调用。

**风格样本降级方案**（无自有样本时）：
1. **仿写模式**（推荐）：用户指定喜欢的网文作者，StyleAnalyzer 分析其公开章节提取风格指纹，标记为 `source_type: "reference"`
2. **先写后提**：用户在工具辅助下先写 1 章，再提取风格
3. **预置模板**：提供 3-5 种常见网文风格模板（如"轻松幽默"、"热血少年"、"细腻言情"），用户选择后微调

### Layer 2: 约束注入（生成层）

ChapterWriter prompt 增加反 AI 约束：
- 禁用 AI 高频用语黑名单（`ai-blacklist.json`）
- 对话带角色语癖
- 每章 ≥1 处反直觉细节
- 场景描写 ≤2 句
- 禁止连续 3 句相同句式

### Layer 3: 后处理（StyleRefiner）

ChapterWriter 初稿 → StyleRefiner（Opus）：
1. 替换命中黑名单的用语
2. 调整句式匹配 style-profile
3. 保留语义不变

单章额外成本 ~$0.08-0.12。

### Layer 4: 检测度量

QualityJudge 新增第 7 维度"风格自然度"：
- AI 黑名单词命中率 < 3 次/千字
- 句式重复率（相邻 5 句中重复句式 < 2）
- 与 style-profile 的匹配度

### 黑名单维护

- 初始化：收集 LLM 高频用语
- 持续更新：QualityJudge 检测到新高频 AI 用语时追加
- 用户自定义：允许添加/删除

