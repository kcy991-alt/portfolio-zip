// 포트폴리오 제작본의 데이터 모양과 순수 규칙. 서버 응답과 비로그인 체험(브라우저 메모리)이 같은 모양을 쓴다.
import type { ProjectAnswers } from "@/lib/validation/project-answers";
import { emptyCover, emptyProfile, emptySummary, type Cover, type Profile, type Summary } from "@/lib/validation/portfolio";

export type PortfolioPageType =
  | "cover"
  | "summary"
  | "profile"
  | "project_intro"
  | "project_analysis"
  | "project_execution"
  | "project_result";

export const PROJECT_PAGE_TYPES = ["project_intro", "project_analysis", "project_execution", "project_result"] as const;

/**
 * 프로젝트 페이지별 기본 섹션. 질문 구조(templates/pm-v1의 OUTPUT_ZONES)와 같아야 하고, 테스트가 확인한다.
 * 같은 내용이 DB 함수 default_page_sections에도 있다(supabase/migrations/20261008020000_portfolio_schema.sql).
 */
export const DEFAULT_PAGE_SECTIONS: Record<(typeof PROJECT_PAGE_TYPES)[number], string[]> = {
  project_intro: ["overview", "role"],
  project_analysis: ["problem", "evidence", "insight", "hypothesis"],
  project_execution: ["solution", "metrics", "execution", "contribution"],
  project_result: ["result", "reflection"],
};

export type PortfolioImage = {
  id: string;
  asset_id: string;
  section_key: string;
  caption: string;
  alt_text: string;
  decorative: boolean;
  sort_order: number;
  include_in_output: boolean;
  width: number;
  height: number;
  /** 보기용 서명 주소(10분). 체험 중에는 이미지가 없다. */
  url: string | null;
};

export type PortfolioProjectDoc = {
  id: string;
  source_project_id: string | null;
  /** 원본이 아직 있고 휴지통에 있지 않은가 (다시 가져오기 가능 여부) */
  source_available: boolean;
  /** 사본을 만든 뒤 원본이 수정되었는가 ("원본 업데이트 있음" 표시) */
  source_changed: boolean;
  revision: number;
  sort_order: number;
  title: string;
  answers: ProjectAnswers;
  images: PortfolioImage[];
};

export type PortfolioPageDoc = {
  id: string;
  type: PortfolioPageType;
  portfolio_project_id: string | null;
  section_keys: string[];
  hidden: boolean;
};

export type PortfolioDoc = {
  id: string;
  title: string;
  revision: number;
  cover: Cover;
  summary: Summary;
  profile: Profile;
  projects: PortfolioProjectDoc[];
  pages: PortfolioPageDoc[];
};

const deepCopy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const uid = () => crypto.randomUUID();

/** 표지 → Summary → 프로필 → 프로젝트 사본(순서대로, 소개·분석·실행·결과). 페이지 순서는 저장하지 않고 이렇게 계산한다. */
export function orderedPages(doc: PortfolioDoc): PortfolioPageDoc[] {
  const byType = (type: PortfolioPageType) => doc.pages.filter((p) => p.type === type && p.portfolio_project_id === null);
  const projects = [...doc.projects].sort((a, b) => a.sort_order - b.sort_order);
  return [
    ...byType("cover"),
    ...byType("summary"),
    ...byType("profile"),
    ...projects.flatMap((pr) =>
      PROJECT_PAGE_TYPES.flatMap((type) => doc.pages.filter((p) => p.portfolio_project_id === pr.id && p.type === type)),
    ),
  ];
}

export const PAGE_TYPE_LABEL: Record<PortfolioPageType, string> = {
  cover: "표지",
  summary: "Summary",
  profile: "프로필",
  project_intro: "소개",
  project_analysis: "분석",
  project_execution: "실행",
  project_result: "결과",
};

// ---------------------------------------------------------------------------
// 비로그인 체험에서 쓰는 순수 동작. 서버(DB 함수)와 같은 규칙으로 동작해야 한다.
// ---------------------------------------------------------------------------

export function createLocalPortfolio(title: string): PortfolioDoc {
  const id = `local-${uid()}`;
  const page = (type: PortfolioPageType): PortfolioPageDoc => ({ id: `local-page-${uid()}`, type, portfolio_project_id: null, section_keys: [], hidden: false });
  return {
    id,
    title,
    revision: 1,
    cover: emptyCover(),
    summary: emptySummary(),
    profile: emptyProfile(),
    projects: [],
    pages: [page("cover"), page("summary"), page("profile")],
  };
}

