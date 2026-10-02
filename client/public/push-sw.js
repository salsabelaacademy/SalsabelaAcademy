self.addEventListener('push', event => {
 let data = {}; try { data = event.data.json(); } catch { /* Generic private notification */ }
 const ar = data.language === 'ar';
 event.waitUntil(self.registration.showNotification('Salsabela Academy', {
 body: ar ? 'لديك تحديث جديد في الأكاديمية. افتح لوحتك للاطلاع عليه.' : 'You have an academy update. Open your dashboard to view it.',
 icon: '/logo-icon.png', badge: '/logo-icon.png', tag: 'academy-' + (data.id || 'update'),
 data: { url: ar ? '/ar/login' : '/login' }
 }));
});
self.addEventListener('notificationclick', event => {
 event.notification.close();
 const url = new URL(event.notification.data?.url || '/login', self.location.origin);
 if (url.origin !== self.location.origin) return;
 event.waitUntil(clients.openWindow(url.href));
});
