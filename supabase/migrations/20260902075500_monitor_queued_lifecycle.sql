alter table public.listing_task_audits
  drop constraint if exists listing_task_audits_status;

alter table public.listing_task_audits
  add constraint listing_task_audits_status
  check (status = any (array[
    'running'::text,
    'queued'::text,
    'completed'::text,
    'failed'::text,
    'cancelled'::text,
    'review'::text,
    'ready'::text,
    'waiting'::text
  ]));

drop trigger if exists listing_task_audits_normalize_waiting on public.listing_task_audits;
drop trigger if exists listing_task_audits_normalize_lifecycle on public.listing_task_audits;
drop function if exists public.normalize_listing_task_audit_waiting_status();

create or replace function public.normalize_listing_task_audit_lifecycle_status()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_job_status text := upper(coalesce(new.result_data ->> 'job_status', ''));
begin
  if lower(coalesce(new.status, '')) = 'running' then
    if v_job_status = 'WAITING_SOURCE_INTERACTION' then
      new.status := 'waiting';
      new.completed_at := null;
    elsif v_job_status = 'QUEUED' then
      new.status := 'queued';
      new.completed_at := null;
    end if;
  end if;
  return new;
end;
$function$;

create trigger listing_task_audits_normalize_lifecycle
before insert or update on public.listing_task_audits
for each row
execute function public.normalize_listing_task_audit_lifecycle_status();

update public.listing_task_audits
set status = 'queued',
    completed_at = null
where lower(coalesce(status, '')) = 'running'
  and completed_at is null
  and upper(coalesce(result_data ->> 'job_status', '')) = 'QUEUED';

