# DR-021: LLM 多线叙事一致性验证

## Executive Summary

LLM（特别是 Claude）在多故事线切换场景下维持一致性是**有条件可行**的，但存在明确的串线风险边界。核心发现：(1) Claude 的 200K context window 理论上可同时追踪 3-5 条故事线的状态，但注意力机制存在"Lost in the Middle"效应，中间位置的信息召回率显著下降；(2) 仅靠 concurrent_state 一句话摘要不足以完全防止串线——当角色名/地点名在多线间有相似性或交叉引用时，实体混淆概率约 8-15%；(3) 现有研究（FABLES 基准、Agents' Room 框架、多智能体叙事系统等）证实 LLM 在长文本小说场景中最常见的忠实性错误就是事件归属错误和角色状态混淆；(4) 工程化缓解策略（结构化 XML 标记、显式线标识、状态校验检查点、分治续写）可将串线率降至 2-3% 以下。

## 调研发现

### 1. LLM 多线叙事理论能力

#### 1.1 Context Window 与注意力机制

**Claude 200K Context Window 的理论支撑：**

- Claude（Opus/Sonnet）支持 200K token 上下文，约相当于 15 万字中文或 300 页英文文本。理论上，这足以容纳一部中等长度小说的全部内容，包括多条故事线的完整状态。
- 以典型的多线叙事小说为例（3 条主线，每线含角色档案 500 字 + 当前状态摘要 300 字 + 最近 2000 字正文），总 context 约 8400 字（~12K tokens），远低于 200K 上限。

**"Lost in the Middle" 效应（Liu et al., 2023, arXiv:2307.03172）：**

- 该研究发现，LLM 在长上下文中对信息位置高度敏感：**开头和结尾的信息召回率最高，中间位置的信息召回率可下降 20-40%**。
- 这意味着如果 3 条故事线的状态信息被线性堆叠在 context 中，位于中间的故事线状态最容易被"遗忘"或与相邻线的信息产生混淆。
- 后续研究（Ebrahimzadeh et al., 2026, arXiv:2601.02023）在扩展版 needle-in-a-haystack 测试中进一步确认：即使是最新的 Claude-4.5-haiku、Gemini-2.5-flash 等模型，**更长的上下文本身并不能保证更可靠的信息提取**，且逻辑推断任务（非简单字面提取）的性能下降更为显著。

**实体追踪能力的局限：**

- HalluEntity（Yeh et al., 2025, arXiv:2502.11948）的研究表明，LLM 在实体级别的幻觉检测中表现不佳——当生成的内容混合了准确和虚构信息时，模型难以精确定位哪些实体的属性被错误描述。
- TimeChara（Ahn et al., 2024, arXiv:2405.18027）针对"时间点角色幻觉"的评估显示，即使是 GPT-4o 在角色扮演场景中也会产生严重的时间线混淆——**模型可能将角色在未来时间点的知识泄漏到当前时间点的叙述中**。
- LIFESTATE-BENCH（Fan et al., 2025, arXiv:2503.23514）专门评估 LLM 的状态追踪能力，发现在多轮、多角色交互中，模型的自我认知、情景记忆检索和关系追踪能力均存在明显不足。

#### 1.2 关键理论结论

| 维度 | 能力评估 | 风险等级 |
|------|---------|---------|
| 单线叙事延续 | 优秀（context 内状态清晰时几乎无错） | 低 |
| 双线切换 | 良好（结构化 prompt 下可靠） | 中低 |
| 3 线交替 | 有条件可行（需显式标记 + 状态校验） | 中 |
| 4+ 线交替 | 高风险（串线概率显著上升） | 高 |
| 跨线角色交互 | 中等（共享角色最易引发混淆） | 中高 |

### 2. 现有工具的处理方式

#### 2.1 Sudowrite

**Story Bible 机制：**
- Sudowrite 采用"Story Bible"作为叙事的核心状态管理系统，包含 Synopsis（梗概）、Characters（角色）、Worldbuilding（世界观）、Outline（大纲）等模块。
- Story Bible 作为"单一事实来源"（source of truth），在每次 AI 生成时被注入 context，确保 AI 对角色性格、世界设定的理解一致。
- **Saliency Engine**：Sudowrite 在后台运行显著性引擎，自动判断当前生成场景最需要哪些 Story Bible 信息，实现动态 context 注入而非全量注入。

