import type { SupabaseClient } from "@supabase/supabase-js";
import { fail } from "./response";

// spec 14장: 업로드 계정당 분당 10회, 일반 쓰기 분당 120회
export const RATE_LIMITS = { write: 120, upload: 10 } as const;
export type RateBucket = keyof typeof RATE_LIMITS;

/**
 * 한도 안이면 null, 넘으면 429 응답을 돌려준다. 횟수는 DB(take_rate_limit)가 계정별로 센다.
 * 횟수를 세지 못했을 때는 막지 않는다(제한 장치의 오류로 저장이 막히면 안 되므로). 오류는 서버 기록에 남긴다.
 */
export async function takeRateLimit(supabase: SupabaseClient, bucket: RateBucket) {
  const { data, error } = await supabase.rpc("take_rate_limit", { p_bucket: bucket, p_limit: RATE_LIMITS[bucket] });
  if (error) {
    console.error("[rate_limit_failed]", bucket, error.code);
    return null;
  }
  const row = (Array.isArray(data) ? data[0] : data) as { allowed: boolean; retry_after: number } | undefined;
  if (!row || row.allowed) return null;
  const wait = row.retry_after;
  const res = fail(
    429,
    "rate_limited",
    bucket === "upload" ? `이미지를 너무 자주 올렸어요. ${wait}초 뒤에 다시 시도해 주세요.` : `요청이 너무 많아요. ${wait}초 뒤에 다시 시도해 주세요.`,
    { retryAfter: wait },
  );
  res.headers.set("Retry-After", String(wait));
  return res;
}
