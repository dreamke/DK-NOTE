#!/usr/bin/env node
/* DK NOTE 打包脚本：src.html → index.html
 *
 * 为什么要有这一步
 * ----------------
 * 编辑器内核（Vditor + lute + highlight.js）合计约 5MB。放在旁边当外链文件时，
 * 浏览器每次打开都要从服务器下载；更麻烦的是 Vditor 用「同步 XHR」去取 lute 与
 * 图标精灵，file:// 下会被 CORS 直接拦掉——双击 HTML 就打不开编辑器。
 *
 * 这个脚本把它们全部内联进 index.html，并给每个资源预置 Vditor 认的 id
 * （vditorLuteScript / vditorHljsScript / vditorIconScript …）。Vditor 的加载函数
 * 第一句就是 document.getElementById(id)，命中即跳过，于是零网络请求、零 XHR。
 *
 * 用法：node build.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src.html');
const OUT = path.join(ROOT, 'index.html');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const F = {
  css: 'vditor/dist/index.css',
  vditor: 'vditor/dist/index.min.js',
  icons: 'vditor/dist/js/icons/ant.js',
  i18n: 'vditor/dist/js/i18n/zh_CN.js',
  lute: 'vditor/dist/js/lute/lute.min.js',
  hljs: 'vditor/dist/js/highlight.js/highlight.min.js',
  hljs3: 'vditor/dist/js/highlight.js/third-languages.js',
};

/* 内联进 <script> 的转义：
 *   </script  会让 HTML 解析器提前闭合标签（lute 里有 G.StrToBytes("</script>")）
 *   <!--      会让解析器进入 script-data-escaped 状态，后面的 </script> 失效
 * 两者都换成 JS 里等价的写法，语义不变。 */
const jsSafe = (s) => s.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '\\x3C!--');
const cssSafe = (s) => s.replace(/<\/style/gi, '<\\/style');

const script = (id, code) =>
  (id ? `<script id="${id}">` : '<script>') + '\n' + jsSafe(code) + '\n</script>';

/* ---------- 主题样式：Vditor 按 id 查找，href 必须与它算出来的 URL 一致 ----------
 * setContentTheme(theme, path) 内部：href !== path + '/' + theme + '.css' 就 remove 再建 <link>
 * 所以这里给 <style> 挂上 href 属性，并把 4 套主题的文本一起带进去，切换时由 JS 换文本。 */
const contentThemes = ['light', 'dark', 'ant-design', 'wechat'];
const codeThemes = ['github', 'monokai'];
const ctMap = {};
const ctFiles = {};
contentThemes.forEach((t) => {
  const f = `vditor/dist/css/content-theme/${t}.css`;
  ctMap[t] = read(f);
  ctFiles[t] = `vditor/dist/css/content-theme/${t}.css`;
});
const hlMap = {};
const hlFiles = {};
codeThemes.forEach((t) => {
  const f = `vditor/dist/js/highlight.js/styles/${t}.min.css`;
  hlMap[t] = read(f);
  hlFiles[t] = `vditor/dist/js/highlight.js/styles/${t}.min.css`;
});

/* 这段脚本在 index.min.js 之后执行：把两处主题样式钉成内联文本，
 * 并提供 __vdInlineTheme(dark) 供应用在建立编辑器前同步当前主题。 */
