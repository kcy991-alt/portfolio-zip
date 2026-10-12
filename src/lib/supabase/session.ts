import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "./env";

/**
 * 요청마다 로그인 세션을 갱신한다.
 * 화면은 로그인 없이 써 볼 수 있다(내용은 저장되지 않는다). 저장된 개인 데이터는 API와 DB(RLS)가 로그인 여부를 검사해서 막는다.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabaseEnv();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // 서버에서 토큰 서명을 검증한다. 쿠키 값만 믿지 않는다.
  const { data } = await supabase.auth.getClaims();

  // 이미 로그인한 사용자가 로그인 화면에 오면 보관함으로 보낸다.
  if (data?.claims && request.nextUrl.pathname === "/auth") {
    const redirect = NextResponse.redirect(new URL("/workspace", request.url));
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  return response;
}
