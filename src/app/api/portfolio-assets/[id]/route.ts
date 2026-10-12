import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { getAuthed, isUuid, notFound, parseBody } from "@/lib/api/server";
import { patchPortfolioAssetBodySchema } from "@/lib/validation/portfolio";

// 제작본에서 쓰는 이미지의 캡션·대체텍스트·출력 포함 여부를 바꾼다. 경험 원본의 이미지는 바뀌지 않는다.
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/portfolio-assets/[id]">) {
  const { id } = await ctx.params;
  const auth = await getAuthed(request);
  if ("response" in auth) return auth.response;
  if (!isUuid(id)) return notFound("이미지");
  const body = await parseBody(request, patchPortfolioAssetBodySchema);
  if ("response" in body) return body.response;

  const { data, error } = await auth.supabase
    .from("portfolio_asset")
    .update(body.data)
    .eq("id", id)
    .select("id, caption, alt_text, decorative, include_in_output")
    .maybeSingle();
  if (error) return fail(500, "update_failed", "이미지 설정을 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  if (!data) return notFound("이미지");
  return ok(data);
}
