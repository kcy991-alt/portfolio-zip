import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { getAuthed, isUuid, notFound } from "@/lib/api/server";

const EXPIRES_IN_SECONDS = 600; // 서명 주소는 10분 동안 유효하다 (spec 11장)

// 프로젝트에 붙은 이미지 목록과 보기용 서명 주소. 주소는 DB에 저장하지 않고 그때그때 만든다.
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/projects/[id]/assets">) {
  const { id } = await ctx.params;
  const auth = await getAuthed();
  if ("response" in auth) return auth.response;
  if (!isUuid(id)) return notFound("프로젝트");

  const { data: project } = await auth.supabase.from("project").select("id").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!project) return notFound("프로젝트");

  const { data: links, error } = await auth.supabase
    .from("project_asset")
    .select("id, asset_id, section_key, caption, alt_text, decorative, sort_order, include_in_output")
    .eq("project_id", id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return fail(500, "list_failed", "이미지를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  if (!links || links.length === 0) return ok({ items: [], expiresIn: EXPIRES_IN_SECONDS });

  const { data: assets, error: assetError } = await auth.supabase
    .from("asset")
    .select("id, storage_path, width, height, bytes")
    .in("id", links.map((l) => l.asset_id));
  if (assetError) return fail(500, "list_failed", "이미지를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  const assetById = new Map((assets ?? []).map((a) => [a.id, a]));

  const paths = (assets ?? []).map((a) => a.storage_path);
  const { data: signed, error: signError } = await auth.supabase.storage.from("portfolio-assets").createSignedUrls(paths, EXPIRES_IN_SECONDS);
  if (signError) return fail(500, "sign_failed", "이미지 주소를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  const items = links.flatMap((l) => {
    const a = assetById.get(l.asset_id);
    if (!a) return [];
    return [{ ...l, width: a.width, height: a.height, bytes: a.bytes, url: urlByPath.get(a.storage_path) ?? null }];
  });
  return ok({ items, expiresIn: EXPIRES_IN_SECONDS });
}
