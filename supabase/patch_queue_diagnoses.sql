-- تشخيصات متعددة لكل زيارة + سياسات + (اختياري) نسخ من queues.diagnosis_id القديم

create table if not exists public.queue_diagnoses (
  queue_id uuid not null references public.queues (id) on delete cascade,
  diagnosis_id uuid not null references public.diagnoses (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (queue_id, diagnosis_id)
);

create index if not exists idx_queue_diagnoses_queue on public.queue_diagnoses (queue_id);

insert into public.queue_diagnoses (queue_id, diagnosis_id)
select q.id, q.diagnosis_id
from public.queues q
where q.diagnosis_id is not null
on conflict (queue_id, diagnosis_id) do nothing;

alter table public.queue_diagnoses enable row level security;

drop policy if exists "qd_select_auth" on public.queue_diagnoses;
create policy "qd_select_auth"
  on public.queue_diagnoses for select
  to authenticated
  using (public.has_role (array['admin','display','clinic','lab','er','pharmacy','reception']));

drop policy if exists "qd_insert_clinic" on public.queue_diagnoses;
create policy "qd_insert_clinic"
  on public.queue_diagnoses for insert
  to authenticated
  with check (public.has_role (array['admin','clinic']));

drop policy if exists "qd_delete_clinic" on public.queue_diagnoses;
create policy "qd_delete_clinic"
  on public.queue_diagnoses for delete
  to authenticated
  using (public.has_role (array['admin','clinic']));

-- شاشة الدور: عرض اسم المريض
drop policy if exists "auth_select_patients" on public.patients;
create policy "auth_select_patients"
  on public.patients for select
  to authenticated
  using (
    public.has_role (array['admin','clinic','pharmacy','lab','er','reception','display'])
  );

alter publication supabase_realtime add table public.queue_diagnoses;
