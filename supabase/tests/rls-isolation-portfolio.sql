-- 포트폴리오 제작본의 사용자 A/B 격리와 규칙 검사 (spec 16장 D4 완료 조건)
-- 20261008020000_portfolio_schema.sql을 실행한 뒤, Supabase 대시보드 > SQL Editor에서 실행한다.
-- 임시 사용자 2명을 만들어 검사하고, 마지막에 일부러 오류를 내서 전부 되돌린다.
-- 결과 해석:
--   "ALL PASSED (rolled back)" 오류 문구가 나오면 통과 (오류처럼 보이지만 정상. 실제 데이터는 남지 않는다)
--   "FAILED: ..." 가 나오면 실패한 항목 이름이 적혀 있다

do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  ws_a uuid;
  ws_b uuid;
  proj_a uuid;
  proj_b uuid;
  pf_a uuid;
  pf_b uuid;
  pp_a uuid;
  n integer;
  rev integer;
  src_rev integer;
  failed boolean;
  v_snapshot jsonb;
  v_title text;
begin
  -- 준비 (관리자 권한): 임시 사용자 2명. 워크스페이스는 트리거가 만든다.
  insert into auth.users (id, aud, role, email) values
    (a, 'authenticated', 'authenticated', 'rls-portfolio-a@example.invalid'),
    (b, 'authenticated', 'authenticated', 'rls-portfolio-b@example.invalid');
  select id into ws_a from public.workspace where owner_id = a;
  select id into ws_b from public.workspace where owner_id = b;

  -- 각자 경험 프로젝트를 하나씩 만든다
  insert into public.project (owner_id, workspace_id, title, answers) values (a, ws_a, 'A의 프로젝트', '{"problem": {"phenomenon": "A의 원문"}}') returning id into proj_a;
  insert into public.project (owner_id, workspace_id, title) values (b, ws_b, 'B의 프로젝트') returning id into proj_b;

  -- ===== A로 로그인 =====
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  -- 제작본 만들기: 표지·Summary·프로필 3장이 함께 만들어진다
  select public.create_portfolio('A의 포트폴리오') into pf_a;
  select count(*) into n from public.portfolio_page where portfolio_id = pf_a;
  if n <> 3 then raise exception 'FAILED: 제작본을 만들면 기본 페이지 3장이 생겨야 함 (현재 %)', n; end if;

  -- 프로젝트 추가: 사본 1개 + 소개·분석·실행·결과 4장
  select public.add_project_to_portfolio(pf_a, proj_a) into pp_a;
  select count(*) into n from public.portfolio_page where portfolio_project_id = pp_a;
  if n <> 4 then raise exception 'FAILED: 프로젝트를 추가하면 프로젝트 페이지 4장이 생겨야 함 (현재 %)', n; end if;
  select snapshot, source_revision into v_snapshot, src_rev from public.portfolio_project where id = pp_a;
  if v_snapshot -> 'answers' -> 'problem' ->> 'phenomenon' <> 'A의 원문' then raise exception 'FAILED: 사본에 원본 답변이 복사되어야 함'; end if;

  -- 사본 독립: 사본을 고쳐도 원본이 바뀌지 않는다
  update public.portfolio_project
    set snapshot = jsonb_set(snapshot, '{answers,problem,phenomenon}', '"제작본에서 고침"')
    where id = pp_a;
  select (answers -> 'problem' ->> 'phenomenon') into v_title from public.project where id = proj_a;
  if v_title <> 'A의 원문' then raise exception 'FAILED: 사본을 고쳤더니 경험 원본이 바뀜'; end if;

  -- 원본에서 다시 가져오기: 사본이 원본으로 교체된다
  perform public.refresh_portfolio_project(pp_a);
  select snapshot -> 'answers' -> 'problem' ->> 'phenomenon' into v_title from public.portfolio_project where id = pp_a;
  if v_title <> 'A의 원문' then raise exception 'FAILED: 다시 가져오기가 사본을 원본으로 교체하지 않음'; end if;

  -- 수정할 때마다 revision이 올라간다
  update public.portfolio set title = 'A의 포트폴리오(수정)' where id = pf_a;
  select revision into rev from public.portfolio where id = pf_a;
  if rev <> 2 then raise exception 'FAILED: 제작본 수정 시 revision이 1 올라가야 함 (현재 %)', rev; end if;

  -- Summary가 사본을 가리키게 한 뒤 사본을 빼면 연결만 풀리고 문장은 남는다
  update public.portfolio
    set summary = jsonb_build_object('items', jsonb_build_array(jsonb_build_object('id', 's1', 'title', '핵심 역량', 'description', '문장 유지', 'projectIds', jsonb_build_array(pp_a::text))))
    where id = pf_a;
  perform public.remove_project_from_portfolio(pp_a);
  select count(*) into n from public.portfolio_project where portfolio_id = pf_a;
  if n <> 0 then raise exception 'FAILED: 사본이 제작본에서 빠지지 않음'; end if;
  select count(*) into n from public.portfolio_page where portfolio_project_id = pp_a;
  if n <> 0 then raise exception 'FAILED: 사본의 페이지가 함께 지워져야 함'; end if;
  select summary -> 'items' -> 0 ->> 'description', jsonb_array_length(summary -> 'items' -> 0 -> 'projectIds')
    into v_title, n from public.portfolio where id = pf_a;
  if v_title <> '문장 유지' or n <> 0 then raise exception 'FAILED: Summary 연결만 풀리고 문장은 유지되어야 함 (문장 %, 연결 %)', v_title, n; end if;
  select count(*) into n from public.project where id = proj_a and deleted_at is null;
  if n <> 1 then raise exception 'FAILED: 사본을 빼도 경험 원본은 남아 있어야 함'; end if;

  -- 순서 바꾸기: 누락·중복은 거절한다
  select public.add_project_to_portfolio(pf_a, proj_a) into pp_a;
  failed := false;
  begin
    perform public.reorder_portfolio_projects(pf_a, array[pp_a, pp_a]);
  exception when others then failed := true; end;
  if not failed then raise exception 'FAILED: 중복이 있는 순서 목록을 거절해야 함'; end if;
  failed := false;
  begin
    perform public.reorder_portfolio_projects(pf_a, array[]::uuid[]);
  exception when others then failed := true; end;
  if not failed then raise exception 'FAILED: 빠진 사본이 있는 순서 목록을 거절해야 함'; end if;
  perform public.reorder_portfolio_projects(pf_a, array[pp_a]);

  -- 원본이 영구 삭제되어도 사본은 남고 원본 연결만 끊긴다
  delete from public.project where id = proj_a;
  select count(*) into n from public.portfolio_project where id = pp_a and source_project_id is null;
  if n <> 1 then raise exception 'FAILED: 원본을 영구 삭제하면 사본은 남고 source_project_id만 비워져야 함'; end if;

  -- ===== B로 전환 =====
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.portfolio;
  if n <> 0 then raise exception 'FAILED: B가 A의 제작본을 읽을 수 있음'; end if;
  select count(*) into n from public.portfolio_project;
  if n <> 0 then raise exception 'FAILED: B가 A의 프로젝트 사본을 읽을 수 있음'; end if;
  select count(*) into n from public.portfolio_page;
  if n <> 0 then raise exception 'FAILED: B가 A의 페이지를 읽을 수 있음'; end if;

  update public.portfolio set title = '해킹' where id = pf_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAILED: B가 A의 제작본을 수정할 수 있음'; end if;

  delete from public.portfolio where id = pf_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAILED: B가 A의 제작본을 삭제할 수 있음'; end if;

  -- B가 A의 제작본에 자기 프로젝트를 담으려 하면 거절된다(제작본이 보이지 않는다)
  failed := false;
  begin
    perform public.add_project_to_portfolio(pf_a, proj_b);
  exception when others then failed := true; end;
  if not failed then raise exception 'FAILED: B가 A의 제작본에 프로젝트를 담을 수 있음'; end if;

  -- B가 A의 프로젝트를 자기 제작본에 복사하려 하면 거절된다(원본이 보이지 않는다)
  select public.create_portfolio('B의 포트폴리오') into pf_b;
  failed := false;
  begin
    perform public.add_project_to_portfolio(pf_b, proj_a);
  exception when others then failed := true; end;
  if not failed then raise exception 'FAILED: B가 A의 프로젝트를 복사할 수 있음'; end if;

  -- 남의 소유자 id로 제작본을 만들 수 없다
  failed := false;
  begin
    insert into public.portfolio (owner_id, workspace_id, title) values (a, ws_a, '침입');
  exception when others then failed := true; end;
  if not failed then raise exception 'FAILED: B가 owner_id를 A로 지정해 제작본을 만들 수 있음'; end if;

  -- B의 사본 순서를 A가 바꾸려는 시도는 위 reorder가 막지만, B의 제작본에서 A의 사본 id를 섞어도 거절된다
  failed := false;
  begin
    perform public.reorder_portfolio_projects(pf_b, array[pp_a]);
  exception when others then failed := true; end;
  if not failed then raise exception 'FAILED: 다른 사용자의 사본 id가 섞인 순서 목록을 거절해야 함'; end if;

  -- 로그인하지 않은 사용자(anon)는 제작본 표도, 함수도 쓸 수 없다
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  failed := false;
  begin
    perform 1 from public.portfolio limit 1;
  exception when others then failed := true; end;
  if not failed then raise exception 'FAILED: 로그인하지 않은 사용자가 제작본 표를 읽을 수 있음'; end if;
  failed := false;
  begin
    perform public.create_portfolio('익명');
  exception when others then failed := true; end;
  if not failed then raise exception 'FAILED: 로그인하지 않은 사용자가 제작본을 만들 수 있음'; end if;

  execute 'reset role';
  -- 오류를 일부러 내서 위에서 만든 임시 사용자와 데이터를 모두 되돌린다.
  raise exception 'ALL PASSED (rolled back)';
end;
$$;
