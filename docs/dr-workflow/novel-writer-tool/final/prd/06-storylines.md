### 6.6 多线叙事体系（Multi-Thread Narrative）

现代网文的叙事结构远非单线连续——多 POV 群像、势力博弈暗线、跨百万字伏笔交汇、回忆/平行时间线交错是常态（如《赤心巡天》的"靖海计划"从第二卷埋线到第十三卷交汇，跨 700 万字）。系统需要在**小说级定义故事线、卷级调度交织节奏、章级注入上下文**。[DR-021](../../v5/dr/dr-021-llm-multi-thread-narrative.md)

**可行性结论**：LLM 多线叙事一致性为**有条件可行**。裸调用串线率 8-20%，通过三层防护（Context 工程 + 指令约束 + 后验校验）可降至 ≤2-3%。关键约束：同时活跃故事线 ≤ 4 条，每次续写为独立 LLM 调用（分治架构）。

#### 6.6.1 故事线数据模型

小说级 `storylines/storylines.json` 定义所有故事线，类似 `characters/` 管理角色：

```json
{
  "storylines": [
    {
      "id": "jiangwang_dao",
      "name": "主角证道之路",
      "type": "main_arc",
      "scope": "novel",
      "pov_characters": ["主角"],
      "affiliated_factions": ["齐国", "太虚阁"],
      "timeline": "present",
      "status": "active",
      "description": "核心成长线"
    },
    {
      "id": "jinghai_plan",
      "name": "靖海计划",
      "type": "conspiracy",
      "scope": "multi_volume",
      "pov_characters": ["许象乾", "主角"],
      "affiliated_factions": ["景国", "佑国", "海族"],
      "timeline": "present",
      "status": "dormant",
      "introduced_volume": 2,
      "description": "跨国海权博弈暗线，多势力交织"
    },
    {
      "id": "zhonggu_secret",
      "name": "中古之秘",
      "type": "mystery",
      "scope": "novel",
      "pov_characters": [],
      "affiliated_factions": ["长河龙宫", "人皇烈山"],
      "timeline": "past",
      "status": "planned",
      "description": "历史真相揭示线，无固定POV，通过多角色碎片拼凑"
    }
  ],
  "relationships": [
    {
      "from": "jiangwang_dao",
      "to": "jinghai_plan",
      "type": "entangled",
      "bridges": {
        "shared_characters": ["主角", "许象乾", "李龙川"],
        "shared_foreshadowing": ["巨龟初现", "天地斩衰"],
        "shared_events": []
      },
      "convergence_condition": "主角卷入海域事件时自然交汇",
      "narrative_function": "主线角色因副线事件承受命运反噬"
    }
  ],
  "storyline_types": [
    "main_arc",
    "faction_conflict",
    "conspiracy",
    "mystery",
    "character_arc",
    "parallel_timeline"
  ]
}
```

核心设计点：
- **type** 覆盖所有叙事模式：主角成长线、势力博弈线、阴谋暗线（长跨度）、真相揭示线（碎片拼凑）、配角独立成长线、回忆/平行时间线
- **scope**：`novel`（全书贯穿）/ `multi_volume`（跨卷）/ `single_volume`（卷内），标识生命周期
- **affiliated_factions**：故事线绑定势力而非单一角色，支持群像叙事
- **无固定 POV 线**：`pov_characters` 为空的线通过多角色视角碎片拼凑
- **bridges**：角色 + 伏笔 + 事件三维桥梁，比简单的"共享角色"更完整
- **narrative_function**：描述两条线交汇的叙事意义，指导 PlotArchitect

#### 6.6.2 卷级调度机制

PlotArchitect 在卷规划时，从 `storylines.json` 选取本卷活跃线，生成卷级故事线编排（写入 `volumes/vol-N/storyline-schedule.json`）：

