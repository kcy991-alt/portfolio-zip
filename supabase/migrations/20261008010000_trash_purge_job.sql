-- 휴지통 30일 자동 정리 (spec 10.2: 서버에서 하루 1회)
-- 삭제한 지 30일이 지난 프로젝트와 폴더를 영구 삭제한다.
-- Vercel Cron 대신 Supabase 데이터베이스 안의 pg_cron으로 돌려서, 관리자 키(secret key)가 필요 없다.
-- Supabase 대시보드 > SQL Editor에서 한 번만 실행한다.
--
-- 참고: 이 작업은 데이터베이스의 행만 지운다. 프로젝트에 붙어 있던 이미지 파일의 정리(스토리지)는
-- 이미지 첨부를 만들 때 서버 작업으로 따로 처리한다.

create extension if not exists pg_cron with schema pg_catalog;

-- 같은 이름의 작업이 있으면 먼저 지워서 여러 번 실행해도 하나만 남게 한다
select cron.unschedule(jobid) from cron.job where jobname = 'portfolio-zip-purge-trash';

-- 매일 18:00 UTC(한국 시간 03:00)
select cron.schedule(
  'portfolio-zip-purge-trash',
  '0 18 * * *',
  $$
    delete from public.project where deleted_at is not null and deleted_at < now() - interval '30 days';
    delete from public.folder where deleted_at is not null and deleted_at < now() - interval '30 days';
  $$
);
