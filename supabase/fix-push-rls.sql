-- ═══════════════════════════════════════════════════════════════
--  إصلاح صلاحيات جدول اشتراكات الإشعارات
--  شغّله في:  Supabase Dashboard > SQL Editor
--
--  المشكلة: الجدول مفعّل عليه RLS بلا سياسات كتابة، فكل محاولة من
--  التطبيق لحفظ اشتراك جهاز تُرفض:
--      42501: new row violates row-level security policy
--  ولهذا لم يُسجَّل أي جهاز ولم يصل أي إشعار.
-- ═══════════════════════════════════════════════════════════════

alter table public.push_subscriptions enable row level security;

-- إضافة اشتراك جهاز جديد
drop policy if exists push_insert on public.push_subscriptions;
create policy push_insert on public.push_subscriptions
  for insert to anon, authenticated
  with check (true);

-- تحديث اشتراك موجود (نفس الجهاز يعيد التفعيل)
drop policy if exists push_update on public.push_subscriptions;
create policy push_update on public.push_subscriptions
  for update to anon, authenticated
  using (true) with check (true);

-- قراءة الاشتراكات تبقى للـ Edge Function وحدها عبر service role،
-- فلا سياسة select ولا delete للواجهة.

-- ── تنظيف صفوف الفحص إن وُجدت ──
delete from public.push_subscriptions where user_name = '__اختبار__';

-- ── تأكيد ──
select policyname as "السياسة", cmd as "العملية", roles as "الأدوار"
from   pg_policies
where  schemaname = 'public' and tablename = 'push_subscriptions'
order  by cmd;
