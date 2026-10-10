# Jmcomic-webUI 项目知识库（AI 参考文档）

> 本文档面向 AI 助手与开发者，记录项目架构、核心模块、关键算法与易错点。修改代码前请先阅读本文。

---

## 1. 项目概述

Jmcomic-webUI（jmViewer）是一个**纯静态**漫画浏览前端：多页应用（MPA），原生 ES Module + 原生 DOM 操作，**无框架、无构建、无 npm 依赖**。数据全部来自线上"禁漫天堂"加密 API，本地没有后端。克隆后用任意 HTTP 静态服务器打开 `index.html` 即可（**不能用 `file://`**，ES Module 与 fetch 会被 CORS 拒绝）。

- 仓库：https://github.com/zrhcdy/Jmcomic-webUI
- 本项目是 JmViewer（Vue 3 + Capacitor 版）的**前身/原型**，JmViewer 即由它重构而来
- 浏览器要求：支持 `IntersectionObserver`、`createImageBitmap`、可选链等

## 2. 页面与路由（HTML 即路由）

| 页面 | 入口脚本 | URL 参数 |
| --- | --- | --- |
| index.html | src/pages/index.js | — |
| latest.html | src/pages/latest.js | — |
| categories.html | src/pages/categories.js | — |
| search.html | src/pages/search.js | `?sq=关键词`（>10 位纯整数先当作品 ID 置顶） |
| chapter.html | src/pages/chapter.js | `?id=作品id` |
| favorite.html | src/pages/favorite.js | — |
| history.html | src/pages/history.js | — |
| setting.html | src/pages/setting.js | — |
| download.html | src/pages/download.js | `?id=作品id&mode=longimg\|zipper`（非法值直接报错） |

页面间跳转全部相对路径。每个 HTML 的 `<body>` 第一个子元素是一段**同步内联脚本**读取 `app_theme` 挂主题类（防闪烁；module 脚本是 defer 做不到）；index.html 还有一段同步脚本按 `lite_mode` 隐藏 banner/tag。

## 3. 目录结构

```
├── *.html                    9 个页面
├── image/                    静态图标（封面占位、hot、looking）
├── style/                    basic.css（全局+6 套主题共 49 个 CSS 变量/主题）+ 每页一个 CSS
└── src/
    ├── api/                  JmcomicApi.js（唯一出口 jmApi）、Crypto.js
    ├── utils/                crypto.js（CryptoJS）、jszip.min.js（3.10.1 UMD，挂 window.JSZip）
    ├── dom/                  LazyLoader.js（封面懒加载单例）
    ├── pages/                每个 HTML 一个入口 class（XxxPage.init()）
    └── components/
        ├── general/          Setting、NavManager、Queue、ImageCutter、SwitchServerBtnManager、
        │                     InfinityScrollContainer、Carousel、ServerSpeedTester
        ├── index/            BannerManager、BannerCarousel、SectionCarousel、TagContainerManager、RecommendationsManager
        ├── chapter/          HeadManager、SeriesManager、ComicImageManager、ComicImageLoader、
        │                     ComicReadingProgress、ComicMobileProgress、CommentManager、Evaluation、
        │                     RecommendedComicsManager、DownloadBtnManager
        ├── download/         ComicImageFetcher、LongImageMaker、ZipPacker
        └── latest/ categories/ search/ favorite/ history/  各自 ContainerManager
```

模式：每个页面 class 在 `init()` 里 `setting.init()` → `await jmApi.init()` → 逐个 new 组件 Manager 并 `init()`。组件直接操作 DOM，无虚拟 DOM。

## 4. API 层（src/api/）

### 4.1 认证与初始化

- `currentKey = Math.floor(Date.now()/1000)`；`token = MD5(key + "185Hcomic3PAPP7R")`；`tokenParam = "{key},3.2.0"`
- 服务器列表：拉取固定地址 `newsvr-2025.txt`（bytepluses CDN），`decryptCurrentApi()`（固定密钥 = MD5("diosfjckwpqpdfjkvnqQjsik")，AES-ECB）解密得 `Server[]`
- `jmApi` 构造函数里就调 `init()`；页面入口再 `await jmApi.init()` 一次（会重复请求，注意）

### 4.2 数据解密（Crypto.js）

响应 `data` 字段为 AES-ECB 密文，密钥 = `MD5(currentKey + template)`，模板依次尝试 `["185Hcomic3PAPP7R", "18comicAPPContent"]`。⚠️ `currentKey` 页面加载时固定，长时间挂着会导致解密失败（需刷新）。

### 4.3 重试策略（与 JmViewer 的差异点）

`retryFetch(getUrl, init, count)`：

- getUrl 为函数（多服务器）且 `count>1` 且 `setting.concurrent_request === "on"` → **并发模式** `#concurrentFetch`：同时向所有候选服务器发请求（各配 AbortController），`Promise.any` 取第一个成功，其余立即 abort；全部失败抛第一条错误
- 否则顺序递归重试（失败换下一个域名）
- 业务接口拼 URL 用 `servers[4 - (i%4)]`（4 个域名循环，5 次尝试）
- 固定 URL（如图片下载）重试不换地址，并发无意义

