-- نفّذ بعد schema.sql إن كان المشروع يعمل مسبقاً (أو أدمج في نسخة جديدة من schema)
-- ربط التشخيص بالدور + صلاحيات إدارة الأدوية والتشخيصات

alter table public.queues
  add column if not exists diagnosis_id uuid references public.diagnoses (id) on delete set null;

create index if not exists idx_queues_diagnosis on public.queues (diagnosis_id);

-- أدوية: تعديل وحذف للإدارة
drop policy if exists "med_update_admin" on public.medications;
create policy "med_update_admin"
  on public.medications for update
  to authenticated
  using (public.has_role (array['admin']))
  with check (public.has_role (array['admin']));

drop policy if exists "med_delete_admin" on public.medications;
create policy "med_delete_admin"
  on public.medications for delete
  to authenticated
  using (public.has_role (array['admin']));

-- تشخيصات: حذف للإدارة
drop policy if exists "diag_delete_admin" on public.diagnoses;
create policy "diag_delete_admin"
  on public.diagnoses for delete
  to authenticated
  using (public.has_role (array['admin']));
