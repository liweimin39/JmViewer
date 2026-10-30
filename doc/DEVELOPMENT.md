# JmViewer 开发文档

面向后续开发与维护。内容以当前 `main` 分支代码为准。

---

## 1. 技术栈与运行环境

| 分类 | 技术 |
|---|---|
| 框架 | Vue 3（Composition API）+ Vue Router 5 |
| 构建 | Vite 8 |
| 原生容器 | Capacitor 8（Android / iOS / Web） |
| 离线数据 | `@capacitor-community/sqlite`（SQLite） |
| 本地账号 | IndexedDB（`localDB.js`） |
| 配置 | localStorage（设置 / 登录态） |
| 加密 | crypto-js（AES-ECB + MD5） |
| 压缩 | JSZip（仅 Web 端打包） |
| 日志 | `logger.js`（接管 console） |

要求 Node.js ≥ 22（`engines` 另有 ≥ 24.12 分支）。无 TypeScript，全部为 `.js` / `.vue`，样式为原生 CSS 按页面命名空间隔离。

### 常用命令

```bash
npm install          # 安装依赖
npm run dev          # 开发服务器（默认 http://localhost:5173）
npm run build        # 构建 Web 产物到 dist/
npm run preview      # 预览构建产物
npm run format       # Prettier 格式化 src/
npx cap sync android # Web 构建后同步原生工程
npx cap open android # 打开 Android Studio
```

> Windows PowerShell 若出现 `npm.ps1 无法加载`（执行策略限制），改用 `npm.cmd run build`。

---

## 2. 启动流程

入口 [src/main.js](../src/main.js)，根组件 [src/App.vue](../src/App.vue)。

1. **首行必须是** `import 'core-js/actual'`，低版本 WebView 的 polyfill 需先于其它模块加载。
2. `logger.init()` → 引入全局样式。
3. `bootstrap()`：`setting.init()` → `await jmApi.init()`（失败仅告警）→ 挂载路由与应用。
4. `App.vue` 根节点类名为 `page-${route.name}`，因此 `chapter.css` 中的 `.page-chapter` 规则只对路由名为 `chapter` 的页面生效。
5. `App.vue` 挂载后检查免责声明标记，未同意则弹出 [DisclaimerOverlay](../src/components/setting/DisclaimerOverlay.vue)。

`index.html` 内联脚本按 `app_theme` 提前给 `<html>` 加 `{theme}-theme` 类，避免首帧闪烁。

---

## 3. 目录与职责

```
src/
├── api/
│   ├── Crypto.js            AES / MD5 加解密，兼容接口返回明文
│   ├── JmcomicApi.js        站点接口 + 图片 URL 拼接 + 多域名重试
│   └── UserApi.js           账号 / 收藏 / 追踪 / 通知接口
├── components/
│   ├── chapter/             ComicHead · ComicContent · ComicImageLoader
│   │                        ComicReadingProgress · ImageCutter · ChapterList
│   │                        CommentList · EvaluationBar · ActionButtons · RecommendedComics
│   ├── download/            DownloadItem · ChapterSelector · StoragePermissionGate
│   ├── general/             NavBar · Carousel · LazyLoader · Queue · Setting.js
│   ├── index/ latest/       首页与卡片
│   ├── setting/             SettingView 子组件：AboutView · LocalDataSettings · ReaderSettings · DisclaimerOverlay
│   └── user/                用户中心组件
├── composables/             useUser · useLocalUser · useDisclaimer · useStoragePermission · useBackButton
├── router/index.js
├── styles/                  basic · theme · index · latest · search · categories
│                            chapter · user · setting · download · offline
├── utils/
│   ├── offlineDB.js         SQLite：专辑 / 章节 / 图片 / 下载任务
│   ├── offlineStorage.js    文件系统封装与路径规则
│   ├── downloadManager.js   下载队列
│   ├── zipHelper.js         Web 端 ZIP 打包
│   ├── localDB.js           IndexedDB：账号 / 收藏 / 历史
│   ├── dataExport.js        收藏与历史导入导出
│   └── logger.js            日志
├── views/                   页面（含 OfflineView / OfflineChapterView）
├── App.vue
└── main.js
```

