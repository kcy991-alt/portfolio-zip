"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/modal";
import { ScaledPage, usePagination } from "@/components/portfolio-output";
import { createSamplePortfolio } from "@/lib/portfolio/sample";

const TYPE_LABEL: Record<string, string> = {
  cover: "표지",
  summary: "Summary",
  profile: "프로필",
  project_intro: "프로젝트 소개",
  project_analysis: "프로젝트 분석",
  project_execution: "프로젝트 실행",
  project_result: "프로젝트 결과",
};

/** 완성된 포트폴리오가 어떤 모양인지 보여 주는 예시. 실제 PDF와 같은 페이지 그리기를 쓰고, 저장되지 않는다. */
export function SamplePreview({ onClose, onStart }: { onClose: () => void; onStart: () => void }) {
  const doc = useMemo(() => createSamplePortfolio(), []);
  const { status, pages } = usePagination(doc);
  const [index, setIndex] = useState(0);
  const page = pages[Math.min(index, pages.length - 1)];

  return (
    <Modal wide title="포트폴리오 완성 예시" description="경험을 기록하고 프로젝트를 선택하면, 이런 포트폴리오를 만들 수 있어요." onClose={onClose}>
      {status === "measuring" || !page ? (
        <p className="py-16 text-center text-muted">예시를 만드는 중이에요…</p>
      ) : (
        <>
          <ScaledPage page={page} total={pages.length} />
          <div className="mt-3 flex items-center justify-between gap-2">
            <button type="button" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0} className="min-h-11 rounded-control border border-line px-4 text-sm font-medium hover:bg-canvas disabled:opacity-40">
              이전
            </button>
            <p className="text-center text-sm text-muted" aria-live="polite">
              <span className="font-semibold text-ink">{TYPE_LABEL[page.type]}</span> · {index + 1} / {pages.length}
            </p>
            <button type="button" onClick={() => setIndex((i) => Math.min(pages.length - 1, i + 1))} disabled={index >= pages.length - 1} className="min-h-11 rounded-control border border-line px-4 text-sm font-medium hover:bg-canvas disabled:opacity-40">
              다음
            </button>
          </div>
        </>
      )}
      <div className="mt-5 flex flex-wrap justify-end gap-2 border-t border-line pt-4">
        <button type="button" onClick={onClose} className="min-h-11 rounded-control border border-line px-4 text-sm font-medium hover:bg-canvas">
          닫기
        </button>
        <button type="button" onClick={onStart} className="min-h-11 rounded-control bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover">
          내 포트폴리오 만들기
        </button>
      </div>
    </Modal>
  );
}
