/* eslint-disable no-restricted-globals */
"use strict";

const SW_VERSION = "reader-offline-v1";
const SHELL_CACHE = `${SW_VERSION}-shell`;
const CONTENT_CACHE = `${SW_VERSION}-content`;

const CORE_SHELL_URLS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json"
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(CORE_SHELL_URLS);
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, CONTENT_CACHE]);
    const names = await caches.keys();

    await Promise.all(names.map((name) => {
      if (!keep.has(name)) {
        return caches.delete(name);
      }
      return Promise.resolve(false);
    }));

    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (!request || request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL_CACHE, "./index.html"));
    return;
  }

  const pathname = url.pathname.toLowerCase();
  if (
    pathname.endsWith(".md")
    || pathname.endsWith(".json")
    || pathname.endsWith(".css")
    || pathname.endsWith(".js")
    || pathname.endsWith(".html")
    || pathname.endsWith(".png")
    || pathname.endsWith(".jpg")
    || pathname.endsWith(".jpeg")
    || pathname.endsWith(".gif")
    || pathname.endsWith(".webp")
    || pathname.endsWith(".svg")
  ) {
    event.respondWith(staleWhileRevalidate(request, CONTENT_CACHE));
  }
});

self.addEventListener("message", (event) => {
  const payload = event && event.data && typeof event.data === "object"
    ? event.data
    : null;

  if (!payload || typeof payload.type !== "string") {
    return;
  }

  if (payload.type === "CACHE_URLS" && Array.isArray(payload.urls)) {
    event.waitUntil(cacheUrls(payload.urls));
  }
});

async function networkFirst(request, cacheName, fallbackUrl) {
  const cache = await caches.open(cacheName);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (_error) {
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }

    if (fallbackUrl) {
      const fallback = await cache.match(fallbackUrl);
      if (fallback) {
        return fallback;
      }
    }

    throw _error;
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    networkFetch.catch(() => null);
    return cached;
  }

  const networkResponse = await networkFetch;
  if (networkResponse) {
    return networkResponse;
  }

  return new Response("Offline and content not cached yet.", {
    status: 503,
    statusText: "Service Unavailable",
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}

async function cacheUrls(rawUrls) {
  const cache = await caches.open(CONTENT_CACHE);
  const urls = normalizeUrls(rawUrls);
  const total = urls.length;
  let done = 0;
  let failed = 0;

  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response && response.ok) {
        await cache.put(url, response.clone());
      } else {
        failed += 1;
      }
    } catch (_error) {
      failed += 1;
    }

    done += 1;
    await broadcast({
      type: "OFFLINE_PROGRESS",
      done,
      total
    });
  }

  await broadcast({
    type: "OFFLINE_COMPLETE",
    cached: Math.max(0, done - failed),
    total
  });
}

function normalizeUrls(rawUrls) {
  const unique = new Set();

  for (const rawUrl of rawUrls) {
    if (typeof rawUrl !== "string") {
      continue;
    }

    const trimmed = rawUrl.trim();
    if (!trimmed) {
      continue;
    }

    try {
      const absolute = new URL(trimmed, self.location.href);
      if (absolute.origin !== self.location.origin) {
        continue;
      }
      unique.add(absolute.href);
    } catch (_error) {
      // Ignore invalid URLs.
    }
  }

  return [...unique];
}

async function broadcast(payload) {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true
  });

  for (const client of clients) {
    client.postMessage(payload);
  }
}
