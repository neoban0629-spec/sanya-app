const CACHE_NAME = "sanya-work-v12";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* 页面(HTML)与每日下发内容必须网络优先：否则每次重新部署后，
   用户打开 App 拿到的是旧的缓存壳，看不到任何新功能。离线时回退缓存。 */
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const accept = e.request.headers.get("accept") || "";
  const isPage = (e.request.mode === "navigate") || accept.indexOf("text/html") !== -1;
  const isData = url.pathname.indexOf("/data/") !== -1;

  if (isPage || isData) {
    /* 页面与数据：加时间戳 + no-store，强制绕过浏览器/CDN 缓存，
       保证一打开就是最新版（离线时 fetch 失败再回退缓存） */
    const req = isPage
      ? (() => { const u = new URL(url.href); u.searchParams.set("_v", Date.now()); return u.href; })()
      : e.request;
    e.respondWith(
      fetch(req, {cache:"no-store"}).then(res => {
        if (res && res.ok && url.origin === location.origin) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() =>
        caches.match(e.request).then(c => c || caches.match("./index.html"))
      )
    );
    return;
  }

  /* 静态资源（图标/manifest 等）：缓存优先 + 后台更新 */
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetched = fetch(e.request).then(res => {
        if (res && res.ok && url.origin === location.origin) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      if (list.length) return list[0].focus();
      return clients.openWindow("./index.html");
    })
  );
});
