import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { getAuthed, isUuid, notFound, parseBody } from "@/lib/api/server";
import { loadPortfolioDoc, rpcStatus } from "@/lib/portfolio/server";
import { addProjectBodySchema } from "@/lib/validation/portfolio";

/** 경험 원본을 골라 제작본에 복사한다. 사본·이미지 연결·기본 페이지를 DB 함수가 한 번에 만든다 (spec 5.3, 11장). */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/portfolios/[id]/projects">) {
  const { id } = await ctx.params;
  const auth = await getAuthed(request);
  if ("response" in auth) return auth.response;
  if (!isUuid(id)) return notFound("포트폴리오");
  const body = await parseBody(request, addProjectBodySchema);
  if ("response" in body) return body.response;

  const { data, error } = await auth.supabase.rpc("add_project_to_portfolio", { p_portfolio: id, p_project: body.data.project_id });
  if (error) {
    const status = rpcStatus(error);
    if (status === 404) return notFound("프로젝트");
    return fail(500, "add_failed", "프로젝트를 추가하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  }

  // 편집 화면이 바로 쓸 수 있게 갱신된 제작본 전체를 돌려준다
  const doc = await loadPortfolioDoc(auth.supabase, id);
  return ok({ copyId: data as string, doc }, { status: 201 });
}
