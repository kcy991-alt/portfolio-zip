import { createBrowserClient } from "@supabase/ssr";

// 브라우저에서 쓰는 클라이언트. NEXT_PUBLIC_ 변수는 정적으로 참조해야 번들에 들어간다.
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
}
