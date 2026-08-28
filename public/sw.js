// Replace legacy /ff/ workers with a controller that never intercepts requests.
// Existing caches remain intact, but future navigations return to the network.
self.addEventListener("install", () => {
  void self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
