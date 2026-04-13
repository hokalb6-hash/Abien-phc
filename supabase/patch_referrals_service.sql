-- عمود الخدمة المقدّمة لتحويلات الإسعاف (نفّذ إن كان جدول referrals موجوداً بدون العمود)

alter table public.referrals
  add column if not exists service_provided text;
