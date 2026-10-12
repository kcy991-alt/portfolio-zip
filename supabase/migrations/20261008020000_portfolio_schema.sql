-- portfolio_zip D4: 포트폴리오 제작본(원본과 독립된 사본), 표지·Summary·프로필, 페이지 구성
-- spec.md 5.3(저장 원칙), 8.3, 9장, 10.1~10.2 기준.
-- Supabase 대시보드 > SQL Editor에서 한 번만 실행한다. (core_schema.sql 뒤에 실행)

-- ---------------------------------------------------------------------
-- 1. 표
-- ---------------------------------------------------------------------

-- 제작본: 지원 목적별로 만드는 포트폴리오. 표지·Summary·프로필은 제작본마다 따로 저장한다.
create table public.portfolio (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  workspace_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  cover jsonb not null default '{}'::jsonb check (jsonb_typeof(cover) = 'object' and pg_column_size(cover) <= 16384),
  summary jsonb not null default '{}'::jsonb check (jsonb_typeof(summary) = 'object' and pg_column_size(summary) <= 32768),
  profile jsonb not null default '{}'::jsonb check (jsonb_typeof(profile) = 'object' and pg_column_size(profile) <= 65536),
  template_version integer not null default 1,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (id, owner_id),
  foreign key (workspace_id, owner_id) references public.workspace (id, owner_id) on delete cascade
);

-- 제작본에 담은 프로젝트 사본. snapshot이 제작본 내용의 유일한 원천이다(원본이 바뀌어도 자동으로 따라가지 않는다).
create table public.portfolio_project (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  portfolio_id uuid not null,
  source_project_id uuid,
  source_revision integer,
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object' and pg_column_size(snapshot) <= 262144),
  revision integer not null default 1,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  foreign key (portfolio_id, owner_id) references public.portfolio (id, owner_id) on delete cascade,
  -- 원본이 영구 삭제되어도 사본은 남고, 원본 연결만 끊긴다 (spec 10.2)
  foreign key (source_project_id, owner_id) references public.project (id, owner_id) on delete set null (source_project_id)
);

-- 제작본이 쓰는 이미지. 원본의 이미지 연결을 복사하므로 원본 첨부를 지워도 제작본의 이미지는 남는다.
create table public.portfolio_asset (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  portfolio_id uuid not null,
  portfolio_project_id uuid,
  asset_id uuid not null,
  section_key text not null check (char_length(section_key) between 1 and 40),
  caption text not null default '' check (char_length(caption) <= 150),
  alt_text text not null default '' check (char_length(alt_text) <= 150),
  decorative boolean not null default false,
  sort_order integer not null default 0,
  include_in_output boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (portfolio_id, owner_id) references public.portfolio (id, owner_id) on delete cascade,
  foreign key (portfolio_project_id, owner_id) references public.portfolio_project (id, owner_id) on delete cascade,
  foreign key (asset_id, owner_id) references public.asset (id, owner_id) on delete cascade
);

-- 제작본의 페이지. 표시 여부(hidden)와 그 페이지에 보이는 섹션(section_keys)을 저장한다.
-- 페이지의 순서는 저장하지 않고 "표지 → Summary → 프로필 → 프로젝트 사본(순서대로, 소개·분석·실행·결과)"로 계산한다.
create table public.portfolio_page (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  portfolio_id uuid not null,
  portfolio_project_id uuid,
  type text not null check (type in ('cover', 'summary', 'profile', 'project_intro', 'project_analysis', 'project_execution', 'project_result')),
  section_keys text[] not null default '{}',
  sort_order integer not null default 0,
  hidden boolean not null default false,
  continuation_index integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key (portfolio_id, owner_id) references public.portfolio (id, owner_id) on delete cascade,
  foreign key (portfolio_project_id, owner_id) references public.portfolio_project (id, owner_id) on delete cascade
);

create index portfolio_owner_idx on public.portfolio (owner_id) where deleted_at is null;
create index portfolio_project_portfolio_idx on public.portfolio_project (portfolio_id, sort_order);
create index portfolio_asset_portfolio_idx on public.portfolio_asset (portfolio_id);
create index portfolio_asset_asset_idx on public.portfolio_asset (asset_id);
create index portfolio_page_portfolio_idx on public.portfolio_page (portfolio_id);

-- 수정할 때마다 revision을 올린다 (core_schema.sql의 bump_project_revision을 그대로 쓴다)
create trigger portfolio_bump before update on public.portfolio
  for each row execute function public.bump_project_revision();
create trigger portfolio_project_bump before update on public.portfolio_project
  for each row execute function public.bump_project_revision();

