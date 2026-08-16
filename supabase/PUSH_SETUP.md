# إشعارات Push (Web Push) — دليل التفعيل

إشعارات تظهر على الموبايل **حتى والتطبيق مقفول** وباللوجو، على نفس أحداث الإيميل/الواتساب الـ3.

## ⚠️ مهم — الآيفون/الآيباد
- لازم iOS **16.4+**.
- لازم المستخدم يعمل **«إضافة إلى الشاشة الرئيسية»** ويفتح التطبيق **من الأيقونة** (مش من سفاري).
- أول مرة يفتح، يظهر زر «🔔 تفعيل الإشعارات» — يضغطه ويوافق على الإذن.
- **أندرويد**: يشتغل عادي من كروم بعد الموافقة على الإذن.

## الخطوات (مرة واحدة)

### 1) قاعدة البيانات
Supabase Dashboard → **SQL Editor** → شغّل محتوى [schema-push.sql](schema-push.sql)
(يعمل جدول `push_subscriptions` + سياسات RLS).

### 2) الأسرار (Edge Functions → Secrets)
أضف الأسرار دي:

| المفتاح | القيمة |
|--------|--------|
| `VAPID_PUBLIC`  | `BPc-3luAluz5vEWzeUKFX2gjwYbpuMKjCQgTLdn9tsRLG34pREWZCitsSTXLGFwvR8Xtm6_gCD1NunG90gCFKAA` |
| `VAPID_PRIVATE` | ⚠️ المفتاح الخاص — أرسله كلود في المحادثة، الصقه هنا (ماينفعش يتحط في ملف على GitHub) |
| `VAPID_SUBJECT` | `mailto:portal.zamzam@gmail.com` (اختياري) |

> `SUPABASE_URL` و `SUPABASE_SERVICE_ROLE_KEY` متوفّرين تلقائيًا في الوظيفة.

المفتاح العام `VAPID_PUBLIC` **لازم يطابق** اللي في [../assets/js/push.js](../assets/js/push.js) (متحطوط بالفعل).

### 3) إعادة نشر الوظيفة
Supabase → Edge Functions → `notify` → الصق كود [functions/notify/index.ts](functions/notify/index.ts) المحدّث → **Deploy**.
(الـ Database Webhook الموجود بيشغّلها زي ما هو — مفيش تغيير.)

### 4) نشر الموقع
ارفع ملفات الموقع على GitHub (index.html + sw.js + assets/js/push.js + assets/js/script-5.js) → Vercel deploy.

## التجربة
1. سجّل دخول بحساب المحاسب على موبايل (أندرويد أو آيفون مثبّت على الشاشة الرئيسية).
2. اضغط «🔔 تفعيل الإشعارات» ووافق.
3. من جهاز تاني، قدّم طلب صرف جديد.
4. المفروض يوصل إشعار للمحاسب فورًا حتى لو التطبيق مقفول.

## لو مفيش إشعار
- افتح Supabase → Edge Functions → `notify` → **Logs**، ودوّر على `push error` أو `VAPID`.
- اتأكد إن جدول `push_subscriptions` فيه صف للمستخدم (يعني الاشتراك اتسجّل).
- على الآيفون: اتأكد إنه مفتوح من أيقونة الشاشة الرئيسية مش من سفاري.