### 快速定位

| 需求 | 文件 |
|---|---|
| API 域名 / 重试 | `src/api/JmcomicApi.js`、`src/api/UserApi.js` |
| 加解密 | `src/api/Crypto.js` |
| 图片切片解密 | `src/components/chapter/ImageCutter.js` |
| 阅读图片加载 / 并发 | `src/components/chapter/ComicImageLoader.js` |
| 下载队列 / 断点续传 | `src/utils/downloadManager.js` |
| 文件路径 / 目录规则 | `src/utils/offlineStorage.js` |
| 离线元数据 | `src/utils/offlineDB.js` |
| 本地账号 / 收藏 / 历史 | `src/utils/localDB.js` |
| 日志 | `src/utils/logger.js` |
| 设置项 | `src/components/general/Setting.js` |
| 原生插件 | `android/app/src/main/java/com/liweimin/jmviewer/`、`ios/App/App/SceneDelegate.swift` |

---

## 4. 加解密与鉴权

### 4.1 响应解密

[Crypto.js](../src/api/Crypto.js)：

- `predefinedKeyTemplates = ["185Hcomic3PAPP7R", "18comicAPPContent"]`，`dynamicKey = MD5(key + template)`。
- `decryptData(key, data)` 支持四种输入：
  1. `data` 已是对象 → 原样返回；
  2. `{` / `[` 开头的 JSON 字符串 → 直接解析；
  3. base64 密文 → 逐个模板尝试 AES-ECB 解密并解析；
  4. 全部失败且内容不像密文（非合法 base64 或长度非 16 倍数，如 `"通知已讀"`）→ 原样返回。
- 真正像密文却解不开时抛 `Decryption failed`，不静默吞错。
- `decryptCurrentApi(text)` 固定 `MD5("diosfjckwpqpdfjkvnqQjsik")`，用于服务器列表文件。

### 4.2 请求鉴权

- `key` = 秒级时间戳；`token` = `MD5(key + "185Hcomic3PAPP7R")`；`tokenParam` = `${key},3.2.0`。
- 用户接口可按需附加 `Authorization: Bearer <jwttoken>`（登录后写 localStorage）。
- 服务器列表：`https://rup4a04-c02.tos-cn-hongkong.bytepluses.com/newsvr-2025.txt` → `decryptCurrentApi(text).Server`。

### 4.3 业务成功判定

`UserApi` 在解密结果为字符串时按 `code` 判定：`code >= 400` 抛业务错误（不重试），否则视为成功。这样 `{"code":200,"data":"通知已讀"}` 不会被当成失败。

---

## 5. 图片解密

[ImageCutter.js](../src/components/chapter/ImageCutter.js) `cutImage(image, id, path)`：

1. Canvas 白色底（避免透明图变黑）。
2. 切片数 `#getCuttingCount(id, path.substring(0, 5))`：
   - `220980 <= id < 268850` → 固定 10；
   - 否则 `key = MD5(id + path前5位)` 末位字符的 charCode；
     - `268850 <= id <= 421925` → `key % 10`；
     - 其它 → `key % 8`；
     - 层数 `key * 2 + 2`，限制在 `[2, 50]`。
3. 切片高度 `floor(height / sliceCount)`，余数归底部片。
4. 还原：最底部一片移到顶部，其余自下而上拼接。

**必须传 chapterId，不能传 albumId**，否则切片数算错导致乱码。是否需要解密：`id >= 220980 && 文件名不以 .gif 结尾`。

---

## 6. 阅读管线

### 6.1 在线

[ChapterView.vue](../src/views/ChapterView.vue) 固定 `Promise.all([getComicAlbum, getComicChapter])`，写阅读历史后渲染：

