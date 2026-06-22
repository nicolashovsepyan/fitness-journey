/* Self-purging service worker.
   During active development the old SW kept serving stale builds, so this
   version CLEARS all caches, UNREGISTERS itself, and reloads open clients.
   Result: the app always loads fresh from the network. We'll add a proper
   offline cache back once the build settles. */
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(c => { try { c.navigate(c.url); } catch (e) {} });
  })());
});
/* no fetch handler → nothing is served from cache */
