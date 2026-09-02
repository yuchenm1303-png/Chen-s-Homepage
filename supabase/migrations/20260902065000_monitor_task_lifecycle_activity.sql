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
        else 'running'
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
      count(*) filter (where c.lifecycle_status = 'ready')::integer as ready,
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
      count(*) filter (where c.lifecycle_status = 'ready')::integer as ready,
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
    'classification', 'whole_product_lifecycle_v1',
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
          'ready', h.ready,
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
          'ready', d.ready,
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
