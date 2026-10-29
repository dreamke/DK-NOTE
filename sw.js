/* DK NOTE 离线缓存
 * 目标：编辑器内核 3.6MB，线上每次冷启动要十几秒；缓存后第二次打开是 0.2s，断网也能用。
 * 策略：
 *   - 页面导航 → 先用缓存秒开，同时后台拉新版（下次打开即新版本）
 *   - 其它同源 GET（vditor/、assets/ 等）→ 缓存优先
 * 版本号变了才会清旧缓存；改 index.html 不需要改它，导航那一支会自己更新。
 */
const VER = 'v1';
const CACHE = 'dknote-' + VER;
const PAGE = './index.html';

/* 首屏完整就是这 7 个请求（合计 4.2MB，gzip 后约 740KB）。
 * 首次访问在后台预缓存，等用户下次打开时全部命中缓存，不再走网络。 */
const PRECACHE = [
  './',
  PAGE,
  './vditor/dist/index.min.js',
  './vditor/dist/index.css',
  './vditor/dist/js/lute/lute.min.js',
  './vditor/dist/js/icons/ant.js',
  './vditor/dist/js/i18n/zh_CN.js',
  './vditor/dist/css/content-theme/light.css',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // 逐个加，个别文件失败不拖累整体安装。
    // 不写 cache:'reload'：页面刚下过这些文件，走 HTTP 缓存直接取，不会重复下载那 3.6MB。
    await Promise.all(PRECACHE.map((u) => c.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;   // 跨源一律不管

  // 导航请求：缓存优先 + 后台更新
  if (req.mode === 'navigate') {
    const cacheP = caches.open(CACHE);
    const netP = fetch(req).then((r) => {
      if (r && r.ok) cacheP.then((c) => c.put(PAGE, r.clone())).catch(() => {});
      return r;
    });
    e.respondWith((async () => {
      const c = await cacheP;
      const hit = await c.match(PAGE, { ignoreSearch: true });
      return hit || netP;
    })());
    e.waitUntil(netP.catch(() => {}));
    return;
  }

  // 静态资源：缓存优先，未命中再取网络并回填
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(req);
    if (hit) return hit;
    try {
      const r = await fetch(req);
      if (r && r.ok && r.type === 'basic') c.put(req, r.clone()).catch(() => {});
      return r;
    } catch (err) {
      return Response.error();
    }
  })());
});
