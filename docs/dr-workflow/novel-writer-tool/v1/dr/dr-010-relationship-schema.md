# DR-010: 角色关系图与情节时间线的结构化数据格式设计

**状态**: ✅ 已完成
**日期**: 2026-02-21
**决策者**: 系统架构组
**影响范围**: 小说创作工具数据模型设计

---

## Executive Summary

基于图数据库最佳实践和 Constella 论文的角色关系建模方法，本研究提出了适用于小说创作工具的角色关系图和情节时间线的 JSON 结构化数据格式。**推荐采用属性图（Property Graph）模型，使用有向图表示角色关系，支持双向不对称关系属性，并通过时间戳实现情节时间线的事件追踪。**

**关键设计决策**：
- 节点类型：Character（角色）、Event（事件）、Location（地点）
- 边类型：Relationship（关系）、Interaction（互动）、Presence（在场）
- 核心属性：关系感知（relational_perception）、知识集（knowledge_set）、时间戳（timestamp）
- 存储格式：JSON + MongoDB（灵活 schema）或 Neo4j（原生图数据库）

**数据规模估算**：
- 单部小说角色数：20-50 个主要角色
- 关系边数：50-200 条（平均每角色 2-4 条关系）
- 事件节点数：100-500 个（章节级事件）
- JSON 文件大小：50-200 KB（未压缩）

---

## Research Question

**核心问题**：如何设计结构化的 JSON 数据格式来表示小说中的角色关系图和情节时间线？

**具体验证点**：
1. 图数据库 schema 设计的最佳实践（节点、边、属性）
2. Constella 论文中的角色关系建模方法
3. 如何表示双向不对称关系（A 对 B 的看法 ≠ B 对 A 的看法）
4. 如何在时间线上追踪角色状态变化和事件发生
5. JSON 格式的可扩展性和查询效率

---

## Methodology

### 1. 文献调研

**图数据库最佳实践**：
- Neo4j 官方文档：Graph modeling guidelines, Data modeling best practices
- 属性图（Property Graph）模型：节点 + 关系 + 属性
- JSON Schema for graph representation

**学术论文**：
- **Constella** (arXiv 2507.05820): LLM-based multi-agent character creation
- **Structured Graph Representations for Visual Narrative Reasoning**: 层次化知识图谱框架
- **Timeline Storyteller**: 时间线叙事的交互式创作工具

### 2. 案例分析

**开源项目**：
- `novel-graph` (GitHub): 使用 LLM 提取小说角色互动图
- Neo4j Movie Graph: 经典的图数据模型示例
- Oracle Property Graph: JSON 存储顶点和边属性的方法

### 3. 设计原则

基于 Neo4j 和 Constella 的最佳实践：
1. **唯一性约束**：每个节点必须有唯一标识符（ID）
2. **白板友好**：数据模型应直观可视化
3. **查询驱动**：根据业务问题设计 schema
4. **属性分离**：区分节点属性和关系属性
5. **时间维度**：支持状态随时间变化的追踪

---

## Key Findings

### 1. 角色关系图 JSON 结构设计

#### 1.1 基于 Constella 的关系模型

Constella 使用**有向图模型**表示角色关系，核心特性：

**关系属性**：
- `relational_perception`（关系感知）：A 如何看待 B
- `knowledge_set`（知识集）：A 对 B 了解的信息类别
  - 角色描述、性格特征、职业、年龄、当前状态、背景故事

**实现细节**：
- 存储：MongoDB（灵活 schema）
- 输出：JSON 对象
- 无状态设计：不跨生成会话持久化记忆（支持迭代修改）

**角色档案结构**：
```json
{
  "character_id": "char_001",
  "name": "张三",
  "attributes": {
    "age": 25,
    "gender": "male",
    "occupation": "剑客",
    "personality": ["勇敢", "冲动", "忠诚"],
    "backstory": "出身江湖世家，自幼习武..."
  },
  "relationships": [
    {
      "target_id": "char_002",
      "relational_perception": "视为师父，尊敬但有时质疑其决策",
      "knowledge_set": {
        "description": true,
        "personality": true,
        "occupation": true,
        "backstory": "partial",
        "current_status": true
      },
      "relationship_type": "mentor_student",
      "strength": 0.8,
      "created_at": "2024-01-15T10:00:00Z",
      "updated_at": "2024-03-20T14:30:00Z"
    }
  ]
}
```