- [ComicContent.vue](../src/components/chapter/ComicContent.vue)：每批 15 张、间隔 80ms 依次 `loader.addImgCr`，`props.chapter.id` 变化时重建。
- [ComicImageLoader.js](../src/components/chapter/ComicImageLoader.js)：图片加载 observer（`rootMargin: 300px`）+ 进度 observer（`threshold: 0.01`）；`Queue` 控制并发。
- 单图加载按设置项 `img_load_mode`：
  - `direct`（默认）：`new Image()` + `crossOrigin='anonymous'` → 解密 → `canvas.toDataURL('image/png')`；
  - `blob`：`fetch` → Blob → objectURL → 解密 → `canvas.toBlob` → objectURL。
  - 失败均降级显示原图。切换后重新进入章节生效。
- `destroy()` 断开两个 observer、清空队列并 `revokeObjectURL`。

### 6.2 离线

[OfflineChapterView.vue](../src/views/OfflineChapterView.vue)，路由 `/offline/chapter/:id`：

- 只读 `offlineDB.getOfflineChapter`，**无在线回退**；缺失时提示并返回离线库。
- 图片由 `ComicImageLoader` 走 `getUri` + `convertFileSrc` 直读本地已解密文件，不二次解密。
- 不渲染评论 / 评分 / 推荐；不写阅读历史。
- 进入时给 `.root` 追加 `page-chapter` 类（离开移除），以复用在线页整套布局与字号。

---

## 7. 下载系统

[downloadManager.js](../src/utils/downloadManager.js)，单例。常量：并发 2、重试 3 次、重试间隔 2s、通知节流 200ms、落盘节流 2s。

状态：`pending / downloading / packaging / completed / failed / paused / cancelled`；暂停与取消以异常 `__PAUSE__` / `__CANCEL__` 传递。

流程：

1. `init()`：初始化目录 → 清 Tmp → 载入任务（SQLite 优先，失败回退 `download-tasks.json`）→ 修正中断任务 → 调度 → 后台补存历史封面。
2. `addTask(album, chapters)`：同专辑已有进行中任务则拒绝；写 `albums` 记录并保存封面。
3. `_runTask()`：按章节串行，先请求 chapter 接口拿 `images`，再逐图下载，每章完成后写 `chapters` + `images`。
4. `_downloadChapter()`：目标文件存在且 > 100 字节则跳过（断点续传）；`fetch` → 必要时解密 → 写盘。
5. 完成：原生端不打包，统计目录大小，`outputPath = Comics/{albumId}`；Web 端走 `zipHelper` 打包。
6. 删除 / 清空已完成：同时删除图片目录、SQLite 记录与任务。

封面：`_saveCover` 优先使用 `imgServers[0]`（唯一下发 `Access-Control-Allow-Origin: *` 的域名），失败回退 `id % 5` 对应域名；写入 `Comics/{albumId}/cover.jpg`。

---

## 8. 存储架构

四层互不越界：

| 层 | 用途 | 实现 |
|---|---|---|
| SQLite `jmviewer_offline` | 离线漫画元数据、图片清单、下载任务 | `offlineDB.js`（仅原生，Web 返回空） |
| 文件系统 | 漫画图片、封面、日志、临时文件 | `offlineStorage.js` |
| IndexedDB `JmViewerLocalDB` | 本地账号、收藏、历史 | `localDB.js` |
| localStorage | 设置、登录态、免责声明标记 | 各业务模块 |

### 8.1 SQLite 表结构

```sql
albums(id TEXT PK, name, author, payload JSON, updated_at)
chapters(id TEXT PK, album_id, idx, name, image_count, bytes, payload JSON, downloaded_at)
images(chapter_id, idx, source, file, bytes, PRIMARY KEY(chapter_id, idx))
download_tasks(id TEXT PK, payload JSON, position, updated_at)
```

- `albums.id` = 下载时打开的专辑 id，`payload` 存完整 album JSON（含 series）。
- `chapters.id` = 章节 id，`images.source` 为接口原文件名，`file` 为落盘文件名（解密后扩展名可能变 `.png`）。
- 连接单例、懒加载；初始化失败会置 `failed` 并永久降级，不阻塞业务。

