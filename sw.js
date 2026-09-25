// sw.js v10 — precache core + game/index split + data/games.json for offline, versioned
const CACHE = 'j2me-v10';
const CORE = ['index.html', 'category.html', 'game.html', 'profile.html', 'lien-he.html', '404.html', 'offline.html', 'go.html', 'goc-senpai.html', 'dang-nhap.html', 'assets/js/sb-auth.js', 'assets/js/sb-config.js', 'assets/js/sb-sync.js', 'assets/js/sb-board.js', 'assets/js/game-core.js', 'assets/js/game-read.js', 'assets/js/game-early.js', 'assets/js/index-core.js', 'assets/js/index-early.js', 'assets/i18n.min.js', 'trang-xep-hang.html', 'style.min.css', 'assets/css/manga.min.css', 'assets/css/game-page.css', 'assets/css/index-page.css', 'assets/anime-girl.webp', 'assets/logo.webp', 'manifest.webmanifest', 'data/games.json', 'data/stats.json'];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(request).then((res) => {
      const cp = res.clone();
      caches.open(CACHE).then((c) => c.put(request, cp)).catch(() => {});
      return res;
    }).catch(() => caches.match(request)));
    return;
  }
  // data/*.json (games/notice/banners...): network-first — bài mới/sửa phải hiện ngay,
  // cache chỉ làm fallback khi offline. Không cache-first như asset tĩnh.
  if (url.pathname.startsWith('/data/')) {
    e.respondWith(fetch(request).then((res) => {
      if (res && res.status === 200) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(request, cp)).catch(() => {}); }
      return res;
    }).catch(() => caches.match(request)));
    return;
  }
  e.respondWith(caches.match(request).then((hit) => {
    const net = fetch(request).then((res) => {
      if (res && res.status === 200) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(request, cp)).catch(() => {}); }
      return res;
    }).catch(() => hit || (request.mode === 'navigate' ? caches.match('offline.html') : Promise.reject(new Error('offline'))));
    return hit || net;
  }));
});
