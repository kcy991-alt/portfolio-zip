-- 사용자 A/B 격리 검사 (spec 16장 D2 완료 조건)
-- Supabase 대시보드 > SQL Editor에서 실행한다. 임시 사용자 2명을 만들어 검사하고, 마지막에 일부러 오류를 내서 전부 되돌린다.
-- 결과 해석:
--   "ALL PASSED (rolled back)" 오류 문구가 나오면 통과 (오류처럼 보이지만 정상. 실제 데이터는 남지 않는다)
--   "FAILED: ..." 가 나오면 실패한 항목 이름이 적혀 있다

do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  ws_a uuid;
  ws_b uuid;
  folder_a uuid;
  project_a uuid;
  n integer;
  rev integer;
  failed boolean;
begin
  -- 준비 (관리자 권한): 임시 사용자 2명. 워크스페이스는 트리거가 만든다.
  insert into auth.users (id, aud, role, email) values
    (a, 'authenticated', 'authenticated', 'rls-test-a@example.invalid'),
    (b, 'authenticated', 'authenticated', 'rls-test-b@example.invalid');
  select id into ws_a from public.workspace where owner_id = a;
  select id into ws_b from public.workspace where owner_id = b;
  if ws_a is null or ws_b is null then raise exception 'FAILED: 새 사용자의 워크스페이스가 자동으로 만들어지지 않음'; end if;

  -- A로 로그인한 것처럼 동작
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  insert into public.folder (owner_id, workspace_id, name) values (a, ws_a, 'A의 폴더') returning id into folder_a;
  insert into public.project (owner_id, workspace_id, folder_id, title) values (a, ws_a, folder_a, 'A의 프로젝트') returning id into project_a;
  insert into storage.objects (bucket_id, name) values ('portfolio-assets', a::text || '/test.png');

  update public.project set title = 'A의 프로젝트(수정)' where id = project_a;
  select revision into rev from public.project where id = project_a;
  if rev <> 2 then raise exception 'FAILED: 수정할 때 revision이 1 올라가야 함 (현재 %)', rev; end if;

  -- B로 전환
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  select count(*) into n from public.folder;
  if n <> 0 then raise exception 'FAILED: B가 A의 폴더를 읽을 수 있음'; end if;
  select count(*) into n from public.project;
  if n <> 0 then raise exception 'FAILED: B가 A의 프로젝트를 읽을 수 있음'; end if;
  select count(*) into n from public.workspace;
  if n <> 1 then raise exception 'FAILED: B는 자기 워크스페이스만 보여야 함 (보이는 개수 %)', n; end if;

  update public.project set title = '해킹' where id = project_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAILED: B가 A의 프로젝트를 수정할 수 있음'; end if;

  delete from public.project where id = project_a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAILED: B가 A의 프로젝트를 삭제할 수 있음'; end if;

  -- 남의 소유자 id로 넣기 → 막혀야 함
  failed := false;
  begin
    insert into public.folder (owner_id, workspace_id, name) values (a, ws_a, '침입');
  exception when others then failed := true; end;
  if not failed then raise exception 'FAILED: B가 owner_id를 A로 지정해 폴더를 만들 수 있음'; end if;

  -- 내 소유자 id지만 남의 워크스페이스를 가리키기 → 막혀야 함
  failed := false;
  begin
    insert into public.folder (owner_id, workspace_id, name) values (b, ws_a, '침입');
  exception when others then failed := true; end;
  if not failed then raise exception 'FAILED: B가 A의 워크스페이스에 폴더를 만들 수 있음'; end if;

  -- 내 프로젝트를 남의 폴더에 넣기 → 막혀야 함
  failed := false;
  begin
    insert into public.project (owner_id, workspace_id, folder_id, title) values (b, ws_b, folder_a, '침입');
  exception when others then failed := true; end;
  if not failed then raise exception 'FAILED: B가 A의 폴더 안에 프로젝트를 만들 수 있음'; end if;

  -- 스토리지: 남의 경로에 올리기, 남의 파일 읽기 → 막혀야 함
  failed := false;
  begin
    insert into storage.objects (bucket_id, name) values ('portfolio-assets', a::text || '/hack.png');
  exception when others then failed := true; end;
  if not failed then raise exception 'FAILED: B가 A의 스토리지 경로에 파일을 올릴 수 있음'; end if;

  select count(*) into n from storage.objects where bucket_id = 'portfolio-assets';
  if n <> 0 then raise exception 'FAILED: B가 A의 이미지 파일 정보를 읽을 수 있음'; end if;

  -- 로그인하지 않은 사용자(anon)는 아무것도 못 읽어야 함
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  failed := false;
  begin
    perform 1 from public.project limit 1;
  exception when others then failed := true; end;
  if not failed then raise exception 'FAILED: 로그인하지 않은 사용자가 프로젝트 표를 읽을 수 있음'; end if;

  -- A는 자기 데이터를 그대로 볼 수 있어야 함
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  select count(*) into n from public.project where title = 'A의 프로젝트(수정)';
  if n <> 1 then raise exception 'FAILED: A가 자기 프로젝트를 읽지 못함'; end if;

  execute 'reset role';
  -- 오류를 일부러 내서 위에서 만든 임시 사용자와 데이터를 모두 되돌린다.
  raise exception 'ALL PASSED (rolled back)';
end;
$$;