#### 1.2 Neo4j 属性图模型

**节点设计**：
```json
{
  "nodes": [
    {
      "id": "char_001",
      "labels": ["Character", "Protagonist"],
      "properties": {
        "name": "张三",
        "age": 25,
        "gender": "male",
        "occupation": "剑客",
        "personality": ["勇敢", "冲动", "忠诚"],
        "backstory": "出身江湖世家...",
        "first_appearance": "chapter_001",
        "status": "active"
      }
    },
    {
      "id": "char_002",
      "labels": ["Character", "Mentor"],
      "properties": {
        "name": "李四",
        "age": 55,
        "gender": "male",
        "occupation": "武林宗师"
      }
    }
  ]
}
```

**关系设计**（双向不对称）：
```json
{
  "relationships": [
    {
      "id": "rel_001",
      "type": "RESPECTS",
      "source": "char_001",
      "target": "char_002",
      "properties": {
        "perception": "视为师父，尊敬但有时质疑其决策",
        "strength": 0.8,
        "trust_level": 0.7,
        "emotional_tone": "respectful",
        "since_chapter": "chapter_001",
        "last_interaction": "chapter_015"
      }
    },
    {
      "id": "rel_002",
      "type": "MENTORS",
      "source": "char_002",
      "target": "char_001",
      "properties": {
        "perception": "视为得意弟子，但担心其冲动性格",
        "strength": 0.9,
        "trust_level": 0.85,
        "emotional_tone": "protective",
        "since_chapter": "chapter_001",
        "last_interaction": "chapter_015"
      }
    }
  ]
}
```

#### 1.3 完整关系图 Schema

```json
{
  "graph_schema": {
    "version": "1.0",
    "created_at": "2026-02-21T00:00:00Z",
    "node_labels": [
      {
        "label": "Character",
        "properties": {
          "id": "string (required, unique)",
          "name": "string (required)",
          "age": "integer",
          "gender": "string",
          "occupation": "string",
          "personality": "array<string>",
          "backstory": "string",
          "first_appearance": "string (chapter_id)",
          "status": "enum [active, deceased, absent]"
        }
      },
      {
        "label": "Location",
        "properties": {
          "id": "string (required, unique)",
          "name": "string (required)",
          "type": "enum [city, building, room, outdoor]",
          "description": "string"
        }
      }
    ],
    "relationship_types": [
      {
        "type": "RELATIONSHIP",
        "description": "通用角色关系",
        "properties": {
          "id": "string (required, unique)",
          "perception": "string (required)",
          "strength": "float [0-1]",
          "trust_level": "float [0-1]",
          "emotional_tone": "string",
          "since_chapter": "string (chapter_id)",
          "last_interaction": "string (chapter_id)"
        }
      },
      {
        "type": "INTERACTS_WITH",
        "description": "角色互动事件",
        "properties": {
          "event_id": "string (required)",
          "chapter_id": "string (required)",
          "interaction_type": "enum [dialogue, conflict, cooperation]",
          "timestamp": "datetime",
          "description": "string"
        }
      }
    ]
  },
  "graph_data": {
    "nodes": [],
    "relationships": []
  }
}
```

### 2. 情节时间线 JSON 结构设计

#### 2.1 基于事件的时间线模型

**核心概念**：
- 事件（Event）：情节中的关键节点
- 时间戳（Timestamp）：事件发生的时间（章节、场景、绝对时间）
- 因果关系（Causality）：事件之间的依赖关系