create or replace function public.get_listing_task_lifecycle_activity_v1(
  p_view text default 'admin',
  p_hours integer default 168,
  p_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_caller uuid := auth.uid();
  v_view text := lower(coalesce(nullif(trim(p_view), ''), 'admin'));
  v_hours integer := least(greatest(coalesce(p_hours, 168), 1), 168);
  v_days integer := least(greatest(coalesce(p_days, 30), 1), 30);
  v_hour_start timestamptz := date_trunc('hour', now()) - ((least(greatest(coalesce(p_hours, 168), 1), 168) - 1) * interval '1 hour');
  v_day_start timestamptz := (((now() at time zone 'Asia/Shanghai')::date - (least(greatest(coalesce(p_days, 30), 1), 30) - 1))::timestamp at time zone 'Asia/Shanghai');
  v_event_start timestamptz;
  v_payload jsonb;
begin
  if v_caller is null then
    raise exception 'invalid_auth' using errcode = '42501';
  end if;

  if v_view = 'admin' then
    if not exists (
      select 1
      from public.download_portal_users p
      where p.user_id = v_caller
        and p.enabled = true
        and p.is_admin = true
    ) then
      raise exception 'not_authorized' using errcode = '42501';
    end if;
  elsif v_view = 'tenant' then
    if not exists (
      select 1
      from public.get_listing_monitor_scope(v_caller)
      limit 1
    ) then
      raise exception 'not_authorized' using errcode = '42501';
    end if;
  else
    raise exception 'invalid_view' using errcode = '22023';
  end if;

  v_event_start := least(v_hour_start, v_day_start);

  with visible_users as (
    select
      p.user_id,
      u.email,
      coalesce(nullif(p.display_name, ''), u.email, '') as display_name
    from public.download_portal_users p
    join auth.users u on u.id = p.user_id
    where v_view = 'admin'
       or (
         v_view = 'tenant'
         and exists (
           select 1
           from public.get_listing_monitor_scope(v_caller) s
           where s.user_id = p.user_id
         )
       )
  ),
  classified as (
    select
      a.user_id,
      coalesce(a.completed_at, a.updated_at, a.created_at) as event_at,
      case
        when lower(coalesce(a.status, '')) = 'failed' then 'failed'
        when lower(coalesce(a.status, '')) = 'cancelled' then 'cancelled'
        when coalesce(a.review_required, false)
          or lower(coalesce(a.status, '')) = 'review' then 'review'
        when lower(coalesce(a.status, '')) = 'completed'
          and lower(coalesce(a.phase, '')) like '%\_execute' escape '\' then 'completed'
        when lower(coalesce(a.status, '')) = 'ready'
          or (
            lower(coalesce(a.status, '')) = 'completed'
            and lower(coalesce(a.phase, '')) like '%\_prepare' escape '\'
          ) then 'ready'
        when lower(coalesce(a.status, '')) = 'queued'
          or upper(coalesce(a.result_data ->> 'job_status', '')) = 'QUEUED' then 'queued'
        when lower(coalesce(a.status, '')) = 'waiting'
          or upper(coalesce(a.result_data ->> 'job_status', '')) = 'WAITING_SOURCE_INTERACTION' then 'waiting'
        when lower(coalesce(a.status, '')) = 'running'
          and coalesce(a.updated_at, a.created_at) < now() - interval '60 minutes' then 'stale'
        when lower(coalesce(a.status, '')) = 'running' then 'running'
        else 'stale'
      end as lifecycle_status
    from public.listing_task_audits a
    join visible_users v on v.user_id = a.user_id
    where coalesce(a.completed_at, a.updated_at, a.created_at) >= v_event_start
  ),
  hourly as (
    select
      c.user_id,
      date_trunc('hour', c.event_at) as bucket_start,
      count(*) filter (where c.lifecycle_status = 'completed')::integer as completed,
      count(*) filter (where c.lifecycle_status = 'running')::integer as running,
      count(*) filter (where c.lifecycle_status = 'queued')::integer as queued,
      count(*) filter (where c.lifecycle_status = 'ready')::integer as ready,
      count(*) filter (where c.lifecycle_status = 'waiting')::integer as waiting,
      count(*) filter (where c.lifecycle_status = 'stale')::integer as stale,
      count(*) filter (where c.lifecycle_status = 'cancelled')::integer as cancelled,
      count(*) filter (where c.lifecycle_status = 'failed')::integer as failed,
      count(*) filter (where c.lifecycle_status = 'review')::integer as review
    from classified c
    where c.event_at >= v_hour_start
    group by c.user_id, date_trunc('hour', c.event_at)
  ),
  daily as (
    select
      c.user_id,
      (c.event_at at time zone 'Asia/Shanghai')::date as activity_date,
      count(*) filter (where c.lifecycle_status = 'completed')::integer as completed,
      count(*) filter (where c.lifecycle_status = 'running')::integer as running,
      count(*) filter (where c.lifecycle_status = 'queued')::integer as queued,
      count(*) filter (where c.lifecycle_status = 'ready')::integer as ready,
      count(*) filter (where c.lifecycle_status = 'waiting')::integer as waiting,
      count(*) filter (where c.lifecycle_status = 'stale')::integer as stale,
      count(*) filter (where c.lifecycle_status = 'cancelled')::integer as cancelled,
      count(*) filter (where c.lifecycle_status = 'failed')::integer as failed,
      count(*) filter (where c.lifecycle_status = 'review')::integer as review
    from classified c
    where c.event_at >= v_day_start
    group by c.user_id, (c.event_at at time zone 'Asia/Shanghai')::date
  )
  select jsonb_build_object(
    'generated_at', now(),
    'timezone', 'Asia/Shanghai',
    'hours', v_hours,
    'days', v_days,
    'classification', 'whole_product_lifecycle_v3',
    'fresh_running_minutes', 60,
    'users', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'user_id', v.user_id,
          'email', v.email,
          'display_name', v.display_name
        ) order by v.email
      )
      from visible_users v
    ), '[]'::jsonb),
    'hourly', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'user_id', h.user_id,
          'bucket_start', h.bucket_start,
          'completed', h.completed,
          'running', h.running,
          'queued', h.queued,
          'ready', h.ready,
          'waiting', h.waiting,
          'stale', h.stale,
          'cancelled', h.cancelled,
          'failed', h.failed,
          'review', h.review
        ) order by h.bucket_start, h.user_id
      )
      from hourly h
    ), '[]'::jsonb),
    'daily', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'user_id', d.user_id,
          'activity_date', to_char(d.activity_date, 'YYYY-MM-DD'),
          'completed', d.completed,
          'running', d.running,
          'queued', d.queued,
          'ready', d.ready,
          'waiting', d.waiting,
          'stale', d.stale,
          'cancelled', d.cancelled,
          'failed', d.failed,
          'review', d.review
        ) order by d.activity_date, d.user_id
      )
      from daily d
    ), '[]'::jsonb)
  ) into v_payload;

  return v_payload;
end;
$function$;

revoke all on function public.get_listing_task_lifecycle_activity_v1(text, integer, integer) from public;
grant execute on function public.get_listing_task_lifecycle_activity_v1(text, integer, integer) to authenticated;
