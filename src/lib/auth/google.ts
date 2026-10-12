import { createClient } from "@/lib/supabase/client";

/** 로그인하려고 일부러 페이지를 떠나는 중인지. 체험 중 내용이 사라진다는 경고를 이때는 띄우지 않는다. */
export const leaving = { forLogin: false };

/** Google 로그인을 시작한다. 성공하면 Google 화면으로 이동하므로 돌아오는 경우는 실패했을 때뿐이다. */
export async function startGoogleSignIn(): Promise<{ error: string | null }> {
  leaving.forLogin = true;
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  });
  if (error) leaving.forLogin = false;
  return { error: error ? "로그인을 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요." : null };
}

/**
 * 계정 삭제 전에 Google로 다시 로그인해 본인을 확인한다. 돌아오면 설정 화면의 삭제 확인 단계로 간다.
 * prompt=login으로 Google이 이미 로그인된 상태여도 다시 확인하게 한다.
 */
export async function startGoogleReauth(): Promise<{ error: string | null }> {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth/callback?next=/settings%3Freauth%3D1`,
      queryParams: { prompt: "login" },
    },
  });
  return { error: error ? "확인을 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요." : null };
}
