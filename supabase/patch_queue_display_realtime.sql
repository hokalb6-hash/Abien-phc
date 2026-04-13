-- إصلاح شاشة الدور (/display): Realtime + قراءة anon لأدوار اليوم
-- نفّذ الملف كاملاً في SQL Editor (Supabase Dashboard → SQL → New query).
--
-- 1) سياسات RLS لـ anon (بدونها: CHANNEL_ERROR عند الاشتراك وقد لا يظهر اسم المريض)
-- 2) إدراج public.queues في نشر supabase_realtime (بدونها لا تصل أحداث الجدول عبر WebSocket)

-- ----- سياسات العرض لـ anon -----
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

-- ----- نشر Realtime (مرة واحدة؛ يُتخطى إن كان الجدول مضافاً) -----
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'queues'
  ) then
    alter publication supabase_realtime add table public.queues;
  end if;
end $$;
