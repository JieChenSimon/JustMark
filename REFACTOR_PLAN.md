# JustMark 代码重构计划

## 主要问题

1. **App.jsx 过大** (2727 行)
   - 所有状态和逻辑都在一个文件
   - 难以维护和测试

2. **状态管理**
   - 太多 useState (30+ 个状态)
   - 缺少状态分组
   - localStorage 操作分散

3. **性能问题**
   - 可能的不必要重渲染
   - 缺少 memo 优化
   - 大量内联函数

## 重构步骤

### Phase 1: 状态管理优化 ✅ 开始
- [ ] 创建 context 管理全局状态
- [ ] 提取 localStorage 逻辑到 hooks
- [ ] 合并相关状态

### Phase 2: 组件拆分
- [ ] 提取 Toolbar 组件
- [ ] 提取 Sidebar 组件
- [ ] 提取 Preview 组件
- [ ] 提取 Settings 组件

### Phase 3: 性能优化
- [ ] 添加 React.memo
- [ ] 优化 useCallback/useMemo
- [ ] 减少不必要的重渲染

### Phase 4: 代码清理
- [ ] 移除重复代码
- [ ] 统一命名规范
- [ ] 添加 TypeScript (可选)

## 当前进度

开始 Phase 1...
