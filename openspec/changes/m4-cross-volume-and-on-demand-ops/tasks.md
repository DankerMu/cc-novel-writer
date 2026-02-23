## 1. Cross-Volume Handoff

- [ ] 1.1 定义卷末回顾到下卷规划的输入集与文件来源（review/state/global）
- [ ] 1.2 卷末回顾产物梳理：review.md、final state 存档、未回收伏笔/故事线摘要
- [ ] 1.3 下卷规划 context 注入：PlotArchitect 读取上卷回顾 + 全局伏笔 + storylines 定义

## 2. On-Demand Ops Routing

- [ ] 2.1 `/novel:start` 增加按需操作菜单与路由（世界观/角色/伏笔/故事线）
- [ ] 2.2 世界观增量更新：WorldBuilder 增量模式的输入/输出与用户确认点
- [ ] 2.3 角色管理：新增/更新/退场的输入/输出与归档保护规则（伏笔/故事线引用保护）

## 3. Transaction & Safety

- [ ] 3.1 维护操作沿用 staging→validate→commit（同章节事务语义）
- [ ] 3.2 注入安全：按需操作的外部文本注入统一使用 `<DATA>` delimiter
- [ ] 3.3 路径审计与白名单：确保写入仅发生在 staging/**（对齐 hooks）

## 4. Spec Propagation Signals

- [ ] 4.1 L1 变更 → 标记受影响 L2 契约（需更新/需审核）
- [ ] 4.2 L2 变更 → 标记受影响 L3 章节契约（特别是待写章节）
- [ ] 4.3 在下一次规划/回顾时展示传播链提示与用户选项（重生成/手动/忽略并留痕）

## References

- `docs/dr-workflow/novel-writer-tool/final/prd/05-spec-system.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/10-protocols.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/09-data.md`
- `docs/dr-workflow/novel-writer-tool/final/milestones.md`

