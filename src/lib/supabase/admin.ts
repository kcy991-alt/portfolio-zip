import { createClient } from "@supabase/supabase-js";

/**
 * 서버 전용 관리자 클라이언트(secret key). RLS를 건너뛰므로 계정 삭제·파일 정리처럼 사용자 권한으로 할 수 없는 일에만 쓴다.
 * 브라우저 코드에서 가져오지 않는다. 키는 .env.local(배포 시 Vercel 환경 변수)에만 둔다.
 * 키가 없으면 null을 돌려준다.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
