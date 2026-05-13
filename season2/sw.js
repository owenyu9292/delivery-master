const CACHE_NAME = 'delivery-master-season2-v3';
const ASSETS = [
  '/delivery-master/season2/',
  '/delivery-master/season2/index.html',
  '/delivery-master/season2/css/style.css',
  '/delivery-master/season2/js/state.js',
  '/delivery-master/season2/js/ui.js',
  '/delivery-master/season2/js/zones.js',
  '/delivery-master/season2/js/events.js',
  '/delivery-master/season2/js/report.js',
  '/delivery-master/season2/js/analysis.js',
  '/delivery-master/season2/js/holiday.js',
  '/delivery-master/season2/js/backup.js',
  '/delivery-master/season2/js/init.js',
  '/delivery-master/season2/icon-192.png',
  '/delivery-master/season2/icon-512.png',
];

// 설치 시 캐시
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// 활성화 시 이전 캐시 삭제
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== CACHE_NAME)
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// 요청 시 캐시 우선
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request)
      .then(cached => cached || fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
          return res;
        })
      )
      .catch(() => caches.match('/delivery-master/season2/index.html'))
  );
});
