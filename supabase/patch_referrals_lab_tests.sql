-- تحاليل المخبر المطلوبة من العيادة + نص النتائج عند الإكمال من المخبر
-- نفّذ في SQL Editor (مشروع قائم).

alter table public.referrals
  add column if not exists requested_lab_tests jsonb not null default '[]'::jsonb;

alter table public.referrals
  add column if not exists lab_results text;

comment on column public.referrals.requested_lab_tests is 'مصفوفة JSON لأسماء التحاليل المطلوبة (نصوص) من العيادة';
comment on column public.referrals.lab_results is 'ملخص/نص النتائج يُدخله المخبر عند الإكمال';
