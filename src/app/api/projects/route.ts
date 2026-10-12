import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { getAuthed, isUuid, parseBody } from "@/lib/api/server";
import { createProjectBodySchema } from "@/lib/validation/api";
import { emptyProjectAnswers, overviewSchema } from "@/lib/validation/project-answers";

const LIST_COLUMNS = "id, title, folder_id, record_status, revision, last_step, updated_at, created_at";

// 목록에는 무거운 답변(answers)을 싣지 않는다.
export async function GET(request: NextRequest) {
  const auth = await getAuthed();
  if ("response" in auth) return auth.response;

  const folder = request.nextUrl.searchParams.get("folder");
  let query = auth.supabase.from("project").select(LIST_COLUMNS).is("deleted_at", null);
  if (folder === "unsorted") query = query.is("folder_id", null);
  else if (folder) {
    if (!isUuid(folder)) return fail(400, "invalid_folder", "폴더 값이 올바르지 않아요.");
    query = query.eq("folder_id", folder);
  }

  const { data, error } = await query.order("updated_at", { ascending: false });
  if (error) return fail(500, "list_failed", "프로젝트를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  return ok(data);
}

export async function POST(request: NextRequest) {
  const auth = await getAuthed(request);
  if ("response" in auth) return auth.response;
  const body = await parseBody(request, createProjectBodySchema);
  if ("response" in body) return body.response;

  // 기간·유형은 개요(overview) 답변으로 저장한다. 날짜 규칙(종료 월 ≥ 시작 월 등)은 개요 스키마가 검사한다.
  const overview = overviewSchema.safeParse({
    ...emptyProjectAnswers().overview,
    startMonth: body.data.startMonth ?? null,
    endMonth: body.data.endMonth ?? null,
    ongoing: body.data.ongoing ?? false,
    projectType: body.data.projectType ?? null,
  });
  if (!overview.success) {
    const { fieldErrors, formErrors } = z.flattenError(overview.error);
    const message = formErrors[0] ?? Object.values(fieldErrors).flat()[0] ?? "기간을 확인해 주세요.";
    return fail(400, "validation_failed", String(message), { fieldErrors });
  }

  const { data: workspace } = await auth.supabase.from("workspace").select("id").maybeSingle();
  if (!workspace) return fail(500, "no_workspace", "워크스페이스를 찾지 못했어요. 다시 로그인해 주세요.");

  const { data, error } = await auth.supabase
    .from("project")
    .insert({
      owner_id: auth.user.id,
      workspace_id: workspace.id,
      folder_id: body.data.folder_id ?? null,
      title: body.data.title,
      answers: { ...emptyProjectAnswers(), overview: overview.data },
    })
    .select(LIST_COLUMNS)
    .single();

  if (error) {
    // 폴더가 없거나 남의 폴더면 복합 외래키가 막는다
    if (error.code === "23503") return fail(400, "invalid_folder", "선택한 폴더를 찾을 수 없어요.");
    return fail(500, "create_failed", "프로젝트를 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  }
  return ok(data, { status: 201 });
}