**时间线 Schema**：
```json
{
  "timeline": {
    "version": "1.0",
    "story_id": "story_001",
    "time_unit": "chapter",
    "events": [
      {
        "id": "event_001",
        "type": "character_introduction",
        "title": "主角登场",
        "description": "张三在江湖大会上首次亮相",
        "timestamp": {
          "chapter": "chapter_001",
          "scene": "scene_003",
          "absolute_time": "故事开始后第 3 天"
        },
        "participants": ["char_001"],
        "location": "loc_001",
        "impact": {
          "character_states": {
            "char_001": {
              "status": "active",
              "location": "loc_001",
              "emotional_state": "confident"
            }
          },
          "relationship_changes": [],
          "plot_advancement": "introduce_protagonist"
        },
        "tags": ["introduction", "action"],
        "foreshadowing": []
      },
      {
        "id": "event_015",
        "type": "conflict",
        "title": "师徒决裂",
        "description": "张三质疑师父的决策，两人发生激烈争执",
        "timestamp": {
          "chapter": "chapter_015",
          "scene": "scene_042",
          "absolute_time": "故事开始后第 45 天"
        },
        "participants": ["char_001", "char_002"],
        "location": "loc_005",
        "impact": {
          "character_states": {
            "char_001": {
              "emotional_state": "angry",
              "relationship_with_char_002": "strained"
            },
            "char_002": {
              "emotional_state": "disappointed",
              "relationship_with_char_001": "concerned"
            }
          },
          "relationship_changes": [
            {
              "relationship_id": "rel_001",
              "property": "trust_level",
              "old_value": 0.7,
              "new_value": 0.4
            }
          ],
          "plot_advancement": "rising_action"
        },
        "tags": ["conflict", "character_development"],
        "foreshadowing": ["event_030"],
        "caused_by": ["event_012", "event_014"],
        "leads_to": ["event_016", "event_018"]
      }
    ],
    "plot_structure": {
      "act_1": {
        "chapters": ["chapter_001", "chapter_005"],
        "events": ["event_001", "event_010"],
        "description": "世界观建立与角色介绍"
      },
      "act_2": {
        "chapters": ["chapter_006", "chapter_020"],
        "events": ["event_011", "event_050"],
        "description": "冲突升级与角色成长"
      },
      "act_3": {
        "chapters": ["chapter_021", "chapter_030"],
        "events": ["event_051", "event_100"],
        "description": "高潮与结局"
      }
    }
  }
}
```

#### 2.2 时间线可视化数据格式

基于 Timeline Storyteller 的设计：

```json
{
  "timeline_visualization": {
    "title": "《剑客传奇》情节时间线",
    "scale": "linear",
    "layout": "vertical",
    "events": [
      {
        "id": "event_001",
        "start_time": "2024-01-01",
        "end_time": "2024-01-01",
        "label": "主角登场",
        "category": "character_introduction",
        "color": "#4CAF50",
        "icon": "person_add",
        "description": "张三在江湖大会上首次亮相"
      },
      {
        "id": "event_015",
        "start_time": "2024-02-15",
        "end_time": "2024-02-15",
        "label": "师徒决裂",
        "category": "conflict",
        "color": "#F44336",
        "icon": "warning",
        "description": "张三质疑师父的决策"
      }
    ],
    "connections": [
      {
        "from": "event_012",
        "to": "event_015",
        "type": "causes",
        "label": "导致"
      }
    ]
  }
}
```

### 3. 图数据库 Schema 设计最佳实践

#### 3.1 节点设计原则

**唯一性约束**：
- 每个节点必须有唯一标识符（`id` 属性）
- 使用复合属性确保唯一性（如 `name + age + location`）
- 避免超级节点（super node）：节点连接数过多会影响查询性能

**属性设计**：
- 区分"完整档案"（存储）和"写作档案"（注入 prompt）
- 使用 JSON 数据类型存储复杂属性（如 `personality: array<string>`）
- 避免在节点中存储关系信息（应使用边表示）

**标签（Labels）设计**：
- 使用多标签支持分类（如 `["Character", "Protagonist"]`）
- 标签应反映节点的类型和角色
- 避免过度细分标签（保持 5-10 个核心标签）

#### 3.2 边设计原则

**关系类型**：
- 使用动词命名（如 `RESPECTS`, `MENTORS`, `CONFLICTS_WITH`）
- 支持双向不对称关系（A→B 和 B→A 是两条不同的边）
- 区分静态关系（如 `IS_PARENT_OF`）和动态关系（如 `TRUSTS`）

**属性设计**：
- 关系强度（`strength: float [0-1]`）
- 情感色调（`emotional_tone: string`）
- 时间范围（`since_chapter`, `last_interaction`）
- 变化历史（可选，用于追踪关系演变）