/**
 * 프로젝트 아카이브 편집 화면의 미리보기용 임시 제작본. 프로젝트 하나를 소개·분석·실행·결과 4개 페이지로 담은 것처럼 만들어서
 * 포트폴리오 PDF와 같은 출력 렌더러로 그린다. 어디에도 저장하지 않는다.
 */
export function projectPreviewDoc(title: string, answers: ProjectAnswers, images: PortfolioImage[] = []): PortfolioDoc {
  const copyId = "preview-copy";
  return {
    id: "preview",
    title,
    revision: 1,
    cover: emptyCover(),
    summary: emptySummary(),
    profile: emptyProfile(),
    projects: [{ id: copyId, source_project_id: null, source_available: false, source_changed: false, revision: 1, sort_order: 0, title, answers, images }],
    pages: PROJECT_PAGE_TYPES.map((type) => ({ id: `preview-page-${type}`, type, portfolio_project_id: copyId, section_keys: [...DEFAULT_PAGE_SECTIONS[type]], hidden: false })),
  };
}

export type CopySource = { id: string; title: string; answers: ProjectAnswers };

/** 프로젝트 원본을 제작본에 복사한다. 원본과 사본은 독립이라 깊은 복사를 한다 (spec 5.3). */
export function addProjectCopy(doc: PortfolioDoc, source: CopySource, copyId: string = `local-pp-${uid()}`): { doc: PortfolioDoc; copyId: string } {
  const next = doc.projects.reduce((max, p) => Math.max(max, p.sort_order), -1) + 1;
  const project: PortfolioProjectDoc = {
    id: copyId,
    source_project_id: source.id,
    source_available: true,
    source_changed: false,
    revision: 1,
    sort_order: next,
    title: source.title,
    answers: deepCopy(source.answers),
    images: [],
  };
  const pages: PortfolioPageDoc[] = PROJECT_PAGE_TYPES.map((type) => ({
    id: `local-page-${uid()}`,
    type,
    portfolio_project_id: copyId,
    section_keys: [...DEFAULT_PAGE_SECTIONS[type]],
    hidden: false,
  }));
  return { doc: { ...doc, projects: [...doc.projects, project], pages: [...doc.pages, ...pages] }, copyId };
}

/** "원본에서 다시 가져오기": 해당 사본의 제목과 답변을 원본으로 교체한다(부분 병합 없음). 페이지 설정은 유지한다. */
export function refreshProjectCopy(doc: PortfolioDoc, copyId: string, source: CopySource): PortfolioDoc {
  return {
    ...doc,
    projects: doc.projects.map((p) =>
      p.id === copyId ? { ...p, title: source.title, answers: deepCopy(source.answers), source_changed: false, revision: p.revision + 1 } : p,
    ),
  };
}

/** 제작본에서 사본을 뺀다(원본은 그대로). Summary가 그 사본을 가리키던 연결은 해제하고 문장은 유지한다 (spec 8.3). */
export function removeProjectCopy(doc: PortfolioDoc, copyId: string): { doc: PortfolioDoc; unlinkedSummaryItems: number } {
  let unlinked = 0;
  const items = doc.summary.items.map((item) => {
    if (!item.projectIds.includes(copyId)) return item;
    unlinked += 1;
    return { ...item, projectIds: item.projectIds.filter((id) => id !== copyId) };
  });
  return {
    doc: {
      ...doc,
      revision: unlinked > 0 ? doc.revision + 1 : doc.revision,
      summary: { ...doc.summary, items },
      projects: doc.projects.filter((p) => p.id !== copyId),
      pages: doc.pages.filter((p) => p.portfolio_project_id !== copyId),
    },
    unlinkedSummaryItems: unlinked,
  };
}

/** 사본의 순서를 한 칸 옮긴다. 맨 앞/뒤에서 더 옮기려 하면 그대로 둔다. */
export function moveProjectCopy(doc: PortfolioDoc, copyId: string, direction: -1 | 1): PortfolioDoc {
  const sorted = [...doc.projects].sort((a, b) => a.sort_order - b.sort_order);
  const index = sorted.findIndex((p) => p.id === copyId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= sorted.length) return doc;
  [sorted[index], sorted[target]] = [sorted[target], sorted[index]];
  return { ...doc, projects: sorted.map((p, i) => ({ ...p, sort_order: i })) };
}

/** 순서 id 목록이 현재 사본 전체와 정확히 같은지(누락·중복 없음) 확인한다 (spec 11장) */
export function isValidOrder(currentIds: string[], nextIds: string[]): boolean {
  if (currentIds.length !== nextIds.length) return false;
  const a = [...currentIds].sort();
  const b = [...nextIds].sort();
  return a.every((id, i) => id === b[i]);
}
