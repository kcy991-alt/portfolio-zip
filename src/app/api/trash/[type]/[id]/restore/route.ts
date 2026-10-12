import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { getAuthed, isUuid, notFound } from "@/lib/api/server";

// 휴지통에서 복원한다. 프로젝트의 원래 폴더가 없어졌으면 미분류로 돌아온다 (spec F13).
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/trash/[type]/[id]/restore">) {
  const { type, id } = await ctx.params;
  const auth = await getAuthed(_request);
  if ("response" in auth) return auth.response;
  if ((type !== "project" && type !== "folder" && type !== "portfolio") || !isUuid(id)) return notFound("항목");

  if (type === "portfolio") {
    const { data, error } = await auth.supabase
      .from("portfolio")
      .update({ deleted_at: null })
      .eq("id", id)
      .not("deleted_at", "is", null)
      .select("id, title")
      .maybeSingle();
    if (error) return fail(500, "restore_failed", "복원하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    if (!data) return notFound("항목");
    return ok({ type, id, name: data.title });
  }

  if (type === "folder") {
    const { data, error } = await auth.supabase
      .from("folder")
      .update({ deleted_at: null })
      .eq("id", id)
      .not("deleted_at", "is", null)
      .select("id, name")
      .maybeSingle();
    if (error) return fail(500, "restore_failed", "복원하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    if (!data) return notFound("항목");
    return ok({ type, id, name: data.name });
  }

  const { data: project } = await auth.supabase
    .from("project")
    .select("id, folder_id")
    .eq("id", id)
    .not("deleted_at", "is", null)
    .maybeSingle();
  if (!project) return notFound("항목");

  let folderId = project.folder_id;
  if (folderId) {
    const { data: folder } = await auth.supabase.from("folder").select("id").eq("id", folderId).is("deleted_at", null).maybeSingle();
    if (!folder) folderId = null; // 원래 폴더가 지워졌으면 미분류로 복원한다
  }

  const { data, error } = await auth.supabase
    .from("project")
    .update({ deleted_at: null, folder_id: folderId })
    .eq("id", id)
    .select("id, folder_id")
    .maybeSingle();
  if (error) return fail(500, "restore_failed", "복원하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  if (!data) return notFound("항목");
  return ok({ type, id, folder_id: data.folder_id, movedToUnsorted: project.folder_id !== null && data.folder_id === null });
}