**中间节点模式**：
- 当关系需要连接 3+ 个节点时，使用中间节点
- 示例：`(Person)-[:HAS_EMPLOYMENT]->(Employment)-[:AT_COMPANY]->(Company)`
- 中间节点可存储事件级别的属性（如雇佣开始/结束日期）

#### 3.3 查询优化

**索引策略**：
- 为常用查询属性创建索引（如 `character.name`, `event.chapter_id`）
- 使用复合索引支持多条件查询
- 避免对高基数属性（如 `description`）创建索引

**查询模式**：
```cypher
// 查询角色的所有关系
MATCH (c:Character {id: 'char_001'})-[r]->(other)
RETURN c, r, other

// 查询两个角色之间的最短路径
MATCH path = shortestPath(
  (a:Character {id: 'char_001'})-[*]-(b:Character {id: 'char_002'})
)
RETURN path

// 查询特定章节的所有事件
MATCH (e:Event)
WHERE e.chapter_id = 'chapter_015'
RETURN e
ORDER BY e.timestamp
```

### 4. 存储方案对比

| 方案 | 优势 | 劣势 | 适用场景 |
|------|------|------|---------|
| **纯 JSON 文件** | 简单、易于版本控制、无需数据库 | 查询效率低、不支持复杂图查询 | 小规模项目（<50 角色） |
| **MongoDB + JSON** | 灵活 schema、支持 JSON 查询、易于扩展 | 图查询能力有限、需要手动维护关系 | 中等规模项目（50-200 角色） |
| **Neo4j** | 原生图数据库、高效图查询、可视化工具 | 学习曲线陡峭、部署复杂 | 大规模项目（200+ 角色） |
| **混合方案** | JSON 存储 + 内存图结构 | 需要同步机制、实现复杂 | 需要离线编辑和在线查询 |

**推荐方案**：
- **Phase 1-2**：纯 JSON 文件（快速原型验证）
- **Phase 3-4**：MongoDB + JSON（支持复杂查询）
- **Phase 5+**：考虑迁移到 Neo4j（如果需要高级图分析）

### 5. 数据规模估算

**典型小说数据规模**：
```
角色节点：20-50 个主要角色 + 50-100 个次要角色
关系边：50-200 条（平均每角色 2-4 条关系）
事件节点：100-500 个（章节级事件）
地点节点：20-50 个

JSON 文件大小：
- 角色关系图：30-100 KB
- 情节时间线：20-100 KB
- 总计：50-200 KB（未压缩）
```

**Token 消耗估算**（注入 prompt）：
```
完整关系图：2000-5000 tokens
精简关系图（仅相关角色）：500-1000 tokens
时间线摘要：1000-2000 tokens
```

---

## Sources

### 主要证据来源

1. **Constella 论文** (arXiv 2507.05820)
   - 标题：Supporting Storywriters' Interconnected Character Creation through LLM-based Multi-Agents
   - 作者：Syemin Park, Soobin Park, Youn-kyung Lim (KAIST)
   - 关键贡献：有向图关系模型、关系感知（relational_perception）、知识集（knowledge_set）
   - URL: https://arxiv.org/html/2507.05820v1

2. **Neo4j 官方文档**
   - Graph modeling guidelines: https://neo4j.com/docs/getting-started/data-modeling/guide-data-modeling/
   - Data modeling best practices: https://support.neo4j.com/s/article/360024789554-Data-Modeling-Best-Practices
   - Tutorial: Create a graph data model: https://neo4j.com/docs/getting-started/data-modeling/tutorial-data-modeling/
   - 关键概念：属性图模型、白板友好设计、查询驱动建模

3. **Neo4j Graph Schema JSON**
   - GitHub: https://github.com/neo4j/graph-schema-json-js-utils
   - 博客：Describing a Property Graph Data Model (Medium)
   - JSON Schema: https://unpkg.com/@neo4j/graph-json-schema/json-schema.json
   - 关键贡献：标准化的图 schema JSON 表示

