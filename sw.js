// Service Worker — زمزم PWA
// نسخة بسيطة: تخلّي التطبيق قابل للتثبيت، وتسرّع فتح الملفات الثابتة.
// ملاحظة: البيانات (Supabase) دايمًا من النت — مابنعملهاش cache.

const CACHE = 'zamzam-v181';
const ASSETS = [
  // الخطوط والصور فقط: ثابتة ولا تتغيّر. أما HTML وCSS وJS فلا تُخزَّن
  // إطلاقاً حتى يفتح التطبيق دائماً على آخر نسخة كأي موقع عادي.
  './assets/fonts/inter-latin.woff2',
  './assets/fonts/plex-arabic-400.woff2',
  './assets/fonts/plex-arabic-500.woff2',
  './assets/fonts/plex-arabic-600.woff2',
  './assets/fonts/plex-arabic-700.woff2',
  './assets/images/image-5fa147e6c3d5.png',
  './assets/images/icon-192.png',
  './assets/images/badge-96.png',
  './assets/images/icon-512.png',
  './assets/images/icon-512-maskable.png',
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
// نخزّن الردود الناجحة فقط. تخزين رد خطأ — كصفحة تحقّق أمني بحالة 403 —
// يضع HTML مكان ملف الأنماط أو الكود، فيرفضه المتصفح وتظهر الصفحة بلا
// تنسيق حتى بعد عودة الخادم. وهذا ما حدث فعلاً.
function isCacheable(res){
  return !!res && res.ok && res.status === 200 && (res.type === 'basic' || res.type === 'default');
}
function putIfGood(req, res){
  if(!isCacheable(res)) return;
  const copy = res.clone();
  caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // الكتابة دايمًا للنت
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // Supabase وغيره: من النت

  const isDoc  = req.mode === 'navigate';
  const isCode = isDoc
    || /\.(?:html|css|js|json)$/i.test(url.pathname)
    || url.pathname === '/' || url.pathname.endsWith('/');

  if (isCode) {
    // من الشبكة دائماً ولا نخزّنه أبداً: هذا ما جعل أجهزة تعلق على نسخة
    // قديمة أو على صفحة خطأ محفوظة مكان الملف. التنقّل وحده يحصل على
    // صفحة الواجهة المخزَّنة إن انقطعت الشبكة، وذلك لعرض رسالة لا لتشغيل
    // نسخة قديمة.
    e.respondWith(
      fetch(req, { cache: 'no-store' }).catch(async () => {
        if(isDoc){
          const shell = await caches.match('./index.html');
          if(shell) return shell;
        }
        return new Response('', { status: 504, statusText: 'offline' });
      })
    );
    return;
  }

  // الصور والخطوط: الكاش أولاً
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if(hit) return hit;
    const res = await fetch(req);
    putIfGood(req, res);
    return res;
  })());
});

// ═══ إشعارات Push — تظهر حتى والتطبيق مقفول (باللوجو) ═══
self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; }
  catch (_e) { data = { body: e.data ? e.data.text() : '' }; }
  const title = data.title || 'زمزم للحج والعمرة';
  const options = {
    body: data.body || '',
    icon: './assets/images/icon-192.png',     // ملوّنة — جوّه الإشعار
    badge: './assets/images/badge-96.png',    // ظلّية — شريط الحالة جنب الساعة
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
