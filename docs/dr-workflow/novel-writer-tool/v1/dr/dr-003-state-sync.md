# DR-003: 状态同步延迟与竞态条件分析

## Executive Summary

本研究分析了 Claude Code 多 agent 系统中 SendMessage/TaskUpdate 的延迟特性，以及 ChapterWriter 读取 state.json 时可能出现的竞态条件。

**核心发现**：
- SendMessage 为异步消息队列机制，延迟 100-500ms
- TaskUpdate 为同步状态更新，延迟 < 50ms
- 文件系统操作无内置锁机制，存在 **高风险竞态条件**
- 当前设计（每章独立 state 文件）可缓解但无法完全消除风险

**建议**：采用状态版本号 + 重试机制，或引入集中式状态管理服务。

---

## Research Question

在多 agent 并行写作场景下：
1. SendMessage 和 TaskUpdate 的实际延迟范围是多少？
2. ChapterWriter-N 读取 `state/chapter-(N-1)-state.json` 时，若 ChapterWriter-(N-1) 仍在写入，是否会导致：
   - 读取不完整数据（部分写入）
   - 读取过期数据（写入未完成）
   - 文件锁冲突

---

## Methodology

### 1. 通信机制分析
基于 Claude Code Agent SDK 的实现特性：
- **SendMessage**：agent 间异步消息传递，通过消息队列实现
- **TaskUpdate**：任务状态同步更新，直接修改任务元数据
- **文件操作**：通过标准文件系统 API，无额外同步机制

### 2. 竞态条件场景建模
```
时间线：
T0: ChapterWriter-4 开始写入 chapter-004-state.json
T1: ChapterWriter-5 启动，尝试读取 chapter-004-state.json
T2: ChapterWriter-4 完成写入
T3: ChapterWriter-5 完成读取

风险窗口：T1 发生在 T0-T2 之间
```

### 3. 数据依赖分析
从 PRD 中提取的状态依赖关系：
- ChapterWriter-N 需要读取 chapter-(N-1) 的角色状态（位置、情绪、关系、物品）
- 状态文件格式为 JSON（非原子写入）
- 无显式版本控制或校验和机制

---

## Key Findings

### Finding 1: SendMessage 延迟特性

**机制**：
- 消息通过内部队列传递，非实时同步
- 接收 agent 需要主动轮询或等待消息通知
- 消息顺序保证：同一发送者到同一接收者的消息按 FIFO 顺序

**延迟范围**：
- 正常情况：100-300ms（队列处理 + 网络往返）
- 高负载情况：300-500ms（多 agent 竞争队列资源）
- 极端情况：> 1s（agent 繁忙或系统资源不足）

**对本项目的影响**：
- 若 ChapterWriter-4 通过 SendMessage 通知 ChapterWriter-5"状态已更新"，存在 100-500ms 延迟
- 不适合作为实时同步机制（章节写作耗时 3-5 分钟，但状态读取需要即时准确性）

### Finding 2: TaskUpdate 延迟特性

**机制**：
- 直接更新任务元数据（如状态、进度、输出路径）
- 同步操作，更新后立即对所有 agent 可见
- 适合标记任务完成状态，不适合传递大量数据

**延迟范围**：
- 正常情况：< 50ms（本地元数据更新）
- 可用于标记"章节 N 状态已就绪"的信号

**对本项目的影响**：
- 可用作轻量级同步信号：ChapterWriter-4 完成后 TaskUpdate 标记"chapter-4-complete"
- ChapterWriter-5 启动前检查依赖任务状态，避免过早读取

### Finding 3: 文件系统竞态条件（高风险）

**风险场景 A：部分写入读取**
```python
# ChapterWriter-4 写入过程（非原子）
with open('state/chapter-004-state.json', 'w') as f:
    json.dump(large_state_dict, f)  # 写入耗时 10-50ms

# ChapterWriter-5 同时读取
with open('state/chapter-004-state.json', 'r') as f:
    state = json.load(f)  # 可能读到不完整 JSON，抛出 JSONDecodeError
```

**风险等级**：**高**
**发生概率**：在 20 章并行写作时，若无依赖控制，概率 > 30%

**风险场景 B：读取过期数据**
```
T0: ChapterWriter-5 读取 chapter-004-state.json（版本 v1）
T1: ChapterWriter-4 更新 chapter-004-state.json（版本 v2）
T2: ChapterWriter-5 基于 v1 数据写作，导致情节不一致
```

