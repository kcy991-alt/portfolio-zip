import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { getAuthed, parseBody } from "@/lib/api/server";
import { folderBodySchema } from "@/lib/validation/api";

export async function GET() {
  const auth = await getAuthed();
  if ("response" in auth) return auth.response;

  const { data, error } = await auth.supabase
    .from("folder")
    .select("id, name, sort_order, created_at")
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return fail(500, "list_failed", "폴더를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  return ok(data);
}

export async function POST(request: NextRequest) {
  const auth = await getAuthed(request);
  if ("response" in auth) return auth.response;
  const body = await parseBody(request, folderBodySchema);
  if ("response" in body) return body.response;

  const { data: workspace } = await auth.supabase.from("workspace").select("id").maybeSingle();
  if (!workspace) return fail(500, "no_workspace", "워크스페이스를 찾지 못했어요. 다시 로그인해 주세요.");

  const { data, error } = await auth.supabase
    .from("folder")
    .insert({ owner_id: auth.user.id, workspace_id: workspace.id, name: body.data.name })
    .select("id, name, sort_order, created_at")
    .single();
  if (error) return fail(500, "create_failed", "폴더를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  return ok(data, { status: 201 });
}
