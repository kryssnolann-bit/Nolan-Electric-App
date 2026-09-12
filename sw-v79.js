self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = { title: 'Nolan Electric', body: event.data ? event.data.text() : '' }; }
  const title = data.title || 'Nolan Electric';
  const options = {
    body: data.body || 'You have a new notification.',
    icon: data.icon || './icon-192.png',
    badge: data.badge || './icon-72.png',
    tag: data.tag || 'nolan-electric',
    renotify: true,
    data: { url: data.url || './' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './', self.location.origin).href;
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if ('focus' in client) {
        await client.focus();
        try { await client.navigate(target); } catch (_) {}
        return;
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(target);
  })());
});
