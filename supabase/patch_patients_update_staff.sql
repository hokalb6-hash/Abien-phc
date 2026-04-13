-- تحديث بيانات المريض من العيادة / الاستقبال / الإدارة
-- نفّذ من SQL Editor إذا كان المخطط لديك قديماً ولا يتضمّن سياسة التحديث.

drop policy if exists "auth_update_patients_staff" on public.patients;
create policy "auth_update_patients_staff"
  on public.patients for update
  to authenticated
  using (public.has_role (array['admin','clinic','reception']))
  with check (public.has_role (array['admin','clinic','reception']));
