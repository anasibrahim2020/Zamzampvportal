-- ═══════════════════════════════════════════════════════════════
--  نقل العهدة بين المحاسبين
--  شغّل المحتوى مرة واحدة في:  Supabase Dashboard > SQL Editor
--  (بعد schema-cash.sql)
--
--  المحاسب يطلب نقل ما بعهدته إلى محاسب آخر، والمال لا ينتقل
--  إلا بقبول المستلِم. الرفض يُعيده إلى صاحبه كما كان.
-- ═══════════════════════════════════════════════════════════════

-- الحائز الحالي للنقدية. فارغ = الحائز هو من استلمها من الموظف
-- (received_by)، فتبقى الإيصالات القديمة صحيحة بلا تعديل.
ALTER TABLE public.cash_receipts ADD COLUMN IF NOT EXISTS held_by TEXT;

-- طلب النقل: رقم واحد يجمع الدفعة (HO-0001)، والحالة pending حتى يُحسم
ALTER TABLE public.cash_receipts ADD COLUMN IF NOT EXISTS handover_no     TEXT;
ALTER TABLE public.cash_receipts ADD COLUMN IF NOT EXISTS handover_to     TEXT;
ALTER TABLE public.cash_receipts ADD COLUMN IF NOT EXISTS handover_by     TEXT;
ALTER TABLE public.cash_receipts ADD COLUMN IF NOT EXISTS handover_at     TIMESTAMPTZ;
ALTER TABLE public.cash_receipts ADD COLUMN IF NOT EXISTS handover_state  TEXT;   -- pending | NULL
ALTER TABLE public.cash_receipts ADD COLUMN IF NOT EXISTS handover_note   TEXT;
ALTER TABLE public.cash_receipts ADD COLUMN IF NOT EXISTS handover_done_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS cash_held_idx     ON public.cash_receipts (held_by);
CREATE INDEX IF NOT EXISTS cash_handover_idx ON public.cash_receipts (handover_state, handover_to);

-- ── للتأكد ──────────────────────────────────────────────────────
-- SELECT inv_no, received_by, held_by, handover_to, handover_state
--   FROM public.cash_receipts WHERE handover_state = 'pending';