-- ---------------------------------------------------------------------
-- 2. 권한과 RLS: 로그인한 사용자는 자기 행만 다룬다
-- ---------------------------------------------------------------------

revoke all on public.portfolio, public.portfolio_project, public.portfolio_asset, public.portfolio_page from anon, authenticated;
grant select, insert, update, delete on public.portfolio, public.portfolio_project, public.portfolio_asset, public.portfolio_page to authenticated;

alter table public.portfolio enable row level security;
alter table public.portfolio_project enable row level security;
alter table public.portfolio_asset enable row level security;
alter table public.portfolio_page enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['portfolio', 'portfolio_project', 'portfolio_asset', 'portfolio_page'] loop
    execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = owner_id)', t || '_select_own', t);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = owner_id)', t || '_insert_own', t);
    execute format('create policy %I on public.%I for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)', t || '_update_own', t);
    execute format('create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = owner_id)', t || '_delete_own', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 3. 여러 표를 한 번에 바꾸는 작업은 함수로 만들어 한 트랜잭션에서 처리한다 (spec 11장)
--    모두 호출한 사용자의 권한으로 실행되므로(security invoker) RLS가 그대로 적용된다.
-- ---------------------------------------------------------------------

-- 프로젝트 페이지별 기본 섹션. templates/pm-v1의 OUTPUT_ZONES와 같아야 한다(테스트가 확인한다).
create function public.default_page_sections(p_type text) returns text[]
language sql immutable set search_path = '' as $$
  select case p_type
    when 'project_intro' then array['overview', 'role']
    when 'project_analysis' then array['problem', 'evidence', 'insight', 'hypothesis']
    when 'project_execution' then array['solution', 'metrics', 'execution', 'contribution']
    when 'project_result' then array['result', 'reflection']
    else array[]::text[]
  end;
$$;

-- 제작본을 만들고 표지·Summary·프로필 페이지를 함께 만든다
create function public.create_portfolio(p_title text) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_ws uuid;
  v_id uuid;
begin
  select id into v_ws from public.workspace where owner_id = v_owner;
  if v_ws is null then
    raise exception 'no_workspace' using errcode = 'P0002';
  end if;

  insert into public.portfolio (owner_id, workspace_id, title, cover, summary, profile)
  values (
    v_owner, v_ws, p_title,
    '{"includeContact": false}'::jsonb,
    '{"items": []}'::jsonb,
    '{"intro": "", "education": [], "careers": [], "tools": []}'::jsonb
  )
  returning id into v_id;

  insert into public.portfolio_page (owner_id, portfolio_id, type, sort_order)
  values (v_owner, v_id, 'cover', 0), (v_owner, v_id, 'summary', 1), (v_owner, v_id, 'profile', 2);

  return v_id;
end;
$$;

-- 프로젝트 원본을 제작본으로 복사한다: 답변·이미지 연결·템플릿 버전을 복사하고 기본 페이지 4장을 만든다 (spec 5.3)
create function public.add_project_to_portfolio(p_portfolio uuid, p_project uuid) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_project public.project%rowtype;
  v_pp uuid;
  v_next integer;
  v_type text;
begin
  perform 1 from public.portfolio where id = p_portfolio and deleted_at is null;
  if not found then
    raise exception 'portfolio_not_found' using errcode = 'P0002';
  end if;

  select * into v_project from public.project where id = p_project and deleted_at is null;
  if not found then
    raise exception 'project_not_found' using errcode = 'P0002';
  end if;

  select coalesce(max(sort_order), -1) + 1 into v_next from public.portfolio_project where portfolio_id = p_portfolio;

  insert into public.portfolio_project (owner_id, portfolio_id, source_project_id, source_revision, snapshot, sort_order)
  values (
    v_owner, p_portfolio, v_project.id, v_project.revision,
    jsonb_build_object(
      'title', v_project.title,
      'answers', v_project.answers,
      'template_key', v_project.template_key,
      'template_version', v_project.template_version
    ),
    v_next
  )
  returning id into v_pp;

  insert into public.portfolio_asset (owner_id, portfolio_id, portfolio_project_id, asset_id, section_key, caption, alt_text, decorative, sort_order, include_in_output)
  select v_owner, p_portfolio, v_pp, asset_id, section_key, caption, alt_text, decorative, sort_order, include_in_output
  from public.project_asset where project_id = v_project.id;

  foreach v_type in array array['project_intro', 'project_analysis', 'project_execution', 'project_result'] loop
    insert into public.portfolio_page (owner_id, portfolio_id, portfolio_project_id, type, section_keys)
    values (v_owner, p_portfolio, v_pp, v_type, public.default_page_sections(v_type));
  end loop;

  return v_pp;
end;
$$;

-- "원본에서 다시 가져오기": 해당 사본의 내용과 이미지를 원본으로 교체한다. 부분 병합은 하지 않는다 (spec 5.3)
create function public.refresh_portfolio_project(p_pp uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_owner uuid := auth.uid();
  v_pp public.portfolio_project%rowtype;
  v_project public.project%rowtype;
  v_revision integer;
begin
  select * into v_pp from public.portfolio_project where id = p_pp;
  if not found then
    raise exception 'copy_not_found' using errcode = 'P0002';
  end if;
  if v_pp.source_project_id is null then
    raise exception 'source_missing' using errcode = 'P0002';
  end if;

  select * into v_project from public.project where id = v_pp.source_project_id and deleted_at is null;
  if not found then
    raise exception 'source_missing' using errcode = 'P0002';
  end if;

  update public.portfolio_project
  set snapshot = jsonb_build_object(
        'title', v_project.title,
        'answers', v_project.answers,
        'template_key', v_project.template_key,
        'template_version', v_project.template_version
      ),
      source_revision = v_project.revision
  where id = p_pp
  returning revision into v_revision;

  delete from public.portfolio_asset where portfolio_project_id = p_pp;
  insert into public.portfolio_asset (owner_id, portfolio_id, portfolio_project_id, asset_id, section_key, caption, alt_text, decorative, sort_order, include_in_output)
  select v_owner, v_pp.portfolio_id, p_pp, asset_id, section_key, caption, alt_text, decorative, sort_order, include_in_output
  from public.project_asset where project_id = v_project.id;

  return jsonb_build_object('revision', v_revision);
end;
$$;

-- 제작본에서 프로젝트 사본을 뺀다. 원본은 그대로 두고, Summary가 그 사본을 가리키던 연결은 해제한다(문장은 유지, spec 8.3).
create function public.remove_project_from_portfolio(p_pp uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_portfolio uuid;
  v_revision integer;
begin
  select portfolio_id into v_portfolio from public.portfolio_project where id = p_pp;
  if not found then
    raise exception 'copy_not_found' using errcode = 'P0002';
  end if;

  delete from public.portfolio_project where id = p_pp;

  update public.portfolio
  set summary = jsonb_set(
        summary,
        '{items}',
        coalesce((
          select jsonb_agg(
            jsonb_set(
              item,
              '{projectIds}',
              coalesce((
                select jsonb_agg(pid)
                from jsonb_array_elements_text(coalesce(item -> 'projectIds', '[]'::jsonb)) as pid
                where pid <> p_pp::text
              ), '[]'::jsonb)
            )
          )
          from jsonb_array_elements(coalesce(summary -> 'items', '[]'::jsonb)) as item
        ), '[]'::jsonb)
      )
  where id = v_portfolio
  returning revision into v_revision;

  return jsonb_build_object('revision', v_revision);
end;
$$;

-- 프로젝트 사본의 순서를 한 번에 바꾼다. 빠진 사본이나 중복이 있으면 거절한다 (spec 11장)
create function public.reorder_portfolio_projects(p_portfolio uuid, p_ids uuid[]) returns void
language plpgsql security invoker set search_path = '' as $$
declare
  v_existing uuid[];
begin
  select coalesce(array_agg(id order by id), '{}') into v_existing from public.portfolio_project where portfolio_id = p_portfolio;
  if coalesce(array_length(p_ids, 1), 0) <> coalesce(array_length(v_existing, 1), 0)
     or (select coalesce(array_agg(x order by x), '{}') from unnest(p_ids) as x) <> v_existing then
    raise exception 'invalid_order' using errcode = '22023';
  end if;

  update public.portfolio_project pp
  set sort_order = o.ord - 1
  from unnest(p_ids) with ordinality as o(id, ord)
  where pp.id = o.id and pp.portfolio_id = p_portfolio;
end;
$$;

grant execute on function public.create_portfolio(text) to authenticated;
grant execute on function public.add_project_to_portfolio(uuid, uuid) to authenticated;
grant execute on function public.refresh_portfolio_project(uuid) to authenticated;
grant execute on function public.remove_project_from_portfolio(uuid) to authenticated;
grant execute on function public.reorder_portfolio_projects(uuid, uuid[]) to authenticated;
revoke execute on function public.create_portfolio(text) from anon, public;
revoke execute on function public.add_project_to_portfolio(uuid, uuid) from anon, public;
revoke execute on function public.refresh_portfolio_project(uuid) from anon, public;
revoke execute on function public.remove_project_from_portfolio(uuid) from anon, public;
revoke execute on function public.reorder_portfolio_projects(uuid, uuid[]) from anon, public;
