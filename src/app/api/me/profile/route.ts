import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, ok } from "@/lib/api/response";
import { getAuthed, parseBody } from "@/lib/api/server";
import { emptyProfile, profileSchema } from "@/lib/validation/portfolio";

const putBodySchema = z.object({
  // 0은 "아직 저장한 적 없음"이다. 처음 저장할 때만 0을 보낸다.
  expected_revision: z.number().int().min(0),
  profile: profileSchema,
});

/** 마이페이지 프로필 조회. 저장한 적이 없으면 빈 프로필과 revision 0을 돌려준다. */
export async function GET() {
  const auth = await getAuthed();
  if ("response" in auth) return auth.response;

  const { data, error } = await auth.supabase.from("my_profile").select("profile, revision").maybeSingle();
  if (error) return fail(500, "load_failed", "마이페이지를 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  if (!data) return ok({ profile: emptyProfile(), revision: 0 });
  const parsed = profileSchema.safeParse(data.profile);
  return ok({ profile: parsed.success ? parsed.data : emptyProfile(), revision: data.revision });
}

/** 마이페이지 프로필 저장. expected_revision이 현재와 같을 때만 저장하고, 다르면 409를 돌려준다 (spec 10.3). */
export async function PUT(request: NextRequest) {
  const auth = await getAuthed(request);
  if ("response" in auth) return auth.response;
  const body = await parseBody(request, putBodySchema);
  if ("response" in body) return body.response;
  const { expected_revision, profile } = body.data;

  const conflict = async () => {
    const { data: current } = await auth.supabase.from("my_profile").select("revision").maybeSingle();
    return fail(409, "conflict", "다른 곳에서 먼저 수정되었어요. 최신 버전을 확인해 주세요.", { latestRevision: current?.revision ?? 0 });
  };

  if (expected_revision === 0) {
    const { data, error } = await auth.supabase.from("my_profile").insert({ owner_id: auth.user.id, profile }).select("revision").single();
    if (error?.code === "23505") return conflict(); // 다른 탭에서 먼저 처음 저장했다
    if (error) return fail(500, "save_failed", "저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    return ok({ revision: data.revision });
  }

  const { data, error } = await auth.supabase
    .from("my_profile")
    .update({ profile })
    .eq("owner_id", auth.user.id)
    .eq("revision", expected_revision)
    .select("revision")
    .maybeSingle();
  if (error) return fail(500, "save_failed", "저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
  if (data) return ok({ revision: data.revision });
  return conflict();
}