### 8.2 文件布局

Android（`Directory.ExternalStorage`，公共目录）：

```
/storage/emulated/0/JmViewer/
├── Tmp/logs/app.log
├── Tmp/ComicImages/...            # 原图临时文件，启动清空
├── Comics/{albumId}/cover.jpg
├── Comics/{albumId}/chapters/{chapterId}/*.jpg|png
└── download-tasks.json            # SQLite 不可用时的回退
```

iOS（`Directory.Documents`，文件 App 可见）：同结构，无 `JmViewer/` 前缀。原图临时文件在 Android 走 `ExternalCache`。

### 8.3 IndexedDB

- 库 `JmViewerLocalDB`，`DB_VERSION = 1`，表 `users / favorites / history`。
- 历史固定 `common`，**跨账号共享**；收藏 key `${userId}__${comicId}`，历史 key `common__${seriesKey}`。
- `_withDB` 捕获 `InvalidStateError / TransactionInactiveError / DatabaseClosedError` 后重连一次；`onclose` / `onversionchange` 主动丢弃连接缓存。

---

## 9. 账号体系

- 云端 [useUser.js](../src/composables/useUser.js)：`userInfo` / `notificationUnread` 模块级单例，登录态存 `jwttoken` + `userInfo`。
- 本地 [useLocalUser.js](../src/composables/useLocalUser.js)：首次访问触发 `localDB.init()` + `getLocalUser()`。
- 当前用户 ID 规则：云端 `uid` → `cloud_{username}` → 本地 `currentUser.id`。

---

## 10. 设置与主题

[Setting.js](../src/components/general/Setting.js) 单例，键值均存 localStorage：

| 键 | 取值 |
|---|---|
| `using_imgserver_index` | `"0"` ~ `"5"`（图片 CDN 索引） |
| `app_theme` | 7 套主题之一（pink/blue/green/purple/gray/dark/orange），写入 `<html>` 的 `{theme}-theme` 类 |
| `img_load_mode` | `direct` / `blob` |
| `root_margin` | 图片懒加载 `IntersectionObserver` 的 `rootMargin`，默认 `200px` |
| `reader_image_width` | 全屏阅读图片宽度百分比，`50` ~ `100`，默认 `100` |
| `reader_is_horizontal` | `off` / `on`，全屏阅读是否横向整屏翻页 |
| `auto_fullscreen_reader` | `off` / `on`，点击「开始阅读」后是否直接进入全屏阅读 |

`init()` 读取时校验合法值，非法则回写默认值；`setOption()` 校验后写库。新增设置项需同时补齐默认值与 UI。

阅读相关的 4 项在独立页面 [ReaderSettings.vue](../src/components/setting/ReaderSettings.vue)（路由 `setting-reader`），设置首页只保留入口。

主题变量定义在 [theme.css](../src/styles/theme.css)：`:root` 为默认粉色，其余主题以 `.{theme}-theme` 覆盖同名 CSS 变量。

---

## 11. 日志

[logger.js](../src/utils/logger.js)：模块加载即接管 `console.*` 并监听 `window.error` / `unhandledrejection`；内存上限 500 条、文件上限 2MB（超限重写并加说明头）、写入去抖 3s（error 立即落盘）；仅原生落盘，导出走 Filesystem + Share（Web 走 Blob 下载）。文件：`Tmp/logs/app.log`。

---

## 12. 原生能力

