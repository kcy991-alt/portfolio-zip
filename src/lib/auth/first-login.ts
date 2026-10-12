/** 계정을 만든 직후 첫 로그인인지 판단한다. 생성 시각과 마지막 로그인 시각이 1분 이내면 첫 로그인으로 본다. */
export function isFirstLogin(createdAt?: string | null, lastSignInAt?: string | null): boolean {
  if (!createdAt || !lastSignInAt) return false;
  const gap = Math.abs(new Date(lastSignInAt).getTime() - new Date(createdAt).getTime());
  return Number.isFinite(gap) && gap < 60_000;
}
