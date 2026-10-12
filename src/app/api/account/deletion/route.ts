import type { NextRequest } from "next/server";
import { z } from "zod";
import { isRecentLogin } from "@/lib/account/recent-login";
import { deleteAccount } from "@/lib/account/delete-account";
import { fail, ok } from "@/lib/api/response";
import { getAuthed, parseBody } from "@/lib/api/server";
import { createAdminClient } from "@/lib/supabase/admin";

// 상태 조회: 마지막 계정 삭제 작업 (spec S09 "삭제 처리 상태·실패 재시도")
export async function GET() {
  const auth = await getAuthed();
  if ("response" in auth) return auth.response;
  const { data } = await auth.supabase
    .from("deletion_job")
    .select("status, retry_count, updated_at")
    .eq("kind", "account")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return ok({ job: data ?? null });
}

const bodySchema = z.object({ confirm: z.literal(true) });

// 삭제 요청: 방금 Google로 다시 로그인했을 때만 처리한다.
export async function POST(request: NextRequest) {
  const auth = await getAuthed(request);
  if ("response" in auth) return auth.response;
  const body = await parseBody(request, bodySchema);
  if ("response" in body) return body.response;

  const { data: claims } = await auth.supabase.auth.getClaims();
  const amr = claims?.claims.amr as Parameters<typeof isRecentLogin>[0];
  if (!isRecentLogin(amr, Math.floor(Date.now() / 1000))) {
    return fail(401, "reauth_required", "계정을 지우려면 Google로 다시 로그인해 확인해야 해요.");
  }

  const admin = createAdminClient();
  if (!admin) {
    console.error("[account_deletion] SUPABASE_SECRET_KEY가 설정되지 않았어요.");
    return fail(500, "not_configured", "지금은 계정을 지울 수 없어요. 잠시 뒤 다시 시도해 주세요.");
  }

  const result = await deleteAccount(admin, auth.user.id);
  if (!result.ok) return fail(500, "deletion_failed", "계정 삭제를 끝내지 못했어요. 지운 내용은 되돌릴 수 없고, 남은 부분은 다시 시도하면 이어서 지워요.");

  // 계정이 사라졌으니 이 브라우저의 로그인 정보도 지운다
  await auth.supabase.auth.signOut().catch(() => {});
  return ok({ deleted: true });
}
