-- ═══════════════════════════════════════════════════════════════
--  فحص اشتراكات إشعارات الموبايل — من يستقبلها ومن لا
--  شغّله في:  Supabase Dashboard > SQL Editor
--  (المحرّر يتجاوز RLS فيُظهر كل الصفوف)
--
--  استعلام واحد عمداً: المحرّر لا يعرض إلا نتيجة آخر أمر.
-- ═══════════════════════════════════════════════════════════════

WITH directory(user_name, role_label) AS (
  VALUES ('أنس إبراهيم',  'المحاسبة'),
         ('عمرو محمد',    'المبيعات'),
         ('أحمد طه',      'العمليات'),
         ('إبراهيم سبل',  'الإدارة'),
         ('محمد راشد',    'الإدارة')
)
SELECT d.user_name                       AS "المستخدم",
       d.role_label                      AS "الدور",
       CASE WHEN count(p.id) > 0
            THEN '✅ مسجّل'
            ELSE '❌ غير مسجّل'
       END                               AS "الحالة",
       count(p.id)                       AS "الأجهزة",
       to_char(max(p.created_at), 'YYYY-MM-DD HH24:MI') AS "آخر تسجيل",
       left(coalesce(max(p.ua), '—'), 46) AS "الجهاز"
FROM   directory d
LEFT   JOIN public.push_subscriptions p ON p.user_name = d.user_name
GROUP  BY d.user_name, d.role_label
ORDER  BY d.role_label;
