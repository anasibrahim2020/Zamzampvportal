/* ═══════════════════════════════════════════════════════════
   زمزم — إشعارات Push (Web Push)
   تسجّل اشتراك الجهاز في جدول push_subscriptions بـ Supabase،
   والـ Edge Function «notify» هي اللي بتبعت الإشعار على نفس الأحداث.
   ملاحظة iOS: لازم التطبيق يتضاف للشاشة الرئيسية ويُفتح من الأيقونة.
   ═══════════════════════════════════════════════════════════ */
(function () {
  // المفتاح العام VAPID (الخاص يفضل سِر في Supabase)
  var VAPID_PUBLIC = 'BPc-3luAluz5vEWzeUKFX2gjwYbpuMKjCQgTLdn9tsRLG34pREWZCitsSTXLGFwvR8Xtm6_gCD1NunG90gCFKAA';

  function supported() {
    return ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);
  }

  function urlB64ToUint8(base64) {
    var pad = '='.repeat((4 - base64.length % 4) % 4);
    var b64 = (base64 + pad).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(b64);
    var arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  function currentUserName() {
    try { return (typeof CURRENT !== 'undefined' && CURRENT && CURRENT.name) ? CURRENT.name : null; }
    catch (e) { return null; }
  }

  async function saveSubscription(sub, userName) {
    if (typeof sb === 'undefined' || !sb) return;
    var j = sub.toJSON();
    try {
      await sb.from('push_subscriptions').upsert({
        user_name: userName,
        endpoint: sub.endpoint,
        p256dh: j.keys.p256dh,
        auth: j.keys.auth,
        ua: (navigator.userAgent || '').slice(0, 180)
      }, { onConflict: 'endpoint' });
    } catch (e) { console.warn('[push] save failed', e); }
  }

  async function subscribe(userName) {
    try {
      var reg = await navigator.serviceWorker.ready;
      var sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8(VAPID_PUBLIC)
        });
      }
      await saveSubscription(sub, userName);
      hideBell();
    } catch (e) { console.warn('[push] subscribe failed', e); }
  }

  /* زر عائم «فعّل الإشعارات» — يظهر فقط لو الإذن لسه مطلوب (default) */
  var bell = null;
  function showBell(userName) {
    if (bell || Notification.permission !== 'default') return;
    bell = document.createElement('button');
    bell.type = 'button';
    bell.setAttribute('aria-label', 'تفعيل الإشعارات');
    bell.innerHTML = '<span style="font-size:16px">🔔</span><span>تفعيل الإشعارات</span>';
    bell.style.cssText = [
      'position:fixed', 'z-index:9998', 'inset-inline-end:16px', 'bottom:18px',
      'display:inline-flex', 'align-items:center', 'gap:8px',
      'background:linear-gradient(115deg,#2F817C 0%,#326F82 46%,#3E3A72 100%)',
      'color:#fff', 'border:none', 'border-radius:999px',
      'padding:12px 18px', 'font-family:Cairo,sans-serif', 'font-size:13px', 'font-weight:800',
      'box-shadow:0 10px 28px rgba(46,58,114,.32)', 'cursor:pointer'
    ].join(';');
    bell.onclick = function () {
      Notification.requestPermission().then(function (p) {
        if (p === 'granted') subscribe(userName);
        else hideBell();
      });
    };
    document.body.appendChild(bell);
  }
  function hideBell() { if (bell) { bell.remove(); bell = null; } }

  /* النداء الرئيسي — يُستدعى من enterApp() بعد الدخول */
  window.initPush = function (current) {
    var userName = (current && current.name) || currentUserName();
    if (!userName || !supported()) return;
    if (Notification.permission === 'granted') { subscribe(userName); return; }
    if (Notification.permission === 'denied') return;
    // default: نعرض زر لطيف (الإذن على iOS لازم يكون بضغطة مستخدم)
    showBell(userName);
  };

  // نداء يدوي احتياطي لو حبينا نربطه بزر تاني
  window.enablePush = function () {
    var n = currentUserName();
    if (n) window.initPush({ name: n });
  };
})();
