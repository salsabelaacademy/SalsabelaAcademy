self.addEventListener('push', event => {
 let data = {}; try { data = event.data.json(); } catch { /* Private generic fallback. */ }
 const ar = data.language === 'ar';
 const words=ar?{
 message:'لديك رسالة جديدة. افتح محادثات الأكاديمية للرد.',lesson:'لديك تحديث مهم لحصتك. افتح الأكاديمية لمراجعة التفاصيل.',report:'تقرير حصتك جاهز. افتح الأكاديمية للاطلاع على الملاحظات.',security:'تنبيه يتعلق بأمان حسابك. افتح الأكاديمية للمراجعة.',academy:'لديك تحديث جديد في الأكاديمية. افتح لوحتك للاطلاع عليه.'
 }:{
 message:'You have a new message. Open academy conversations to reply.',lesson:'An important lesson update is available. Open the academy for details.',report:'Your lesson report is ready. Open the academy to read your feedback.',security:'An account security notice is available. Open the academy to review it.',academy:'You have an academy update. Open your dashboard to view it.'
 };
 const candidate=typeof data.url==='string'?data.url:'';
 const safePath=/^\/(?:ar\/)?dashboard\/(?:admin|student)\?tab=(?:messages|notifications|settings|lessons)(?:&focus=lesson(?::|%3A)[1-9]\d{0,9})?$/.test(candidate)?candidate:(ar?'/ar/login':'/login');
 event.waitUntil(self.registration.showNotification('Salsabela Academy', {
 body: Object.prototype.hasOwnProperty.call(words,data.category)?words[data.category]:words.academy,
 icon: '/logo-icon.png', badge: '/logo-icon.png', tag: data.category==='message'?'academy-messages':'academy-' + (data.id || 'update'),
 data: { url: safePath }
 }));
});
self.addEventListener('notificationclick', event => {
 event.notification.close();
 const url = new URL(event.notification.data?.url || '/login', self.location.origin);
 if (url.origin !== self.location.origin) return;
 event.waitUntil((async()=>{
   const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
   const current=windows.find(client=>new URL(client.url).origin===self.location.origin&&/\/(?:dashboard|admin)(?:\/|$)/.test(new URL(client.url).pathname));
   if(current){try{const navigated=await current.navigate(url.href);if(navigated)return navigated.focus();}catch{ /* Open a fresh window if the old one cannot navigate. */ }}
   return clients.openWindow(url.href);
 })());
});
