const CACHE = "quotecut-v12-dashboard-refresh";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

const CRITICAL_EXTERNAL_ASSETS = [
  "https://cdn.tailwindcss.com/",
  "https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap"
];

async function cacheExternal(cache, url) {
  try {
    const response = await fetch(url, { mode: "no-cors", cache: "reload" });
    await cache.put(url, response.clone());
  } catch (error) {
    // L'app continuerà a usare la cache precedente o il font di sistema.
  }
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(APP_SHELL);
    await Promise.all(CRITICAL_EXTERNAL_ASSETS.map(url => cacheExternal(cache, url)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);

  if (event.request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(event.request, { cache: "no-store" });
        const cache = await caches.open(CACHE);
        await cache.put("./index.html", response.clone());
        return response;
      } catch (error) {
        return (await caches.match("./index.html")) || (await caches.match("./"));
      }
    })());
    return;
  }

  if (requestUrl.origin !== self.location.origin) {
    event.respondWith((async () => {
      const cached = await caches.match(event.request, { ignoreVary: true });
      if (cached) return cached;
      try {
        const response = await fetch(event.request, { mode: "no-cors" });
        const cache = await caches.open(CACHE);
        await cache.put(event.request, response.clone());
        return response;
      } catch (error) {
        return Response.error();
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cached = await caches.match(event.request, { ignoreSearch: true });
    if (cached) {
      event.waitUntil(fetch(event.request).then(async response => {
        if (response && response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(event.request, response.clone());
        }
      }).catch(() => undefined));
      return cached;
    }
    try {
      const response = await fetch(event.request);
      if (response && response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch (error) {
      return Response.error();
    }
  })());
});
