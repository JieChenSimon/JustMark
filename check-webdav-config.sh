#!/bin/bash

echo "🔍 检查WebDAV网络权限配置..."
echo ""

# 检查entitlements文件
if [ -f "src-tauri/JustMark.entitlements" ]; then
    echo "✅ Entitlements文件存在"
    echo "内容："
    cat src-tauri/JustMark.entitlements | grep -A 1 "network"
else
    echo "❌ Entitlements文件不存在"
fi

echo ""

# 检查Info.plist
if [ -f "src-tauri/Info.plist" ]; then
    echo "✅ Info.plist文件存在"
    echo "内容："
    cat src-tauri/Info.plist | grep -A 3 "NSAppTransportSecurity"
else
    echo "❌ Info.plist文件不存在"
fi

echo ""

# 检查tauri.conf.json配置
if grep -q "entitlements" src-tauri/tauri.conf.json; then
    echo "✅ tauri.conf.json已配置entitlements"
else
    echo "❌ tauri.conf.json未配置entitlements"
fi

if grep -q "infoFile" src-tauri/tauri.conf.json; then
    echo "✅ tauri.conf.json已配置infoFile"
else
    echo "❌ tauri.conf.json未配置infoFile"
fi

if grep -q "http:allow-fetch" src-tauri/tauri.conf.json; then
    echo "✅ tauri.conf.json已配置HTTP权限"
else
    echo "❌ tauri.conf.json未配置HTTP权限"
fi

echo ""
echo "📦 现在可以重新构建应用："
echo "   npm run tauri build"
echo ""
echo "🧪 构建完成后测试WebDAV功能"
