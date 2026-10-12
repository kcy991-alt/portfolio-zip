// 계정 삭제 전 "Google 재로그인 확인" (spec 11장). 로그인 방식별 시간 기록(amr)에서 가장 최근 시각을 본다.
// 토큰은 한 시간마다 새로 발급되므로 발급 시각(iat)은 "방금 로그인했는가"의 근거가 되지 않는다.

export const REAUTH_WINDOW_SECONDS = 10 * 60;

type Amr = { method?: string; timestamp?: number }[] | string[] | undefined;

export function lastLoginAt(amr: Amr): number | null {
  if (!Array.isArray(amr)) return null;
  const times = amr.map((a) => (typeof a === "object" && a ? a.timestamp : undefined)).filter((t): t is number => typeof t === "number");
  return times.length ? Math.max(...times) : null;
}

export function isRecentLogin(amr: Amr, nowSeconds: number, windowSeconds = REAUTH_WINDOW_SECONDS): boolean {
  const at = lastLoginAt(amr);
  return at !== null && nowSeconds - at >= -60 && nowSeconds - at <= windowSeconds;
}
