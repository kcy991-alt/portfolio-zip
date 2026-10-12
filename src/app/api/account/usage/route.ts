import { ok, fail } from "@/lib/api/response";
import { getAuthed } from "@/lib/api/server";
import { MAX_ACCOUNT_BYTES } from "@/lib/storage/asset-limits";

// 설정 화면에 보여 줄 저장 용량
export async function GET() {
  const auth = await getAuthed();
  if ("response" in auth) return auth.response;
  const { data, error } = await auth.supabase.from("asset").select("bytes").is("deleted_at", null);
  if (error) return fail(500, "usage_failed", "저장 용량을 확인하지 못했어요.");
  return ok({ used: (data ?? []).reduce((sum, r) => sum + r.bytes, 0), limit: MAX_ACCOUNT_BYTES });
}
