## Context

M2 已具备卷规划与日更续写的基础循环，但在多卷尺度上需要：
- 卷末输出的结构化信息能直接驱动下卷规划（而不是用户手动搬运）
- 维护操作（世界观更新、角色新增/退场、伏笔查询、故事线管理）有明确入口与事务边界
- 任意变更都能触发“受影响项”提示，保持 Spec 体系可追溯

## Goals / Non-Goals

**Goals:**
- 跨卷衔接时，自动注入上卷 review + final state + 未回收伏笔到 PlotArchitect context
- `/novel:start` 提供按需操作入口，严格遵守交互边界（主技能 AskUserQuestion）
- 维护操作采用 staging→validate→commit，避免“只改了一半”的中间态
- Spec 传播链有明确的“标记需更新”机制，避免 silent drift

**Non-Goals:**
- 不在 M4 引入多用户协作或远程同步（仍为单用户本地文件）
- 不强制所有按需操作都自动完成（可要求用户确认变更）

## Decisions

1. **跨卷输入集最小化且稳定**
   - PlotArchitect 下卷规划输入固定包含：`prev_volume_review`、`global_foreshadowing`、`storylines`、`world_docs`、`active_characters`；
   - 不读取章节全文，保持冷启动。

2. **按需操作是“同一套事务语义”**
   - 任何写入都先进入 `staging/**`，验证通过后再 commit 到正式目录；
   - 写 world/character/storylines 时也记录 changelog（实现时对齐现有结构）。

3. **Spec 传播用“标记与建议”而非静默重写**
   - L1 规则变更 → 标记受影响的角色契约与章节契约；
   - 由 `/novel:start` 在下一次规划/回顾时提示用户选择“重生成/手动调整/忽略（记录原因）”。

4. **按需工具调用以 `/novel:start` 路由为主**
   - 维持三命令 UX，不增加新的高频命令；
   - `/novel:start` 菜单项可包含：世界观更新、角色管理、伏笔查询、故事线管理、质量回顾、规划新卷。

## Risks / Trade-offs

- [Risk] 菜单项过多导致复杂度上升 → Mitigation：按状态推荐 + 分层菜单（先 2-4 选项）
- [Risk] 传播链提示过于频繁 → Mitigation：只在影响“将要写的章节”或 hard 规则时高优先提示

## References

- `docs/dr-workflow/novel-writer-tool/final/prd/05-spec-system.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/08-orchestrator.md`
- `docs/dr-workflow/novel-writer-tool/final/prd/10-protocols.md`

