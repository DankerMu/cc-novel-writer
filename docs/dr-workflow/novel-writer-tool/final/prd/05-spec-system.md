### 6.5 规范驱动写作体系（Spec-Driven Writing）

小说创作与软件开发共享同一核心范式：**规范先行，实现随后，验收对齐规范**。设定是架构文档，角色是接口定义，大纲是需求规格，章节是实现，质量检查是测试套件。

#### 6.5.1 三层 Spec 体系

| 层级 | 内容 | 格式 | 生成者 | 验证者 | 约束强度 | 软件类比 |
|------|------|------|--------|--------|---------|---------|
| **L1 世界规则** | 物理/魔法/地理/社会硬约束 | `world/rules.json` | WorldBuilder 抽取 | QualityJudge 逐条 | 不可违反 | 系统架构约束 |
| **L2 角色契约** | 能力边界/行为模式/关系规则 | `characters/active/NAME.json` | CharacterWeaver 生成 | QualityJudge 逐条 | 可变更但需走协议 | 接口定义 |
| **L3 章节契约** | 前置条件/目标/后置条件/验收标准 | `volumes/vol-{V:02d}/chapter-contracts/chapter-{C:03d}.json` | PlotArchitect 派生 | QualityJudge 逐条 | 可协商但须留痕 | 函数签名+测试用例 |

约束强度说明：
- **L1 不可违反**（硬约束）：类似编译错误，违反即阻塞
- **L2 可扩展但不可矛盾**（契约）：类似接口变更需要版本管理
- **L3 可协商但须留痕**（任务单）：类似 ticket 可以调整 scope 但要记录原因

#### 6.5.2 L1 世界规则 — 结构化规则表

WorldBuilder 在生成叙述性文档的同时，抽取可验证的规则：

```json
// world/rules.json
{
  "rules": [
    {
      "id": "W-001",
      "category": "magic_system",
      "rule": "修炼者突破金丹期需要天地灵气浓度 ≥ 3级",
      "constraint_type": "hard",
      "exceptions": [],
      "introduced_chapter": 1,
      "last_verified": 47
    }
  ]
}
```

- `constraint_type`: `hard`（不可违反）/ `soft`（可有例外但需说明）
- ChapterWriter 收到时，`hard` 规则以禁止项注入：`"违反以下规则的内容将被自动拒绝"`
- QualityJudge 逐条验证，不是"感觉世界观一致"，而是"W-001 是否被违反"

#### 6.5.3 L2 角色契约 — 行为边界定义

CharacterWeaver 在生成角色档案的同时，输出可验证的契约：

```json
// characters/active/protagonist.json 中的 contracts 字段
{
  "contracts": [
    {
      "id": "C-LUCHEN-001",
      "type": "capability",
      "rule": "当前修为：筑基后期，无法使用金丹期以上法术",
      "valid_from_chapter": 1,
      "valid_until": null,
      "update_requires": "PlotArchitect 在大纲中标注突破事件"
    },
    {
      "id": "C-LUCHEN-002",
      "type": "personality",
      "rule": "面对强敌时倾向智取而非硬碰，除非保护身边人",
      "exceptions": ["极度愤怒时可能失控（需要前文铺垫 ≥2 章）"]
    }
  ]
}
```

**契约变更协议**：角色能力/性格变化必须通过 PlotArchitect 在大纲中预先标注 → CharacterWeaver 更新契约 → 章节实现 → 验收确认。类似 API 接口变更需要先写 RFC。

#### 6.5.4 L3 章节契约 — 前置/后置条件 + 验收标准

PlotArchitect 从叙述性大纲自动派生每章的结构化契约：

```json
// volumes/vol-02/chapter-contracts/chapter-048.json
{
  "chapter": 48,
  "preconditions": {
    "character_states": {"陆尘": {"location": "魔都外城", "修为": "筑基后期"}},
    "required_world_rules": ["W-001", "W-002"]
  },
  "objectives": [
    {"id": "OBJ-048-1", "type": "plot", "required": true,
     "description": "陆尘发现密信中的暗号指向城北废墟"},
    {"id": "OBJ-048-2", "type": "foreshadowing", "action": "advance",
     "target": "ancient_prophecy", "description": "废墟中发现与预言相关的符文"}
  ],
  "postconditions": {
    "state_changes": {"陆尘": {"location": "城北废墟", "emotional_state": "疑虑"}},
    "foreshadowing_updates": {"ancient_prophecy": "advanced"}
  },
  "acceptance_criteria": [
    "OBJ-048-1 在正文中明确体现",
    "不违反 W-001, W-002",
    "不违反 C-LUCHEN-001",
    "postconditions 中的状态变更在正文中有因果支撑"
  ]
}
```

#### 6.5.5 Spec 生成流程

三层 Spec 均为 **Agent 自动生成 + 用户审核**：

| Spec | 生成方式 | 审核点 |
|------|---------|--------|
| L1 规则 | WorldBuilder 从自由文本抽取结构化规则 | 首次生成 + 每次增量更新 |
| L2 契约 | CharacterWeaver 从角色描述提取行为边界 | 新角色创建 + 能力变更 |
| L3 章节契约 | PlotArchitect 从卷纲自动派生（前章 postconditions → 本章 preconditions） | 卷规划审核时一并展示 |

**变更传播链**（可追溯性核心）：
```
世界规则变更 → 检查哪些角色契约受影响
  → CharacterWeaver 更新受影响 contracts
  → 检查哪些待写章节的 preconditions 受影响
  → PlotArchitect 更新相关 chapter-contracts
```

类似改了接口定义，编译器告诉你哪些调用方需要适配。

#### 6.5.6 QualityJudge 双轨验收

QualityJudge 从"单一评分"升级为"合规检查 + 质量评分"双轨制：

```
验收流程：
1. Contract Verification（硬门槛 — 逐条检查 L1/L2/L3）
   输出：{"OBJ-048-1": "pass", "W-001": "pass", ...} + violations 列表

2. Quality Scoring（软评估 — 8 维度评分，含 storyline_coherence）
   输出：8 维度加权均值

门控决策：
├── 有 violation → 强制修订（不管印象分多高）
├── 无 violation + 印象分 ≥ 3.5 → 通过
└── 无 violation + 印象分 < 3.5 → 走现有质量门控（Section 6 质量门控表）
```

合规是编译通过，质量是 code review。两者独立，缺一不可。
