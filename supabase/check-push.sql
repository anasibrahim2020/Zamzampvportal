-- ═══════════════════════════════════════════════════════════════
--  فحص اشتراكات إشعارات الموبايل
--  شغّله في:  Supabase Dashboard > SQL Editor
--  (محرّر SQL يتجاوز RLS فيُظهر الصفوف كلها)
-- ═══════════════════════════════════════════════════════════════

-- 1) مَن سجّل جهازه لاستقبال الإشعارات؟
SELECT user_name          AS "المستخدم",
       count(*)           AS "عدد الأجهزة",
       max(created_at)    AS "آخر تسجيل"
FROM   public.push_subscriptions
GROUP  BY user_name
ORDER  BY user_name;

-- 2) هل الإدارة تحديداً مسجّلة؟
--    إن كانت النتيجة صفراً فلن يصل إليها إشعار مهما كان الكود سليماً،
--    ويلزم أن تفتح البوابة من أيقونة الشاشة الرئيسية وتفعّل الإشعارات.
SELECT CASE WHEN count(*) > 0
            THEN '✅ مسجّلة — ' || count(*) || ' جهاز'
            ELSE '❌ غير مسجّلة — لن يصلها إشعار'
       END AS "حالة الإدارة"
FROM   public.push_subscriptions
WHERE  user_name = 'إبراهيم سبل';

-- 3) تفاصيل الأجهزة (لمعرفة نوع الجهاز والمتصفح)
SELECT user_name AS "المستخدم",
       left(endpoint, 42) || '…' AS "عنوان الدفع",
       left(coalesce(ua,'—'), 60) AS "الجهاز",
       created_at AS "التسجيل"
FROM   public.push_subscriptions
ORDER  BY created_at DESC;
