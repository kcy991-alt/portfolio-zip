-- 마이페이지 프로필의 사용자 A/B 격리 검사
-- 20261013000000_my_profile.sql을 실행한 뒤, Supabase 대시보드 > SQL Editor에서 실행한다.
-- 임시 사용자 2명을 만들어 검사하고, 마지막에 일부러 오류를 내서 전부 되돌린다.
-- 결과 해석:
--   "ALL PASSED (rolled back)" 오류 문구가 나오면 통과 (오류처럼 보이지만 정상. 실제 데이터는 남지 않는다)
--   "FAILED: ..." 가 나오면 실패한 항목 이름이 적혀 있다

do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  n integer;
  rev integer;
  failed boolean;
begin
  insert into auth.users (id, aud, role, email) values
    (a, 'authenticated', 'authenticated', 'rls-myprofile-a@example.invalid'),
    (b, 'authenticated', 'authenticated', 'rls-myprofile-b@example.invalid');

  -- ===== A로 로그인 =====
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  insert into public.my_profile (owner_id, profile) values (a, '{"intro": "A의 소개"}');
  select count(*) into n from public.my_profile;
  if n <> 1 then raise exception 'FAILED: A는 자기 프로필 1개만 보여야 한다 (%)', n; end if;

  -- 남의 이름으로 만들 수 없다
  failed := false;
  begin
    insert into public.my_profile (owner_id, profile) values (b, '{"intro": "A가 B 이름으로 만듦"}');
  exception when others then failed := true;
  end;
  if not failed then raise exception 'FAILED: A가 B의 프로필을 만들 수 있다'; end if;

  -- 수정하면 revision이 오른다
  update public.my_profile set profile = '{"intro": "A의 새 소개"}' where owner_id = a;
  select revision into rev from public.my_profile where owner_id = a;
  if rev <> 2 then raise exception 'FAILED: 수정 뒤 revision이 2여야 한다 (%)', rev; end if;

  -- ===== B로 로그인 =====
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);

  select count(*) into n from public.my_profile;
  if n <> 0 then raise exception 'FAILED: B는 A의 프로필을 읽을 수 없어야 한다 (%)', n; end if;

  update public.my_profile set profile = '{"intro": "B가 고침"}' where owner_id = a;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAILED: B가 A의 프로필을 고칠 수 있다'; end if;

  -- ===== 로그인하지 않은 사용자 =====
  execute 'reset role';
  execute 'set local role anon';
  failed := false;
  begin
    perform 1 from public.my_profile;
  exception when others then failed := true;
  end;
  if not failed then raise exception 'FAILED: 로그인하지 않은 사용자가 프로필을 읽을 수 있다'; end if;

  execute 'reset role';
  raise exception 'ALL PASSED (rolled back)';
end;
$$;
