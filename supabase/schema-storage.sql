-- ═══════════════════════════════════════════════════════════════
--  مرفقات الطلبات — فحص إعدادات Supabase Storage
--  شغّل المحتوى ده في:  Supabase Dashboard > SQL Editor
--
--  الـbucket «request-attachments» موجود بالفعل، فالملف ده
--  للفحص والتأكد من السياسات — مش لإنشاء أي حاجة من جديد.
--  الجزء (1) و(2) قراءة فقط وآمنين تمامًا.
-- ═══════════════════════════════════════════════════════════════

-- ── (1) إعدادات الـbucket الحالية ──────────────────────────────
--  المفروض: public = false (البورتال بيقرأ بروابط موقّتة موقّعة)
--  و file_size_limit كبير كفاية لفواتير الموردين الممسوحة ضوئيًا.
SELECT id,
       public                       AS "عام؟",
       file_size_limit              AS "حد الحجم (بايت)",
       ROUND(file_size_limit/1048576.0, 1) AS "حد الحجم (ميجا)",
       allowed_mime_types           AS "الأنواع المسموحة"
FROM   storage.buckets
WHERE  id = 'request-attachments';

-- ── (2) السياسات المطبّقة حاليًا على الملفات ────────────────────
--  المفروض تلاقي على الأقل سياسة SELECT وسياسة INSERT
--  للدور authenticated. لو INSERT ناقصة، الرفع هيفشل للجميع.
SELECT policyname AS "السياسة",
       cmd        AS "العملية",
       roles      AS "الأدوار",
       qual       AS "شرط القراءة",
       with_check AS "شرط الكتابة"
FROM   pg_policies
WHERE  schemaname = 'storage' AND tablename = 'objects'
ORDER  BY cmd, policyname;


-- ═══════════════════════════════════════════════════════════════
--  (3) للاستخدام عند الحاجة فقط
--  شغّل الجزء ده لو الفحص فوق أظهر إن سياسة INSERT أو SELECT
--  للدور authenticated مش موجودة. لو السياسات موجودة وشغّالة،
--  متشغّلش الجزء ده — المشكلة ساعتها في الشبكة مش في الصلاحيات.
-- ═══════════════════════════════════════════════════════════════

-- DROP POLICY IF EXISTS "attachments_read"   ON storage.objects;
-- DROP POLICY IF EXISTS "attachments_insert" ON storage.objects;
--
-- -- قراءة: أي مستخدم مسجّل يفتح مرفقات الطلبات
-- CREATE POLICY "attachments_read" ON storage.objects
--   FOR SELECT TO authenticated
--   USING (bucket_id = 'request-attachments');
--
-- -- رفع: أي مستخدم مسجّل يرفع مرفقات
-- CREATE POLICY "attachments_insert" ON storage.objects
--   FOR INSERT TO authenticated
--   WITH CHECK (bucket_id = 'request-attachments');

--  ملاحظة: مافيش سياسة DELETE عن قصد — المرفقات دليل مالي
--  مربوط بطلب صرف، فمينفعش تتمسح من الواجهة.
