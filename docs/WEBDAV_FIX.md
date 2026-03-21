# WebDAV网络权限修复说明

## 问题描述
WebDAV同步功能在开发环境（`npm run tauri dev`）中正常工作，但在打包后的dmg安装的正式应用中无法使用。

## 根本原因
macOS应用在打包后受到沙箱限制，需要明确声明网络访问权限。开发环境没有这些限制，所以功能正常。

## 解决方案

### 1. 创建Entitlements文件
文件：`src-tauri/JustMark.entitlements`

声明了以下权限：
- `com.apple.security.network.client` - 允许出站网络连接（WebDAV客户端必需）
- `com.apple.security.network.server` - 允许入站网络连接
- `com.apple.security.files.user-selected.read-write` - 文件系统访问

### 2. 创建Info.plist
文件：`src-tauri/Info.plist`

配置了：
- `NSAppTransportSecurity` - 允许HTTP和HTTPS连接
- `NSAllowsArbitraryLoads` - 允许任意URL加载（包括HTTP）

**安全建议**：如果WebDAV服务器地址固定，可以使用`NSExceptionDomains`只允许特定域名，而不是允许所有URL。

### 3. 更新tauri.conf.json
在`bundle.macOS`中添加：
```json
"macOS": {
  "entitlements": "JustMark.entitlements",
  "infoFile": "Info.plist"
}
```

在`permissions`中添加：
```json
"http:default",
"http:allow-fetch"
```

## 重新构建应用

```bash
# 清理旧的构建
rm -rf src-tauri/target/release/bundle

# 重新构建
npm run tauri build
```

## 验证修复

1. 安装新构建的dmg
2. 打开应用
3. 配置WebDAV连接
4. 测试同步功能

## 技术细节

### 为什么开发环境正常？
- `tauri dev`运行时，应用没有沙箱限制
- 可以自由访问网络和文件系统

### 为什么打包后失败？
- macOS对打包应用强制沙箱
- 没有明确权限声明的网络请求会被阻止
- Rust的`reqwest`库需要系统网络权限

### 相关技术栈
- **Tauri 2.x** - 应用框架
- **reqwest_dav 0.2** - WebDAV客户端库
- **reqwest 0.12** - HTTP客户端（底层）
- **macOS沙箱** - 安全限制机制

## 其他可能的问题

如果修复后仍有问题，检查：

1. **防火墙设置**：确保应用被允许访问网络
2. **WebDAV服务器**：确认服务器地址、端口、认证信息正确
3. **证书问题**：如果使用HTTPS，确保证书有效
4. **日志检查**：查看控制台日志获取详细错误信息

## 调试方法

```bash
# 查看应用日志
log stream --predicate 'process == "JustMark"' --level debug

# 检查网络连接
sudo tcpdump -i any host <webdav-server-ip>
```

## 参考资料
- [Tauri Security Configuration](https://tauri.app/v1/guides/features/security)
- [macOS App Sandbox](https://developer.apple.com/documentation/security/app_sandbox)
- [NSAppTransportSecurity](https://developer.apple.com/documentation/bundleresources/information_property_list/nsapptransportsecurity)