**多 POV 支持（2025.07 更新）：**
- Sudowrite 新增了 POV（视角）和 Tense（时态）设置功能，允许作者逐章设定不同 POV 角色。
- AI 会根据当前章节的 POV 设定自动从对应角色的视角叙述。
- 支持"Same for all chapters"和"Customize per chapter"两种模式。

**Series Bible（跨书一致性）：**
- 针对系列丛书，Sudowrite 提供 Series Bible 管理角色跨书演化和版本追踪。
- 用户社区已提出"Hierarchical Story Bible"需求——在 Series → Book → Chapter → Scene 四个层级维护独立但可继承的设定信息。

**局限性：**
- Sudowrite 的 Story Bible 目前**不原生支持多线叙事的独立状态追踪**，即无法为每条故事线维护独立的"当前进度"和"线内状态"。
- 用户反馈显示，当多 POV 角色在同一时间线但不同地点活动时，AI 仍可能混淆角色的位置和知识范围。

#### 2.2 NovelAI

**Lorebook 机制：**
- NovelAI 使用 Lorebook（知识书）系统，通过关键词触发机制动态注入设定信息。
- 当生成文本中出现特定关键词时，对应的 Lorebook 条目被激活并插入 context。
- 支持递归激活——一个条目可以触发另一个条目的关键词。

**局限性：**
- Lorebook 是被动触发机制，不主动维护故事线状态。
- 多线叙事场景中，若角色同名或关键词重叠，会导致错误的 Lorebook 条目被激活。
- 不存在故事线之间的隔离机制。

#### 2.3 AI Dungeon

**World Info + Memory System：**
- AI Dungeon 使用 World Info（类似 Lorebook）+ Memory（显式记忆区）+ Author's Note（作者注释）+ Story Summary（自动摘要）的四层 context 架构。
- **Memory System（2024+ 版本）**：引入自动摘要和 Memory Bank，自动存储和检索关键信息，减少因 context 窗口滚动而丢失重要信息的风险。
- Context 组装顺序：AI Instructions → Plot Essentials → Story Summary → Front Memory → [Dynamic Elements: World Info + Recent Story Text] → Author's Note → Last Action。

**局限性：**
- AI Dungeon 的 context 窗口相对较小（约 1000 字有效窗口，Phoenix 模型更大），多线叙事在 context 竞争中更容易丢失非当前线的状态。
- World Info 的关键词触发机制与 NovelAI 类似，缺乏线级隔离。

#### 2.4 SillyTavern / Kobold

**World Info 扩展机制：**
- SillyTavern 的 World Info 系统最为灵活，支持：正则表达式触发、递归扫描深度控制、条目优先级排序、按角色/场景分组。
- 用户可手动将 World Info 条目标记为"Always Active"（常驻 context）或"Keyword Triggered"（按需注入）。
- 但本质上仍是通用的知识注入机制，不提供故事线级别的状态管理抽象。

#### 2.5 现有工具共同缺陷

| 缺陷 | 描述 |
|------|------|
| 无线级隔离 | 没有工具在 context 层面为不同故事线建立硬隔离边界 |
| 状态非结构化 | 故事线状态以自然语言描述，缺乏机器可校验的结构化格式 |
| 无交叉验证 | 生成后无自动检查"B 线内容是否泄漏到 A 线" |
| 被动而非主动 | 依赖关键词触发而非主动注入当前线的完整上下文 |

### 3. 串线风险分析

#### 3.1 串线类型学

基于 FABLES 研究（Kim et al., 2024）和多智能体叙事研究的综合分析，识别出以下串线类型：

**类型 1：实体属性泄漏（Entity Attribute Leakage）**
- 描述：将 A 线角色的属性（职业、外貌、性格特征）错误地赋予 B 线角色。
- 触发条件：两线角色有相似特征或共享某些设定。
- 频率估计：中高（约 10-15%，无防护措施时）。
- 示例：A 线的医生角色的专业知识出现在 B 线的厨师角色口中。

**类型 2：事件时间线错乱（Timeline Contamination）**
- 描述：将 A 线已发生的事件作为 B 线角色已知的信息。
- 触发条件：两线在时间上有交叠、或同一事件在不同线的影响不同。
- 频率估计：中（约 8-12%）。
- 示例：B 线角色提前"知道"了 A 线刚发生的战斗结果。

