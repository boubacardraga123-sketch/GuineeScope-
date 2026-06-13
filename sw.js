// ============================================================
// SERVICE WORKER - GuinéeScope
// Met en cache l'app shell (index.html) pour un chargement
// INSTANTANÉ aux visites suivantes, même hors-ligne.
// Les appels API/RSS (actualités, vidéos) ne sont PAS mis en
// cache ici : ils restent toujours frais (gérés par le JS).
// ============================================================
const CACHE_NAME = 'guineescope-shell-v1';
const SHELL_URL = './index.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(SHELL_URL))
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

  // On ne gère que la page principale (navigation). Tout le reste
  // (proxies RSS, polices, images, YouTube...) part directement au réseau.
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(SHELL_URL);
        const networkFetch = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(SHELL_URL, res.clone());
            return res;
          })
          .catch(() => cached);

        // Stale-while-revalidate : on affiche le cache instantanément
        // si dispo, sinon on attend le réseau.
        return cached || networkFetch;
      })
    );
  }
});
