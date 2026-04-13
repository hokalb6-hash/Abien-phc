-- إعلانات للمرضى على الموقع العام — نفّذ في SQL Editor إن لم يكن الجدول موجوداً

create table if not exists public.patient_announcements (
  id uuid primary key default uuid_generate_v4(),
  title text,
  message text not null,
  is_active boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create index if not exists idx_patient_announcements_created on public.patient_announcements (created_at desc);

create or replace function public.enforce_single_patient_announcement()
returns trigger
language plpgsql
as $$
begin
  if new.is_active then
    update public.patient_announcements
    set is_active = false, updated_at = now()
    where is_active = true
      and (TG_OP = 'INSERT' or id is distinct from new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists tr_patient_announcements_single_active on public.patient_announcements;
create trigger tr_patient_announcements_single_active
  before insert or update on public.patient_announcements
  for each row
  execute procedure public.enforce_single_patient_announcement();

alter table public.patient_announcements enable row level security;

drop policy if exists "pann_select_active_anon" on public.patient_announcements;
create policy "pann_select_active_anon"
  on public.patient_announcements for select
  to anon
  using (is_active = true);

drop policy if exists "pann_select_active_auth" on public.patient_announcements;
create policy "pann_select_active_auth"
  on public.patient_announcements for select
  to authenticated
  using (is_active = true);

drop policy if exists "pann_select_admin_all" on public.patient_announcements;
create policy "pann_select_admin_all"
  on public.patient_announcements for select
  to authenticated
  using (public.has_role (array['admin']));

drop policy if exists "pann_insert_admin" on public.patient_announcements;
create policy "pann_insert_admin"
  on public.patient_announcements for insert
  to authenticated
  with check (public.has_role (array['admin']));

drop policy if exists "pann_update_admin" on public.patient_announcements;
create policy "pann_update_admin"
  on public.patient_announcements for update
  to authenticated
  using (public.has_role (array['admin']))
  with check (public.has_role (array['admin']));

drop policy if exists "pann_delete_admin" on public.patient_announcements;
create policy "pann_delete_admin"
  on public.patient_announcements for delete
  to authenticated
  using (public.has_role (array['admin']));

alter publication supabase_realtime add table public.patient_announcements;
