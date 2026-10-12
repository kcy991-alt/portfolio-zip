import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { getAuthed, isUuid, notFound, parseBody } from "@/lib/api/server";
import { loadPortfolioDoc } from "@/lib/portfolio/server";
import { patchPortfolioBodySchema } from "@/lib/validation/portfolio";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/portfolios/[id]">) {
  const { id } = await ctx.params;
  const auth = await getAuthed();
  if ("response" in auth) return auth.response;
  if (!isUuid(id)) return notFound("포트폴리오");

  const doc = await loadPortfolioDoc(auth.supabase, id);
  if (!doc) return notFound("포트폴리오");
  return ok(doc);
}

/** 제목·표지·Summary·프로필 저장. expected_revision이 현재와 같을 때만 저장하고, 다르면 409를 돌려준다 (spec 10.3). */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/portfolios/[id]">) {
  const { id } = await ctx.params;
  const auth = await getAuthed(request);
  if ("response" in auth) return auth.response;
  if (!isUuid(id)) return notFound("포트폴리오");
  const body = await parseBody(request, patchPortfolioBodySchema);
  if ("response" in body) return body.response;

  const { expected_revision, ...fields } = body.data;
  const { data, error } = await auth.supabase
    .from("portfolio")
    .update(fields)
    .eq("id", id)
    .eq("revision", expected_revision)
    .is("deleted_at", null)
    .select("revision, updated_at")
    .maybeSingle();
  if (error) return fail(500, "save_failed", "저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  if (data) return ok(data);

  const { data: current } = await auth.supabase.from("portfolio").select("revision").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!current) return notFound("포트폴리오");
  return fail(409, "conflict", "다른 곳에서 먼저 수정되었어요. 최신 버전을 확인해 주세요.", { latestRevision: current.revision });
}

/** 제작본을 휴지통으로 보낸다. 경험 원본은 그대로 남는다 (spec 10.2). */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/portfolios/[id]">) {
  const { id } = await ctx.params;
  const auth = await getAuthed(_request);
  if ("response" in auth) return auth.response;
  if (!isUuid(id)) return notFound("포트폴리오");

  const { data, error } = await auth.supabase
    .from("portfolio")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) return fail(500, "delete_failed", "포트폴리오를 지우지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  if (!data) return notFound("포트폴리오");
  return ok({ id });
}
