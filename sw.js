// Service Worker — زمزم PWA
// نسخة بسيطة: تخلّي التطبيق قابل للتثبيت، وتسرّع فتح الملفات الثابتة.
// ملاحظة: البيانات (Supabase) دايمًا من النت — مابنعملهاش cache.

const CACHE = 'zamzam-v113';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/css/styles.css',
  './assets/css/cost-center-toggle.css',
  './assets/fonts/inter-latin.woff2',
  './assets/fonts/plex-arabic-400.woff2',
  './assets/fonts/plex-arabic-500.woff2',
  './assets/fonts/plex-arabic-600.woff2',
  './assets/fonts/plex-arabic-700.woff2',
  './assets/js/i18n.js',
  './assets/js/script-1.js',
  './assets/js/script-2.js',
  './assets/js/script-3.js',
  './assets/js/script-4.js',
  './assets/js/script-5.js',
  './assets/js/push.js',
  './assets/images/image-5fa147e6c3d5.png',
  './assets/images/icon-192.png',
  './assets/images/icon-512.png',
  './assets/images/icon-180.png',
];

// تثبيت: نخزّن ملفات الواجهة
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).catch(() => {}));
  self.skipWaiting();
});

// تفعيل: نمسح الكاش القديم
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// الطلبات:
//  • Supabase وأي حاجة خارجية → النت مباشرة
//  • ملفات الكود (html/css/js) → النت الأول عشان التحديث يوصل فوراً، والكاش احتياطي لو مفيش نت
//  • الصور والخطوط → الكاش الأول (مابتتغيّرش وبتوفّر سرعة وبيانات)
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // الكتابة دايمًا للنت
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // Supabase وغيره: من النت

  const isCode = req.mode === 'navigate'
    || /\.(?:html|css|js|json)$/i.test(url.pathname)
    || url.pathname === '/' || url.pathname.endsWith('/');

  if (isCode) {
    // Network-first: أحدث نسخة دايمًا، ولو النت واقع نرجع للكاش
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then((hit) => hit || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first للأصول الثابتة
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});

// ═══ إشعارات Push — تظهر حتى والتطبيق مقفول (باللوجو) ═══
self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; }
  catch (_e) { data = { body: e.data ? e.data.text() : '' }; }
  const title = data.title || 'زمزم للحج والعمرة';
  const options = {
    body: data.body || '',
    icon: './assets/images/icon-192.png',
    badge: './assets/images/icon-192.png',
    dir: 'rtl',
    lang: 'ar',
    tag: data.tag || undefined,
    renotify: !!data.tag,
    vibrate: [90, 40, 90],
    data: { url: data.url || './index.html' },
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// الضغط على الإشعار: يفتح البورتال أو يركّز عليه لو مفتوح
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || './index.html';
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if ('focus' in c) { try { await c.navigate(target); } catch (_e) {} return c.focus(); }
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  })());
});
