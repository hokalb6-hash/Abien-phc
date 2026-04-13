-- زيارة مباشرة لقسم الإسعاف: إضافة مريض + دور (clinic_type=er) + تحويل er من الواجهة دون المرور بالعيادة
-- نفّذ في SQL Editor لمشروع Supabase.

drop policy if exists "auth_insert_patients_staff" on public.patients;
create policy "auth_insert_patients_staff"
  on public.patients for insert
  to authenticated
  with check (public.has_role (array['admin','clinic','er']));

drop policy if exists "auth_insert_queues_er_direct" on public.queues;
create policy "auth_insert_queues_er_direct"
  on public.queues for insert
  to authenticated
  with check (
    public.has_role (array['admin','er'])
    and clinic_type = 'er'
    and exists (select 1 from public.patients pt where pt.id = patient_id)
  );

drop policy if exists "ref_insert_er_direct" on public.referrals;
create policy "ref_insert_er_direct"
  on public.referrals for insert
  to authenticated
  with check (
    public.has_role (array['admin','er'])
    and department = 'er'
  );
