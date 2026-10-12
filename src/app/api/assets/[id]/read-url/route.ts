import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { createClient } from "@/lib/supabase/server";

const EXPIRES_IN_SECONDS = 600; // spec 11장: 10분

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/assets/[id]/read-url">) {
  const { id } = await ctx.params;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fail(401, "unauthorized", "로그인이 필요해요.");

  // 형식이 틀렸거나 남의 이미지여도 같은 404로 답해서 존재 여부를 알려 주지 않는다 (spec 8.1)
  if (!UUID.test(id)) return fail(404, "not_found", "이미지를 찾을 수 없어요.");

  const { data: asset } = await supabase
    .from("asset")
    .select("storage_path")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!asset) return fail(404, "not_found", "이미지를 찾을 수 없어요.");

  const { data, error } = await supabase.storage.from("portfolio-assets").createSignedUrl(asset.storage_path, EXPIRES_IN_SECONDS);
  if (error || !data) return fail(500, "sign_failed", "이미지 주소를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.");

  return ok({ url: data.signedUrl, expiresIn: EXPIRES_IN_SECONDS });
}
