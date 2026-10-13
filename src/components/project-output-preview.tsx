"use client";

import { useMemo } from "react";
import { PAGE_TYPE_LABEL, projectPreviewDoc, type PortfolioImage } from "@/lib/portfolio/model";
import { useDebounced } from "@/lib/use-debounced";
import type { ProjectAnswers } from "@/lib/validation/project-answers";
import { PAGE_LAYOUT, PAGE_ORDER, type PageType } from "@/templates/pm-v1";
import { OutputPages } from "./output-pages";
import { usePagination } from "./portfolio-output";

const NO_IMAGES: PortfolioImage[] = [];

/**
 * 프로젝트 아카이브 편집 화면의 미리보기. 포트폴리오 PDF와 같은 렌더러로 프로젝트의 4개 페이지(소개·분석·실행·결과)를 그린다.
 * 지금 입력 중인 구역(activeZone)은 윤곽선과 "작성 위치"로 알린다.
 */
export function ProjectOutputPreview({
  title,
  answers,
  images = NO_IMAGES,
  page,
  onPageChange,
  activeZone,
  onCollapse,
}: {
  title: string;
  answers: ProjectAnswers;
  images?: PortfolioImage[];
  page: PageType;
  onPageChange: (p: PageType) => void;
  activeZone: string | null;
  /** 있으면 "미리보기 접기" 버튼을 보여 준다(넓은 화면에서만 의미가 있다) */
  onCollapse?: () => void;
}) {
  const doc = useMemo(() => projectPreviewDoc(title, answers, images), [title, answers, images]);
  const pagination = usePagination(useDebounced(doc, 300));
  const mine = pagination.pages.filter((p) => p.logicalId === `preview-page-${page}`);
  const pageIndex = PAGE_ORDER.indexOf(page);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="break-keep text-base font-bold">포트폴리오 미리보기 · 프로젝트 {PAGE_LAYOUT[page].title}</h2>
        <div className="flex shrink-0 items-center gap-2 whitespace-nowrap text-sm">
          <button type="button" disabled={pageIndex === 0} onClick={() => onPageChange(PAGE_ORDER[pageIndex - 1])} className="min-h-11 rounded-control border border-line px-3 disabled:text-muted">
            이전
          </button>
          <span aria-live="polite">
            페이지 {pageIndex + 1} / {PAGE_ORDER.length}
          </span>
          <button type="button" disabled={pageIndex === PAGE_ORDER.length - 1} onClick={() => onPageChange(PAGE_ORDER[pageIndex + 1])} className="min-h-11 rounded-control border border-line px-3 disabled:text-muted">
            다음
          </button>
        </div>
      </div>

      {mine.length > 0 ? (
        <OutputPages pages={mine} total={pagination.pages.length} activeZone={activeZone} />
      ) : pagination.status === "measuring" ? (
        <p className="rounded-card border border-dashed border-line bg-panel p-6 text-sm text-muted">미리보기를 그리는 중이에요…</p>
      ) : (
        <p className="rounded-card border border-dashed border-line bg-panel p-6 text-sm text-muted">
          {PAGE_TYPE_LABEL[page]} 페이지에는 아직 쓴 내용이 없어요. 왼쪽에서 입력하면 여기에 나타나요. 비어 있는 페이지는 출력에도 나오지 않아요.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">PDF로 저장했을 때와 같은 모습이에요. 비어 있는 부분은 출력에서도 나오지 않아요.</p>
        {onCollapse && (
          <button type="button" onClick={onCollapse} className="hidden min-h-11 items-center rounded-control border border-line px-3 text-sm hover:bg-canvas xl:inline-flex">
            미리보기 접기
          </button>
        )}
      </div>
    </div>
  );
}
