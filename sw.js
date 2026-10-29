/* DK NOTE 离线缓存
 * 页面本身已经是单文件：编辑器内核全部内联在 index.html 里，运行时不再请求任何静态资源。
 * 所以这里只需要缓存这一个文件：首次访问下载一次（5.3MB，gzip 约 1.1MB），之后秒开，断网也能写。
 * 策略：
 *   - 页面导航 → 先用缓存秒开，同时后台拉新版（下次打开即新版本）
 *   - 其它同源 GET（图标等零散文件）→ 缓存优先
 * 版本号变了才会清旧缓存；改 index.html 不需要改它，导航那一支会自己更新。
 */
const VER = 'v4';
const CACHE = 'dknote-' + VER;
/* 缓存 key 用目录根，和用户实际访问的地址一致。
   写成 './index.html' 会和页面 URL '/DK-NOTE/' 变成两个缓存条目，
   预缓存时命中不了刚下载的那份，等于白下一次 5MB。 */
const PAGE = './';

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    /* 只存一个文件，而且用 force-cache 取：页面刚刚下载完，HTTP 缓存里就有，
       不会真的再走一遍网络。之前用 c.add() 会重新下载 5MB，首访结束都装不完。 */
    try {
      const r = await fetch(PAGE, { cache: 'force-cache' });
      if (r && r.ok) await c.put(PAGE, r);
    } catch (err) { /* 取不到就算了，导航那一支会回填 */ }
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
