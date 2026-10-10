# JmViewer 项目知识库（AI 参考文档）

> 本文档面向 AI 助手与开发者，记录项目架构、核心模块、关键算法与易错点。修改代码前请先阅读本文。

---

## 1. 项目概述

JmViewer 是一个基于 **Vue 3 + Vite + Capacitor 8** 的跨平台漫画阅读器（Web / Android / iOS），重构自纯 HTML+JS 的原项目 [Jmcomic-webUI](https://github.com/zrhcdy/Jmcomic-webUI)。数据来源为第三方"禁漫天堂"APP 的加密 API，本项目只是界面壳。

- 包名 / appId：`com.liweimin.jmviewer`
- 无 UI 框架，纯手写 CSS（按页面命名空间隔离，见 `src/styles/*.css`）
- 无 Pinia/Vuex，状态靠**模块级单例 + Vue `ref`**（composables 模式）
- Node 要求：`^22.18.0 || >=24.12.0`

## 2. 技术栈与构建

| 分类 | 技术 |
| --- | --- |
| 框架 | Vue 3 Composition API + vue-router（createWebHistory） |
| 构建 | Vite 8，target: `es2015/safari14/chrome61`，`modulePreload.polyfill: false`（iOS WKWebView 兼容） |
| 兼容 | `core-js/actual` 必须在 `main.js` **第一行** import（早于所有模块） |
| 加密 | crypto-js（AES-ECB / MD5） |
| 存储 | IndexedDB（账号数据）+ localStorage（设置/登录态）+ Capacitor Filesystem（下载文件） |
| 原生 | Capacitor 8 + 自定义 Android 插件 StoragePermissionPlugin |
| CI/CD | GitHub Actions：build-web / build-android / build-ios / release（tag `v*` 触发） |

命令：`npm run dev`（5173）、`npm run build`（dist/）、`npx cap sync android|ios`。

## 3. 目录与模块地图

```
src/
├── main.js              # 启动：core-js → logger.patch/init → setting.init → jmApi.init → 挂载
├── App.vue              # NavBar + SwitchServerBtn + RouterView，根类名 page-{route.name}
├── api/                 # 网络层（详见 §4）
├── components/
│   ├── chapter/         # 阅读页：ComicImageLoader / ImageCutter / ComicReadingProgress
│   ├── download/        # ChapterSelector / DownloadItem / StoragePermissionGate
│   ├── general/         # NavBar / Setting / Queue / LazyLoader / Carousel / InfinityScrollContainer
│   ├── index/ latest/ user/ setting/
├── composables/         # useUser / useLocalUser / useStoragePermission / useBackButton
├── router/index.js      # 路由（懒加载除 home 外全部页面）
├── utils/               # localDB / offlineStorage / downloadManager / zipHelper / dataExport / logger
└── views/               # 页面：Home/Latest/Search/Categories/Chapter/Setting/User/Downloads/DownloadDetail
```

路由：`/`、`/latest`、`/search`、`/categories`、`/setting`、`/user`、`/chapter/:id`、`/downloads`、`/download/:albumId`、`/setting/LocalDataSettings`。

## 4. API 层（src/api/）

### 4.1 认证机制（JmcomicApi.js）

- `currentKey = Math.floor(Date.now()/1000)`（秒级时间戳）
- `token = MD5(currentKey + "185Hcomic3PAPP7R")`，`tokenParam = "{key},3.2.0"`
- 服务器列表：启动时从固定地址拉取 `newsvr-2025.txt`，用 `decryptCurrentApi()`（固定密钥 MD5 of `"diosfjckwpqpdfjkvnqQjsik"`）解密得到 `servers[]`
- 所有业务请求头必须带 `token` / `tokenParam`

### 4.2 数据解密（Crypto.js）

- 响应体 `data` 字段为 AES-ECB 密文；密钥 = `MD5(currentKey + template)`，逐个尝试模板 `["185Hcomic3PAPP7R", "18comicAPPContent"]`，成功即返回 JSON
- ⚠️ `currentKey` 是模块加载时生成的，长时间运行后与服务器时间偏差会导致解密失败

### 4.3 多域名重试策略

- `JmcomicApi.retryFetch(getUrl, init, count)`：getUrl 是 `(i)=>url` 函数，业务接口用 `servers[4 - i]`（从第 5 个域名开始），共 5 次
- `UserApi._requestWithRetry`：循环遍历全部 servers，15s 超时（AbortController），重试间隔 300ms
- **错误分类**：`err.__businessError = true`（4xx 非 404 / errorMsg 非空）→ 立即抛出不换域名；网络错误/超时/5xx/404 → 换域名重试
- 图片服务器 `imgServers[]` 共 6 个，`getCoverImageURL` 用 `id % 5` 分散负载；章节图片用 `setting.using_imgserver_index`（图源切换，SwitchServerBtn.vue 修改，持久化在 localStorage）

### 4.4 UserApi.js

登录/注册/忘记密码/登出、收藏（toggleFavorite/getFavoriteList）、追踪（toggleTracking/getTrackingStatus）、通知（getNotifications/markNotificationRead）。登录成功把 `jwttoken`、`userInfo` 写入 localStorage；请求头 `Authorization: Bearer {jwt}`。

## 5. 图片解密核心算法（ImageCutter.js）

禁漫对章节图片做**水平切片乱序**。还原步骤：

1. 切片数：`id ∈ [220980, 268850)` → 固定 10；否则 `MD5(id + path前5字符)` 最后一个字符 charCode 取模（`id ≤ 421925` 模 10，否则模 8），层数 = `key*2+2`
2. Canvas 重绘：先画最后一片（底部）到顶部，再"从下往上依次拼接"其余切片
3. 白色背景填充防止透明图变黑；输出 PNG dataURL

**是否需要解密**：`chapterId >= 220980 && !name.endsWith('.gif')`。

> ★★★ 最重要的坑：`cutImage(img, id, path)` 的 id **必须传 chapterId，不能传 albumId**——切片层数由 `MD5(id+path)` 决定，传错会解密出乱码。downloadManager.js 和 zipHelper.js 中已多处注释强调。

## 6. 阅读页链路（ChapterView.vue + components/chapter/）

- `ComicImageLoader`（class，非组件）：两个 IntersectionObserver——一个触发图片加载（rootMargin 300px），一个跟踪可见图片索引驱动进度条；`Queue`（LRU，超出上限调 `cleanup()`）限制并发；30s 加载超时
- 并发上限动态调整 `getMaxQueueLength()`：移动端夜间 2 张 / 白天 3 张；桌面夜间 3 / 傍晚 6 / 白天 10
- `ComicReadingProgress`：进度条拖拽（mouse+touch），`jumpTo` 用 `scrollIntoView`
- 卸载时必须调用 `destroy()`（Vue 迁移新增，防止 observer 泄漏）
- 历史写入：`localDB.addHistory(getCurrentUserId(), {...})`，userId 云端优先（`userInfo.uid`），否则本地账号 id

## 7. 账号与数据模型

### 7.1 双账号体系

- **云端账号**：`useUser.js` 模块级单例 `userInfo`/`notificationUnread`，持久化在 localStorage `jwttoken`/`userInfo`
- **本地账号**：`useLocalUser.js` + `localDB`，默认单账号可改名，存 IndexedDB
- UserView 中 `mode` 切换云端/本地视图；云端登出自动回退本地
- **收藏**按当前 userId 隔离（云端走 UserApi，本地走 localDB，key 前缀 `{userId}__`）
- **历史**全局共享：userId 固定为 `'common'`（跨账号保留），key `{common}__{comicId}`，每部漫画只保留最新一条（按 comicId 合并）

### 7.2 localDB.js（IndexedDB）

- DB `JmViewerLocalDB` v1，object stores：`users` / `favorites` / `history`
- 连接容错：`_withDB()` 包装所有操作，遇 InvalidStateError/TransactionInactiveError 自动重连重试一次；`onclose`/`onversionchange` 清缓存
- `init()` 含一次性迁移：`jmviewer.cleanedV2` 清旧账号、`jmviewer.historyCommonMigrated` 历史合并到 common
- 导出格式 version 1/2（favorites + history，剥离 userId）

localStorage 关键 key：`jwttoken`、`userInfo`、`jmviewer.localUserId`、`jmviewer.cleanedV2`、`jmviewer.historyCommonMigrated`、`using_imgserver_index`、`promoteCache`（推广数据按日缓存）。

## 8. 下载系统（utils/downloadManager.js）

- 状态机：`pending → downloading → packaging(仅 Web) → completed`，旁路 `paused / failed / cancelled`
- 常量：并发 2 任务、重试 3 次（退避 2000ms×n）、通知节流 200ms、落盘节流 2000ms
- **流水线**：按章节顺序 `getComicChapter(id)` → 逐张 fetch → 需要解密则 Canvas 切片还原（存 PNG）→ `offlineStorage.writeBase64`
- **断点续传**：解码目标文件存在且 >100 字节即跳过；`_chapters` 元数据随任务持久化，丢失则标记 FAILED
- 原生端不打包 ZIP（直接保存图片目录避免内存溢出）；Web 端完成后用 JSZip 打包（zipHelper.js 动态 import），blob 存内存 + 落盘 Tmp/
- 暂停/取消用异常信号 `__PAUSE__`/`__CANCEL__` 在循环边界抛出
- 事件订阅：`addListener(fn)` 回调全量 tasks；`openOutput()` 原生调 StoragePermission.openFolder，Web 触发 `<a download>`

## 9. 文件存储（utils/offlineStorage.js）

统一封装 Capacitor Filesystem，区分**主目录**与**原图缓存目录**：

| 平台 | 主目录 | 原图缓存 |
| --- | --- | --- |
| Android | `Directory.ExternalStorage` 下 `JmViewer/` | `Directory.ExternalCache` 下 `Tmp/ComicImages/` |
| iOS | `Directory.Documents` 根（无 JmViewer 前缀） | Documents 下 `Tmp/ComicImages/` |
| Web | 同样走 Filesystem 插件（实际由 Capacitor 兼容层处理） | — |

目录结构：`JmViewer/{Tmp/logs/app.log, Comics/{albumId}/chapters/{chapterId}/*.png, download-tasks.json}`。App 启动 `clearTmp()` 清空 Tmp（保留 logs）。iOS 通过 `UIFileSharingEnabled` 暴露到系统「文件」App。

## 10. 原生能力

### 10.1 Android 自定义插件 StoragePermissionPlugin.java

注册于 `MainActivity.onCreate`（必须在 `super.onCreate` **之前** `registerPlugin`）。方法：

- `checkAllFilesAccess()`：`Environment.isExternalStorageManager()`（API 30+，以下恒 true）
- `openAllFilesAccess()`：三级降级跳设置页（本 App 页 → 列表页 → 应用详情页）
- `openFolder({path})`：优先 MT 管理器（`bin.mt.plus.ACTION_SHORTCUT`，两个 Component 备用）→ 系统文件管理器（DocumentsContract primary: 相对路径）→ Toast 显示路径

Manifest：`MANAGE_EXTERNAL_STORAGE` + `<queries>` 包可见性声明（Android 11+ 检测 MT 必需）。

### 10.2 其他

- `useBackButton.js`：仅 Android 原生生效；优先级：关抽屉 → router.back() → 根页面双击退出（2s 内）/ 非根页面回首页
- `useStoragePermission.js`：Android ≥11 走自定义插件，≤10 走 `Filesystem.checkPermissions()`；iOS/Web 恒 granted
- iOS：SPM 工程（CapApp-SPM），无 Podfile；CI 产出未签名 IPA（TrollStore 自签安装）

## 11. 日志系统（utils/logger.js）

- 模块加载即 `logger.patch()`：拦截 console.* + window error/unhandledrejection；`main.js` 中 `logger.init()` 在挂载前调用
- 内存环形 500 条；原生端追加写 `Tmp/logs/app.log`，超 2MB 重置；error 级立即 flush，其他 3s 防抖；`visibilitychange hidden` 时 flush
- Web 端仅内存；`export()` 原生走 Share 面板，Web 走 blob 下载

## 12. 通用组件模式

- `InfinityScrollContainer`：window scroll 监听 + 冷却时间（默认 1000ms）+ `loadContent(page)` 回调；**必须 destroy()** 防路由切换后监听叠加
- `LazyLoader`（单例）：封面懒加载，rootMargin 50px，失败回退 `/image/cover_default.jpg`（onerror 先于 src 挂载，防死循环）
- `Queue`：定长队列，满员时 shift 并调用被淘汰项的 `cleanup()`
- 列表页共同模式：`loadContent(page)` + `loading/loadingMore` 双状态 + onMounted 建滚动容器（Latest/Search/Categories）
- SearchView 特例：纯数字查询先尝试 `getComicAlbum(id)` 直达

## 13. CI/CD（.github/workflows/）

- release.yml：tag `v*` 触发 android（签名 APK，4 个 Secrets：ANDROID_KEYSTORE_BASE64/PASSWORD/KEY_ALIAS/KEY_PASSWORD，先校验别名存在）+ ios（自动判断 SPM/Podfile，无签名构建）+ web（dist.zip）三 job，release job 汇总发 GitHub Release（先删同名旧 Release，保留 tag）
- build-*.yml：push main 或手动触发

## 14. 已知约束与注意事项（改动前必读）

1. **core-js import 必须是 main.js 第一行**，否则低版本 WebView 语法报错
2. **解密/命名一律用 chapterId**（§5），albumId 只用于输出目录
3. `jmApi` 构造函数即触发 `init()` 网络请求；main.js 里 await 失败不阻断挂载（离线可用本地数据）
4. IndexedDB 历史迁移标志位是一次性的，改历史模型需新增迁移 flag
5. Vite `cssMinify: false`——CSS 里可能有依赖注释语义的写法，勿开启压缩
6. 原生端不打包 ZIP 是有意为之（内存限制），勿在原生走 zipHelper
7. `.gif` 不解密、id < 220980 的老漫画不解密
8. 图片 URL 域名与 API 域名分离（imgServers vs servers），图源切换只影响图片
9. 无测试、无 lint（仅 prettier `npm run format`）；验证改动靠 `npm run build` + 真机
10. 免责声明：仅界面壳，内容来自第三方接口，仅供个人离线备份

## 15. 快速定位表

| 需求 | 入口文件 |
| --- | --- |
| 改 API 域名/重试 | `src/api/JmcomicApi.js`、`src/api/UserApi.js` |
| 改图片解密 | `src/components/chapter/ImageCutter.js` |
| 改阅读加载并发 | `src/components/chapter/ComicImageLoader.js` |
| 改下载流程 | `src/utils/downloadManager.js` |
| 改存储路径规则 | `src/utils/offlineStorage.js` |
| 改本地账号/收藏/历史 | `src/utils/localDB.js` + `src/composables/` |
| 改 Android 权限/打开文件夹 | `android/app/src/main/java/com/liweimin/jmviewer/StoragePermissionPlugin.java` |
| 改返回键行为 | `src/composables/useBackButton.js` |
| 改构建目标/兼容 | `vite.config.js`、`src/main.js` 首行 |
