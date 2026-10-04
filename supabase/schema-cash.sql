-- ═══════════════════════════════════════════════════════════════
--  الخزنة — الكاش المستلم من العملاء
--  شغّل المحتوى مرة واحدة في:  Supabase Dashboard > SQL Editor
--
--  جدول مستقل تمامًا. لا يُضاف عمود واحد إلى جدول requests ولا إلى
--  supplier_invoices، فنموذج طلب الصرف وطريقة طباعته كما هما.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.cash_receipts (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- ما يُدخله الموظف عند الاستلام
  inv_no         TEXT          NOT NULL,        -- رقم فاتورة العميل
  amount         NUMERIC(14,2) NOT NULL,        -- المبلغ المستلم بالريال القطري
  receipt_date   DATE          NOT NULL,        -- تاريخ الاستلام (اليوم افتراضيًا)
  note           TEXT,

  --  with_employee   : مع الموظف، لم يستلمه المحاسب بعد
  --  with_accountant : استلمه المحاسب، لم يُودَع بعد
  --  deposited       : أُودِع في البنك
  status         TEXT          NOT NULL DEFAULT 'with_employee',

  -- الموظف المستلِم من العميل
  created_by     TEXT          NOT NULL,
  created_at     TIMESTAMPTZ   DEFAULT NOW(),

  -- استلام المحاسب
  received_by    TEXT,
  received_at    TIMESTAMPTZ,

  -- الإيداع البنكي: رقم واحد يجمع عدة إيصالات (مثل DEP-0001)
  deposit_no     TEXT,
  deposit_bank   TEXT,
  deposit_image  TEXT,                          -- صورة الإيصال، إلزامية عند الإيداع
  deposited_by   TEXT,
  deposited_at   TIMESTAMPTZ,

  updated_at     TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cash_status_idx  ON public.cash_receipts (status);
CREATE INDEX IF NOT EXISTS cash_emp_idx     ON public.cash_receipts (created_by);
CREATE INDEX IF NOT EXISTS cash_deposit_idx ON public.cash_receipts (deposit_no);
CREATE INDEX IF NOT EXISTS cash_date_idx    ON public.cash_receipts (receipt_date);

-- ── الصلاحيات ──────────────────────────────────────────────────
-- الكتابة للمستخدم المسجّل دخوله، والتقسيم حسب الدور يتم في الواجهة
-- كما هو الحال في الطلبات وسجل الفواتير. لا توجد صلاحية حذف عن قصد:
-- الإيصال الخطأ يُحذف من الواجهة قبل استلام المحاسب فقط، وبعدها يبقى.

ALTER TABLE public.cash_receipts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_receipts TO authenticated;

DROP POLICY IF EXISTS cash_select ON public.cash_receipts;
CREATE POLICY cash_select ON public.cash_receipts
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS cash_insert ON public.cash_receipts;
CREATE POLICY cash_insert ON public.cash_receipts
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS cash_update ON public.cash_receipts;
CREATE POLICY cash_update ON public.cash_receipts
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- الحذف مسموح للإيصال الذي لم يستلمه المحاسب بعد فقط
DROP POLICY IF EXISTS cash_delete ON public.cash_receipts;
CREATE POLICY cash_delete ON public.cash_receipts
  FOR DELETE TO authenticated USING (status = 'with_employee');

-- ── للتأكد ──────────────────────────────────────────────────────
-- SELECT status, COUNT(*), SUM(amount) FROM public.cash_receipts GROUP BY status;
