-- ═══════════════════════════════════════════════════════════════
--  سجل فواتير الموردين — الباب الجديد
--  شغّل المحتوى ده مرة واحدة في:  Supabase Dashboard > SQL Editor
--
--  الجدول ده منفصل تمامًا عن جدول requests. مفيش عمود واحد
--  بيتضاف أو بيتغيّر في requests، فشكل طلب الصرف وطريقة طباعته
--  زي ما هما بالحرف.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.supplier_invoices (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- بيانات الفاتورة الأساسية
  supplier      TEXT        NOT NULL,            -- اسم المورّد
  inv_no        TEXT        NOT NULL,            -- رقم فاتورة المورّد
  descr         TEXT        NOT NULL,            -- بيان مختصر
  amount        NUMERIC(14,2) NOT NULL,          -- المبلغ بالريال القطري
  inv_date      DATE,                            -- تاريخ الفاتورة
  due_date      DATE,                            -- موعد الدفع المتوقّع (ممكن يبقى فاضي)

  -- مركز التكلفة: JSON = [{"inv":"INV/2026/0144","amt":30000}]
  cost_centers  TEXT,
  is_general    BOOLEAN     DEFAULT FALSE,       -- فاتورة عامة (بدون مركز تكلفة)

  -- الحالة اليدوية الوحيدة: open (مستحقة) أو excluded (مستبعدة)
  -- باقي الحالات (في طلب صرف / مسدّدة / متأخرة) بتتحسب من الطلب المربوط
  -- ومن التاريخ، فمفيش حد بيحدّث حالة بإيده.
  status        TEXT        NOT NULL DEFAULT 'open',

  -- الربط بطلب صرف
  request_id    BIGINT,
  req_no        TEXT,
  linked_at     TIMESTAMPTZ,
  linked_by     TEXT,

  -- مرفق صورة الفاتورة (نفس الـbucket بتاع مرفقات الطلبات)
  attachment    TEXT,

  note          TEXT,
  created_by    TEXT        NOT NULL,            -- اسم المستخدم في البورتال (عربي)
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- فاتورة واحدة ما تتربطش بأكتر من طلب: الفهرس ده بيمنع التكرار
CREATE INDEX IF NOT EXISTS sinv_request_idx  ON public.supplier_invoices (request_id);
CREATE INDEX IF NOT EXISTS sinv_status_idx   ON public.supplier_invoices (status);
CREATE INDEX IF NOT EXISTS sinv_supplier_idx ON public.supplier_invoices (supplier);
CREATE INDEX IF NOT EXISTS sinv_due_idx      ON public.supplier_invoices (due_date);

-- حارس التكرار: نفس المورّد + نفس رقم الفاتورة ما يتسجلوش مرتين.
-- بنستخدم فهرس فريد عشان الخطأ يرجع بكود 23505 والواجهة تفهمه.
CREATE UNIQUE INDEX IF NOT EXISTS sinv_dup_guard
  ON public.supplier_invoices (LOWER(TRIM(supplier)), LOWER(TRIM(inv_no)));

-- ── الصلاحيات ──────────────────────────────────────────────────
-- نفس مبدأ جدول requests: الكتابة للمستخدم المسجّل دخوله، والتقسيم
-- حسب الدور (موظف / محاسب / إدارة) بيتمّ في الواجهة زي ما هو حاصل
-- في الطلبات بالظبط. مفيش صلاحية حذف عن قصد — الفاتورة الغلط
-- بتتحوّل لـ excluded وتفضل في السجل بسببها.

ALTER TABLE public.supplier_invoices ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.supplier_invoices TO authenticated;

DROP POLICY IF EXISTS sinv_select ON public.supplier_invoices;
CREATE POLICY sinv_select ON public.supplier_invoices
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS sinv_insert ON public.supplier_invoices;
CREATE POLICY sinv_insert ON public.supplier_invoices
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS sinv_update ON public.supplier_invoices;
CREATE POLICY sinv_update ON public.supplier_invoices
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ── للتأكد إن كل حاجة اتظبطت ────────────────────────────────────
-- SELECT COUNT(*) AS "عدد الفواتير" FROM public.supplier_invoices;
-- SELECT policyname, cmd FROM pg_policies
--  WHERE schemaname='public' AND tablename='supplier_invoices';
