const CACHE_NAME = 'goo-news-v2';
const ASSETS = ['/Goo-news/', '/Goo-news/index.html', '/Goo-news/news.json'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))); });
self.addEventListener('fetch', (e) => {
  e.respondWith(caches.match(e.request).then(response => response || fetch(e.request).then(fetchRes => {
    return caches.open(CACHE_NAME).then(cache => { cache.put(e.request, fetchRes.clone()); return fetchRes; });
  })).catch(() => caches.match('/Goo-news/index.html')));
});
