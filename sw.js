const CACHE = 'detailer-v5';

// critical app files — cached immediately on install
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './logo.svg',
  './icon-180.png',
  './icon-512.png'
];

// large PDF libs — cached on first successful fetch instead of at install,
// and still allowed through the network while offline mode is on
const RUNTIME = [
  'lib/pdfmake.min.js',
  'lib/vfs_fonts.js'
];

// Offline mode flag. The Woovio receipts app keeps this only in memory, so it
// silently resets whenever the browser kills the idle service worker — here it
// is also persisted in the cache and re-read after every SW restart.
const FLAG_KEY = './__offline-flag__';
let offlineMode = null;

async function readOfflineFlag() {
  if (offlineMode !== null) return offlineMode;
  try {
    const c = await caches.open(CACHE);
    const r = await c.match(FLAG_KEY);
    offlineMode = r ? (await r.text()) === 'true' : false;
  } catch (e) {
    offlineMode = false;
  }
  return offlineMode;
}

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SET_OFFLINE_MODE') {
    offlineMode = !!e.data.value;
    const store = caches.open(CACHE).then((c) => c.put(FLAG_KEY, new Response(String(offlineMode))));
    if (e.waitUntil) e.waitUntil(store);
  }
});

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith((async () => {
    const cached = await caches.match(e.request);
    const offline = await readOfflineFlag();

    if (offline) {
      if (cached) return cached;
      const isLib = RUNTIME.some((f) => new URL(e.request.url).pathname.endsWith(f));
      if (!isLib) {
        return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }
      // uncached PDF lib: fall through to the network so export still works
    }

    const fetched = fetch(e.request)
      .then((res) => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } }));

    return cached || fetched;
  })());
});
