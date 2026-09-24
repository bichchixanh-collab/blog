// sw.js v9 â€” versioned cache, khÃ´ng cache API POST, giá»›i háº¡n dung lÆ°á»£ng.
const CACHE = 'j2me-v11';
const CORE = ['index.html', 'category.html', 'game.html', 'profile.html', 'lien-he.html', '404.html', 'offline.html', 'go.html', 'dang-nhap.html', 'assets/js/sb-auth.js', 'assets/js/sb-config.js', 'assets/js/sb-sync.js', 'assets/js/sb-board.js', 'assets/i18n.js', 'assets/js/game-common.js', 'assets/js/game-comments.js', 'assets/js/game-detail.js', 'assets/js/game-ui.js',            'trang-xep-hang.html', 'style.min.css', 'assets/css/manga.css', 'assets/anime-girl.png', 'assets/logo.png',                     'manifest.webmanifest'];
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
  // data/*.json (games/notice/banners...): network-first â€” bÃ i má»›i/sá»­a pháº£i hiá»‡n ngay,
  // cache chá»‰ lÃ m fallback khi offline. KhÃ´ng cache-first nhÆ° asset tÄ©nh.
  if (url.pathname.startsWith('/data/')) {
    e.respondWith(fetch(request).then((res) => {
      if (res && res.status === 200) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(request, cp)).catch(() => {}); }
      return res;
    }).catch(() => caches.match(request)));
    return;
  }
  // Trang HTML Ä‘iá»u hÆ°á»›ng: network-first Ä‘á»ƒ deploy má»›i hiá»‡n ngay láº§n Ä‘áº§u,
  // rá»›t máº¡ng má»›i dÃ¹ng cache. Asset tÄ©nh (?v=) giá»¯ cache-first cho nháº¹.
  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).then((res) => {
      if (res && res.status === 200) { const cp = res.clone(); caches.open(CACHE).then((c) => c.put(request, cp)).catch(() => {}); }
      return res;
    }).catch(() => caches.match(request).then((hit) => hit || caches.match('offline.html'))));
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
