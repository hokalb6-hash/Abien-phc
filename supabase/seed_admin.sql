-- ============================================================
-- أبين الصحي — ترقية مستخدم إلى أدمن أساسي
-- نفّذ من: Supabase → SQL Editor → New query
-- ============================================================
--
-- لماذا لا نضع كلمة المرور من SQL؟
-- جدول auth.users يستخدم تشفيراً خاصاً بـ Supabase؛ الطريقة الموثوقة هي إنشاء المستخدم من اللوحة.
--
-- ── الخطوة 1 ──
-- Authentication → Users → Add user → Create new user
--   • Email:    admin@abien-phc.local  (أو أي بريد تختاره)
--   • Password: mohammed19940  ← استخدمها عند إنشاء المستخدم في اللوحة (تسجيل الدخول في التطبيق)
--   • فعّل «Auto Confirm User» إن وُجدت، أو عطّل «Confirm email» من Email Provider للتجربة
--
-- تحذير أمني: لا ترفع هذا الملف لمستودع عام؛ غيّر كلمة المرور في الإنتاج من لوحة Supabase أو من التطبيق.
--
-- ── الخطوة 2 ──
-- إن غيّرت البريد عن admin@abien-phc.local استبدله في الاستعلامين أدناه (موضعين).
-- ثم نفّذ الملف كاملاً.
-- ============================================================

insert into public.profiles (id, full_name, role)
select
  u.id,
  'مدير النظام',
  'admin'
from auth.users u
where lower(u.email) = lower('admin@abien-phc.local')
on conflict (id) do update
set
  role = 'admin',
  full_name = coalesce(public.profiles.full_name, excluded.full_name);

-- تحقق: يجب أن يظهر role = admin
select
  u.email,
  u.created_at as user_created_at,
  p.full_name,
  p.role
from auth.users u
left join public.profiles p on p.id = u.id
where lower(u.email) = lower('admin@abien-phc.local');

-- ============================================================
-- بديل: جعل أول مستخدم مُنشأ في المشروع أدمناً
-- (استخدمه فقط إن لم تُنشئ المستخدم بالبريد أعلاه؛ يمكن أن يغيّر دور مستخدم خاطئ)
-- ============================================================
/*
update public.profiles p
set
  role = 'admin',
  full_name = coalesce(p.full_name, 'مدير النظام')
where p.id = (
  select id from auth.users order by created_at asc limit 1
);

select u.email, p.role from auth.users u
join public.profiles p on p.id = u.id
order by u.created_at asc limit 1;
*/
