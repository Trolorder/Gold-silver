// Service Worker — Patrimoine Métaux Précieux
const CACHE = 'patrimoine-v2'; // ← version bumpée : vide l'ancien cache (icône cassée incluse)
const ASSETS = [
  './',
  './index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=Inter:wght@300;400;500;600;700&display=swap'
];

// Installation : mettre en cache les assets statiques
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS.map(u => new Request(u, {mode:'no-cors'}))))
      .catch(() => {})
  );
  self.skipWaiting();
});

// Activation : supprimer TOUS les vieux caches (y compris l'icône cassée mise en cache par erreur)
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch : cache-first pour les assets, network-first pour GitHub API et icônes/manifest
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Ne pas intercepter les appels GitHub API (données dynamiques)
  if (url.hostname === 'api.github.com') return;

  // Ne pas intercepter les APIs de cours (données temps réel)
  if (url.hostname.includes('jsdelivr') || url.hostname.includes('er-api') ||
      url.hostname.includes('ipify') || url.hostname.includes('exchangerate')) return;

  // Icônes et manifest : toujours réseau d'abord (jamais de cache permanent cassé)
  if (url.pathname.endsWith('manifest.json') ||
      url.pathname.includes('icon-192') || url.pathname.includes('icon-512')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first pour tout le reste (index.html, fonts, Chart.js...)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE).then(cache => cache.put(e.request, clone));
          }
          return response;
        })
        .catch(() => caches.match('./index.html')); // Fallback hors-ligne
    })
  );
});