```json
{
  "volume": 3,
  "volume_theme": "豪杰举",
  "active_storylines": [
    {
      "storyline_id": "jiangwang_dao",
      "volume_role": "primary",
      "target_chapters": 20,
      "arc_goal": "主角在本卷突破境界"
    },
    {
      "storyline_id": "jinghai_plan",
      "volume_role": "secondary",
      "target_chapters": 6,
      "arc_goal": "靖海计划第一次浮出水面"
    },
    {
      "storyline_id": "zhonggu_secret",
      "volume_role": "seasoning",
      "target_chapters": 2,
      "arc_goal": "通过遗迹探索揭示一个中古碎片"
    }
  ],
  "interleaving_pattern": {
    "strategy": "primary_dominant",
    "primary_max_consecutive": 5,
    "secondary_min_appearance": "every_8_chapters",
    "seasoning_placement": "mid_volume_and_climax"
  },
  "convergence_events": [
    {
      "chapter_range": [25, 28],
      "involved_storylines": ["jiangwang_dao", "jinghai_plan"],
      "trigger": "关键角色之死将主线与暗线强制交汇",
      "aftermath": "主线承受副线余波"
    }
  ],
  "dormant_storylines": ["faction_internal"],
  "newly_activated": ["jinghai_plan"]
}
```

- **volume_role** 三档：`primary`（主推进）/ `secondary`（穿插）/ `seasoning`（点缀）
- **interleaving_pattern**：给 PlotArchitect 节奏约束而非精确排布，具体在大纲中动态决定
- **convergence_events**：带章节范围的交汇预规划，PlotArchitect 根据剧情微调

#### 6.6.3 章节契约扩展

现有 L3 chapter-contract 增加故事线上下文：

```json
{
  "chapter": 26,
  "storyline_id": "jinghai_plan",
  "storyline_context": {
    "last_chapter_on_this_line": 18,
    "last_chapter_summary": "许象乾秘密接触佑国使者，巨龟异动被主角察觉",
    "chapters_since_last": 8,
    "line_arc_progress": "40%",
    "concurrent_state": {
      "jiangwang_dao": "主角正在闭关冲击新境界（ch25）",
      "zhonggu_secret": "遗迹线索指向龙宫（ch22）"
    }
  },
  "transition_hint": {
    "next_storyline": "jiangwang_dao",
    "bridge": "主角闭关被海域震动打断，自然切回主线"
  }
}
```

- **concurrent_state**：其他活跃线此刻的一句话进展，ChapterWriter 可植入暗示
- **transition_hint**：本章结尾如何过渡到下一条线，保证切线不突兀

#### 6.6.4 LS 故事线规范（Storyline Spec）

与 L1/L2/L3 平行的独立 Spec 层，**以 soft 约束为主，仅时间线一致性为 hard**：

```json
{
  "spec_version": 1,
  "rules": [
    {
      "id": "LS-001",
      "category": "continuity",
      "rule": "同一时间发生的不同线事件，时间线不得矛盾",
      "constraint_type": "hard"
    },
    {
      "id": "LS-002",
      "category": "transition",
      "rule": "故事线切换时，建议在开头 200 字内建立时空锚点",
      "constraint_type": "soft"
    },
    {
      "id": "LS-003",
      "category": "convergence",
      "rule": "交汇事件前建议在涉及的线各铺垫至少一次",
      "constraint_type": "soft"
    },
    {
      "id": "LS-004",
      "category": "dormancy",
      "rule": "休眠线重新激活时，建议通过角色回忆或对话重建读者记忆",
      "constraint_type": "soft"
    },
    {
      "id": "LS-005",
      "category": "contamination",
      "rule": "非交汇事件章中，不得出现其他故事线的角色独有信息（Summarizer leak_risk: high 触发）",
      "constraint_type": "soft",
      "_note": "M1/M2 为 soft（依赖 NER 对齐，误报率高），M3 具备实体检测能力后升级为 hard"
    }
  ]
}
```

设计原则：**创作不是编译，过度约束限制发挥**。hard 只留"不可违反的逻辑错误"（时间线矛盾），其余均为建议性 soft 约束，QualityJudge 对 soft 只报告不阻断。

#### 6.6.5 QualityJudge 扩展

Track 1（合规检查）新增 LS 层：
- LS-001（hard）：检查本章事件时间是否与并发线矛盾
- LS-002~004（soft）：报告但不阻断

