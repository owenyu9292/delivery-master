const CACHE_NAME = 'delivery-master-v6';
const ASSETS = [
  '/delivery-master/',
  '/delivery-master/index.html',
  '/delivery-master/css/style.css',
  '/delivery-master/js/state.js',
  '/delivery-master/js/ui.js',
  '/delivery-master/js/zones.js',
  '/delivery-master/js/events.js',
  '/delivery-master/js/report.js',
  '/delivery-master/js/analysis.js',
  '/delivery-master/js/holiday.js',
  '/delivery-master/js/backup.js',
  '/delivery-master/js/init.js',
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
      .catch(() => caches.match('/delivery-master/index.html'))
  );
});
