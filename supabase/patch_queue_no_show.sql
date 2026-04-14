-- تخطي المريض «لم يأتِ»: حالة no_show للدور + للتحويل؛ سياسات العرض والصيدلية
-- نفّذ في SQL Editor بعد النسخ الاحتياطي. إن فشل DROP CONSTRAINT لاسم مختلف، راجع:
--   SELECT conname FROM pg_constraint WHERE conrelid = 'public.queues'::regclass;

-- ----- queues.status -----
alter table public.queues drop constraint if exists queues_status_check;
alter table public.queues
  add constraint queues_status_check
  check (status in ('waiting', 'called', 'in_service', 'completed', 'cancelled', 'no_show'));

-- ----- referrals.status -----
alter table public.referrals drop constraint if exists referrals_status_check;
alter table public.referrals
  add constraint referrals_status_check
  check (status in ('pending', 'in_progress', 'completed', 'no_show'));

-- ----- anon شاشة الدور: قراءة no_show لاكتشاف الانتقال + إخفاء الاسم عبر عدم الجلب في الواجهة -----
drop policy if exists "anon_select_queues_display" on public.queues;
create policy "anon_select_queues_display"
  on public.queues for select
  to anon
  using (
    service_date = (timezone('Asia/Aden', now()))::date
    and status in ('waiting', 'called', 'in_service', 'no_show')
  );

drop policy if exists "anon_select_patients_display_queue" on public.patients;
create policy "anon_select_patients_display_queue"
  on public.patients for select
  to anon
  using (
    exists (
      select 1 from public.queues q
      where q.patient_id = patients.id
        and q.service_date = (timezone('Asia/Aden', now()))::date
        and q.status in ('waiting', 'called', 'in_service', 'no_show')
    )
  );

-- ----- الصيدلية: تحديث حالة الدور لصف له وصفات -----
drop policy if exists "auth_update_queues_pharmacy_attendance" on public.queues;
create policy "auth_update_queues_pharmacy_attendance"
  on public.queues for update
  to authenticated
  using (
    public.has_role(array['admin', 'pharmacy'])
    and exists (select 1 from public.prescriptions pr where pr.queue_id = queues.id)
  )
  with check (
    public.has_role(array['admin', 'pharmacy'])
    and exists (select 1 from public.prescriptions pr where pr.queue_id = queues.id)
  );