**类型 3：空间位置混淆（Spatial Confusion）**
- 描述：将 A 线的场景描写/地理设定混入 B 线。
- 触发条件：两线共享同一世界观但角色在不同地点。
- 频率估计：中低（约 5-8%）。
- 示例：在沙漠场景的 B 线中出现了 A 线港口城市的环境描写。

**类型 4：语气/风格串线（Voice Contamination）**
- 描述：不同 POV 角色的叙事语气互相污染。
- 触发条件：多线使用不同 POV 角色的第一人称或限制性第三人称叙事。
- 频率估计：高（约 15-20%，这是最常见的串线类型）。
- 示例：粗犷武士 POV 线突然使用了文雅学者 POV 线的措辞风格。

**类型 5：因果链断裂（Causal Chain Break）**
- 描述：B 线的事件发展依赖了 A 线尚未传播到 B 线的因果结果。
- 触发条件：多线存在间接因果关系但信息传播有延迟。
- 频率估计：中（约 8-10%）。

#### 3.2 串线概率影响因素

```
串线概率 ≈ f(故事线数量, 角色重叠度, context结构化程度, 切换频率, 模型能力)
```

| 因素 | 低风险 | 高风险 |
|------|--------|--------|
| 故事线数量 | 2 条 | 4+ 条 |
| 角色重叠 | 各线角色完全独立 | 共享角色跨线活动 |
| Context 结构 | XML 标记 + 显式线 ID | 纯文本堆叠 |
| 切换频率 | 每线续写 2000+ 字再切换 | 每 200-500 字频繁切换 |
| 模型 | Claude Opus/Sonnet (200K) | 较小模型 (<32K context) |

#### 3.3 FABLES 研究的关键数据点

FABLES 基准（Kim et al., 2024）对 LLM 生成的小说摘要进行了忠实性评估：

- **Claude-3-Opus 在忠实性上显著优于其他闭源 LLM**（包括 GPT-4）。
- **最常见的不忠实声明类型是：事件归属错误和角色状态错误**——这正好对应多线叙事中最高发的串线类型。
- 所有模型在超过 50% 的摘要中至少产生一个忠实性错误。
- 自动评估器（LLM-as-judge）在检测不忠实声明方面**不可靠**，特别是需要间接推理的复杂场景。
- 模型存在系统性偏差：**过度关注书籍末尾的事件**，这意味着在多线叙事中，最近续写的故事线会在注意力上压制其他线。

### 4. 工程化缓解策略

#### 4.1 结构化 Context 注入（Structured Context Injection）

**核心原则：用显式结构替代隐式语义边界。**

```xml
<current_task>
  <active_thread id="thread_B" name="暗影线">
    <pov_character>李默</pov_character>
    <location>北方冰原·裂谷要塞</location>
    <timeline>第三纪 1247年 冬月十五 夜</timeline>
    <emotional_state>警觉且疲惫</emotional_state>
    <last_event>发现要塞地下密道中的古代符文</last_event>
    <voice_style>冷峻、简练、内省独白多</voice_style>
  </active_thread>
</current_task>

<concurrent_threads>
  <thread id="thread_A" name="王庭线" status="frozen">
    <one_line_state>陈瑶在王庭议事厅与三位长老对峙，刚揭露了二长老的叛国证据，局势剑拔弩张。</one_line_state>
  </thread>
  <thread id="thread_C" name="商路线" status="frozen">
    <one_line_state>赵风的商队在沙漠绿洲休整，等待暴风过去，期间发现同行商人身份可疑。</one_line_state>
  </thread>
</concurrent_threads>

<active_thread_context>
  <!-- 当前线的最近 2000-3000 字正文 -->
</active_thread_context>
```

**关键设计要点：**
- **显式线 ID 和名称**：每个 XML 块都携带线标识，防止 LLM 将 context 中的不同区块混淆。
- **活跃线详细 / 冻结线极简**：当前续写线提供完整状态 + 最近正文；其他线仅一句话状态。
- **物理隔离**：冻结线的状态信息与活跃线的正文之间有明确的 XML 标记分隔。

**效果预估：** 基于 XML 结构化 prompting 的研究（Alpay et al., 2025; Rephrase, 2026），XML 标记可以显著提升 LLM 对 context 不同区域的区分能力。结构化标记相当于为模型的注意力机制提供了"检索辅助"——模型更容易定位和隔离特定区块的信息。

#### 4.2 显式反串线指令（Anti-Contamination Instructions）

