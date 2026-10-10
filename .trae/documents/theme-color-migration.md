# JmViewer 移植 Jmcomic-webUI「主题配色」设置功能

## Context

Jmcomic-webUI（原型项目）有一套成熟的 6 主题配色系统：49 个 `--theme-*` CSS 变量 × 6 套主题（pink/blue/green/purple/gray/dark），定义在 `Jmcomic-webUI/style/basic.css`，通过 `<html>` 上的主题类切换，localStorage key 为 `app_theme`，body 首段同步脚本防闪烁。

JmViewer（Vue 版）目前所有颜色**硬编码**：`src/styles/*.css` 约 432 处、`.vue` 组件 style 块 31 处、`.js` 内联字符串 5 处——且这些色值基本就是 webUI 粉色主题的取值，可逐值映射到 `--theme-*` 变量。

目标：给 JmViewer 设置页添加「主题配色」功能，6 套主题全量移植，所有颜色改走 CSS 变量。

## 实施步骤

### 1. 新建 `src/styles/themes.css`（主题变量定义）

- 从 `Jmcomic-webUI/style/basic.css` 完整复制 6 个主题类（`.pink-theme` … `.dark-theme`）的 49 个 `--theme-*` 变量块
- 追加 `:root` 兜底块 = pink 值（与 `.pink-theme` 并列，防类名缺失时变量为空）

### 2. 颜色值 → 变量替换（机械性主体工作）

- 建立映射表：以 webUI pink 主题的 49 个变量值为基准做**精确色值匹配**（不区分大小写），如 `#f8bbd0→--theme-primary-light`、`#ff6183→--theme-accent`、`#aa4d4d→--theme-logo`、`#794252→--theme-shadow-strong`、`rgb(228,77,147)→--theme-loading` 等
- 用一次性 Node 脚本对 `src/styles/*.css` 执行替换（脚本放项目外/临时目录，跑完删除），随后人工抽查修正：
  - 功能性纯黑/纯白（`#fff`、`#000`、`border: 1px solid #fff` 等）保留字面值，不强行变量化
  - 脚本无法覆盖的写法（渐变 stop、box-shadow 多段）逐个检查
- `src/components/**/*.vue` 的 `<style>` 块（9 个文件 31 处）与 `.js` 内联色（5 处：`useBackButton.js` toast、`ComicImageLoader.js` 错误占位、`ImageCutter.js` 白底）同样替换为 `var(--theme-*)`；JS 拼 HTML 字符串里的颜色改用 CSS 变量（浏览器支持 inline style 用 var()）

### 3. 应用主题类（防闪烁 + 运行时切换）

- `index.html`：`<body>` 第一个子元素加同步 `<script>`，读 `localStorage.app_theme`，校验 6 个合法值后置 `documentElement.className = theme + '-theme'`，非法/缺省用 pink（刻意不写回，保持简单）
- `src/main.js`：`import './styles/themes.css'`（在 basic.css 之前）
- `src/App.vue`：`watchEffect` 同步 `setting.app_theme` → `documentElement.className`，保证应用内切换即时生效

### 4. Setting.js 白名单

- `src/components/general/Setting.js`：`#settingValues` 增加 `app_theme: ['pink','blue','green','purple','gray','dark']`（默认 pink），新增 getter `app_theme`

### 5. 设置页 UI

- `src/views/SettingView.vue`：新增「主题配色」option 行——6 个色块按钮（各自显示该主题主色圆点 + 名称），当前项高亮；点击 `setting.setOption('app_theme', v)`，主题经 §3 的 watch 立即生效
- `src/styles/setting.css`：补充色块按钮样式（颜色走变量）

## 关键文件

- 参考源：`Jmcomic-webUI/style/basic.css`（变量定义唯一来源）
- 修改：`src/styles/*.css`（9 个）、`src/styles/themes.css`（新建）、`index.html`、`src/main.js`、`src/App.vue`、`src/components/general/Setting.js`、`src/views/SettingView.vue`、9 个含色值的 `.vue`、3 个含色值的 `.js`

## 验证

1. `npm run build` 通过
2. `npm run dev`：设置页依次点 6 个主题，逐页检查首页/最新/搜索/分类/章节阅读/下载/用户/设置——无残留粉色硬块、无透明/黑色异常块（变量缺失的症状）
3. 深色主题下特别检查：加载动画、进度条、遮罩、图片占位、错误占位 div、退出 toast
4. 刷新页面验证主题持久化且无闪烁；改 localStorage 为非法值后刷新应回落 pink 且页面正常
