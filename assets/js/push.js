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
    } catch (e) { console.warn('[push] subscribe failed', e); }
  }

  /* ───── نافذة تفعيل الإشعارات ─────
     الإذن لازم يتطلب من ضغطة مستخدم (شرط آبل)، فالنافذة هي الوسيط. */
  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches
        || window.navigator.standalone === true;
  }

  var TT = (typeof t === 'function') ? t : function (x) { return x; };

  async function showPushDialog(userName, force) {
    // تظهر في كل مرة يُفتح فيها التطبيق ما دامت الإشعارات غير مفعّلة —
    // لا مرة واحدة فقط: من رفضها مرة كان لا يصله شيء على جهازه إلى الأبد.
    if (typeof showConfirmDialog !== 'function') return;

    // آيفون من المتصفح: الدفع مش مدعوم أصلاً — نوريه الخطوة الصح
    if (isIOS() && !isStandalone()) {
      if (typeof showMessageDialog === 'function') {
        showMessageDialog({
          title: TT('فعّل إشعارات الطلبات'),
          subtitle: 'Enable Notifications',
          message: TT('لاستقبال إشعارات الطلبات على iPhone، يلزم إضافة البوابة إلى الشاشة الرئيسية أولاً.'),
          details: [
            { label: TT('الخطوة ١'), value: TT('افتح قائمة المشاركة في Safari') },
            { label: TT('الخطوة ٢'), value: TT('اختر «إضافة إلى الشاشة الرئيسية»') },
            { label: TT('الخطوة ٣'), value: TT('افتح البوابة من الأيقونة الجديدة') }
          ],
          note: TT('سيظهر بعدها طلب تفعيل الإشعارات.'),
          confirmText: TT('حسنًا')
        });
      }
      return;
    }

    var ok = await showConfirmDialog({
      title: TT('فعّل إشعارات الطلبات'),
      subtitle: 'Enable Notifications',
      message: TT('يصلك إشعار فوري على جهازك عند كل حدث يخصّك، حتى والبوابة مغلقة.'),
      details: [
        { label: TT('المحاسب'), value: TT('طلب جديد بانتظار اعتمادك') },
        { label: TT('الموظف'),  value: TT('اعتماد طلبك وتحويله') },
        { label: TT('الجميع'),  value: TT('تعليق جديد على طلب') }
      ],
      note: TT('يمكنك إيقافها في أي وقت من إعدادات المتصفح.'),
      confirmText: TT('تفعيل الإشعارات'),
      cancelText: TT('ليس الآن')
    });
    if (!ok) return;
    try {
      var p = await Notification.requestPermission();
      if (p === 'granted') {
        subscribe(userName);
        if (typeof showMessageDialog === 'function') {
          showMessageDialog({
            title: TT('تم تفعيل الإشعارات'),
            message: TT('سيصلك إشعار على هذا الجهاز عند كل حدث يخصّك.'),
            confirmText: TT('حسنًا')
          });
        }
      }
    } catch (e) { console.warn('[push] permission failed', e); }
  }

  /* النداء الرئيسي — يُستدعى من enterApp() بعد الدخول */
  window.initPush = function (current) {
    var userName = (current && current.name) || currentUserName();
    if (!userName || !supported()) return;
    if (Notification.permission === 'granted') { subscribe(userName); return; }
    if (Notification.permission === 'denied') return;
    // default: نافذة واضحة تشرح وتطلب الإذن بضغطة المستخدم
    setTimeout(function () { showPushDialog(userName); }, 1200);
  };

  /* حالة الإشعارات على هذا الجهاز — تستخدمها الواجهة لعرض زر التفعيل */
  window.pushStatus = function () {
    if (!supported()) return isIOS() && !isStandalone() ? 'ios-needs-install' : 'unsupported';
    if (isIOS() && !isStandalone()) return 'ios-needs-install';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    return 'default';
  };

  /* تفعيل يدوي من زرّ في الواجهة — يفتح النافذة حتى لو سبق رفضها */
  window.enablePush = function () {
    var n = currentUserName();
    if (!n) return;
    if (supported() && Notification.permission === 'granted') { subscribe(n); return; }
    showPushDialog(n, true);
  };
})();
