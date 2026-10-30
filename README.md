# JmViewer

基于 [Jmcomic-webUI](https://github.com/zrhcdy/Jmcomic-webUI) 重构的跨平台漫画阅读器，支持 **Web / Android / iOS** 三端。

原项目为纯 HTML + 原生 JS，本项目用 **Vue 3 + Vite + Capacitor** 重写，具备 SPA 路由、组件化架构、图片解密、下载管理与 SQLite 离线阅读，并通过 GitHub Actions 自动构建发布。

> 本项目只是一个界面，不含任何内容。详见下方[免责声明](#免责声明)。

---

## 功能特性

### 浏览与阅读

- 首页 Banner 轮播、推荐分区、标签快捷入口
- 最新 / 分类 / 搜索 / 章节列表
- 漫画图片 Canvas 切片解密还原
- 图片懒加载（`IntersectionObserver`），直链 / Blob 两种加载方式可切换
- 阅读进度条拖拽与触摸跳转

### 账号系统

- **云端账号**：登录 / 注册 / 找回密码，收藏、追踪、信箱、已读切换
- **本地账号**：默认单账号，可改名，数据存 IndexedDB
- 云端 / 本地账号自由切换，收藏按账号独立
- 浏览历史跨账号共享

### 下载与离线

- 章节选择（全选 / 反选 / 不全选）
- 队列并发下载、断点续传、失败自动重试
- 实时进度（章节 + 图片双维度）
- 下载时同步保存封面与元数据到 SQLite
- **离线库**：按漫画汇总章节数与占用空间，支持单部删除
- **离线阅读**：独立页面，纯本地读取，断网可用

### 数据与设置

- 收藏 / 历史 JSON 导出与导入，历史批量删除
- 临时文件清理（含 WebView 图片缓存）
- 6 套主题配色、图源切换
- 开发者日志自动记录 / 导出
- 免责声明首次启动弹窗，设置页可重新查看
- 关于页展示版本、项目地址与技术栈

### 原生能力

- Android 返回键拦截（应用内后退 + 双击退出）
- Android 存储权限引导（Android 11+）
- Android 优先唤醒 MT 管理器，降级系统文件管理器
- iOS 系统「文件」App 集成（`shareddocuments://`）
- 自定义 App 图标与启动屏

---

## 技术栈

| 分类 | 技术 |
|---|---|
| 框架 | Vue 3（Composition API）+ Vue Router 5 |
| 构建 | Vite 8 |
| 原生容器 | Capacitor 8 |
| 存储 | SQLite（离线漫画）+ IndexedDB（本地账号）+ localStorage（设置） |
| 加密 / 压缩 | crypto-js（AES / MD5）、JSZip（Web 端） |
| CI/CD | GitHub Actions |

---

## 快速开始

**环境要求**：Node.js ≥ 22；Android 构建需 Android Studio；iOS 构建需 macOS + Xcode。

```bash
npm install
npm run dev      # 开发服务器，默认 http://localhost:5173
npm run build    # 构建 Web 产物到 dist/
```

同步原生工程：

```bash
npm run build
npx cap sync android && npx cap open android   # Android
npx cap sync ios && npx cap open ios           # iOS（需 macOS）
```

---

## 下载安装

前往 [Releases](https://github.com/liweimin39/JmViewer/releases) 下载：

| 产物 | 说明 |
|---|---|
| `.apk` | Android 直接安装（需允许安装未知来源应用） |
| `.ipa` | iOS 未签名包，需 TrollStore 等工具自签安装 |
| `web-dist.zip` | 静态站点，可部署到任意 Web 服务器 |

版本号规则：`v1.0.2` 为正式版，含 `beta` 的标签自动标记为预发布。

---

## 项目结构

```
src/
├── api/           Crypto · JmcomicApi · UserApi
├── components/    chapter / download / general / index / latest / setting / user
├── composables/   useUser · useLocalUser · useDisclaimer · useStoragePermission · useBackButton
├── router/        路由配置
├── styles/        basic · theme · index · latest · search · categories
│                  chapter · user · setting · download · offline
├── utils/         offlineDB · offlineStorage · downloadManager · zipHelper
│                  localDB · dataExport · logger
├── views/         页面（含 OfflineView / OfflineChapterView）
├── App.vue
└── main.js
android/ · ios/    Capacitor 原生工程
doc/               开发文档
```

---

## 数据存储

| 位置 | 内容 |
|---|---|
| `JmViewer/Comics/{albumId}/` | 解密后的章节图片与 `cover.jpg` |
| `JmViewer/Tmp/logs/app.log` | 运行日志 |
| `JmViewer/download-tasks.json` | 下载任务（SQLite 不可用时的回退） |
| SQLite `jmviewer_offline` | 离线专辑 / 章节 / 图片清单 / 任务 |
| IndexedDB | 本地账号、收藏、历史 |
| localStorage | 设置、登录态、免责声明标记 |

Android 保存在公共目录 `/storage/emulated/0/JmViewer/`（需「所有文件访问」权限）；iOS 保存在 App Documents，可通过系统「文件」App 访问。

---

## 发布新版本

```bash
# 1. 同步版本号：build.gradle、project.pbxproj、package.json
# 2. 打标签推送，触发 Release 工作流
git tag v1.0.2
git push origin v1.0.2
```

工作流会自动构建 Android 签名 APK、iOS 未签名 IPA、Web 静态包并创建 GitHub Release。CI 清单、签名 Secret 配置、本地打包与调试细节见[开发文档](doc/DEVELOPMENT.md)。

---

## 已知限制

- 极低版本 WebView（Android 9 以下）可能仍有兼容问题
- iOS 侧滑返回在 SPA 中不生效，需使用页内返回按钮
- Web 端打包在内存中处理，超大漫画（> 100 MB）可能 OOM
- 原生端不生成 ZIP，直接保存解密图片
- 离线功能仅在 Android / iOS 客户端可用

---

## 免责声明

1. 本项目只是一个界面，不含任何内容；所有漫画数据、图片都来自第三方接口，与项目作者无关。
2. 请遵守你所在地区的法律法规，以及内容来源方的服务条款。
3. 下载功能仅供个人备份离线阅读使用，请勿二次传播或用于任何商业用途。
4. 如有侵权，请联系删除。

---

## 致谢

- 原项目：[Jmcomic-webUI](https://github.com/zrhcdy/Jmcomic-webUI)
- [Capacitor](https://capacitorjs.com/) · [Vue.js](https://vuejs.org/) · [JSZip](https://stuk.github.io/jszip/)
