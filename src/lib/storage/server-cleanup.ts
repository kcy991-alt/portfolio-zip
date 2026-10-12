import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteAccount } from "@/lib/account/delete-account";

const BUCKET = "portfolio-assets";
const BATCH = 200;

export type CleanupReport = { unreferencedAssets: number; orphanFiles: number; retriedAccounts: number; failed: number };

/**
 * 서버 정리 작업(하루 1회, spec 11장·14장):
 * 1) 어디에서도 쓰지 않는 이미지(휴지통 영구 삭제·30일 자동 삭제 뒤 남은 것, 삭제 표시만 남은 것)의 파일과 행을 지운다.
 * 2) 업로드 후 등록에 실패해 asset 행이 없는 파일을 지운다.
 * 3) 실패한 계정 삭제를 다시 처리한다.
 * 올린 직후 붙이는 중인 파일을 지우지 않도록 하루 이상 지난 것만 본다.
 */
export async function runCleanup(admin: SupabaseClient): Promise<CleanupReport> {
  const report: CleanupReport = { unreferencedAssets: 0, orphanFiles: 0, retriedAccounts: 0, failed: 0 };

  const { data: assets } = await admin.rpc("list_unreferenced_assets", { p_older_than: "1 day", p_limit: BATCH });
  for (const a of (assets ?? []) as { id: string; storage_path: string }[]) {
    const removed = await admin.storage.from(BUCKET).remove([a.storage_path]);
    if (removed.error) {
      report.failed++;
      continue;
    }
    const { error } = await admin.from("asset").delete().eq("id", a.id);
    if (error) report.failed++;
    else report.unreferencedAssets++;
  }

  const { data: orphans } = await admin.rpc("list_orphan_storage_objects", { p_older_than: "1 day", p_limit: BATCH });
  const names = ((orphans ?? []) as { name: string }[]).map((o) => o.name);
  if (names.length) {
    const removed = await admin.storage.from(BUCKET).remove(names);
    if (removed.error) report.failed += names.length;
    else report.orphanFiles += names.length;
  }

  const { data: jobs } = await admin
    .from("deletion_job")
    .select("owner_id")
    .eq("kind", "account")
    .in("status", ["failed", "pending"])
    .lt("retry_count", 5)
    .limit(20);
  for (const j of jobs ?? []) {
    const r = await deleteAccount(admin, j.owner_id);
    if (r.ok) report.retriedAccounts++;
    else report.failed++;
  }
  return report;
}
