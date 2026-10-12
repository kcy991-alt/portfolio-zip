-- D6: 이미지 파일 정리용 조회 함수. 서버 전용 키(service_role)만 부를 수 있다.

-- 어느 프로젝트·제작본도 쓰지 않는 이미지(asset). 올린 직후 붙이는 중일 수 있어서 p_older_than보다 오래된 것만 본다.
-- 삭제 표시(deleted_at)가 있는 이미지는 시간과 상관없이 포함한다(파일 삭제를 한 번 실패한 것).
create function public.list_unreferenced_assets(p_older_than interval, p_limit integer)
returns table (id uuid, owner_id uuid, storage_path text)
language sql security definer set search_path = '' as $$
  select a.id, a.owner_id, a.storage_path
  from public.asset a
  where (a.deleted_at is not null or a.created_at < now() - p_older_than)
    and not exists (select 1 from public.project_asset pa where pa.asset_id = a.id)
    and not exists (select 1 from public.portfolio_asset pf where pf.asset_id = a.id)
  order by a.created_at
  limit greatest(p_limit, 1);
$$;

-- asset 행이 없는 저장소 파일(업로드 직후 등록에 실패하고 정리도 실패한 것)
create function public.list_orphan_storage_objects(p_older_than interval, p_limit integer)
returns table (name text)
language sql security definer set search_path = '' as $$
  select o.name
  from storage.objects o
  where o.bucket_id = 'portfolio-assets'
    and o.created_at < now() - p_older_than
    and not exists (select 1 from public.asset a where a.storage_path = o.name)
  order by o.created_at
  limit greatest(p_limit, 1);
$$;

revoke all on function public.list_unreferenced_assets(interval, integer) from public, anon, authenticated;
revoke all on function public.list_orphan_storage_objects(interval, integer) from public, anon, authenticated;
grant execute on function public.list_unreferenced_assets(interval, integer) to service_role;
grant execute on function public.list_orphan_storage_objects(interval, integer) to service_role;

-- 계정 삭제·정리 작업 기록은 서버 전용 키가 쓴다. 사용자는 자기 것을 읽기만 한다(기존 정책).
grant select, insert, update on public.deletion_job to service_role;
