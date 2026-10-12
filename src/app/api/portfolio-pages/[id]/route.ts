import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { getAuthed, isUuid, notFound, parseBody } from "@/lib/api/server";
import { patchPageBodySchema } from "@/lib/validation/portfolio";

// 페이지의 표시 여부와, 그 페이지에 보일 섹션을 바꾼다 (spec F10·F11)
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/portfolio-pages/[id]">) {
  const { id } = await ctx.params;
  const auth = await getAuthed(request);
  if ("response" in auth) return auth.response;
  if (!isUuid(id)) return notFound("페이지");
  const body = await parseBody(request, patchPageBodySchema);
  if ("response" in body) return body.response;

  const { data, error } = await auth.supabase
    .from("portfolio_page")
    .update(body.data)
    .eq("id", id)
    .select("id, hidden, section_keys")
    .maybeSingle();
  if (error) return fail(500, "update_failed", "페이지 설정을 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  if (!data) return notFound("페이지");
  return ok(data);
}
