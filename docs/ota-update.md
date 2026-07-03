# PlanFlow OTA 远程更新功能

## 功能概述

OTA (Over-The-Air) 远程更新允许 PlanFlow APP 在不重新安装 APK 的情况下，通过网络自动下载并应用最新版本代码。

**核心原理**：
1. APP 启动时检查 Cloudflare Pages 的 `version.json`
2. 发现新版本则下载 `dist.zip`
3. 解压到本地 `planflow-updates/` 目录
4. 重启 APP 自动加载最新代码

## 一键部署

```bash
# 部署到 Cloudflare Pages（自动构建 + 上传）
npm run deploy:ota
```

部署后 OTA 地址：`https://planflow-aot.pages.dev`

## 部署平台：Cloudflare Pages

免费、HTTPS、全球 CDN、国内访问较快、自动部署。

### 首次配置

1. 安装 Wrangler CLI：`npm install wrangler --save-dev`
2. 登录授权：`npx wrangler login`
3. 部署：`npm run deploy:ota`

### 更新流程

每次修改代码后：

```bash
npm run deploy:ota
```

一行命令完成构建 + 部署，手机 APP 下次打开自动检测更新。

## 文件结构

```
新增文件：
├── src/utils/otaUpdate.ts          # OTA 核心逻辑（检查、下载、解压）
├── src/components/common/OtaUpdate.vue  # 更新对话框 UI
├── scripts/generate-ota.mjs        # 构建后生成 version.json + dist.zip
├── scripts/ota-server.mjs          # 本地测试用的简易静态服务器

修改文件：
├── src/App.vue                     # 添加 OtaUpdate 组件
├── package.json                    # 新增 build:ota / deploy:ota 命令
├── vite.config.ts                  # base: './' 支持相对路径
├── capacitor.config.ts             # 移除固定 server.url
├── src/utils/db.ts                 # 深拷贝修复 IndexedDB 存储
├── src/utils/aiTools.ts            # 类型断言 as const
├── src/components/task/TaskForm.vue # muscleGroup undefined 修复
```

## 本地测试

```bash
# 启动本地 OTA 服务器（端口 3017）
npm run ota:serve

# 手机连接同一 WiFi，访问 http://<你的IP>:3017
```

## 技术细节

### 版本检测逻辑

```ts
// 检查 Cloudflare Pages 的 version.json
const remote = await fetch('https://planflow-aot.pages.dev/version.json')
const localVersion = await Preferences.get({ key: 'ota_version' })

// 比较版本号
if (remote.version !== localVersion) {
  // 有更新，弹出对话框
}
```

### 文件存储位置

- 本地更新目录：`Directory.Data/planflow-updates/`
- 版本号存储：Capacitor Preferences (类似 localStorage)

### Capacitor 依赖

```json
{
  "@capacitor/filesystem": "^8.1.2",  // 文件读写
  "@capacitor/preferences": "^8.0.1", // 本地存储版本号
  "jszip": "^3.10.1"                  // ZIP 解压
}
```

## 部署架构图

```
┌─────────────────┐     HTTPS     ┌──────────────────┐
│ Cloudflare Pages│◄────────────►│   手机 APP        │
│ planflow-aot   │              │  OtaUpdate.vue    │
│ ├─ version.json │  检查版本     │                  │
│ ├─ dist.zip     │  下载更新     │  planflow-updates│
│ └─ assets/      │              │  ├─ index.html   │
└─────────────────┘              │  ├─ assets/      │
                                 └──────────────────┘
```

## 注意事项

1. **网络要求**：手机需能访问 Cloudflare（WiFi/4G/5G 均可）
2. **版本号**：`package.json` 的 version 字段决定更新提示
3. **首次安装**：新 APK 需要用户手动安装一次，之后全自动更新
4. **回滚**：清除 Preferences 中的 `ota_version` 可触发重新下载

## 其他 Bug 修复

本次提交还包含以下修复：

### IndexedDB 存储修复 (db.ts)

```ts
// 修复：Vue reactive 对象直接存入 IndexedDB 会丢失响应性
await db.put('tasks', JSON.parse(JSON.stringify(task)))  // 深拷贝
```

### AI Tools 类型修复 (aiTools.ts)

```ts
// 修复：TypeScript 类型推断问题
type: 'function' as const  // 明确为字面量类型
```

### TaskForm 空值修复

```ts
// 修复：muscleGroup 可能 undefined 导致查找失败
const group = ex.muscleGroup || '其他'
const dw = DEFAULT_WEIGHT_BY_GROUP[group] ?? 20
```