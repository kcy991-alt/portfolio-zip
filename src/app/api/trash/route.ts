import { fail, ok } from "@/lib/api/response";
import { getAuthed } from "@/lib/api/server";
import { trashCutoff, type TrashItem } from "@/lib/trash";

// 휴지통 목록: 30일 안에 삭제한 프로젝트·폴더·포트폴리오 제작본 (spec F13, S08)
export async function GET() {
  const auth = await getAuthed();
  if ("response" in auth) return auth.response;
  const cutoff = trashCutoff().toISOString();

  const [projects, folders, portfolios, allFolders] = await Promise.all([
    auth.supabase.from("project").select("id, title, folder_id, deleted_at").not("deleted_at", "is", null).gte("deleted_at", cutoff),
    auth.supabase.from("folder").select("id, name, deleted_at").not("deleted_at", "is", null).gte("deleted_at", cutoff),
    auth.supabase.from("portfolio").select("id, title, deleted_at").not("deleted_at", "is", null).gte("deleted_at", cutoff),
    // 프로젝트의 원래 폴더 이름을 보여 주려고 삭제된 폴더까지 모두 읽는다
    auth.supabase.from("folder").select("id, name, deleted_at"),
  ]);
  if (projects.error || folders.error || portfolios.error || allFolders.error) {
    return fail(500, "list_failed", "휴지통을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  }

  const folderById = new Map((allFolders.data ?? []).map((f) => [f.id, f]));
  const items: TrashItem[] = [
    ...(projects.data ?? []).map((p): TrashItem => {
      const f = p.folder_id ? folderById.get(p.folder_id) : undefined;
      return {
        type: "project",
        id: p.id,
        name: p.title,
        deleted_at: p.deleted_at as string,
        original_folder: f ? { name: f.name, deleted: f.deleted_at !== null } : null,
      };
    }),
    ...(folders.data ?? []).map((f): TrashItem => ({ type: "folder", id: f.id, name: f.name, deleted_at: f.deleted_at as string, original_folder: null })),
    ...(portfolios.data ?? []).map((p): TrashItem => ({ type: "portfolio", id: p.id, name: p.title, deleted_at: p.deleted_at as string, original_folder: null })),
  ].sort((a, b) => b.deleted_at.localeCompare(a.deleted_at));

  return ok(items);
}
