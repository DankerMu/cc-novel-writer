## 6. Templates

### 6.1 项目简介模板

## 文件路径：`templates/brief-template.md`

````markdown
# 创作纲领

## 基本信息

- **书名**：{book_title}
- **题材**：{genre}（如：玄幻、都市、悬疑、言情、科幻）
- **目标字数**：{target_word_count} 万字
- **目标卷数**：{target_volumes} 卷
- **每卷章数**：{chapters_per_volume} 章

## 核心设定

### 世界观一句话

{world_one_liner}

### 核心冲突

{core_conflict}

### 主角概念

- **姓名**：{protagonist_name}
- **身份**：{protagonist_identity}
- **目标**：{protagonist_goal}
- **内在矛盾**：{protagonist_contradiction}

## 风格定位

- **基调**：{tone}（如：轻松幽默、热血燃向、暗黑压抑、细腻温暖）
- **节奏**：{pacing}（如：快节奏爽文、慢热型、张弛交替）
- **参考作品**：{reference_works}
- **风格样本来源**：{style_source}（original / reference / template）

## 读者画像

- **目标平台**：{platform}
- **目标读者**：{target_reader}
- **核心卖点**：{selling_point}

## 备注

{notes}
````

---

### 6.2 AI 用语黑名单

## 文件路径：`templates/ai-blacklist.json`

````markdown
```json
{
  "version": "1.0.0",
  "description": "AI 高频中文用语黑名单 — 生成时禁止使用",
  "last_updated": "2026-02-21",
  "words": [
    "不禁",
    "莫名",
    "油然而生",
    "心中暗道",
    "嘴角微微上扬",
    "嘴角勾起一抹弧度",
    "眼中闪过一丝",
    "深吸一口气",
    "不由得",
    "一股暖流",
    "心头一震",
    "宛如",
    "恍若",
    "仿佛置身于",
    "与此同时",
    "值得一提的是",
    "毫无疑问",
    "显而易见",
    "不言而喻",
    "如同一道闪电",
    "眼神中带着一丝",
    "嘴角微扬",
    "紧握双拳",
    "瞳孔骤缩",
    "心中一凛",
    "暗自思忖",
    "不由自主",
    "心中暗想",
    "嘴角露出一丝笑意",
    "眉头微皱",
    "眼中闪过一抹异色",
    "浑身一震",
    "心中掀起波澜",
    "一时间",
    "顿时",
    "霎时间",
    "刹那间",
    "仿佛被什么击中",
    "如释重负",
    "内心深处"
  ],
  "categories": {
    "emotion_cliche": ["不禁", "莫名", "油然而生", "心中暗道", "一股暖流", "心头一震", "心中一凛", "心中掀起波澜", "如释重负", "内心深处"],
    "expression_cliche": ["嘴角微微上扬", "嘴角勾起一抹弧度", "眼中闪过一丝", "嘴角微扬", "眼神中带着一丝", "嘴角露出一丝笑意", "眉头微皱", "眼中闪过一抹异色"],
    "action_cliche": ["深吸一口气", "紧握双拳", "瞳孔骤缩", "浑身一震", "仿佛被什么击中"],
    "transition_cliche": ["与此同时", "值得一提的是", "毫无疑问", "显而易见", "不言而喻"],
    "simile_cliche": ["宛如", "恍若", "仿佛置身于", "如同一道闪电"],
    "time_cliche": ["一时间", "顿时", "霎时间", "刹那间"],
    "thought_cliche": ["暗自思忖", "不由自主", "不由得", "心中暗想"]
  }
}
```
````

---

### 6.3 风格指纹模板

## 文件路径：`templates/style-profile-template.json`

````markdown
```json
{
  "_comment": "风格指纹模板 — 由 StyleAnalyzer Agent 填充，ChapterWriter 和 StyleRefiner 读取",

  "source_type": null,
  "_source_type_comment": "original（用户原创样本）| reference（参考作者）| template（预置模板）",

  "reference_author": null,
  "_reference_author_comment": "仿写模式时填写参考作者名，原创模式为 null",

  "avg_sentence_length": null,
  "_avg_sentence_length_comment": "平均句长（字数），如 18 表示平均每句 18 字",

  "sentence_length_range": [null, null],
  "_sentence_length_range_comment": "[最短句, 最长句]，如 [8, 35]",

  "dialogue_ratio": null,
  "_dialogue_ratio_comment": "对话占全文比例，如 0.4 表示 40%",

  "description_ratio": null,
  "_description_ratio_comment": "描写（环境+心理）占比",

  "action_ratio": null,
  "_action_ratio_comment": "动作叙述占比",

  "rhetoric_preferences": [],
  "_rhetoric_preferences_comment": "修辞偏好列表，格式 [{\"type\": \"短句切换\", \"frequency\": \"high|medium|low\"}]",

  "forbidden_words": [],
  "_forbidden_words_comment": "作者从不使用的词汇列表（精准收录，不过度泛化）",

  "preferred_expressions": [],
  "_preferred_expressions_comment": "作者常用的特色表达",

  "character_speech_patterns": {},
  "_character_speech_patterns_comment": "角色语癖，格式 {\"角色名\": \"语癖描述 + 具体示例\"}",

  "paragraph_style": {
    "avg_paragraph_length": null,
    "dialogue_format": null
  },
  "_paragraph_style_comment": "avg_paragraph_length 为平均段落字数，dialogue_format 为 引号式 | 无引号式",

  "narrative_voice": null,
  "_narrative_voice_comment": "第一人称 | 第三人称限制 | 全知",

  "writing_directives": [],
  "_writing_directives_comment": "正向写作指令数组（可为空），用于直接注入 ChapterWriter prompt（如：偏短句、动作推进、对话更生活化）",

  "override_constraints": {},
  "_override_constraints_comment": "可选：覆盖 ChapterWriter 默认写作约束。支持的 key：anti_intuitive_detail (bool, 默认 true), max_scene_sentences (int, 默认 2)。未设置的 key 使用默认值",

  "analysis_notes": null,
  "_analysis_notes_comment": "StyleAnalyzer 的分析备注"
}
```
````