### 4.4 图片 URL

- `imgServers[]` 6 条线路；封面 `getCoverImageURL(id, retryCount)` 用 `(id+retryCount) % 5` 分散负载；章节图片 `getChapterImageURL` 走 `setting.using_imgserver_index`；`getChapterImageURLByServer` 供测速用
- 推广位 `getPromotionContent` 带 localStorage 按日缓存（key `promoteCache`）

## 5. 图片解扰算法（general/ImageCutter.js）

站点把章节图**横向切片重排**，并用 CSS `.comic-img img { filter: brightness(0) }` 涂黑防抓。还原：

1. 切片数：`id ∈ [220980, 268850)` → 10；否则 `MD5(id + path前5字符)` 末位 charCode 取模（`id ≤ 421925` 模 10，否则模 8），层数 `key*2+2`
2. Canvas 重绘：最后一片（底部）搬到顶部，其余"从下往上"依次拼接
3. **是否需解密**：`chapterId >= 220980 && !path.endsWith('.gif')`（download 侧 `isScrambled()` 同规则）

> ★ 传参一律用 **chapterId**，不是 albumId；切片层数由 `MD5(id+path)` 决定，传错必乱码。

## 6. 章节阅读页（chapter.html）

- `ComicImageManager` 按 `chapter.images` 建占位容器（含骨架元素），`ComicImageLoader` 双 Observer：
  - `IntersectionObserver`（rootMargin = `setting.root_margin`，**创建后不可改，改设置要重进页面**）触发加载并驱动进度
  - `ResizeObserver` 监听图片实际高度，撑开容器（带 transition 结束后清理）
- 加载完成回调里：删占位 → 需解密则 `cutImage` 替换为 canvas，否则 `filter: none`；`Queue` 限并发，`getMaxQueueLength()` 按时段：>21 点 3、>18 点 6、否则 10（**注意：与 JmViewer 不同，无移动端判断**）
- 历史写入（pages/chapter.js）：`getComicAlbum` 成功后 `history.unshift({id, addTime, name, author})`，去重（+号比较），**上限 666 条**（超出 pop）
- HeadManager：封面/标题/作者/标签/简介 + 收藏按钮（toggle `favorite` 数组，结构同 history）+ Evaluation（点赞/浏览量）
- 收藏与历史**都只存 localStorage，无账号系统**（与 JmViewer 的 IndexedDB 双账号模型完全不同）

## 7. 下载系统（download.html + components/download/）

入口：章节页 DownloadBtnManager 跳转 `download.html?id=&mode=`，只依赖地址栏 id、不等接口。

### 7.1 流程（pages/download.js）

- 章节列表来自 `album.series`；无 series 则单章（就是地址里的 id）；默认全选
- `longimg`：每章先全部下载并 `readImageSize` 量尺寸（createImageBitmap 后即 close）→ `layoutLongImage` 分段 → `LongImageRenderer` 逐段拼图导出 JPEG（质量 0.95），文件名 `作品名_章节N[_k].jpg`
- `zipper`：`ZipPacker` 收集（打乱的图 canvas 还原后 `addCanvas` 编码 JPEG 0.92；原图正常的 `addBlob` 直接存，保住 gif），条目 `章节N/001.ext`，生成整包
- 容错：单章失败记日志跳过；**连续 3 章失败**视为全局问题（线路挂/CORS 被拦）中止
- 进度：长图模式下载占 70%、拼接 30%；zip 模式收集占 85%、压缩 15%
- 保存：`<a download>` + blob URL，**60 秒后才 revoke**（防下载中断）；连续保存间隔 500ms 防浏览器拦截自动下载

### 7.2 关键算法

- `layoutLongImage(sizes, width)`：canvas 上限 `MAX_CANVAS_DIMENSION=32767`、面积 `16384²`（取最保守档防空白）；按宽度缩放统一、超高自动切段，单图比一张长图还高也能跨段
- `LongImageRenderer.render`：白底（JPEG 不支持透明）、按需解码（一张图在同段内连续出现，任何时刻内存只有一张原图+一张长图）、导出后 `canvas.width=0` 释放
- `ZipPacker`：图片条目 **STORE**（已压缩格式再 deflate 白费 CPU/内存），其它 DEFLATE level 6 + `streamFiles: true`；JSZip 来自 `window.JSZip`（download.html 普通 script 引入，带 unpkg CDN `document.write` 兜底）

### 7.3 CORS 约束（整个下载功能最大不确定因素）

图片必须先 `fetch` 成 blob 再 objectURL 喂 `<img>`/canvas（`ComicImageFetcher.decode`），否则 canvas 被 taint 导出抛 SecurityError。要求 CDN 回 CORS 头；某条线路不回就换图源。

## 8. 设置与主题（general/Setting.js）

单例 `setting`，**白名单校验**：只有 `#settingValues` 里列出的键值可读写，非法值读时回写默认。

