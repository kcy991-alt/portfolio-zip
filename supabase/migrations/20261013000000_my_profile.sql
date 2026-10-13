-- 마이페이지 프로필: 사용자당 1개. 소개·교육·경력·자격증·도구를 한 번 저장해 두고 포트폴리오에서 불러와 쓴다.
-- 불러오면 제작본(portfolio.profile)으로 복사되며, 이후 두 쪽은 서로 영향을 주지 않는다 (spec 5.3과 같은 원칙).
-- Supabase 대시보드 > SQL Editor에서 한 번 실행한다. 실행 뒤 supabase/tests/rls-isolation-my-profile.sql로 격리를 확인한다.

create table public.my_profile (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  profile jsonb not null default '{}'::jsonb,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 수정할 때마다 revision을 올린다 (core_schema.sql의 bump_project_revision을 그대로 쓴다)
create trigger my_profile_bump before update on public.my_profile
  for each row execute function public.bump_project_revision();

revoke all on public.my_profile from anon, authenticated;
grant select, insert, update on public.my_profile to authenticated;

alter table public.my_profile enable row level security;

create policy my_profile_select_own on public.my_profile
  for select to authenticated using ((select auth.uid()) = owner_id);
create policy my_profile_insert_own on public.my_profile
  for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy my_profile_update_own on public.my_profile
  for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
