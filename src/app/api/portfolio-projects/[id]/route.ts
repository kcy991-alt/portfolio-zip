import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { getAuthed, isUuid, notFound, parseBody } from "@/lib/api/server";
import { rpcStatus } from "@/lib/portfolio/server";
import { patchPortfolioProjectBodySchema } from "@/lib/validation/portfolio";

/**
 * 프로젝트 사본의 제목·답변을 고친다. 경험 원본은 바뀌지 않는다 (spec 5.3).
 * 사본의 snapshot에서 title과 answers만 바꾸고 나머지(템플릿 버전 등)는 그대로 둔다.
 */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/portfolio-projects/[id]">) {
  const { id } = await ctx.params;
  const auth = await getAuthed(request);
  if ("response" in auth) return auth.response;
  if (!isUuid(id)) return notFound("프로젝트 사본");
  const body = await parseBody(request, patchPortfolioProjectBodySchema);
  if ("response" in body) return body.response;

  const { data: current } = await auth.supabase.from("portfolio_project").select("snapshot").eq("id", id).maybeSingle();
  if (!current) return notFound("프로젝트 사본");

  const snapshot = { ...(current.snapshot as Record<string, unknown>) };
  if (body.data.title !== undefined) snapshot.title = body.data.title;
  if (body.data.answers !== undefined) snapshot.answers = body.data.answers;

  const { data, error } = await auth.supabase
    .from("portfolio_project")
    .update({ snapshot })
    .eq("id", id)
    .eq("revision", body.data.expected_revision)
    .select("revision")
    .maybeSingle();
  if (error) return fail(500, "save_failed", "저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  if (data) return ok(data);

  const { data: now } = await auth.supabase.from("portfolio_project").select("revision").eq("id", id).maybeSingle();
  if (!now) return notFound("프로젝트 사본");
  return fail(409, "conflict", "다른 곳에서 먼저 수정되었어요. 최신 버전을 확인해 주세요.", { latestRevision: now.revision });
}

/** 제작본에서 프로젝트를 뺀다. 경험 원본은 그대로 두고 Summary의 연결만 풀린다 (spec 5.3, 8.3). */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/portfolio-projects/[id]">) {
  const { id } = await ctx.params;
  const auth = await getAuthed(_request);
  if ("response" in auth) return auth.response;
  if (!isUuid(id)) return notFound("프로젝트 사본");

  const { data, error } = await auth.supabase.rpc("remove_project_from_portfolio", { p_pp: id });
  if (error) {
    if (rpcStatus(error) === 404) return notFound("프로젝트 사본");
    return fail(500, "remove_failed", "프로젝트를 빼지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  }
  return ok({ id, portfolioRevision: (data as { revision?: number } | null)?.revision ?? null });
}
