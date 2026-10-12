import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { getAuthed, isUuid, notFound } from "@/lib/api/server";
import { rpcStatus } from "@/lib/portfolio/server";

/**
 * "원본에서 다시 가져오기": 이 사본의 제목·답변·이미지를 원본으로 교체한다. 부분 병합은 하지 않는다 (spec 5.3).
 * 사용자가 덮어쓰일 편집 내용을 안내받고 확인한 뒤에만 화면에서 부른다.
 */
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/portfolio-projects/[id]/refresh">) {
  const { id } = await ctx.params;
  const auth = await getAuthed(_request);
  if ("response" in auth) return auth.response;
  if (!isUuid(id)) return notFound("프로젝트 사본");

  const { data, error } = await auth.supabase.rpc("refresh_portfolio_project", { p_pp: id });
  if (error) {
    if (rpcStatus(error) === 404) return fail(404, "source_missing", "원본 프로젝트를 찾을 수 없어요. 삭제되었거나 휴지통에 있을 수 있어요.");
    return fail(500, "refresh_failed", "원본에서 가져오지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  }
  return ok({ id, revision: (data as { revision?: number } | null)?.revision ?? null });
}
