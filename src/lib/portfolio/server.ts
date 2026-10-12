import type { SupabaseClient } from "@supabase/supabase-js";
import { coverSchema, emptyCover, emptyProfile, emptySummary, profileSchema, summarySchema } from "@/lib/validation/portfolio";
import { emptyProjectAnswers, projectAnswersSchema } from "@/lib/validation/project-answers";
import type { PortfolioDoc, PortfolioImage, PortfolioPageDoc, PortfolioPageType, PortfolioProjectDoc } from "./model";

const EXPIRES_IN_SECONDS = 600; // 이미지 서명 주소는 10분 동안 유효하다 (spec 11장)

/** DB 함수(RPC)가 던진 오류를 응답 상태로 바꾼다. P0002는 없음, 22023은 잘못된 요청이다. */
export function rpcStatus(error: { code?: string } | null): 404 | 400 | 500 {
  if (error?.code === "P0002") return 404;
  if (error?.code === "22023") return 400;
  return 500;
}

/**
 * 제작본 하나를 편집 화면이 쓰는 모양으로 읽어 온다.
 * 사용자 세션으로 읽으므로 남의 제작본은 보이지 않는다(없는 것과 같게 null).
 */
export async function loadPortfolioDoc(supabase: SupabaseClient, id: string): Promise<PortfolioDoc | null> {
  const { data: portfolio } = await supabase
    .from("portfolio")
    .select("id, title, cover, summary, profile, revision")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!portfolio) return null;

  const [projectsRes, pagesRes, assetsRes] = await Promise.all([
    supabase.from("portfolio_project").select("id, source_project_id, source_revision, snapshot, revision, sort_order").eq("portfolio_id", id).order("sort_order"),
    supabase.from("portfolio_page").select("id, type, portfolio_project_id, section_keys, hidden").eq("portfolio_id", id),
    supabase.from("portfolio_asset").select("id, portfolio_project_id, asset_id, section_key, caption, alt_text, decorative, sort_order, include_in_output").eq("portfolio_id", id).order("sort_order"),
  ]);
  if (projectsRes.error || pagesRes.error || assetsRes.error) return null;

  // 원본 상태: 아직 있는가, 사본을 만든 뒤 바뀌었는가
  const sourceIds = (projectsRes.data ?? []).map((p) => p.source_project_id).filter((v): v is string => Boolean(v));
  const { data: sources } = sourceIds.length
    ? await supabase.from("project").select("id, revision, deleted_at").in("id", sourceIds)
    : { data: [] as { id: string; revision: number; deleted_at: string | null }[] };
  const sourceById = new Map((sources ?? []).map((s) => [s.id, s]));

  // 이미지 보기 주소
  const assetIds = [...new Set((assetsRes.data ?? []).map((a) => a.asset_id))];
  const { data: assetRows } = assetIds.length
    ? await supabase.from("asset").select("id, storage_path, width, height").in("id", assetIds)
    : { data: [] as { id: string; storage_path: string; width: number; height: number }[] };
  const assetById = new Map((assetRows ?? []).map((a) => [a.id, a]));
  const { data: signed } = assetRows?.length
    ? await supabase.storage.from("portfolio-assets").createSignedUrls(assetRows.map((a) => a.storage_path), EXPIRES_IN_SECONDS)
    : { data: [] as { path: string | null; signedUrl: string }[] };
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  const imagesFor = (ppId: string): PortfolioImage[] =>
    (assetsRes.data ?? [])
      .filter((a) => a.portfolio_project_id === ppId)
      .flatMap((a) => {
        const asset = assetById.get(a.asset_id);
        if (!asset) return [];
        return [{ ...a, width: asset.width, height: asset.height, url: urlByPath.get(asset.storage_path) ?? null }];
      });

  const projects: PortfolioProjectDoc[] = (projectsRes.data ?? []).map((p) => {
    const source = p.source_project_id ? sourceById.get(p.source_project_id) : undefined;
    const snapshot = (p.snapshot ?? {}) as { title?: string; answers?: unknown };
    const answers = projectAnswersSchema.safeParse(snapshot.answers ?? {});
    return {
      id: p.id,
      source_project_id: p.source_project_id,
      source_available: Boolean(source && source.deleted_at === null),
      source_changed: Boolean(source && source.deleted_at === null && p.source_revision !== null && source.revision !== p.source_revision),
      revision: p.revision,
      sort_order: p.sort_order,
      title: snapshot.title ?? "제목 없음",
      answers: answers.success ? answers.data : emptyProjectAnswers(),
      images: imagesFor(p.id),
    };
  });

  const pages: PortfolioPageDoc[] = (pagesRes.data ?? []).map((p) => ({
    id: p.id,
    type: p.type as PortfolioPageType,
    portfolio_project_id: p.portfolio_project_id,
    section_keys: p.section_keys ?? [],
    hidden: p.hidden,
  }));

  const cover = coverSchema.safeParse(portfolio.cover);
  const summary = summarySchema.safeParse(portfolio.summary);
  const profile = profileSchema.safeParse(portfolio.profile);
  return {
    id: portfolio.id,
    title: portfolio.title,
    revision: portfolio.revision,
    cover: cover.success ? cover.data : emptyCover(),
    summary: summary.success ? summary.data : emptySummary(),
    profile: profile.success ? profile.data : emptyProfile(),
    projects,
    pages,
  };
}