| 键（=localStorage key） | 可选值 | 默认 | 说明 |
| --- | --- | --- | --- |
| `using_imgserver_index` | "0"~"5" | "0" | 图片服务器线路 |
| `app_theme` | pink/blue/green/purple/gray/dark | pink | 主题 |
| `root_margin` | 0px/50px/100px/200px/500px | 50px | 章节图懒加载提前量 |
| `concurrent_request` | off/on | off | API 并发竞速请求 |
| `lite_mode` | off/on | off | 首页精简（隐藏 banner/tag） |

设置页（pages/setting.js）完全 **data-key/data-value 驱动**：HTML 里 `.option-list[data-key]` + `.option-item[data-value]`，增删设置项只改 setting.html + Setting.js 白名单/getter。getter 名必须与 data-key 一致，否则 console.warn 且不生效。`setOption` 拒绝非法值后 UI 读回真实值保持一致。

主题：所有颜色走 CSS 变量（basic.css，每主题 49 个变量）；`:root` 与 `.pink-theme` 并列兜底；切换只改 `document.documentElement` 类名；body 首段同步脚本防闪烁，刻意不校验（非法值只是无害类名）。

## 9. 图源测速与切换（ServerSpeedTester + SwitchServerBtnManager）

- 测速统一请求同一张测试图（章节 1479091 的 `00001.webp`），**用 `<img>` 而非 fetch**（图床可能不回 CORS，fetch 测的是"能不能跨域"不是"快不快"）；URL 加 `_t=时间戳_索引` 防缓存；8s 超时（换 src 为空图顶掉请求）；`performance.now()` 计时到 onload（加载+解码）
- setting.html 内嵌测速面板：六台同时起跑，每台一回来就实时刷新条目；**第一个回来的最快结果自动切换线路**（`useServer` 写 setting + 同步导航按钮，刻意不刷新页面保留测速结果）；点条目手动切换（failed 项不可点）
- 导航上「图源 N」按钮：SwitchServerBtnManager 点击循环线路，写 `using_imgserver_index` 并刷新页面

## 10. 列表页通用模式

- `InfinityScrollContainer`：window scroll 触底（threshold）加载下一页，1s 冷却、页码上限（搜索每页 80 条）
- `LazyLoader`（dom/LazyLoader.js 单例）：封面 `data-src` + IntersectionObserver
- latest/categories/search/favorite/history 各自 `XxxContainerManager` 渲染 `.comics-cr` 网格，innerHTML 模板字符串拼 HTML（⚠️ name/author 直接插值，无转义）
- 首页：BannerCarousel（热门轮播）+ TagContainerManager（标签快捷）+ RecommendationsManager（推广推荐，用 promoteCache）；lite_mode=on 时跳过 banner/tag

## 11. localStorage 键总表

| 键 | 内容 |
| --- | --- |
| `favorite` | `[{id, addTime, name, author}]`，新在前 |
| `history` | 同上结构，上限 666 条 |
| `promoteCache` | `{date, data}` 按日缓存推广位 |
| `using_imgserver_index` / `app_theme` / `root_margin` / `concurrent_request` / `lite_mode` | 设置项（白名单校验） |

## 12. 已知约束与注意事项（改动前必读）

1. **必须走 HTTP 服务**，`file://` 下 ES Module 与 fetch 全挂
2. **解密/判定一律用 chapterId**（§5）
3. `root_margin` 只在创建 IntersectionObserver 时读取，改后需重进章节页
4. `jmApi` 构造即 init，页面入口再 await init 造成服务器列表重复拉取
5. `currentKey` 页面生命周期内固定，久挂不刷新会解密失败
6. 主题防闪烁脚本是刻意的普通 `<script>`，不要合并进 module
7. JSZip 是仓库内文件（97630 字节，3.10.1），丢失用 README 中 curl 命令重下
8. 下载依赖 CDN 的 CORS 头，属外部不可控因素，报错要给用户明确日志
9. 列表 innerHTML 插值无转义，改渲染逻辑时留意 XSS
10. 与 JmViewer 的差异：无账号系统（纯 localStorage）、无 IndexedDB、无原生容器、Queue 并发不区分移动端、重试支持并发竞速模式

## 13. 快速定位表

| 需求 | 入口文件 |
| --- | --- |
| 改 API 域名/重试/并发竞速 | `src/api/JmcomicApi.js` |
| 改数据解密 | `src/api/Crypto.js` |
| 改图片解扰 | `src/components/general/ImageCutter.js` |
| 改阅读加载/进度 | `src/components/chapter/ComicImageLoader.js` + `ComicImageManager.js` |
| 改下载流程 | `src/pages/download.js` + `src/components/download/*` |
| 改设置项/主题 | `src/components/general/Setting.js` + `setting.html` + `style/basic.css` |
| 改测速/图源 | `src/components/general/ServerSpeedTester.js` + `SwitchServerBtnManager.js` + `src/pages/setting.js` |
| 改收藏/历史 | `src/components/{favorite,history}/` + `src/components/chapter/HeadManager.js` |
