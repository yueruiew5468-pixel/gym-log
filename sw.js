// 離線支援：有網路時永遠抓最新版（更新網站後馬上生效），沒網路時才用上次存下的版本
const CACHE = 'gymlog-v4';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    // 不用瀏覽器的暫存（GitHub 會叫手機留 10 分鐘），每次都拿網站上最新的
    fetch(e.request, {cache: 'no-store'})
      .then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});

// 點「休息結束」通知：回到 App 並停止鬧鈴
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(list => {
    const c = list[0];
    if (c) { c.postMessage('stopAlarm'); return c.focus(); }
    return self.clients.openWindow('./');
  }));
});
