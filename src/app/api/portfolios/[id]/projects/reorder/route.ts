import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { getAuthed, isUuid, notFound, parseBody } from "@/lib/api/server";
import { rpcStatus } from "@/lib/portfolio/server";
import { reorderBodySchema } from "@/lib/validation/portfolio";

/** 프로젝트 사본의 순서를 바꾼다. 빠진 사본이나 중복이 있으면 400으로 거절한다 (spec 11장). */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/portfolios/[id]/projects/reorder">) {
  const { id } = await ctx.params;
  const auth = await getAuthed(request);
  if ("response" in auth) return auth.response;
  if (!isUuid(id)) return notFound("포트폴리오");
  const body = await parseBody(request, reorderBodySchema);
  if ("response" in body) return body.response;

  const { error } = await auth.supabase.rpc("reorder_portfolio_projects", { p_portfolio: id, p_ids: body.data.ids });
  if (error) {
    const status = rpcStatus(error);
    if (status === 400) return fail(400, "invalid_order", "순서 목록이 현재 프로젝트와 맞지 않아요. 새로고침한 뒤 다시 시도해 주세요.");
    return fail(500, "reorder_failed", "순서를 바꾸지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  }
  return ok({ id });
}
