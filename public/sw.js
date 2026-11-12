self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Requisito de Chrome: debe haber un evento fetch para que sea instalable
self.addEventListener('fetch', (event) => {
  // Por ahora no cacheamos nada, todo pasa directo a la red
});
