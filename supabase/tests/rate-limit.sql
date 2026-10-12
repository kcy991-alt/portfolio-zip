-- 요청 제한·업로드 중복 방지 검사 (spec 16장 D6)
-- 20261008030000_rate_limit_and_dedupe.sql을 실행한 뒤, Supabase 대시보드 > SQL Editor에서 실행한다.
-- 결과 해석: "ALL PASSED (rolled back)" 오류 문구가 나오면 통과 (오류처럼 보이지만 정상. 실제 데이터는 남지 않는다)

do $$
declare
  a uuid := gen_random_uuid();
  b uuid := gen_random_uuid();
  r record;
  i integer;
  n integer;
  op uuid := gen_random_uuid();
  failed boolean;
begin
  insert into auth.users (id, aud, role, email) values
    (a, 'authenticated', 'authenticated', 'rate-a@example.invalid'),
    (b, 'authenticated', 'authenticated', 'rate-b@example.invalid');

  -- ===== A =====
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  -- 업로드는 10번까지 허용, 11번째부터 거절
  for i in 1..10 loop
    select * into r from public.take_rate_limit('upload', 10);
    if not r.allowed then raise exception 'FAILED: upload % should be allowed', i; end if;
  end loop;
  select * into r from public.take_rate_limit('upload', 10);
  if r.allowed or r.retry_after < 1 or r.retry_after > 60 then raise exception 'FAILED: 11th upload should be limited with retry_after 1..60'; end if;

  -- 업로드 한도를 써도 일반 쓰기는 따로 센다
  select * into r from public.take_rate_limit('write', 120);
  if not r.allowed then raise exception 'FAILED: write bucket should be independent'; end if;

  -- 직접 표를 읽거나 고칠 수 없다
  failed := false;
  begin
    select count(*) into n from public.rate_limit_hit;
  exception when insufficient_privilege then failed := true; end;
  if not failed then raise exception 'FAILED: rate_limit_hit must not be readable by users'; end if;

  -- 잘못된 종류 거절
  failed := false;
  begin
    perform * from public.take_rate_limit('other', 10);
  exception when others then failed := true; end;
  if not failed then raise exception 'FAILED: invalid bucket must be rejected'; end if;

  -- 같은 작업 번호는 두 번 등록할 수 없다
  insert into public.client_operation (owner_id, operation_id) values (a, op);
  failed := false;
  begin
    insert into public.client_operation (owner_id, operation_id) values (a, op);
  exception when unique_violation then failed := true; end;
  if not failed then raise exception 'FAILED: duplicate operation id must conflict'; end if;

  -- 남의 이름으로 등록할 수 없다
  failed := false;
  begin
    insert into public.client_operation (owner_id, operation_id) values (b, gen_random_uuid());
  exception when others then failed := true; end;
  if not failed then raise exception 'FAILED: cannot register operation for another user'; end if;

  -- ===== B =====
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  -- A가 한도를 다 써도 B는 영향이 없다
  select * into r from public.take_rate_limit('upload', 10);
  if not r.allowed then raise exception 'FAILED: B should not be affected by A'; end if;
  -- B는 A의 작업 번호를 볼 수 없다
  select count(*) into n from public.client_operation where operation_id = op;
  if n <> 0 then raise exception 'FAILED: B can see A operation'; end if;

  -- ===== 로그인 없음 =====
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
  failed := false;
  begin
    perform * from public.take_rate_limit('write', 120);
  exception when others then failed := true; end;
  if not failed then raise exception 'FAILED: anon must not call take_rate_limit'; end if;

  execute 'reset role';
  raise exception 'ALL PASSED (rolled back)';
end $$;
