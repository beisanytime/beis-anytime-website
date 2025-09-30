self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'New Video Uploaded!';
  const options = {
    body: data.body || 'A new shiur has been uploaded. Check it out!',
    icon: '/images/logo-placeholder.png',
    badge: '/images/logo-icon-placeholder.png',
    data: data.url || '/recent.html'
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data)
  );
});
