// Installability only. No caches, teacher snapshots, OAuth responses or student
// data are stored/intercepted; all requests retain their normal network behavior.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
