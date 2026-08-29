-- ═══════════════════════════════════════════════════════════════
--  إصلاح صلاحيات جدول اشتراكات الإشعارات — النسخة المصحّحة
--  شغّله في:  Supabase Dashboard > SQL Editor
--
--  المحاولة الأولى قيّدت السياسة بدورَي anon و authenticated، وظلّت
--  الكتابة مرفوضة: مفتاح التطبيق من النوع الجديد (sb_publishable_)
--  لا يعمل بأيٍّ منهما، فلم تطابقه السياسة. هنا نجعلها لكل الأدوار
--  ونمنح الصلاحية على الجدول صراحةً.
-- ═══════════════════════════════════════════════════════════════

alter table public.push_subscriptions enable row level security;

-- إضافة اشتراك جهاز
drop policy if exists push_insert on public.push_subscriptions;
create policy push_insert on public.push_subscriptions
  for insert to public
  with check (true);

-- تحديث اشتراك موجود (نفس الجهاز يعيد التفعيل)
drop policy if exists push_update on public.push_subscriptions;
create policy push_update on public.push_subscriptions
  for update to public
  using (true) with check (true);

-- الصلاحية على الجدول نفسه: السياسة وحدها لا تكفي إن لم يكن الدور
-- يملك حقّ الكتابة أصلاً.
grant usage on schema public to anon, authenticated;
grant insert, update on public.push_subscriptions to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- القراءة والحذف تبقيان للـ Edge Function عبر service role وحده.

-- ── تنظيف صفوف الفحص ──
delete from public.push_subscriptions where user_name = '__اختبار__';

-- ── تأكيد ──
select policyname as "السياسة", cmd as "العملية",
       coalesce(array_to_string(roles, ', '), 'public') as "الأدوار",
       with_check as "الشرط"
from   pg_policies
where  schemaname = 'public' and tablename = 'push_subscriptions'
order  by cmd;