const themeRuntime = `
/* ===== 内联主题样式：避免 Vditor 因 href 不匹配而退回网络加载 ===== */
(function () {
  var CT = ${JSON.stringify(ctMap)};
  var CT_FILES = ${JSON.stringify(ctFiles)};
  var HL = ${JSON.stringify(hlMap)};
  var HL_FILES = ${JSON.stringify(hlFiles)};

  function pin(el, css, href) {
    if (!el) return;
    if (el.textContent !== css) el.textContent = css;
    el.setAttribute('href', href);
  }
  /* Vditor 切换主题时先把元素删掉再建 <link>，所以元素可能已经不在、也可能变成了
     <link>，两种情况都要换回内联的 <style> */
  function ensure(id) {
    var el = document.getElementById(id);
    if (el && el.tagName === 'STYLE') return el;
    if (el && el.parentNode) el.parentNode.removeChild(el);
    el = document.createElement('style');
    el.id = id;
    (document.head || document.documentElement).appendChild(el);
    return el;
  }
  function pinContent(theme) {
    if (!CT[theme]) return;
    pin(ensure('vditorContentTheme'), CT[theme], CT_FILES[theme]);
  }
  function pinCode(theme) {
    if (!HL[theme]) return;
    pin(ensure('vditorHljsStyle'), HL[theme], HL_FILES[theme]);
  }
  window.__vdInlineTheme = function (dark) {
    pinContent(dark ? 'dark' : 'light');
    pinCode(dark ? 'monokai' : 'github');
  };
  pinContent('light');
  pinCode('github');

  /* 用户在「更多 → 内容主题 / 代码主题」里手动切换时，Vditor 内部会先删掉我们的
   * <style> 再建 <link>。这里包一层外部 API，保持内联；同时暴露 afterInit 供
   * 应用在实例就绪后补一次（初始化过程本身也可能删元素）。 */
  window.__vdInlineAfter = function (dark) {
    window.__vdInlineTheme(dark);
  };
  var V = window.Vditor;
  if (V) {
    var a = V.setContentTheme, b = V.setCodeTheme;
    V.setContentTheme = function (theme, p) {
      if (CT[theme]) {
        pinContent(theme);
        if (p) document.getElementById('vditorContentTheme')
          .setAttribute('href', p + '/' + theme + '.css');
        return;
      }
      if (a) return a.apply(V, arguments);
    };
    V.setCodeTheme = function (theme, cdn) {
      if (HL[theme]) {
        pinCode(theme);
        if (cdn) document.getElementById('vditorHljsStyle')
          .setAttribute('href', cdn + '/dist/js/highlight.js/styles/' + theme + '.min.css');
        return;
      }
      if (b) return b.apply(V, arguments);
    };
  }
})();
`;

/* ---------- 主流程 ---------- */
let html = fs.readFileSync(SRC, 'utf8');
const before = Buffer.byteLength(html);

const cssBlock =
  '<!-- Vditor 样式（构建时内联，见 build.js） -->\n' +
  '<style>\n' + cssSafe(read(F.css)) + '\n</style>';
const CSS_LINK = '<link rel="stylesheet" href="vditor/dist/index.css" />';
if (!html.includes(CSS_LINK)) throw new Error('src.html 里找不到 index.css 的 <link>，构建中止');

const themeStyles =
  '<style id="vditorContentTheme" href="vditor/dist/css/content-theme/light.css"></style>\n' +
  '<style id="vditorHljsStyle" href="vditor/dist/js/highlight.js/styles/github.min.css"></style>\n';

html = html
  .replace(CSS_LINK, () => cssBlock)
  .replace('</head>', () => themeStyles + '</head>');

/* 内核脚本：替换原来那两行外链，一次性内联全部依赖 */
const OLD_VD = '<script src="vditor/dist/index.min.js"></script>';
const OLD_ICON = '<script id="vditorIconScript" src="vditor/dist/js/icons/ant.js"></script>';
if (!html.includes(OLD_VD) || !html.includes(OLD_ICON)) {
  throw new Error('src.html 里找不到 index.min.js / ant.js 的外链，构建中止');
}

const kernel = [
  '<!-- 以下 6 段由 build.js 内联：Vditor 的加载函数先查 id，命中就跳过，因此不发任何请求 -->',
  script('vditorLuteScript', read(F.lute)),
  script('vditorHljsScript', read(F.hljs)),
  script('vditorHljsThirdScript', read(F.hljs3)),
  // Vditor 的 id 规则是 "vditorI18nScript" + lang，多一层后缀，别写成 vditorI18nScript
  script('vditorI18nScriptzh_CN', read(F.i18n)),
  script(null, read(F.vditor)),
  script('vditorIconScript', read(F.icons)),
  script(null, themeRuntime),
].join('\n');

html = html
  .replace(/^[ \t]*<script id="vditorIconScript"[^>]*><\/script>[ \t]*\r?\n/m, '')
  .replace(OLD_VD, () => kernel);

fs.writeFileSync(OUT, html);

const after = Buffer.byteLength(html);
const kb = (n) => (n / 1024).toFixed(0) + ' KB';
console.log('src.html   ' + kb(before));
console.log('index.html ' + kb(after) + '   （内联 +' + kb(after - before) + '）');

const left =
  (html.match(/<script[^>]+src="vditor\//g) || []).length +
  (html.match(/<link[^>]+href="vditor\//g) || []).length;
console.log('外链残留 ' + left + ' 处（应为 0）');
if (left) throw new Error('仍有 vditor/ 外链未内联');
