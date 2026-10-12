import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "portfolio-assets";

/** 사용자 폴더({user_id}/) 아래 파일을 모두 지운다. 지울 것이 없어질 때까지 반복한다. */
async function removeAllFiles(admin: SupabaseClient, userId: string) {
  for (let round = 0; round < 200; round++) {
    const { data, error } = await admin.storage.from(BUCKET).list(userId, { limit: 100 });
    if (error) throw new Error("storage_list_failed");
    if (!data || data.length === 0) return;
    const { error: removeError } = await admin.storage.from(BUCKET).remove(data.map((f) => `${userId}/${f.name}`));
    if (removeError) throw new Error("storage_remove_failed");
  }
  throw new Error("storage_too_many_files");
}

/**
 * 계정을 지운다: 이미지 파일 → 계정(관련 행은 연쇄 삭제). 작업 상태를 deletion_job에 남기고, 중간에 실패하면 failed로 두어서
 * 다시 요청하거나 서버 정리 작업이 이어서 처리할 수 있다(같은 일을 여러 번 해도 안전하다).
 */
export async function deleteAccount(admin: SupabaseClient, userId: string): Promise<{ ok: true } | { ok: false }> {
  const { data: existing } = await admin
    .from("deletion_job")
    .select("id, retry_count")
    .eq("owner_id", userId)
    .eq("kind", "account")
    .neq("status", "done")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let jobId: string | null = existing?.id ?? null;
  const retries = existing ? existing.retry_count + 1 : 0;
  if (jobId) {
    await admin.from("deletion_job").update({ status: "running", retry_count: retries, updated_at: new Date().toISOString() }).eq("id", jobId);
  } else {
    const { data } = await admin.from("deletion_job").insert({ owner_id: userId, kind: "account", status: "running" }).select("id").single();
    jobId = data?.id ?? null;
  }

  const finish = async (status: "done" | "failed") => {
    if (jobId) await admin.from("deletion_job").update({ status, updated_at: new Date().toISOString() }).eq("id", jobId);
  };

  try {
    await removeAllFiles(admin, userId);
    const { error } = await admin.auth.admin.deleteUser(userId);
    // 이미 지워진 계정이면 성공으로 본다(재시도)
    if (error && !/not.?found/i.test(error.message)) throw new Error("delete_user_failed");
    await finish("done");
    return { ok: true };
  } catch (e) {
    console.error("[account_deletion_failed]", e instanceof Error ? e.message : "unknown");
    await finish("failed");
    return { ok: false };
  }
}