Track 2（质量评分）新增维度：
- `storyline_coherence`（权重 0.08）：切线流畅度、读者跟线难度、并发线暗示自然度

**权重定版方案**（8 维度总和 = 1.0）：

| 维度 | 权重 | 说明 |
|------|------|------|
| plot_logic（情节逻辑） | 0.18 | 与大纲一致度、因果链 |
| character（角色塑造） | 0.18 | 言行符合人设、性格连续性 |
| immersion（沉浸感） | 0.15 | 画面感、氛围营造 |
| foreshadowing（伏笔） | 0.10 | 埋设/推进/回收 |
| pacing（节奏） | 0.08 | 冲突强度、张弛有度 |
| style_naturalness（风格自然度） | 0.15 | 黑名单命中率、句式重复率 |
| emotional_impact（情感冲击） | 0.08 | 情感起伏、读者代入感 |
| storyline_coherence（故事线连贯） | 0.08 | 切线流畅度、跟线难度、并发线暗示自然度 |

#### 6.6.6 Agent 职责扩展

| Agent | 新增职责 | 新增输入/输出 |
|-------|---------|-------------|
| PlotArchitect | 卷规划时选取活跃线、规划交织节奏、标记交汇事件 | 输入：`storylines.json`；输出：`storyline-schedule.json` |
| ChapterWriter | 意识到"我在写哪条线"，可植入其他线暗示，遵循 transition_hint | 输入：`storyline_context` + `concurrent_state` |
| QualityJudge | LS 合规检查 + storyline_coherence 评分 | 输入：`storyline-spec.json` + `storyline-schedule.json` |
| WorldBuilder | 初始化时协助定义 storylines.json（势力关系 → 派生故事线） | 输出：`storylines.json`（协作） |
| Summarizer | 摘要标记 storyline_id，便于按线检索 | 输出增加 `storyline_id` 字段 |

不新增 agent，不改变现有工作流骨架。StyleAnalyzer、StyleRefiner、CharacterWeaver 无需变动。

#### 6.6.7 防串线策略（Anti-Contamination）[DR-021]

DR-021 调研表明，LLM 多线叙事的五类串线风险（实体属性泄漏 10-15%、事件时间线错乱 8-12%、空间位置混淆 5-8%、语气风格串线 15-20%、因果链断裂 8-10%）需要三层工程化防护：

**Layer 1: 结构化 Context 注入**
- ChapterWriter 的故事线 context 采用结构化格式（XML/JSON），显式标记活跃线 vs 冻结线
- 每条线维护独立的 `storylines/{id}/memory.md`（≤500 字关键事实），Summarizer 每章自动更新
- 写章时注入：当前线 memory + 相邻线 memory（schedule 指定）+ 交汇线 memory（交汇事件章）
- 冻结线仅提供 concurrent_state 一句话摘要，不注入 memory（降低"全局信息涌入"风险）
- Context 位置优化：活跃线状态放在 context 开头（利用 "Lost in the Middle" 研究，开头召回率最高）

**Layer 2: 反串线指令**
- ChapterWriter prompt 嵌入显式线边界约束："只使用当前线的角色/地点/事件"
- 明确告知"当前 POV 角色不知道其他线角色的行动和发现"
- 跨线信息传递必须有叙事合理的机制（信使、书信、偶遇等）

**Layer 3: 后验校验（QualityJudge 扩展）**
- Summarizer 输出 `cross_references[]`（本章提及的非本线实体）和 `leak_risk` 标记
- QualityJudge 对每次续写结果提取实体（角色名、地名、事件引用），与活跃线白名单交叉比对
- LS-005（M1/M2 soft → M3 hard）：非交汇事件章中，`leak_risk: high` 的跨线实体泄漏。M1/M2 阶段报告但不阻断（缺乏确定性 NER，误报率高）；M3 具备实体检测后升级为 hard 强制修正
- 检测到外线实体泄漏时标记为 LS violation

**分治续写架构**：每条故事线的续写是独立的 LLM 调用，不在同一 conversation 中混合多条线的正文。与 Agents' Room（Huot et al., 2024）等多智能体叙事框架的设计理念一致。