4. **Timeline Storyteller** (Microsoft Research)
   - 论文：The Design & Deployment of an Interactive Authoring Tool for Expressive Timeline Narratives
   - 作者：Matthew Brehmer, Bongshin Lee, et al.
   - 关键贡献：时间线可视化设计模式、事件表示方法
   - URL: https://www.microsoft.com/en-us/research/publication/timeline-storyteller-the-design-deployment-of-an-interactive-authoring-tool-for-expressive-timeline-narratives/

5. **相关学术论文**
   - Structured Graph Representations for Visual Narrative Reasoning (arXiv 2506.10008)
   - Feature-Action Design Patterns for Storytelling Visualizations with Time Series Data (arXiv 2402.03116)
   - Visualizing Narrative Structures: Chapter-wise Character Relationship Networks in Novels (IEEE)

6. **开源项目**
   - novel-graph (GitHub): https://github.com/schoobani/novel-graph
   - Story Graphs (University of Kentucky): https://cs.uky.edu/~sgware/projects/storygraphs/

### 技术参考

- Oracle Property Graph: JSON Support in SQL Property Graphs
- LinkML: How to make a property graph schema
- Data Storytelling Arc: Narrative structure in data stories

---

## Conclusion

### 决策结论

✅ **采用属性图（Property Graph）模型 + JSON 存储格式**，支持角色关系图和情节时间线的结构化表示。

### 核心设计决策

1. **关系模型**：使用有向图表示双向不对称关系
   - 每条关系包含：`perception`（感知）、`strength`（强度）、`trust_level`（信任度）
   - 支持关系随时间演变（通过 `since_chapter`, `last_interaction` 追踪）

2. **节点类型**：
   - `Character`（角色）：核心实体，包含属性和关系
   - `Event`（事件）：情节节点，连接角色和时间线
   - `Location`（地点）：场景节点，支持空间关系

3. **时间线设计**：
   - 基于事件的时间线模型
   - 支持因果关系追踪（`caused_by`, `leads_to`）
   - 集成角色状态变化和关系变化

4. **存储方案**：
   - **Phase 1-2**：纯 JSON 文件（快速原型）
   - **Phase 3+**：MongoDB + JSON（生产环境）
   - 保留迁移到 Neo4j 的可能性（如需高级图分析）

### 实施建议

**Phase 1（Milestone 1-2）**：
1. 实现基础 JSON schema（角色节点 + 关系边）
2. 支持手动编辑和版本控制（Git）
3. 实现简单的关系查询（JavaScript/Python）

**Phase 2（Milestone 3-4）**：
1. 添加事件节点和时间线支持
2. 实现关系强度和信任度的动态更新
3. 集成到章节生成 prompt（注入相关角色关系）

**Phase 3（Milestone 5+）**：
1. 迁移到 MongoDB（如果需要复杂查询）
2. 实现关系图可视化（使用 D3.js 或 Cytoscape.js）
3. 支持自动关系提取（使用 LLM 分析章节内容）

### 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 关系数量爆炸（>500 条） | 中 | 中 | 仅注入当前章节相关关系（3-5 个角色） |
| JSON 文件过大（>1MB） | 低 | 中 | 拆分为多个文件（按章节或角色组） |
| 关系一致性维护困难 | 高 | 高 | 实现自动一致性检查（双向关系同步） |
| 时间线事件冲突 | 中 | 中 | 添加事件依赖验证（DAG 检查） |

### 后续行动

- [ ] 实现 JSON schema 验证器（使用 JSON Schema 标准）
- [ ] 创建角色关系图编辑器原型（Web UI）
- [ ] 设计关系注入策略（如何选择相关关系注入 prompt）
- [ ] 在 Milestone 2 中验证关系图对生成质量的影响
- [ ] 研究自动关系提取方法（DR-011）

### 参考实现

**最小可行 JSON 结构**（用于 Phase 1）：
```json
{
  "characters": {
    "char_001": {
      "name": "张三",
      "age": 25,
      "relationships": {
        "char_002": {
          "type": "mentor_student",
          "perception": "视为师父",
          "strength": 0.8
        }
      }
    }
  },
  "timeline": {
    "events": [
      {
        "id": "event_001",
        "chapter": "chapter_001",
        "participants": ["char_001"],
        "description": "主角登场"
      }
    ]
  }
}
```

### 更新日志

- 2026-02-21: 初始研究完成，确定属性图模型和 JSON 存储方案