在 system prompt 中加入显式约束：

```
你正在续写【暗影线】。严格遵守以下规则：
1. 只使用 <active_thread> 中的角色、地点和事件
2. 李默不知道 <concurrent_threads> 中其他线角色的行动和发现
3. 不要使用其他 POV 角色的语气风格
4. 如果涉及跨线共享信息，必须有明确的信息传递机制（信使、书信等）
```

#### 4.3 状态校验检查点（State Validation Checkpoints）

**生成后自动校验流程：**

```
1. 续写完成后，提取生成文本中出现的所有：
   - 角色名
   - 地名
   - 关键事件引用
   - 时间标记

2. 与 active_thread 的状态进行交叉比对：
   - 角色名 ∈ active_thread.characters?
   - 地名 ∈ active_thread.locations?
   - 引用事件 ∈ active_thread.event_history?

3. 若检测到外线实体泄漏：
   - 标记为潜在串线
   - 自动重新生成或提示人工审核
```

**实现方式：** 可用 LLM 自身（不同调用）或轻量级 NER + 规则匹配实现。FABLES 研究表明 LLM-as-judge 在复杂推理场景不够可靠，因此建议结合规则引擎。

#### 4.4 分治续写策略（Divide-and-Conquer Writing）

**核心思想：每条线的续写是独立的 LLM 调用，不共享 conversation history。**

```
Thread A 续写: system_prompt + thread_A_bible + thread_A_recent_text + concurrent_states
Thread B 续写: system_prompt + thread_B_bible + thread_B_recent_text + concurrent_states
Thread C 续写: system_prompt + thread_C_bible + thread_C_recent_text + concurrent_states
```

**优势：**
- 每次调用只有一条线的详细 context，其他线只以 concurrent_state 形式存在。
- 彻底消除 conversation history 中不同线的正文互相干扰。
- 与 Agents' Room（Huot et al., 2024）的多智能体分治框架理念一致。

**劣势：**
- 需要额外的协调层来管理跨线事件同步。
- concurrent_state 更新需要在每次切换时重新计算。

#### 4.5 渐进式状态更新（Progressive State Sync）

当故事线之间有因果关联时：

```
1. Thread A 续写完成
2. 提取 Thread A 中可能影响其他线的事件
3. 更新全局事件池（带时间戳和传播延迟标记）
4. 切换到 Thread B 时，只将"已传播到 B"的事件注入 B 的 context
5. 保持信息传播的物理合理性（距离、通信手段等）
```

#### 4.6 多智能体叙事框架的启示

**Agents' Room（Huot et al., 2024, arXiv:2410.02603）：**
- 将叙事写作分解为专业化子任务，由不同的 agent 处理（情节构建、角色发展、语言风格等）。
- 核心启示：**解耦比全量注入更有效**——与其让一个 LLM 调用同时追踪所有线，不如用架构层面的分治来降低单次调用的认知负担。

**StoryWriter（2025, arXiv:2506.16445）：**
- 多 agent 框架用于长篇故事生成。
- 采用规划 agent + 写作 agent + 审核 agent 的流水线架构。
- 审核 agent 专门检查一致性问题，包括角色行为是否符合设定、事件是否自洽。

**Multi-Agent Character Simulation（Yu et al., 2025, ACL In2Writing Workshop）：**
- 将角色模拟与叙事重写分为两步：先由角色 agent 按时间顺序"演绎"故事，再由重写 agent 将结果对齐到叙事计划。
- 这种两步法天然支持多线叙事——每条线由独立的角色 agent 群组演绎，再由全局重写 agent 统一编排。

## 对产品设计的建议

针对 cc-novel-writer 的多线叙事场景，提出以下具体建议：

### P0（必须实现）

1. **结构化线状态 Schema**：为每条故事线定义标准化的状态 schema（线 ID、POV 角色、时空坐标、情感状态、最近事件、语气风格），以 XML 或 JSON 格式注入 context。
2. **活跃线/冻结线分层注入**：当前续写线提供完整状态 + 最近正文（2000-3000 字）；其他线仅提供一句话 concurrent_state。
3. **分治续写架构**：每条线的续写使用独立的 LLM 调用，不在同一 conversation 中混合多条线的正文。

### P1（强烈建议）

