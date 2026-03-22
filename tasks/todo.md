# WebDAV 深入分析计划

## 背景
- 目标: 对现有 WebDAV 功能做多角色并行分析与评估，识别根因、风险和改进优先级。
- 范围: 前端配置流、同步算法、Tauri/Rust WebDAV 命令层、测试与可观测性。

## 执行计划
- [x] 定位 WebDAV 相关代码与现有报告
- [x] 阅读核心实现文件并建立问题清单
- [x] 启动多个子代理并行评估不同维度
- [x] 交叉比对 findings，筛出高置信问题
- [x] 补充必要的本地验证与证据
- [x] 输出结论、优先级与改进建议
- [x] 产出 WebDAV 重构规格与分阶段修复路线

## 高层摘要
- 当前先做代码级评估，不直接修改实现。
- 重点关注行为正确性、协议路径构造、删除/冲突语义、安全性和测试缺口。

## Phase 0 执行
- [x] 停止根据本地缺失自动删除远端文件
- [x] 修复 Rust 删除命令未拼接 `base_path`
- [x] 停止持久化 `connected` 历史状态
- [x] 将设置页状态从实时连接误导收敛为已保存配置
- [x] 将同步模式文案收敛为 `backup`
- [x] 运行 Rust 单测
- [x] 运行前端构建验证

## 结果复盘
- 已完成多角色并行评估，确认问题不是单点故障，而是四层共同失稳:
- 配置层: 明文存储密码、持久化 `connected`、双入口配置漂移。
- 同步层: 删除语义危险、`upload-only` 语义错误、冲突未真正闭环、`size + mtime` 漏检。
- 命令层: 删除未拼接 `base_path`、URL/path 解析过于脆弱、缺少路径边界保护。
- 工程层: 缺少 WebDAV 自动化测试与结构化日志，状态机不可证伪。
- 结论: 当前实现更像“高风险双向同步器雏形”，不适合作为可依赖的数据同步能力继续叠加功能。
- 已新增规格文档: `docs/specs/WEBDAV_REFACTOR_SPEC.md`
- 推荐优先路线: `backup` 单向安全备份 -> 配置层重构 -> 命令层重构 -> 同步策略重构 -> 测试与可观测性补齐
- 本轮已落地 Phase 0 止血:
- 停止根据本地缺失自动删除远端文件
- 本地存在但远端缺失时改为补传远端
- Rust 删除命令改为保留 `base_path`
- 停止持久化 `connected`，UI 改为区分“配置已保存”与“实时连接”
- 同步模式文案收敛为 `Backup (Upload Only)`
- 已继续推进 Phase 1/2:
- WebDAV 普通配置与密码凭据分离，保存模型改为 `passwordSaved + credentialId`
- macOS 下新增 Keychain 凭据读写命令，并支持旧版 localStorage 明文密码自动迁移
- Rust URL/path 解析改为结构化校验，拒绝 query/fragment 和 `..` 路径穿越
- 前端在提交前就校验 WebDAV URL 和 folder，减少后端才报错的情况
- 已验证:
- `npm run test:webdav-phase0` 通过
- `cargo test webdav --manifest-path src-tauri/Cargo.toml` 通过
- `npm run build` 通过
- 本轮 Phase 0 验证结果:
- `cargo test` 通过
- `npm run build` 通过
- 已新增最小验证入口: `npm run test:webdav-phase0`
- 当前验证结果: 3 个检查均能复现现有风险，分别卡住配置持久化、删除路径和危险同步语义
