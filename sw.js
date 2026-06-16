// =============================================
// EtudierGN – Service Worker (Mode Hors-ligne)
// Compatible GitHub Pages /GuineeScope-/
// =============================================

const CACHE_NAME = 'etudiergn-v3';
const CACHE_STATIC = 'etudiergn-static-v3';

// Déterminer le chemin de base automatiquement
const BASE = self.registration.scope;

// Fichiers essentiels mis en cache au démarrage
const STATIC_ASSETS = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
];

// ---- Installation ----
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC).then(cache => {
      return Promise.allSettled(
        STATIC_ASSETS.map(url => cache.add(url).catch(() => {}))
      );
    }).then(() => self.skipWaiting())
  );
});

// ---- Activation : nettoyage anciens caches ----
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== CACHE_STATIC)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ---- Fetch ----
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. Firebase / Firestore → toujours réseau
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('gstatic.com/firebasejs')
  ) {
    event.respondWith(
      fetch(event.request).catch(() => new Response('', { status: 503 }))
    );
    return;
  }

  // 2. Google APIs (AdSense, etc.) → réseau uniquement
  if (url.hostname.includes('googlesyndication.com') ||
      url.hostname.includes('doubleclick.net')) {
    event.respondWith(
      fetch(event.request).catch(() => new Response('', { status: 204 }))
    );
    return;
  }

  // 3. YouTube thumbnails → cache d'abord
  if (url.hostname.includes('img.youtube.com')) {
    event.respondWith(cacheFirst(event.request, CACHE_NAME));
    return;
  }

  // 4. Images Postimage → cache d'abord
  if (url.hostname.includes('postimg.cc') || url.hostname.includes('i.postimg.cc')) {
    event.respondWith(cacheFirst(event.request, CACHE_NAME));
    return;
  }

  // 5. Google Fonts → cache statique
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(cacheFirst(event.request, CACHE_STATIC));
    return;
  }

  // 6. Fichiers locaux du site → réseau d'abord, fallback cache
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirstLocal(event.request));
    return;
  }

  // 7. Tout le reste → réseau simple
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// ---- Cache d'abord ----
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 503 });
  }
}

// ---- Réseau d'abord, fallback cache ----
async function networkFirstLocal(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_STATIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      return caches.match(BASE + 'index.html');
    }
    return new Response('', { status: 503 });
  }
}
