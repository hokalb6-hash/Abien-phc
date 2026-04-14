-- ============================================================
-- أبين الصحي — مخطط قاعدة البيانات لـ Supabase (PostgreSQL)
-- نفّذ الملف من: Dashboard → SQL Editor → New query → Run
-- بعدها: Authentication → Users → أنشئ مستخدمًا ثم أضف له صفًا في profiles (انظر آخر الملف)
-- ============================================================

create extension if not exists "uuid-ossp";

-- أدوار التطبيق (نص مع قيد)
-- queues.status و referrals.status كذلك

-- -------------------- patients --------------------
create table if not exists public.patients (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  national_id text,
  phone text,
  date_of_birth date,
  gender text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- -------------------- profiles (مرتبط بـ auth.users) --------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role text not null default 'clinic'
    check (role in ('admin', 'reception', 'clinic', 'lab', 'er', 'pharmacy', 'display')),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- -------------------- queues --------------------
create table if not exists public.queues (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid not null references public.patients (id) on delete restrict,
  clinic_type text not null,
  status text not null default 'waiting'
    check (status in ('waiting', 'called', 'in_service', 'completed', 'cancelled', 'no_show')),
  queue_number integer not null default 0,
  /** يوم تقديم الخدمة (توقيت أبين سمعان — Asia/Aden): للمريض anon يُفرض غداً؛ للموظف الافتراضي اليوم */
  service_date date not null default ((timezone('Asia/Aden', now()))::date),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ترحيل للقواعد التي أُنشئت قبل service_date
alter table public.queues add column if not exists service_date date;
update public.queues
set service_date = coalesce(
  service_date,
  (timezone('Asia/Aden', created_at))::date
);
alter table public.queues
  alter column service_date set default ((timezone('Asia/Aden', now()))::date);
alter table public.queues
  alter column service_date set not null;

-- ترقيم حسب clinic_type + service_date؛ anon: تاريخ الخدمة = غدٍ (توقيت أبين سمعان)، حد أقصى 50/عيادة/يوم
create or replace function public.assign_queue_number_daily()
returns trigger
language plpgsql
as $$
declare
  next_n integer;
  today_d date;
  tomorrow_d date;
  booked_tomorrow int;
  cap_daily int := 50;
begin
  if new.queue_number is not null and new.queue_number > 0 then
    return new;
  end if;

  today_d := (timezone('Asia/Aden', now()))::date;
  tomorrow_d := today_d + 1;

  if auth.role() = 'anon' then
    new.service_date := tomorrow_d;
    select count(*)::int
    into booked_tomorrow
    from public.queues q
    where q.clinic_type = new.clinic_type
      and q.service_date = tomorrow_d;
    if booked_tomorrow >= cap_daily then
      raise exception
        'تم بلوغ الحد الأقصى (50) لحجوزات غدٍ لهذه العيادة. جرّب عيادة أخرى أو حاول لاحقاً.'
        using errcode = '23514';
    end if;
  else
    if new.service_date is null then
      new.service_date := today_d;
    end if;
  end if;

  select coalesce(max(q.queue_number), 0) + 1
  into next_n
  from public.queues q
  where q.clinic_type = new.clinic_type
    and q.service_date = new.service_date;

  new.queue_number := next_n;
  return new;
end;
$$;

drop trigger if exists tr_queues_assign_number on public.queues;
create trigger tr_queues_assign_number
  before insert on public.queues
  for each row
  execute procedure public.assign_queue_number_daily();

-- دالة اختيارية لـ RPC (التطبيق الحالي يعتمد على التريغر)
create or replace function public.assign_queue_number(p_clinic_type text default null)
returns integer
language plpgsql
as $$
declare
  next_n integer;
  day_start date;
  ct text;
begin
  ct := coalesce(p_clinic_type, 'internal');
  day_start := (timezone('Asia/Aden', now()))::date;
  select coalesce(max(q.queue_number), 0) + 1
  into next_n
  from public.queues q
  where q.clinic_type = ct
    and q.service_date = day_start;
  return next_n;
end;
$$;

create or replace function public.today_aden()
returns date
language sql
stable
as $$
  select (timezone('Asia/Aden', now()))::date;
$$;

create or replace function public.tomorrow_aden()
returns date
language sql
stable
as $$
  select (timezone('Asia/Aden', now()))::date + 1;
$$;

/** للواجهة: هل يمكن للمريض الحجز لغدٍ لهذه العيادة (حد 50) */
create or replace function public.can_book_clinic_tomorrow(p_clinic_type text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d date;
  c int;
  cap int := 50;
begin
  d := public.tomorrow_aden();
  select count(*)::int into c
  from public.queues q
  where q.clinic_type = p_clinic_type
    and q.service_date = d;
  return jsonb_build_object(
    'allowed', c < cap,
    'booked', c,
    'cap', cap,
    'remaining', greatest(0, cap - c),
    'service_date', d
  );
end;
$$;

grant execute on function public.today_aden() to anon, authenticated, service_role;
grant execute on function public.tomorrow_aden() to anon, authenticated, service_role;
grant execute on function public.can_book_clinic_tomorrow(text) to anon, authenticated, service_role;

-- -------------------- diagnoses --------------------
create table if not exists public.diagnoses (
  id uuid primary key default uuid_generate_v4(),
  code text,
  name_ar text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- -------------------- medications --------------------
create table if not exists public.medications (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  form text,
  unit text,
  default_dosage text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- ربط الدور بالتشخيص (بعد إنشاء diagnoses)
alter table public.queues
  add column if not exists diagnosis_id uuid references public.diagnoses (id) on delete set null;

create index if not exists idx_queues_diagnosis on public.queues (diagnosis_id);

-- -------------------- prescriptions --------------------
create table if not exists public.prescriptions (
  id uuid primary key default uuid_generate_v4(),
  queue_id uuid not null references public.queues (id) on delete cascade,
  medication_id uuid not null references public.medications (id) on delete restrict,
  dosage text not null,
  frequency text not null,
  duration text not null,
  dispensed boolean not null default false,
  dispensed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- -------------------- referrals --------------------
create table if not exists public.referrals (
  id uuid primary key default uuid_generate_v4(),
  queue_id uuid not null references public.queues (id) on delete cascade,
  department text not null,
  from_department text,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'no_show')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- خدمة مقدّمة في الطوارئ (يُعبأ من واجهة الإسعاف عند الإكمال؛ المخبر يتركه فارغاً)
alter table public.referrals
  add column if not exists service_provided text;

-- تحاليل المخبر: طلب من العيادة + نتائج نصية من المخبر عند الإكمال
alter table public.referrals
  add column if not exists requested_lab_tests jsonb not null default '[]'::jsonb;

alter table public.referrals
  add column if not exists lab_results text;

-- -------------------- queue_diagnoses (عدة تشخيصات لنفس زيارة الدور) --------------------
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

-- -------------------- audit_logs --------------------
create table if not exists public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users (id) on delete set null,
  action text not null,
  table_name text,
  record_id uuid,
  payload jsonb,
  created_at timestamptz not null default now()
);

-- -------------------- patient_announcements (إعلان للمرضى على الصفحة العامة) --------------------
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

-- إعلان واحد مفعّل في كل وقت: عند تفعيل صف جديد يُلغى تفعيل الباقي
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

-- فهرسات بسيطة
create index if not exists idx_queues_created on public.queues (created_at desc);
drop index if exists public.idx_queues_clinic_day;
create index if not exists idx_queues_clinic_service_date on public.queues (clinic_type, service_date);
create index if not exists idx_prescriptions_queue on public.prescriptions (queue_id);
create index if not exists idx_referrals_dept on public.referrals (department, status);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.patients enable row level security;
alter table public.profiles enable row level security;
alter table public.queues enable row level security;
alter table public.diagnoses enable row level security;
alter table public.medications enable row level security;
alter table public.prescriptions enable row level security;
alter table public.referrals enable row level security;
alter table public.queue_diagnoses enable row level security;
alter table public.patient_announcements enable row level security;
alter table public.audit_logs enable row level security;

-- مساعد: هل المستخدم له دور معيّن؟
create or replace function public.has_role(any_of text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = any (any_of)
  );
$$;

-- ----- anon: حجز المريض من المنزل (بدون تسجيل دخول) -----
drop policy if exists "anon_insert_patients" on public.patients;
create policy "anon_insert_patients"
  on public.patients for insert
  to anon
  with check (true);

drop policy if exists "auth_insert_patients_staff" on public.patients;
create policy "auth_insert_patients_staff"
  on public.patients for insert
  to authenticated
  with check (public.has_role (array['admin','clinic','er']));

drop policy if exists "anon_insert_queues" on public.queues;
create policy "anon_insert_queues"
  on public.queues for insert
  to anon
  with check (
    exists (select 1 from public.patients pt where pt.id = patient_id)
  );

drop policy if exists "auth_insert_queues_staff" on public.queues;
create policy "auth_insert_queues_staff"
  on public.queues for insert
  to authenticated
  with check (
    public.has_role (array['admin','clinic','reception'])
    and exists (select 1 from public.patients pt where pt.id = patient_id)
  );

-- زيارة مباشرة للإسعاف (بدون تحويل من العيادة): دور بنوع clinic_type = er فقط
drop policy if exists "auth_insert_queues_er_direct" on public.queues;
create policy "auth_insert_queues_er_direct"
  on public.queues for insert
  to authenticated
  with check (
    public.has_role (array['admin','er'])
    and clinic_type = 'er'
    and exists (select 1 from public.patients pt where pt.id = patient_id)
  );

-- ----- authenticated: قراءة الدور وشاشة العرض -----
drop policy if exists "auth_select_queues" on public.queues;
create policy "auth_select_queues"
  on public.queues for select
  to authenticated
  using (
    public.has_role (array['admin','display','clinic','lab','er','pharmacy','reception'])
  );

drop policy if exists "auth_update_queues_staff" on public.queues;
create policy "auth_update_queues_staff"
  on public.queues for update
  to authenticated
  using (public.has_role (array['admin','clinic','reception']))
  with check (public.has_role (array['admin','clinic','reception']));

/** الصيدلية: تعليم «لم يأتِ» أو إرجاع الحالة لصف مرتبط بوصفات */
drop policy if exists "auth_update_queues_pharmacy_attendance" on public.queues;
create policy "auth_update_queues_pharmacy_attendance"
  on public.queues for update
  to authenticated
  using (
    public.has_role (array['admin','pharmacy'])
    and exists (select 1 from public.prescriptions pr where pr.queue_id = queues.id)
  )
  with check (
    public.has_role (array['admin','pharmacy'])
    and exists (select 1 from public.prescriptions pr where pr.queue_id = queues.id)
  );

-- مرضى: للطاقم
drop policy if exists "auth_select_patients" on public.patients;
create policy "auth_select_patients"
  on public.patients for select
  to authenticated
  using (
    public.has_role (array['admin','clinic','pharmacy','lab','er','reception','display'])
  );

/** تحديث بيانات المريض من العيادة أو الاستقبال أو الإدارة (تصحيح الاسم بعد الحجز، إلخ) */
drop policy if exists "auth_update_patients_staff" on public.patients;
create policy "auth_update_patients_staff"
  on public.patients for update
  to authenticated
  using (public.has_role (array['admin','clinic','reception']))
  with check (public.has_role (array['admin','clinic','reception']));

-- شاشة الدور العامة بدون تسجيل دخول: anon يقرأ فقط أدوار «يوم الخدمة الحالي» (توقيت Asia/Aden) والحالات النشطة؛ وإلا يفشل Realtime ولا يُجلب الاسم من patients
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

-- profiles: كل مستخدم يرى صفه فقط
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists "profiles_admin_all" on public.profiles;
create policy "profiles_admin_all"
  on public.profiles for all
  to authenticated
  using (public.has_role (array['admin']))
  with check (public.has_role (array['admin']));

-- تشخيصات وأدوية: قراءة للطاقم، كتابة للإدارة (بسيط)
drop policy if exists "diag_select_auth" on public.diagnoses;
create policy "diag_select_auth"
  on public.diagnoses for select
  to authenticated
  using (public.has_role (array['admin','clinic']));

drop policy if exists "diag_write_admin" on public.diagnoses;
create policy "diag_write_admin"
  on public.diagnoses for insert
  to authenticated
  with check (public.has_role (array['admin']));
drop policy if exists "diag_update_admin" on public.diagnoses;
create policy "diag_update_admin"
  on public.diagnoses for update
  to authenticated
  using (public.has_role (array['admin']));

drop policy if exists "med_select_auth" on public.medications;
create policy "med_select_auth"
  on public.medications for select
  to authenticated
  using (public.has_role (array['admin','clinic','pharmacy']));

drop policy if exists "med_write_admin" on public.medications;
create policy "med_write_admin"
  on public.medications for insert
  to authenticated
  with check (public.has_role (array['admin']));

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

drop policy if exists "diag_delete_admin" on public.diagnoses;
create policy "diag_delete_admin"
  on public.diagnoses for delete
  to authenticated
  using (public.has_role (array['admin']));

-- تشخيصات مرتبطة بالدور (عدة صفوف لكل زيارة)
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

-- وصفات وتحويلات: للطاقم المعني (مبسّط — يمكن تشديده لاحقاً)
drop policy if exists "rx_select_auth" on public.prescriptions;
create policy "rx_select_auth"
  on public.prescriptions for select
  to authenticated
  using (public.has_role (array['admin','clinic','pharmacy']));

drop policy if exists "rx_write_clinic" on public.prescriptions;
create policy "rx_write_clinic"
  on public.prescriptions for insert
  to authenticated
  with check (public.has_role (array['admin','clinic']));

drop policy if exists "rx_update_pharmacy" on public.prescriptions;
create policy "rx_update_pharmacy"
  on public.prescriptions for update
  to authenticated
  using (public.has_role (array['admin','pharmacy']));

drop policy if exists "ref_select_auth" on public.referrals;
create policy "ref_select_auth"
  on public.referrals for select
  to authenticated
  using (public.has_role (array['admin','clinic','lab','er']));

drop policy if exists "ref_write_clinic" on public.referrals;
create policy "ref_write_clinic"
  on public.referrals for insert
  to authenticated
  with check (public.has_role (array['admin','clinic']));

drop policy if exists "ref_insert_er_direct" on public.referrals;
create policy "ref_insert_er_direct"
  on public.referrals for insert
  to authenticated
  with check (
    public.has_role (array['admin','er'])
    and department = 'er'
  );

drop policy if exists "ref_update_lab_er" on public.referrals;
create policy "ref_update_lab_er"
  on public.referrals for update
  to authenticated
  using (public.has_role (array['admin','lab','er']));

drop policy if exists "audit_select_admin" on public.audit_logs;
create policy "audit_select_admin"
  on public.audit_logs for select
  to authenticated
  using (public.has_role (array['admin']));

-- إعلانات المرضى (الزائر anon + الموظفون يرون النشط فقط؛ الأدمن يدير الكل)
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

-- إدراج profiles عند أول تسجيل (دور افتراضي clinic — غيّره من لوحة الإدارة لاحقاً)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'clinic'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();

-- ============================================================
-- Realtime: تفعيل الجداول المطلوبة
-- ============================================================
alter publication supabase_realtime add table public.queues;
alter publication supabase_realtime add table public.referrals;
alter publication supabase_realtime add table public.prescriptions;
alter publication supabase_realtime add table public.queue_diagnoses;
alter publication supabase_realtime add table public.patient_announcements;

-- إن ظهر خطأ "already member" تجاهل السطر المعني

-- ============================================================
-- بعد التشغيل: أدمن أساسي
-- نفّذ الملف: supabase/seed_admin.sql (بعد إنشاء المستخدم من Authentication → Users)
-- ============================================================
