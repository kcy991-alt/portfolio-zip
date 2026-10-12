import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { getAuthed, isUuid, notFound } from "@/lib/api/server";
import { cleanupUnreferencedAssets } from "@/lib/storage/cleanup";

// 영구 삭제. 휴지통에 있는 항목만 지울 수 있고, 사용 중인 항목은 이 경로로 지울 수 없다.
// 되돌릴 수 없으므로 화면에서 확인을 받은 뒤에만 부른다 (spec 6장).
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/trash/[type]/[id]/purge">) {
  const { type, id } = await ctx.params;
  const auth = await getAuthed(_request);
  if ("response" in auth) return auth.response;
  if ((type !== "project" && type !== "folder" && type !== "portfolio") || !isUuid(id)) return notFound("항목");

  // 프로젝트를 영구 삭제하면 이미지 연결도 함께 지워지므로, 그 이미지들이 다른 곳에서 쓰이지 않는지 지운 뒤에 정리한다.
  let assetIds: string[] = [];
  if (type === "project") {
    const { data: links } = await auth.supabase.from("project_asset").select("asset_id").eq("project_id", id);
    assetIds = (links ?? []).map((l) => l.asset_id);
  } else if (type === "portfolio") {
    const { data: links } = await auth.supabase.from("portfolio_asset").select("asset_id").eq("portfolio_id", id);
    assetIds = (links ?? []).map((l) => l.asset_id);
  }

  const { data, error } = await auth.supabase
    .from(type)
    .delete()
    .eq("id", id)
    .not("deleted_at", "is", null)
    .select("id")
    .maybeSingle();
  if (error) return fail(500, "purge_failed", "영구 삭제하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  if (!data) return notFound("항목");
  if (assetIds.length > 0) await cleanupUnreferencedAssets(auth.supabase, assetIds);
  return ok({ type, id });
}
