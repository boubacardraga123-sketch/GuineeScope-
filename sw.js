// ============================================================
// SERVICE WORKER - GuinéeScope
// Stratégie "réseau d'abord" pour l'app shell (index.html) :
// - En ligne : toujours la dernière version (évite tout décalage
//   après une mise à jour du fichier sur le serveur).
// - Hors-ligne : on retombe sur la dernière version mise en cache.
// Les appels API/RSS (actualités, vidéos) ne sont pas concernés :
// ils partent directement au réseau, gérés par le JS de la page.
// ============================================================
const CACHE_NAME = 'guineescope-shell-v2';
const SHELL_URL = './index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(SHELL_URL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            caches.open(CACHE_NAME).then((cache) => cache.put(SHELL_URL, res.clone()));
          }
          return res;
        })
        .catch(() => caches.match(SHELL_URL))
    );
  }
});
