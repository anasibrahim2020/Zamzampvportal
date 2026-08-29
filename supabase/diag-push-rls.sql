-- ═══════════════════════════════════════════════════════════════
--  تشخيص كامل لرفض الكتابة على push_subscriptions
--  شغّله في:  Supabase Dashboard > SQL Editor
--
--  الكتابة مرفوضة حتى من مستخدم مسجّل دخول رغم وجود سياسة
--  with check (true). هذا الاستعلام يكشف ما يمنعها فعلاً:
--  سياسة مقيِّدة (restrictive)، أو RLS مفروض، أو صلاحية ناقصة.
-- ═══════════════════════════════════════════════════════════════

SELECT
  '① حالة الجدول' AS "الفحص",
  CASE WHEN c.relrowsecurity THEN 'RLS مفعّل' ELSE 'RLS مطفأ' END
    || ' · ' ||
  CASE WHEN c.relforcerowsecurity THEN 'مفروض على المالك أيضاً' ELSE 'غير مفروض' END
    AS "النتيجة"
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'push_subscriptions'

UNION ALL

SELECT
  '② سياسة: ' || pol.polname,
  CASE pol.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT'
                  WHEN 'w' THEN 'UPDATE' WHEN 'd' THEN 'DELETE' ELSE 'ALL' END
    || ' · ' ||
  CASE WHEN pol.polpermissive THEN 'مسموحة (permissive)'
       ELSE '⚠️ مقيِّدة (restrictive) — تمنع رغم غيرها' END
    || ' · أدوار: ' ||
  coalesce((SELECT string_agg(r.rolname, ', ')
            FROM unnest(pol.polroles) x JOIN pg_roles r ON r.oid = x), 'public')
    || ' · شرط: ' || coalesce(pg_get_expr(pol.polwithcheck, pol.polrelid), pg_get_expr(pol.polqual, pol.polrelid), '—')
FROM pg_policy pol JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'push_subscriptions'

UNION ALL

SELECT
  '③ صلاحية: ' || grantee,
  string_agg(privilege_type, ', ' ORDER BY privilege_type)
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'push_subscriptions'
  AND grantee IN ('anon','authenticated','public')
GROUP BY grantee

UNION ALL

SELECT '④ الدور الحالي', current_user || ' / ' || session_user;
