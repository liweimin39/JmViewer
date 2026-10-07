# JmViewer

基于 [Jmcomic-webUI](https://github.com/zrhcdy/Jmcomic-webUI) 重构的跨平台漫画阅读器，支持 Web / Android / iOS 三端。

原项目是纯 HTML + 原生 JS，本项目用 **Vue 3 + Vite + Capacitor** 全面重写，具备完整的 SPA 路由、组件化架构、离线数据管理、图片解密、下载打包等能力，并通过 GitHub Actions 自动化构建发布。

---

## 功能特性

### 核心浏览

- 首页 Banner 轮播、推荐分区、标签快捷入口
- 最新 / 分类 / 搜索 / 章节列表
- 漫画图片加解密（Canvas 切片还原）
- 阅读进度条拖拽 / 触摸拖动
- 图片懒加载（`IntersectionObserver`）

### 账号系统

- **云端账号**：登录 / 注册 / 忘记密码，收藏、追踪、信箱、已读未读切换
- **本地账号**：默认单账号，可改名，数据存 IndexedDB
- 云端 / 本地账号自由切换，收藏独立存储
- **浏览历史本地与云端共享**，跨账号保留

### 下载管理

- 章节选择（全选 / 不全选 / 反选 ）
- 队列并发下载 + 断点续传 + 失败自动重试
- 按章节流水线处理（请求 API → 下载图片）
- 实时进度（章节 + 图片双维度）
- 图片解密后保存，原生端直接打开文件夹

### 数据管理

- 收藏 / 历史 JSON 导出与导入
- 历史批量删除
- 临时文件清理
- 开发者日志自动记录 / 保存 / 导出

### 原生能力

- Android 物理返回键拦截（应用内后退 + 双击退出）
- Android 存储权限引导（Android 11+ `MANAGE_EXTERNAL_STORAGE`）
- Android 优先唤醒 MT 管理器，降级系统文件管理器
- iOS 系统「文件」App 集成（`shareddocuments://`）
- 自定义 App 图标 + 启动屏
- 图源切换

---

## 技术栈

| 分类         | 技术                                        |
| ------------ | ------------------------------------------- |
| **框架**     | Vue 3（Composition API）+ Vue Router        |
| **构建**     | Vite                                        |
| **原生容器** | Capacitor 8                                 |
| **加密**     | crypto-js（AES / MD5）                      |
| **压缩**     | JSZip（Web 端）                             |
| **存储**     | IndexedDB（本地账号）+ localStorage（设置） |
| **CI/CD**    | GitHub Actions                              |
| **样式**     | 原生 CSS（按页面命名空间隔离）              |

---

## 项目结构

```

project/
├── android/ # Capacitor Android 原生工程
├── ios/ # Capacitor iOS 原生工程
├── public/ # 静态资源
│ └── image/ # 占位图、启动屏图
├── src/
│ ├── api/ # API 封装
│ │ ├── Crypto.js # AES / MD5 加解密
│ │ ├── JmcomicApi.js # 禁漫 API（多域名重试）
│ │ └── UserApi.js # 用户 API（收藏 / 追踪 / 信箱）
│ ├── components/
│ │ ├── chapter/ # 章节页组件
│ │ │ ├── ComicHead.vue
│ │ │ ├── ComicContent.vue
│ │ │ ├── ComicImageLoader.js # 图片懒加载 + 解密
│ │ │ ├── ComicReadingProgress.js
│ │ │ ├── ImageCutter.js # Canvas 切片解密
│ │ │ ├── ActionButtons.vue # 收藏 / 追踪
│ │ │ ├── ChapterList.vue
│ │ │ ├── CommentList.vue
│ │ │ ├── EvaluationBar.vue
│ │ │ └── RecommendedComics.vue
│ │ ├── download/ # 下载组件
│ │ │ ├── DownloadItem.vue
│ │ │ └── StoragePermissionGate.vue
│ │ ├── general/ # 通用组件
│ │ │ ├── NavBar.vue
│ │ │ ├── SwitchServerBtn.vue
│ │ │ ├── Carousel.js
│ │ │ ├── LazyLoader.js
│ │ │ ├── Queue.js
│ │ │ └── Setting.js
│ │ ├── index/ # 首页组件
│ │ ├── latest/ # 最新页组件（ComicCard）
│ │ ├── setting/ # 设置页组件
│ │ ├── user/ # 用户页组件
│ │ └── ...
│ ├── composables/ # 组合式函数
│ │ ├── useUser.js # 云端账号状态
│ │ ├── useLocalUser.js # 本地账号状态
│ │ └── useStoragePermission.js
│ ├── router/ # 路由配置
│ ├── styles/ # 全局样式
│ ├── utils/
│ │ ├── localDB.js # IndexedDB 封装（多用户 + 连接容错）
│ │ ├── offlineStorage.js # 文件系统封装
│ │ ├── downloadManager.js # 下载队列管理
│ │ ├── zipHelper.js # JSZip 打包
│ │ ├── dataExport.js # 数据导出 / 导入
│ │ └── logger.js # 日志系统
│ ├── views/ # 页面
│ │ ├── HomeView.vue
│ │ ├── LatestView.vue
│ │ ├── SearchView.vue
│ │ ├── CategoriesView.vue
│ │ ├── ChapterView.vue
│ │ ├── SettingView.vue
│ │ ├── UserView.vue
│ │ ├── DownloadsView.vue
│ │ └── DownloadDetailView.vue
│ ├── App.vue
│ └── main.js
├── capacitor.config.json # Capacitor 配置
├── vite.config.js
├── package.json
└── .github/workflows/ # GitHub Actions

```

---

## 开发

### 环境要求

- Node.js >= 22
- npm
- Android Studio（Android 构建）
- Xcode + macOS（iOS 构建）

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

浏览器访问 `http://localhost:5173`。

### 构建 Web 静态资源

```bash
npm run build
```

产物输出到 `dist/`。

---

## 打包原生 App

### 前置：安装 Capacitor CLI

```bash
npm install -g @capacitor/cli
```

### Android

```bash
# 构建 Web + 同步到原生工程
npm run build
npx cap sync android

# 打开 Android Studio
npx cap open android
```

在 Android Studio 中：

1. **Build → Clean Project**
2. **Run** 到真机（需开启 USB 调试）

### iOS（需要 macOS）

```bash
npm run build
npx cap sync ios
npx cap open ios
```

在 Xcode 中：

1. 设置 **Signing & Capabilities**（Team 选你的 Apple ID）
2. **Run** 到真机

---

## 权限说明

### Android 存储权限

项目使用 `MANAGE_EXTERNAL_STORAGE`（所有文件访问）权限，将下载的漫画保存到公共目录：

```
/storage/emulated/0/JmViewer/
├── Tmp/logs/app.log         # 日志
├── Comics/{albumId}/        # 解密后的漫画图片
└── download-tasks.json      # 下载任务记录
```

原图暂存在 `Android/data/com.liweimin.jmviewer/cache/Tmp/ComicImages/`，App 启动时自动清空。

**权限引导**：首次进入"我的下载"页会自动弹出权限请求，点击"去授权"跳转系统设置。

### iOS 文件访问

通过 `UIFileSharingEnabled` + `LSSupportsOpeningDocumentsInPlace` 让 App 的 Documents 目录显示在系统「文件」App 中：

```
文件 App / 我的 iPhone / JmViewer/
├── Tmp/logs/app.log
├── Comics/{albumId}/
└── download-tasks.json
```

点击漫画卡片的文件夹图标通过 `shareddocuments://` 跳转到系统「文件」App。

---

## CI / CD

所有工作流位于 `.github/workflows/`：

| Workflow              | 触发条件             | 产物                                  |
| --------------------- | -------------------- | ------------------------------------- |
| **build-web.yml**     | push to main / 手动  | `web-dist.zip`                        |
| **build-android.yml** | push to main / 手动  | Debug 或 Release APK                  |
| **build-ios.yml**     | push to main / 手动  | 未签名 IPA                            |
| **release.yml**       | push tag `v*` / 手动 | GitHub Release（APK + IPA + Web zip） |

### 手动触发构建

进入 GitHub 仓库 → **Actions** 标签页 → 选择对应 workflow → **Run workflow**。

### 发布新版本

```bash
git tag v1.0.0
git push origin v1.0.0
```

会自动：

1. 构建 Android Release APK（需签名）
2. 构建 iOS 未签名 IPA
3. 打包 Web 静态资源
4. 创建 GitHub Release 并上传所有产物

### Android 签名配置

在仓库 **Settings → Secrets and variables → Actions** 中添加：

| Secret 名                   | 说明                        |
| --------------------------- | --------------------------- |
| `ANDROID_KEYSTORE_BASE64`   | keystore 文件的 base64 编码 |
| `ANDROID_KEYSTORE_PASSWORD` | keystore 密码               |
| `ANDROID_KEY_ALIAS`         | key 别名                    |
| `ANDROID_KEY_PASSWORD`      | key 密码                    |

生成 keystore：

```bash
# 1. 生成 keystore
keytool -genkey -v -keystore release.keystore -alias jmviewer -keyalg RSA -keysize 2048 -validity 10000
# 2. 转 base64
# Linux:
base64 -w 0 release.keystore > release.keystore.base64

# macOS:
base64 -i release.keystore > release.keystore.base64
# Windows CMD
powershell -Command "[Convert]::ToBase64String([IO.File]::ReadAllBytes('release.keystore')) | Out-File -Encoding ASCII release.keystore.base64"
```

### iOS 未签名 IPA 使用

下载 IPA 后通过以下工具自签安装到设备：

- [TrollStore](https://github.com/opa334/TrollStore)

---

## 已知限制

- **Android 9 / iOS 15.8.7 兼容**：已通过 `core-js` + 目标降级适配，但极低版本 WebView 可能仍有兼容问题
- **iOS 边缘滑动返回**：WKWebView 原生不支持 SPA 路由返回，需手动加返回键
- **Web 端大文件打包**：JSZip 在内存中处理，超大漫画（> 100MB）可能内存溢出
- **原生端不打包 ZIP**：直接保存解密后的图片到 `Comics/` 文件夹，避免内存问题

---

## 免责声明

- 本项目只是一个界面，不含任何内容；所有漫画数据、图片都来自第三方接口，与项目作者无关。
- 请遵守你所在地区的法律法规，以及内容来源方的服务条款。
- 下载功能仅供个人备份离线阅读使用，请勿二次传播或用于任何商业用途。
- 如有侵权，请联系删除。

---

## 致谢

- 原项目：[Jmcomic-webUI](https://github.com/zrhcdy/Jmcomic-webUI)
- [Capacitor](https://capacitorjs.com/)
- [Vue.js](https://vuejs.org/)
- [JSZip](https://stuk.github.io/jszip/)

---
