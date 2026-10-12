import { NextResponse, type NextRequest } from "next/server";
import { isFirstLogin } from "@/lib/auth/first-login";
import { createClient } from "@/lib/supabase/server";

// Google 로그인이 끝나면 Supabase가 이 주소로 code를 붙여 돌려보낸다.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (searchParams.get("error") || !code) {
    return NextResponse.redirect(`${origin}/auth?error=cancelled`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/auth?error=failed`);
  }

  // 계정 삭제 확인처럼 정해진 화면으로 돌아가야 할 때만 next를 따른다(허용 목록 밖의 주소는 무시)
  const next = searchParams.get("next");
  if (next === "/settings?reauth=1") return NextResponse.redirect(`${origin}${next}`);

  const { data } = await supabase.auth.getUser();
  const first = isFirstLogin(data.user?.created_at, data.user?.last_sign_in_at);
  return NextResponse.redirect(`${origin}${first ? "/welcome" : "/workspace"}`);
}
