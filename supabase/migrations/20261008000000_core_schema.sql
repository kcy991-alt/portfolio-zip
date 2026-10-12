-- portfolio_zip D2: 핵심 표, 사용자별 접근 제한(RLS), 이미지 저장소
-- spec.md 10.1(저장 모델), 10.3(저장·충돌), 12.2(RLS), 7.5(이미지) 기준.
-- Supabase 대시보드 > SQL Editor에서 한 번만 실행한다. 포트폴리오 제작본 표는 D4에서 별도 마이그레이션으로 만든다.

-- ---------------------------------------------------------------------
-- 1. 표
-- ---------------------------------------------------------------------

-- 사용자당 워크스페이스 1개 (팀 기능 없음)
create table public.workspace (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (id, owner_id)
);

-- 폴더 1단계 (중첩 없음). 이름 1~60자
create table public.folder (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, owner_id),
  -- 같은 소유자의 워크스페이스만 가리킬 수 있다
  foreign key (workspace_id, owner_id) references public.workspace (id, owner_id) on delete cascade
);

-- 프로젝트(경험 원본). 제목 1~80자, 답변은 JSON
create table public.project (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid not null,
  folder_id uuid,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  template_key text not null default 'pm',
  template_version integer not null default 1,
  answers jsonb not null default '{}'::jsonb
    check (jsonb_typeof(answers) = 'object' and pg_column_size(answers) <= 262144),
  record_status text not null default 'draft' check (record_status in ('draft', 'done')),
  revision integer not null default 1,
  last_step integer not null default 1 check (last_step between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, owner_id),
  foreign key (workspace_id, owner_id) references public.workspace (id, owner_id) on delete cascade,
  -- 같은 소유자의 폴더만 가리킬 수 있다. 폴더가 지워지면 미분류(null)로 돌아간다.
  foreign key (folder_id, owner_id) references public.folder (id, owner_id) on delete set null (folder_id)
);

-- 업로드한 이미지(비공개 파일). URL이 아니라 경로만 저장한다.
create table public.asset (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid not null,
  storage_path text not null unique check (storage_path like owner_id::text || '/%'),
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  bytes integer not null check (bytes between 1 and 10485760),
  width integer not null check (width between 1 and 4096),
  height integer not null check (height between 1 and 4096),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, owner_id),
  foreign key (workspace_id, owner_id) references public.workspace (id, owner_id) on delete cascade
);

-- 프로젝트 구역에 붙인 이미지
create table public.project_asset (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null,
  asset_id uuid not null,
  section_key text not null check (char_length(section_key) between 1 and 40),
  caption text not null default '' check (char_length(caption) <= 150),
  alt_text text not null default '' check (char_length(alt_text) <= 150),
  decorative boolean not null default false,
  sort_order integer not null default 0,
  include_in_output boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (project_id, owner_id) references public.project (id, owner_id) on delete cascade,
  foreign key (asset_id, owner_id) references public.asset (id, owner_id) on delete cascade
);

-- 삭제 작업 큐(스토리지·계정 삭제 실패 재시도). 사용자는 읽기만 하고, 쓰기는 서버 전용 키로 한다.
create table public.deletion_job (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  kind text not null check (kind in ('storage_cleanup', 'account')),
  status text not null default 'pending' check (status in ('pending', 'running', 'done', 'failed')),
  retry_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 제품 이벤트. 원문 답변·이미지·연락처는 넣지 않는다 (spec 10.4)
create table public.product_event (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users (id) on delete set null,
  name text not null check (char_length(name) between 1 and 60),
  object_id uuid,
  properties jsonb not null default '{}'::jsonb check (pg_column_size(properties) <= 4096),
  created_at timestamptz not null default now()
);

create index folder_owner_idx on public.folder (owner_id) where deleted_at is null;
create index project_owner_idx on public.project (owner_id, folder_id) where deleted_at is null;
create index asset_owner_idx on public.asset (owner_id) where deleted_at is null;
create index project_asset_project_idx on public.project_asset (project_id, sort_order);
create index deletion_job_owner_idx on public.deletion_job (owner_id);

-- ---------------------------------------------------------------------
-- 2. 자동 처리
-- ---------------------------------------------------------------------

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 프로젝트가 수정될 때마다 revision을 올린다.
-- 앱은 `update ... where id = ? and revision = ?`로 저장하고, 0행이면 충돌(409)로 처리한다 (spec 10.3).
create function public.bump_project_revision() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;

create trigger folder_touch before update on public.folder
  for each row execute function public.touch_updated_at();
create trigger project_bump before update on public.project
  for each row execute function public.bump_project_revision();

-- 새 사용자가 만들어지면 워크스페이스를 자동으로 만든다.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.workspace (owner_id) values (new.id) on conflict (owner_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 이미 로그인해 본 사용자에게도 워크스페이스를 만들어 준다.
insert into public.workspace (owner_id) select id from auth.users on conflict (owner_id) do nothing;

-- ---------------------------------------------------------------------
-- 3. 권한과 RLS: 로그인한 사용자는 자기 행만 다룬다. 로그인하지 않은 사용자(anon)는 아무것도 못 한다.
-- ---------------------------------------------------------------------

revoke all on public.workspace, public.folder, public.project, public.asset,
  public.project_asset, public.deletion_job, public.product_event from anon, authenticated;

grant select on public.workspace to authenticated;
grant select, insert, update, delete on public.folder, public.project, public.asset, public.project_asset to authenticated;
grant select on public.deletion_job to authenticated;
grant insert on public.product_event to authenticated;

alter table public.workspace enable row level security;
alter table public.folder enable row level security;
alter table public.project enable row level security;
alter table public.asset enable row level security;
alter table public.project_asset enable row level security;
alter table public.deletion_job enable row level security;
alter table public.product_event enable row level security;

create policy workspace_select_own on public.workspace
  for select to authenticated using ((select auth.uid()) = owner_id);

create policy deletion_job_select_own on public.deletion_job
  for select to authenticated using ((select auth.uid()) = owner_id);

create policy product_event_insert_own on public.product_event
  for insert to authenticated with check ((select auth.uid()) = owner_id);

do $$
declare
  t text;
begin
  foreach t in array array['folder', 'project', 'asset', 'project_asset'] loop
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = owner_id)', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = owner_id)', t || '_insert_own', t);
    -- 수정할 때는 기존 행의 소유권과 수정 후 소유권을 모두 검사한다 (spec 12.2)
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = owner_id)', t || '_delete_own', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 4. 이미지 저장소: 비공개 버킷, 경로는 `{사용자 id}/{파일}` 형태
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio-assets', 'portfolio-assets', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy portfolio_assets_select_own on storage.objects
  for select to authenticated
  using (bucket_id = 'portfolio-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy portfolio_assets_insert_own on storage.objects
  for insert to authenticated
  with check (bucket_id = 'portfolio-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy portfolio_assets_update_own on storage.objects
  for update to authenticated
  using (bucket_id = 'portfolio-assets' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'portfolio-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy portfolio_assets_delete_own on storage.objects
  for delete to authenticated
  using (bucket_id = 'portfolio-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
