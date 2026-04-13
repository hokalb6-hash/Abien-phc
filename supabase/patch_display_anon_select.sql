-- شاشة الدور (/display): سياسات anon فقط (نسخة مختصرة).
-- يُفضَّل تنفيذ الملف الموحّد: supabase/patch_queue_display_realtime.sql
-- (يشمل السياسات + إدراج الجدول في نشر supabase_realtime تلقائياً).

drop policy if exists "anon_select_queues_display" on public.queues;
create policy "anon_select_queues_display"
  on public.queues for select
  to anon
  using (
    service_date = (timezone('Asia/Aden', now()))::date
    and status in ('waiting', 'called', 'in_service')
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
        and q.status in ('waiting', 'called', 'in_service')
    )
  );