- **返回键**（仅 Android）[useBackButton.js](../src/composables/useBackButton.js)：抽屉优先 → `router.back()` → 根页面双击退出（2s 内）→ 其它回首页。
- **存储权限与打开文件夹**：`StoragePermissionPlugin.java`，前端 `registerPlugin('StoragePermission')` 调 `openFolder`；`MainActivity` 中插件注册**必须早于** `super.onCreate`。
- **iOS 文件 App**：`UIFileSharingEnabled` + `LSSupportsOpeningDocumentsInPlace`，`shareddocuments://` 跳转。
- **iOS 退出应用**：[SceneDelegate.swift](../ios/App/App/SceneDelegate.swift) 中 `StoragePermissionPlugin.exitApp` 调用 `exit(0)`，用于免责声明「拒绝」。该项目不发布 App Store，因此不受审核限制。
- 平台差异统一用 `Capacitor.getPlatform() / isNativePlatform()` 判断，Android 专属功能不在 iOS / Web 展示。

---

## 13. 兼容性约束

1. **Android 9（WebView / Chrome ≈70）**：
   - 禁用 `inset: 0` 简写，改为 `top / right / bottom / left`；
   - 禁用 flex `gap`（Chrome 84+），用 `margin` 替代；
   - 避免 `:has()`、容器查询等新特性；
   - `main.js` 首行 `core-js` polyfill 不可删除。
2. **图片解密必须传 chapterId**。
3. **路径规则集中在 `offlineStorage`**，不要在业务模块手拼路径。
4. **历史 / 收藏 key 格式固定**，改动会破坏已有数据。
5. **原生端不打包 ZIP**（直接存图片规避 OOM），Web 才用 JSZip。
6. 新增网络接口优先复用 `UserApi` 的超时 / 错误分类 / 换域名重试模式。
7. 文件写入大对象时避免 `toDataURL` 中转；需要时优先 Blob / `toBlob`。

---

## 14. 发布流程

工作流位于 `.github/workflows/`：`build-web.yml`、`build-android.yml`、`build-ios.yml`、`release.yml`。

发布正式版 / Beta：

```bash
# 同步版本号：android/app/build.gradle（versionCode + versionName）
#              ios/App/App.xcodeproj/project.pbxproj（CURRENT_PROJECT_VERSION + MARKETING_VERSION）
#              package.json（version）
git tag v1.0.2          # tag 含 beta → 自动标记 prerelease
git push origin v1.0.2
```

`release.yml` 会构建 Android Release APK、iOS 未签名 IPA、Web zip，并在发布前删除同名旧 Release 再重建。

Android 签名 secrets：`ANDROID_KEYSTORE_BASE64`、`ANDROID_KEYSTORE_PASSWORD`、`ANDROID_KEY_ALIAS`、`ANDROID_KEY_PASSWORD`。

> 同一版本重发需 `git tag -f` + `git push origin <tag> --force`；会重写标签历史，仅在确有必要时使用。

---

## 15. 已知问题

| 问题 | 说明 |
|---|---|
| `jmApi.init()` 被调用两次 | 构造函数内一次（未 await）+ `main.js` 一次，启动重复请求服务器列表 |
| `retryFetch` 不校验 `resp.ok` | HTTP 500/404 被当作成功，随后解析失败且不换域名 |
| 服务器索引 `servers[4 - i]` 硬编码 | 服务器不足 5 个时可能拼出 `undefined` 域名 |
| `needsDecrypt` / `getDecodedName` 重复实现 | `downloadManager` 与 `zipHelper` 各有一份，建议抽公共模块 |
| `localDB.init()` 含破坏性迁移 | `cleanedV2` 标记存在时会清空 users/favorites/history，改动需保留语义 |
| 离线功能仅原生可用 | Web 端 SQLite 不可用，离线库显示「仅客户端可用」 |
| 离线阅读不写历史 | 离线页刻意不记录阅读历史 |

---

## 16. 常见问题

- **提交时出现「modified 但 diff 为空」**：多为 CRLF / LF 差异，可加 `.gitattributes` 统一 `* text=auto eol=lf`。
- **构建/同步后功能没生效**：先 `npm run build` 再 `npx cap sync <platform>`，原生改动需重新安装。
- **日志文件异常增大**：排查是否有循环写入（写日志失败又触发新日志）或打印了完整接口响应。
- **图片显示乱码**：确认调用解密时传的是章节 ID，且 `.gif` 未参与解密。
