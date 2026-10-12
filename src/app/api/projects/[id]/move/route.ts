import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { getAuthed, isUuid, notFound, parseBody } from "@/lib/api/server";
import { moveProjectBodySchema } from "@/lib/validation/api";

// 프로젝트를 다른 폴더(또는 미분류=null)로 옮긴다.
export async function POST(request: NextRequest, ctx: RouteContext<"/api/projects/[id]/move">) {
  const { id } = await ctx.params;
  const auth = await getAuthed(request);
  if ("response" in auth) return auth.response;
  if (!isUuid(id)) return notFound("프로젝트");
  const body = await parseBody(request, moveProjectBodySchema);
  if ("response" in body) return body.response;

  if (body.data.folder_id) {
    const { data: folder } = await auth.supabase
      .from("folder")
      .select("id")
      .eq("id", body.data.folder_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!folder) return fail(400, "invalid_folder", "선택한 폴더를 찾을 수 없어요.");
  }

  const { data, error } = await auth.supabase
    .from("project")
    .update({ folder_id: body.data.folder_id })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id, folder_id, revision")
    .maybeSingle();
  if (error) return fail(500, "move_failed", "프로젝트를 옮기지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  if (!data) return notFound("프로젝트");
  return ok(data);
}