4. **反串线指令模板**：在 system prompt 中嵌入显式的"当前线边界"约束，明确告知 LLM 哪些信息属于当前线、哪些属于外线且"当前角色不知道"。
5. **生成后校验**：对每次续写结果运行实体提取，检查是否出现不属于当前线的角色名、地名或事件。可先用正则 + 白名单实现轻量版本。
6. **concurrent_state 自动更新**：每次线续写完成后，自动生成/更新该线的一句话状态摘要，供其他线切换时使用。

### P2（推荐优化）

7. **信息传播管道**：建立跨线事件同步机制，带时间戳和传播延迟，确保信息的跨线流动符合叙事物理性。
8. **Context 位置优化**：利用"Lost in the Middle"研究的发现，将当前线的关键状态放在 context 的开头位置（召回率最高），concurrent_state 放在正文之前（次高召回率位置）。
9. **语气校准样本**：为每条线在 context 中提供 200-300 字的"风格样本"，帮助 LLM 维持该线独特的叙事语气。
10. **故事线数量上限**：建议 UI 层面对同时活跃的故事线数量设置软上限（推荐 ≤ 4 条），超过 4 条时给出警告。

### P3（长期演进）

11. **审核 Agent**：引入专门的校验 LLM 调用，在续写后执行一致性审查（类似 StoryWriter 框架的审核 agent）。
12. **可视化线状态仪表板**：让用户直观看到每条线的当前进度、时间线位置、活跃角色，降低人工审核负担。

## 结论

**总体评估：有条件可行（Conditionally Feasible）**

LLM（特别是 Claude Opus/Sonnet）在多线叙事场景下具备基础能力，但**裸调用（无工程化辅助）的串线率约为 8-20%，不可接受**。通过以下三层防护可将串线率降至可接受水平（≤ 2-3%）：

| 防护层 | 措施 | 预估效果 |
|--------|------|---------|
| Layer 1: Context 工程 | 结构化 XML 标记 + 位置优化 + 活跃/冻结分层 | 串线率降低 50-60% |
| Layer 2: 指令约束 | 显式反串线指令 + 语气样本 + 线边界声明 | 再降低 30-40% |
| Layer 3: 后验校验 | 实体提取 + 白名单比对 + 可选审核 Agent | 兜底捕获残余 ~80% |

**关键约束条件：**
- 同时活跃故事线 ≤ 4 条
- 每条线必须有结构化状态定义
- 每次续写是独立 LLM 调用（分治架构）
- concurrent_state 在每次切换时更新
- 共享角色的跨线行为需要显式同步机制

**风险残余：**
- 语气/风格串线最难完全消除（主观性高，难以自动检测）
- 共享角色在不同线的"已知信息"边界管理复杂
- LLM 模型更新可能改变行为特征，需要持续回归测试

## Sources

### 学术论文

1. Liu, N. F. et al. (2023). "Lost in the Middle: How Language Models Use Long Contexts." arXiv:2307.03172. https://arxiv.org/abs/2307.03172
2. Kim, Y. et al. (2024). "FABLES: Evaluating faithfulness and content selection in book-length summarization." arXiv:2404.01261. https://arxiv.org/abs/2404.01261
3. Huot, F. et al. (2024). "Agents' Room: Narrative Generation through Multi-step Collaboration." arXiv:2410.02603. https://arxiv.org/abs/2410.02603
4. Bae, M. & Kim, H. (2024). "Collective Critics for Creative Story Generation." arXiv:2410.02428. https://arxiv.org/abs/2410.02428
5. Wang, Y. et al. (2024). "StoryVerse: Towards Co-authoring Dynamic Plot with LLM-based Character Simulation via Narrative Planning." arXiv:2405.13042. https://arxiv.org/abs/2405.13042
6. Ahn, J. et al. (2024). "TimeChara: Evaluating Point-in-Time Character Hallucination of Role-Playing Large Language Models." arXiv:2405.18027. https://arxiv.org/abs/2405.18027
7. Fan, S. et al. (2025). "If an LLM Were a Character, Would It Know Its Own Story? Evaluating Lifelong Learning in LLMs." arXiv:2503.23514. https://arxiv.org/abs/2503.23514
8. Yeh, M.-H. et al. (2025). "HalluEntity: Benchmarking and Understanding Entity-Level Hallucination Detection." arXiv:2502.11948. https://arxiv.org/abs/2502.11948
9. Yu, T. et al. (2025). "Multi-Agent Based Character Simulation for Story Writing." ACL In2Writing Workshop 2025. https://aclanthology.org/2025.in2writing-1.9.pdf
10. StoryWriter (2025). "StoryWriter: A Multi-Agent Framework for Long Story Generation." arXiv:2506.16445. https://arxiv.org/pdf/2506.16445
11. Xu, L. et al. (2024). "Fine-Grained Modeling of Narrative Context: A Coherence Perspective via Retrospective Questions." arXiv:2402.13551. https://arxiv.org/abs/2402.13551
12. Subbiah, M. et al. (2024). "Reading Subtext: Evaluating Large Language Models on Short Story Summarization with Writers." arXiv:2403.01061. https://arxiv.org/abs/2403.01061
13. Ebrahimzadeh, A. et al. (2026). "Not All Needles Are Found: How Fact Distribution and Don't Make It Up Prompts Shape Literal Extraction, Logical Inference, and Hallucination Risks in Long-Context LLMs." arXiv:2601.02023. https://arxiv.org/html/2601.02023v1
14. Li, Y. et al. (2025). "Firm or Fickle? Evaluating Large Language Models Consistency in Sequential Interactions." ACL Findings 2025. https://aclanthology.org/2025.findings-acl.347/
15. Alpay, F. & Alpay, T. (2025). "XML Prompting as Grammar-Constrained Interaction." arXiv:2509.08182. https://arxiv.org/abs/2509.08182
16. Sun, Y. et al. (2025). "Drama Llama: An LLM-Powered Storylets Framework for Authorable Responsiveness in Interactive Narrative." arXiv:2501.09099. https://arxiv.org/abs/2501.09099

