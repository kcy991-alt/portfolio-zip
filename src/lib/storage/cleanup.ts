import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "portfolio-assets";

/**
 * 어느 프로젝트도 쓰지 않는 이미지를 지운다(파일과 asset 행).
 * 사용자 세션으로 하므로 자기 이미지만 지울 수 있다. 파일 삭제가 실패하면 asset에 삭제 표시만 남겨서 사라진 것으로 처리하고,
 * 남은 파일은 이후 서버 정리 작업(D6)이 지운다. 이 함수는 던지지 않고 정리하지 못한 이미지 id를 돌려준다.
 */
export async function cleanupUnreferencedAssets(supabase: SupabaseClient, assetIds: string[]): Promise<string[]> {
  const failed: string[] = [];
  for (const id of new Set(assetIds)) {
    try {
      // 경험 프로젝트나 포트폴리오 제작본 중 한 곳이라도 쓰고 있으면 지우지 않는다 (spec 10.2)
      const [inProjects, inPortfolios] = await Promise.all([
        supabase.from("project_asset").select("id", { count: "exact", head: true }).eq("asset_id", id),
        supabase.from("portfolio_asset").select("id", { count: "exact", head: true }).eq("asset_id", id),
      ]);
      if ((inProjects.count ?? 0) > 0 || (inPortfolios.count ?? 0) > 0) continue;

      const { data: asset } = await supabase.from("asset").select("storage_path").eq("id", id).maybeSingle();
      if (!asset) continue;

      const removed = await supabase.storage.from(BUCKET).remove([asset.storage_path]);
      if (removed.error) {
        await supabase.from("asset").update({ deleted_at: new Date().toISOString() }).eq("id", id);
        failed.push(id);
        continue;
      }
      await supabase.from("asset").delete().eq("id", id);
    } catch {
      failed.push(id);
    }
  }
  return failed;
}
