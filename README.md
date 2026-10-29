# DK NOTE

日志型的本地 Markdown 笔记应用。左侧日历选日期，右侧直接写，一天一篇，笔记存成干净的 Markdown 文本。

纯静态单页，没有后端、没有账号、运行时零网络请求——编辑器依赖全部内联在这一个 HTML 里，双击就能打开，数据留在浏览器。

![主界面](assets/screenshots/01-main.png)

在线试用：<https://dreamke.github.io/DK-NOTE/>

## 为什么是「日志型」

多数笔记工具先有「笔记」，再按时间排序。DK NOTE 反过来：**日期是唯一的组织单位**。

- 点日历上的任意一天就开始写，不需要新建、起标题、选文件夹
- 日志标题就是日期，不可改名——省掉归档时最耗神的那个动作
- 有内容的日子在日历上标一个小圆点，一眼看出哪几天断更
- 侧栏按日期倒序列出全部日志，收藏的可以单独筛出来

![双栏：同时编辑连续两天](assets/screenshots/05-split.png)

## 功能

### 写作

| 能力 | 说明 |
| --- | --- |
| 即时渲染 | 基于 Vditor 的 IR 模式，Markdown 与排版同屏，光标移开标记自动收合 |
| 常用格式 | 标题、加粗、斜体、删除线、引用、有序/无序/任务列表、代码块、分割线、链接、公式 |
| 字色与高亮 | 6 档字色 + 6 档高亮，格式与旧版一致，反解成标准内联 HTML，不污染正文 |
| 图片 | 粘贴或拖入即插入，自动压缩到 1600px 以内并转 WebP；`.md` 里存 data URI，编辑器内部换 blob 短链保证输入不卡 |
| 双链 | 输入 `[[` 或点工具栏插入，按标题跳转；指向不存在的笔记时提示新建 |
| 双栏 | 左右各开一天，同时编辑连续两天（`Ctrl+Shift+D`） |

### 表格

![表格](assets/screenshots/02-table.png)

- 自绘工具条：上/下加行、删行、左/右加列、删列、左中右对齐、删除整表
- 拖列边界改列宽、拖行边界改行高，双击复位
- 整表宽度拖右下角手柄调整，双击回到默认（正文宽度的一半）
- 窄窗格里单元格自动换行，不会出现横向滚动条

### 查找与整理

![搜索](assets/screenshots/03-search.png)

- 全文搜索正文，空格分词、多个关键词同时命中才出现结果；结果挂在搜索框下方，`↑↓` 选择、`↵` 打开、`Esc` 关闭
- 收藏星标：标题下方的 ☆，收藏后在侧栏「收藏」页单独查看
- 标签：正文写 `#标签` 自动识别，也可以点「＋ 添加标签」；侧栏「标签」页列出标签池与篇数

### 外观

![暗色](assets/screenshots/04-dark.png)

明暗两套主题，深灰侧栏配白色编辑区，日历带 ISO 周数、周一为一周起始。

## 数据放在哪

| 方式 | 说明 |
| --- | --- |
| 浏览器存储 | 默认写 IndexedDB，不可用时退回 localStorage，再退回内存（会提示） |
| 导入 / 导出 | 设置里可以整库打包成 zip，也可以导入零散的 `.md` |

没有埋点、没有远端接口，正文不会离开这台机器。

## 本地运行

**双击 `index.html` 就能用**，不需要服务、不需要网络。编辑器内核（Vditor、lute、highlight.js、图标、语言包）全部内联在这一个 5.3 MB 的 HTML 里，运行时零请求，所以 `file://` 下也没有跨域问题——实测 1.5 秒进入可编辑状态，数据照样写 IndexedDB。

想要固定地址、方便多标签打开，也可以起个本地服务：

```bash
git clone https://github.com/dreamke/DK-NOTE.git
cd DK-NOTE
node dev-server.js        # http://127.0.0.1:8787/
```

`dev-server.js` 只是个静态文件服务，任何 HTTP 服务器都行（`python -m http.server` 也可以）。

线上版本首次打开要把这 5.3 MB 下载完（gzip 约 1.1 MB），国内直连 GitHub Pages 实测 20–60 秒，取决于带宽。页面带了一个 Service Worker，首次访问在后台缓存整页，之后打开约 0.2 秒，断网也能继续写。**嫌慢就别开线上版，把 `index.html` 存到本地双击**——本机读 5 MB 文件不到一毫秒。

## 改代码

`index.html` 是构建产物，不要直接改。源码在 `src.html`，改完重新打包：

```bash
node build.js      # src.html + vditor/dist → index.html
```

`build.js` 做三件事：把 `vditor/dist` 下的 CSS/JS 内联进页面；给每个资源补上 Vditor 认的 id（`vditorLuteScript`、`vditorHljsScript`…，Vditor 的加载函数先查 id，命中就跳过，于是不发请求）；把 4 套内容主题与 2 套代码主题的样式转成 `<style>`，避免切换主题时退回 `<link>`。

## 技术实现

单页应用，无框架、无构建链、无后端。界面与逻辑写在 `src.html` 里，编辑器依赖由 `build.js` 内联成单个 `index.html`。

| 部分 | 做法 |
| --- | --- |
| 编辑器 | Vditor 固定 IR 模式；双栏时右栏克隆左栏 DOM（`id` 统一加 `-b`），改一处两栏同步 |
| 打包 | 把 Vditor、lute、highlight.js、图标、语言包内联进 HTML，并预置 Vditor 认的资源 id，让它以为已经加载过，从而零请求、零 XHR |
| Markdown | 读写走 `mdForEditor` / `mdForStore` 两个兑换口，只在边界上处理图片载荷 |
| 双链 | 存的就是 `[[标题]]` 纯文本，渲染时后置包一层 chip，`textContent` 一个字都不改——否则反解 Markdown 会丢括号 |
| 字色 / 高亮 | Lute 把内联 HTML 收进 `span[data-type="html-inline"]`，再在标记之间套纯样式元素上色，两层分离 |
| 表格尺寸 | Markdown 表达不了列宽行高，尺寸存在浏览器本地的 `tblsize:<笔记名>`，`.md` 一个字节都不动 |
| 存储 | IndexedDB → localStorage → 内存 三级降级，接口统一为 `Store` |

## 已知限制

- **表格尺寸不跟着文件走**：列宽、行高、整表宽度只存在本机，换设备或清缓存会回到默认。这是为了保持 `.md` 是干净的标准表格，能被任何 Markdown 工具读取。
- **数据不跨设备**：没有账号体系，浏览器之间不共享。换机器或换浏览器，用导出 zip 再导入。
- **只适合日志**：没有笔记本、层级目录、多标签页；也不支持修改日志文件名。

## 目录结构

```
DK-NOTE/
├── index.html              构建产物：单文件应用，双击即用（5.3 MB）
├── src.html                源码：改这里，然后跑 build.js
├── build.js                打包脚本：把编辑器依赖内联进 index.html
├── sw.js                   离线缓存（线上版本用）
├── dev-server.js           本地预览用的静态服务
├── assets/                 图标与截图
└── vditor/dist/            编辑器依赖的原始文件（构建输入，运行时不再请求）
```

## 许可

MIT。编辑器内核 [Vditor](https://github.com/Vanessa219/vditor) 同样以 MIT 发布，其许可证见 `vditor/LICENSE`。
