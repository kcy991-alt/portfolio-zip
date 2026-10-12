import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { getAuthed, isUuid, notFound, parseBody } from "@/lib/api/server";
import { folderBodySchema } from "@/lib/validation/api";

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/folders/[id]">) {
  const { id } = await ctx.params;
  const auth = await getAuthed(request);
  if ("response" in auth) return auth.response;
  if (!isUuid(id)) return notFound("폴더");
  const body = await parseBody(request, folderBodySchema);
  if ("response" in body) return body.response;

  const { data, error } = await auth.supabase
    .from("folder")
    .update({ name: body.data.name })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id, name")
    .maybeSingle();
  if (error) return fail(500, "update_failed", "폴더 이름을 바꾸지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  if (!data) return notFound("폴더");
  return ok(data);
}

/**
 * 폴더를 삭제(휴지통으로 이동)한다 (spec F02).
 * 프로젝트가 들어 있으면 기본으로 409를 돌려주고, ?moveToUnsorted=true일 때만 프로젝트를 미분류로 옮긴 뒤 삭제한다.
 * 프로젝트는 폴더와 함께 지워지지 않는다.
 */
export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/folders/[id]">) {
  const { id } = await ctx.params;
  const auth = await getAuthed(request);
  if ("response" in auth) return auth.response;
  if (!isUuid(id)) return notFound("폴더");

  const { data: folder } = await auth.supabase.from("folder").select("id").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!folder) return notFound("폴더");

  const { count, error: countError } = await auth.supabase
    .from("project")
    .select("id", { count: "exact", head: true })
    .eq("folder_id", id)
    .is("deleted_at", null);
  if (countError) return fail(500, "delete_failed", "폴더를 지우지 못했어요. 잠시 뒤 다시 시도해 주세요.");

  const projectCount = count ?? 0;
  const move = request.nextUrl.searchParams.get("moveToUnsorted") === "true";
  if (projectCount > 0 && !move) {
    return fail(409, "folder_not_empty", `폴더 안에 프로젝트가 ${projectCount}개 있어요. 미분류로 옮긴 뒤 삭제할 수 있어요.`, { projectCount });
  }

  if (projectCount > 0) {
    const { error } = await auth.supabase.from("project").update({ folder_id: null }).eq("folder_id", id).is("deleted_at", null);
    if (error) return fail(500, "delete_failed", "프로젝트를 미분류로 옮기지 못했어요. 폴더는 그대로 두었어요.");
  }

  const { error } = await auth.supabase.from("folder").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) return fail(500, "delete_failed", "폴더를 지우지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  return ok({ id, movedProjects: projectCount });
}
