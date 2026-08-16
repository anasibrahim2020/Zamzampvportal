-- ═══════════════════════════════════════════════════════════════
--  إشعارات Push (Web Push) — جدول اشتراكات الأجهزة
--  شغّل المحتوى ده في:  Supabase Dashboard > SQL Editor
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.push_subscriptions (
  id         bigint generated always as identity primary key,
  user_name  text        not null,            -- نفس اسم المستخدم في البورتال (عربي)
  endpoint   text        not null unique,     -- عنوان الدفع للجهاز (مفتاح التكرار)
  p256dh     text        not null,
  auth       text        not null,
  ua         text,
  created_at timestamptz default now()
);

create index if not exists idx_push_user on public.push_subscriptions (user_name);

-- ── RLS ──
-- الواجهة (anon) تقدر تضيف/تحدّث اشتراكها فقط. القراءة والحذف للإشعارات
-- بتتمّ من Edge Function عبر service role (بيتجاوز RLS تلقائيًا).
alter table public.push_subscriptions enable row level security;

drop policy if exists push_insert on public.push_subscriptions;
create policy push_insert on public.push_subscriptions
  for insert to anon, authenticated with check (true);

drop policy if exists push_update on public.push_subscriptions;
create policy push_update on public.push_subscriptions
  for update to anon, authenticated using (true) with check (true);
