import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { getAuthed, isUuid, notFound, parseBody } from "@/lib/api/server";
import { MAX_ALT, MAX_CAPTION, REPRESENTATIVE } from "@/lib/storage/asset-limits";
import { cleanupUnreferencedAssets } from "@/lib/storage/cleanup";
import { emptyProjectAnswers } from "@/lib/validation/project-answers";

const sections: [string, ...string[]] = [REPRESENTATIVE, ...Object.keys(emptyProjectAnswers())];

const patchSchema = z
  .object({
    caption: z.string().max(MAX_CAPTION, `캡션은 ${MAX_CAPTION}자 이하로 입력해 주세요.`).optional(),
    alt_text: z.string().max(MAX_ALT, `대체텍스트는 ${MAX_ALT}자 이하로 입력해 주세요.`).optional(),
    decorative: z.boolean().optional(),
    section_key: z.enum(sections).optional(),
    sort_order: z.number().int().min(0).max(1000).optional(),
    include_in_output: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "바꿀 내용이 없어요." });

// 캡션·대체텍스트·구역·순서·출력 포함 여부를 바꾼다 (spec F06)
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/asset-links/[id]">) {
  const { id } = await ctx.params;
  const auth = await getAuthed(request);
  if ("response" in auth) return auth.response;
  if (!isUuid(id)) return notFound("이미지");
  const body = await parseBody(request, patchSchema);
  if ("response" in body) return body.response;

  const { data, error } = await auth.supabase
    .from("project_asset")
    .update(body.data)
    .eq("id", id)
    .select("id, section_key, caption, alt_text, decorative, sort_order, include_in_output")
    .maybeSingle();
  if (error) return fail(500, "update_failed", "이미지 정보를 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  if (!data) return notFound("이미지");
  return ok(data);
}

// 프로젝트에서 이미지를 뺀다. 먼저 화면·참조 데이터에서 빼고, 다른 곳에서 쓰지 않으면 파일 정리를 이어서 시도한다 (spec 7.5).
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/asset-links/[id]">) {
  const { id } = await ctx.params;
  const auth = await getAuthed(_request);
  if ("response" in auth) return auth.response;
  if (!isUuid(id)) return notFound("이미지");

  const { data: removed, error } = await auth.supabase.from("project_asset").delete().eq("id", id).select("asset_id").maybeSingle();
  if (error) return fail(500, "delete_failed", "이미지를 지우지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  if (!removed) return notFound("이미지");

  const failed = await cleanupUnreferencedAssets(auth.supabase, [removed.asset_id]);
  return ok({ id, fileCleanup: failed.length === 0 ? "done" : "pending" });
}
