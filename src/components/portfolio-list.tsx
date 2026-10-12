"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, ListRow } from "@/components/app-motion";
import { SamplePreview } from "@/components/sample-preview";
import { useWorkspace } from "@/components/workspace-data";
import { useWorkspaceDialogs } from "@/components/workspace-dialogs";

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("ko-KR");

// 포트폴리오 제작본 목록 (spec S04)
export function PortfolioList() {
  const { mode, portfolios, error, reload } = useWorkspace();
  const { openNewPortfolio, openDeletePortfolio } = useWorkspaceDialogs();
  const ready = mode !== "loading";
  const [sampleOpen, setSampleOpen] = useState(false);
  const sampleButton = (className: string) => (
    <button type="button" onClick={() => setSampleOpen(true)} className={className}>
      포트폴리오 예시 보기
    </button>
  );

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      {mode === "local" && (
        <div role="note" className="mb-6 rounded-card border border-line bg-accent-soft p-4 text-sm">
          <strong>로그인 없이 체험 중이에요</strong>
          <br />
          로그인 없이 자유롭게 체험해 보세요. 작성한 내용은 <strong>저장되지 않으며</strong>, 새로고침하거나 창을 닫으면 사라져요. 저장하려면{" "}
          <Link href="/auth" className="font-medium text-accent underline underline-offset-2">
            로그인
          </Link>
          하세요.
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">포트폴리오 제작</h1>
          <p className="mt-1 text-sm text-muted">기록해 둔 프로젝트 중 지원할 곳에 맞는 경험만 골라 나만의 포트폴리오를 만들어 보세요.</p>
        </div>
        {ready && portfolios.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {sampleButton("min-h-11 rounded-control border border-line bg-panel px-4 text-sm font-semibold hover:border-accent hover:text-accent")}
            <button type="button" onClick={openNewPortfolio} className="min-h-11 rounded-control bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover">
              새 포트폴리오 만들기
            </button>
          </div>
        )}
      </div>

      {mode === "loading" && <p className="text-muted">불러오는 중이에요…</p>}
      {error && (
        <div role="alert" className="mb-4 rounded-card border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          {error}{" "}
          <button type="button" onClick={() => void reload()} className="font-medium underline underline-offset-2">
            다시 시도
          </button>
        </div>
      )}

      {ready && portfolios.length === 0 && (
        <section className="flex flex-col items-center rounded-card border border-line bg-panel px-4 py-16 text-center shadow-card">
          <h2 className="text-[22px] font-bold sm:text-[28px]">첫 포트폴리오를 만들어 보세요</h2>
          <p className="mt-2 max-w-md text-muted">표지, Summary, 프로필을 쓰고 프로젝트 아카이브에서 프로젝트를 골라 담으면 돼요.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={openNewPortfolio} className="min-h-12 rounded-control bg-accent px-6 font-semibold text-white hover:bg-accent-hover">
              새 포트폴리오 만들기
            </button>
            {sampleButton("min-h-12 rounded-control border border-line bg-panel px-6 font-semibold hover:border-accent hover:text-accent")}
          </div>
          <p className="mt-3 text-sm text-muted">완성되면 어떤 모양인지 먼저 볼 수 있어요.</p>
        </section>
      )}

      {portfolios.length > 0 && (
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {portfolios.map((p) => (
            <ListRow key={p.id} className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-panel p-2 hover:border-accent">
              <Link href={`/portfolios/${p.id}/edit`} className="flex min-h-12 min-w-0 flex-1 flex-wrap items-center justify-between gap-2 px-2">
                <span className="block min-w-0 truncate font-medium">{p.title}</span>
                <span className="text-sm text-muted">
                  프로젝트 {p.project_count}개 · {formatDate(p.updated_at)}
                </span>
              </Link>
              <button type="button" onClick={() => openDeletePortfolio(p)} className="min-h-11 rounded-control px-3 text-sm text-danger hover:bg-danger/5">
                삭제
              </button>
            </ListRow>
            ))}
          </AnimatePresence>
        </ul>
      )}
      {sampleOpen && (
        <SamplePreview
          onClose={() => setSampleOpen(false)}
          onStart={() => {
            setSampleOpen(false);
            openNewPortfolio();
          }}
        />
      )}
    </main>
  );
}
