-- ترقية: service_date على queues، حد 50 حجز/عيادة/يوم لغدٍ (anon)، ترقيم حسب service_date
-- نفّذ على مشروع Supabase الحالي بعد النسخ الاحتياطي.

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

drop index if exists public.idx_queues_clinic_day;
create index if not exists idx_queues_clinic_service_date on public.queues (clinic_type, service_date);
