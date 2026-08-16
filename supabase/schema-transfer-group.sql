-- ══════════════════════════════════════════
-- التحويل المجمّع — إثبات تحويل واحد لعدة طلبات
-- شغّل الملف ده مرة واحدة في: Supabase Dashboard > SQL Editor
-- ══════════════════════════════════════════

-- رقم مجموعة التحويل (مثال: TRF-0001) — كل الطلبات اللي اتحوّلت مع بعض بتاخد نفس الرقم
ALTER TABLE requests ADD COLUMN IF NOT EXISTS transfer_group TEXT;

-- توقيت إنشاء المجموعة
ALTER TABLE requests ADD COLUMN IF NOT EXISTS transfer_group_at TIMESTAMPTZ;

-- مرجع/ملاحظة التحويل (اختياري) — مثال: رقم الحوالة البنكية
ALTER TABLE requests ADD COLUMN IF NOT EXISTS transfer_group_note TEXT;

-- فهرس لتسريع فلترة وعرض طلبات المجموعة
CREATE INDEX IF NOT EXISTS requests_transfer_group_idx ON requests (transfer_group);

-- للتأكد إن الأعمدة اتضافت:
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'requests' AND column_name LIKE 'transfer_group%';