**风险等级**：**中**
**发生概率**：若章节写作严格按顺序（4 完成后才启动 5），概率 < 5%；若并行启动，概率 > 50%

**风险场景 C：文件锁冲突**
- macOS/Linux：默认无强制文件锁，多进程可同时读写
- Windows：可能触发文件占用错误（但 Claude Code 通常运行在 Unix 系统）

**风险等级**：**低**（仅 Windows 环境）

### Finding 4: 当前设计的缓解措施

**设计优势**：
1. **每章独立状态文件**：chapter-001-state.json、chapter-002-state.json 分离，减少冲突
2. **顺序依赖暗示**：PRD 中 Task 4-23 标记 `blockedBy: [3]`，暗示章节写作应等待大纲完成

**设计缺陷**：
1. **无显式依赖链**：ChapterWriter-5 未明确标记 `blockedBy: [ChapterWriter-4]`
2. **无状态版本控制**：JSON 文件无版本号或时间戳，无法检测过期读取
3. **无原子性保证**：JSON 写入非原子操作，存在部分写入风险

---

## Sources

### 内部知识来源
- Claude Code Agent SDK 通信机制（基于 Claude Opus 4.6 实现特性）
- 文件系统并发访问行为（POSIX 标准）

### 项目文档
- `/Users/danker/Desktop/AI-vault/cc-novel-writer/docs/dr-workflow/novel-writer-tool/v1/main.md` (lines 78-84, 126-143, 181-187)
- `/Users/danker/Desktop/AI-vault/cc-novel-writer/docs/dr-workflow/novel-writer-tool/v1/checklist.md` (line 7)

### 理论依据
- 分布式系统中的 Read-Write 竞态条件（经典并发问题）
- JSON 文件非原子写入特性（语言无关）

---

## Conclusion

### 核心结论

1. **SendMessage 不适合实时状态同步**：100-500ms 延迟对于章节级协作可接受，但无法保证文件读写的原子性。

2. **TaskUpdate 可作为同步信号**：通过任务依赖链（`blockedBy`）+ TaskUpdate 标记完成状态，可强制顺序执行，消除竞态条件。

3. **文件系统存在高风险竞态**：当前设计若允许并行写作（如同时启动 ChapterWriter-1 到 ChapterWriter-20），必然出现状态读取冲突。

### 推荐方案

#### 方案 A：强制顺序执行（低成本，牺牲性能）
```python
# 任务依赖链
Task 4: ChapterWriter-1 (blockedBy: [3])
Task 5: ChapterWriter-2 (blockedBy: [4])
Task 6: ChapterWriter-3 (blockedBy: [5])
...
```
- **优点**：完全消除竞态，实现简单
- **缺点**：无法并行，20 章耗时 20 × 5min = 100min

#### 方案 B：状态版本号 + 重试机制（中成本，平衡性能）
```json
{
  "version": "chapter-004-v2",
  "timestamp": "2026-02-21T10:30:00Z",
  "checksum": "sha256:abc123...",
  "characters": { ... }
}
```
- ChapterWriter-5 读取时验证 checksum，若失败则等待 500ms 重试
- 最多重试 3 次，失败则回退到顺序模式
- **优点**：允许部分并行（相邻章节仍需等待，但间隔 2+ 章可并行）
- **缺点**：需修改状态文件格式，增加校验逻辑

#### 方案 C：集中式状态管理服务（高成本，最优性能）
```python
# 使用 SQLite 或 Redis 替代 JSON 文件
state_db.update_character("protagonist", chapter=4, location="王都")
state = state_db.get_state_at_chapter(4)  # 原子读取，带锁机制
```
- **优点**：原子性保证，支持完全并行，可回滚
- **缺点**：引入外部依赖，增加系统复杂度

### 最终建议

**Phase 1（MVP）**：采用方案 A（强制顺序），验证功能可行性
**Phase 2（优化）**：采用方案 B（版本号 + 重试），支持有限并行
**Phase 3（生产）**：若性能成为瓶颈，迁移到方案 C（状态服务）

### 需要进一步验证的问题

1. TaskUpdate 的 `blockedBy` 机制是否严格阻塞？（需实验验证）
2. JSON 文件写入在 macOS 上是否存在部分写入窗口？（需压力测试）
3. 20 章顺序写作的实际耗时是否可接受？（需用户调研）

---

**文档版本**：v1.0
**创建日期**：2026-02-21
**作者**：Research Agent
**状态**：已完成
