-- D6: 요청 제한(spec 14장: 업로드 분당 10회, 일반 쓰기 분당 120회)과 업로드 중복 방지(spec 11장 client operation ID)

-- 1. 요청 제한: 계정·종류별로 1분 단위 칸에 횟수를 센다.
create table public.rate_limit_hit (
  owner_id uuid not null references auth.users (id) on delete cascade,
  bucket text not null check (bucket in ('write', 'upload')),
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (owner_id, bucket, window_start)
);
alter table public.rate_limit_hit enable row level security;
revoke all on public.rate_limit_hit from anon, authenticated;

-- 호출한 사용자의 횟수만 올린다(auth.uid()). 한도를 넘으면 allowed=false와 다시 시도할 수 있을 때까지 남은 초를 돌려준다.
create function public.take_rate_limit(p_bucket text, p_limit integer)
returns table (allowed boolean, retry_after integer)
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  win timestamptz := date_trunc('minute', now());
  n integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_bucket not in ('write', 'upload') or p_limit < 1 then
    raise exception 'invalid arguments' using errcode = '22023';
  end if;

  insert into public.rate_limit_hit as r (owner_id, bucket, window_start, hits)
  values (uid, p_bucket, win, 1)
  on conflict (owner_id, bucket, window_start) do update set hits = r.hits + 1
  returning r.hits into n;

  -- 가끔 오래된 칸을 치운다
  if random() < 0.02 then
    delete from public.rate_limit_hit where window_start < now() - interval '1 hour';
  end if;

  allowed := n <= p_limit;
  retry_after := case when n <= p_limit then 0 else greatest(1, ceil(extract(epoch from (win + interval '1 minute' - now())))::integer) end;
  return next;
end;
$$;
revoke all on function public.take_rate_limit(text, integer) from public, anon;
grant execute on function public.take_rate_limit(text, integer) to authenticated;

-- 2. 업로드 중복 방지: 같은 작업 번호로 다시 오면 새로 만들지 않고 처음 결과를 돌려준다.
create table public.client_operation (
  owner_id uuid not null references auth.users (id) on delete cascade,
  operation_id uuid not null,
  result jsonb,
  created_at timestamptz not null default now(),
  primary key (owner_id, operation_id)
);
alter table public.client_operation enable row level security;
revoke all on public.client_operation from anon, authenticated;
grant select, insert, update, delete on public.client_operation to authenticated;
create policy client_operation_own on public.client_operation
  for all to authenticated
  using ((select auth.uid()) = owner_id)
  with check ((select auth.uid()) = owner_id);