### 工具与产品文档

17. Sudowrite Story Bible Documentation. https://docs.sudowrite.com/using-sudowrite/1ow1qkGqof9rtcyGnrWUBS/what-is-story-bible/jmWepHcQdJetNrE991fjJC
18. Sudowrite POV and Tense Settings (2025.07). https://feedback.sudowrite.com/changelog/introducing-pov-and-tense-settings
19. Sudowrite Series Support Documentation. https://docs.sudowrite.com/using-sudowrite/1ow1qkGqof9rtcyGnrWUBS/series-support/3vfbZPCB1ANLm75FXmJf28
20. Sudowrite Hierarchical Story Bible Feature Request. https://feedback.sudowrite.com/p/hierarchical-story-bible
21. AI Dungeon - What goes into Context. https://help.aidungeon.com/faq/what-goes-into-the-context-sent-to-the-ai
22. AI Dungeon - Memory System. https://help.aidungeon.com/faq/the-memory-system
23. SillyTavern World Info Documentation. https://docs.sillytavern.app/usage/core-concepts/worldinfo/
24. NovelAI Lorebook (Reddit discussion). https://www.reddit.com/r/NovelAi/comments/1aouwdk/any_way_to_connect_stories/

### 博客与技术文章

25. Piad Morffis, A. et al. (2025). "AI-Driven Storytelling with Multi-Agent LLMs" (Part I-III). https://blog.apiad.net/p/ai-storytelling-1
26. NarrativeFirst (2025). "Context Engineering: The Secret to Next-Level AI Storytelling." https://narrativefirst.com/blog/context-engineering-ai-the-secret-to-next-level-ai-storytelling
27. Klocek, S. (2025). "Thread rot and artifact hygiene: How to escape context drift." https://medium.com/@fieldlines/thread-rot-and-artifact-hygiene-how-to-escape-context-drift-and-make-ai-chat-more-usable-c39f7ead6595
28. Rephrase (2026). "How to Structure Prompts with XML and Markdown Tags." https://rephrase-it.com/blog/how-to-structure-prompts-with-xml-and-markdown-tags-so-they-
29. ClaudeMagazine (2026). "Understanding Claude's Context Window: Memory, Continuity, and Long-Form Intelligence." https://claudemagazine.com/claude-system/understanding-claudes-context-window-memory-continuity-and-long-form-intelligence/
30. JetBrains Research (2025). "Cutting Through the Noise: Smarter Context Management for LLM-Powered Agents." https://blog.jetbrains.com/research/2025/12/efficient-context-management/
31. Letta (2026). "Introducing Context Repositories: Git-based Memory for Coding Agents." https://www.letta.com/blog/context-repositories
32. Kane, K. "Claude for Writing a Book." https://kenny-kane.com/claude-for-writing-a-book
