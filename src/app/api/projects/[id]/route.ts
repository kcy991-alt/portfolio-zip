import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { getAuthed, isUuid, notFound, parseBody } from "@/lib/api/server";
import { patchProjectBodySchema } from "@/lib/validation/api";

const DETAIL_COLUMNS = "id, title, folder_id, answers, record_status, revision, last_step, template_key, template_version, updated_at";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/projects/[id]">) {
  const { id } = await ctx.params;
  const auth = await getAuthed();
  if ("response" in auth) return auth.response;
  if (!isUuid(id)) return notFound("프로젝트");

  const { data, error } = await auth.supabase.from("project").select(DETAIL_COLUMNS).eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) return fail(500, "load_failed", "프로젝트를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  if (!data) return notFound("프로젝트");
  return ok(data);
}

/** 프로젝트를 휴지통으로 보낸다(삭제 표시만 한다). 30일 동안 복원할 수 있다 (spec F13). */
export async function DELETE(_request: NextRequest, ctx: RouteContext<"/api/projects/[id]">) {
  const { id } = await ctx.params;
  const auth = await getAuthed(_request);
  if ("response" in auth) return auth.response;
  if (!isUuid(id)) return notFound("프로젝트");

  const { data, error } = await auth.supabase
    .from("project")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) return fail(500, "delete_failed", "프로젝트를 지우지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  if (!data) return notFound("프로젝트");
  return ok({ id });
}

/**
 * 저장 (spec 10.3). expected_revision이 현재 revision과 같을 때만 갱신한다.
 * revision은 DB 트리거가 올린다. 다르면 409와 서버의 최신 revision을 돌려준다(자동 덮어쓰기 금지).
 */
export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/projects/[id]">) {
  const { id } = await ctx.params;
  const auth = await getAuthed(request);
  if ("response" in auth) return auth.response;
  if (!isUuid(id)) return notFound("프로젝트");
  const body = await parseBody(request, patchProjectBodySchema);
  if ("response" in body) return body.response;

  const { expected_revision, ...fields } = body.data;
  const update: Record<string, unknown> = {};
  if (fields.title !== undefined) update.title = fields.title;
  if (fields.answers !== undefined) update.answers = fields.answers;
  if (fields.record_status !== undefined) update.record_status = fields.record_status;
  if (fields.last_step !== undefined) update.last_step = fields.last_step;

  const { data, error } = await auth.supabase
    .from("project")
    .update(update)
    .eq("id", id)
    .eq("revision", expected_revision)
    .is("deleted_at", null)
    .select("revision, updated_at")
    .maybeSingle();
  if (error) return fail(500, "save_failed", "저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  if (data) return ok(data);

  // 갱신된 행이 없다: 프로젝트가 없거나, 다른 곳에서 먼저 수정되었다.
  const { data: current } = await auth.supabase.from("project").select("revision").eq("id", id).is("deleted_at", null).maybeSingle();
  if (!current) return notFound("프로젝트");
  return fail(409, "conflict", "다른 곳에서 먼저 수정되었어요. 최신 버전을 확인해 주세요.", { latestRevision: current.revision });
}
