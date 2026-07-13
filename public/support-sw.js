self.addEventListener('push', event => {
  let data = { title: 'New support message', body: 'A customer sent a message.', url: '/?support=1' };
  try { data = { ...data, ...event.data.json() }; } catch (_) {}
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, tag: 'bluecrest-support', data: { url: data.url } }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    const existing = windows[0];
    if (existing) { existing.navigate(event.notification.data.url); return existing.focus(); }
    return clients.openWindow(event.notification.data.url);
  }));
});
