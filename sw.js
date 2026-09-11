// sw.js — Service Worker: đọc offline các trang đã xem (đúng chất WAP).
// Chiến lược: trang HTML + ảnh theo kiểu stale-while-revalidate, data JSON
// network-first (rớt mạng mới dùng cache), API POST (tải/bình luận) không cache.
const CACHE = 'j2me-v2';
const CORE = ['./index.html', './category.html', './lien-he.html', './offline.html', './style.css'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(CORE).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isDataJson(url) {
  return /\/data\/(games|stats|comments|banners)\.json(\?|$)/.test(url.pathname + url.search);
}

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'POST' && request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // ảnh/link ngoài: để trình duyệt lo
  if (request.method === 'POST' || url.pathname.startsWith('/api/')) {
    // API: network-first, rớt mạng thì trả lỗi JSON nhẹ (trừ GET cache được)
    if (request.method !== 'GET') return;
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }
  if (isDataJson(url)) {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }
  // Trang + ảnh + còn lại: cache trước, đồng thời cập nhật nền;
  // chưa từng xem + mất mạng → trang offline
  e.respondWith(
    caches.match(request).then((hit) => {
      const net = fetch(request)
        .then((res) => {
          if (res && (res.status === 200 || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() =>
          hit ||
          (request.mode === 'navigate'
            ? caches.match('offline.html')
            : Promise.reject(new Error('offline')))
        );
      return hit || net;
    })
  );
});
