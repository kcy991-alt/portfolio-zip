"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { api, ApiError } from "@/lib/api/client";
import type { PortfolioDoc } from "@/lib/portfolio/model";
import { countByLevel, runPreflight, type Check } from "@/lib/portfolio/output";
import { useAuth } from "./auth-context";
import { CANVAS_H, CANVAS_W, PageFrame, ScaledPage, usePagination } from "./portfolio-output";
import { useWorkspace } from "./workspace-data";

type Loaded = { state: "loading" } | { state: "ready"; doc: PortfolioDoc } | { state: "notFound" } | { state: "error"; message: string };

const primaryBtn = "inline-flex min-h-11 items-center rounded-control bg-accent px-4 font-semibold text-white hover:bg-accent-hover";
const subBtn = "inline-flex min-h-11 items-center rounded-control border border-line px-4 hover:bg-canvas";

function useOutputDoc(id: string): Loaded {
  const { status } = useAuth();
  const { getLocalPortfolio } = useWorkspace();
  const [remote, setRemote] = useState<Loaded>({ state: "loading" });

  useEffect(() => {
    if (status !== "signedIn") return;
    let cancelled = false;
    api<PortfolioDoc>(`/api/portfolios/${id}`)
      .then((doc) => !cancelled && setRemote({ state: "ready", doc }))
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) setRemote({ state: "notFound" });
        else setRemote({ state: "error", message: e instanceof Error ? e.message : "포트폴리오를 불러오지 못했어요." });
      });
    return () => {
      cancelled = true;
    };
  }, [status, id]);

  if (status === "loading") return { state: "loading" };
  if (status === "guest") {
    const doc = getLocalPortfolio(id);
    return doc ? { state: "ready", doc } : { state: "notFound" };
  }
  return remote;
}

function recordEvent(name: "preview_opened" | "print_requested", id: string) {
  const guest = id.startsWith("local-");
  trackEvent(name, guest ? "guest" : "member");
  // 자체 DB에는 비로그인 체험을 기록하지 않는다. 실패해도 사용자 동작은 막지 않는다.
  if (guest) return;
  api("/api/events", { method: "POST", body: { name, object_id: id } }).catch(() => {});
}

const LEVEL_STYLE: Record<Check["level"], { label: string; cls: string }> = {
  block: { label: "채워 주세요", cls: "border-danger text-danger" },
  warn: { label: "확인 필요", cls: "border-[#b7791f] text-[#8a5a00]" },
  info: { label: "참고", cls: "border-line text-muted" },
};

function PreflightPanel({ checks, id }: { checks: Check[]; id: string }) {
  if (checks.length === 0) return <p className="rounded-card border border-line bg-panel p-4">점검할 문제가 없어요. 출력할 수 있어요.</p>;
  return (
    <ul className="flex flex-col gap-2" aria-label="출력 전 점검">
      {checks.map((c) => (
        <li key={c.id} className="rounded-card border border-line bg-panel p-3">
          <p className="flex flex-wrap items-center gap-2">
            <span className={`rounded border px-2 text-xs font-semibold ${LEVEL_STYLE[c.level].cls}`}>{LEVEL_STYLE[c.level].label}</span>
            <strong>{c.title}</strong>
          </p>
          <p className="mt-1 text-sm text-muted">{c.detail}</p>
          {c.level !== "info" && (
            <Link href={`/portfolios/${id}/edit${c.pageId ? `?page=${c.pageId}` : ""}`} className="mt-1 inline-flex min-h-11 items-center text-sm text-accent underline">
              고치러 가기
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="text-muted">{body}</p>
      <Link href="/portfolios" className={primaryBtn}>
        포트폴리오 목록으로
      </Link>
    </main>
  );
}

function OutputView({ doc, mode }: { doc: PortfolioDoc; mode: "preview" | "print" }) {
  const pagination = usePagination(doc);
  const sent = useRef(false);

  const checks = useMemo(() => (pagination.status === "ready" ? runPreflight({ doc, pages: pagination.pages, failedImages: pagination.failedImages }) : []), [doc, pagination]);
  const counts = countByLevel(checks);
  const ready = pagination.status === "ready";
  const blocked = counts.block > 0;
  // 점검에서 문제가 보여도 PDF 저장은 막지 않는다(사용자 결정). 내보낼 페이지가 있으면 바로 저장할 수 있다.
  const canPrint = ready && pagination.pages.length > 0;
  const total = pagination.pages.length;

  useEffect(() => {
    if (mode === "preview" && !sent.current) {
      sent.current = true;
      recordEvent("preview_opened", doc.id);
    }
  }, [mode, doc.id]);

  const print = useCallback(() => {
    recordEvent("print_requested", doc.id);
    window.print();
  }, [doc.id]);

  if (mode === "print") {
    return (
      <main className="flex-1">
        <div className="print:hidden mx-auto flex max-w-3xl flex-col gap-3 p-4">
          <h1 className="text-xl font-bold">PDF로 저장하기</h1>
          <ol className="list-decimal pl-5 text-sm text-muted">
            <li>아래 &lsquo;인쇄 창 열기&rsquo;를 누르세요.</li>
            <li>프린터(대상)를 <strong>PDF로 저장</strong>으로 고르세요.</li>
            <li>설정에서 <strong>여백: 없음</strong>, <strong>배경 그래픽: 켜기</strong>를 확인하고 저장하세요.</li>
          </ol>
          {!ready && <p role="status">페이지를 나누는 중이에요…</p>}
          {ready && blocked && (
            <p role="status" className="text-sm text-danger">
              채우지 않은 필수 항목이 {counts.block}개 있어요. 그대로 저장할 수 있지만 그 부분은 비어서 나와요.{" "}
              <Link href={`/portfolios/${doc.id}/preview`} className="underline">
                미리보기에서 확인하기
              </Link>
            </p>
          )}
          <div className="flex gap-2">
            <button type="button" disabled={!canPrint} onClick={print} className={`${primaryBtn} disabled:cursor-not-allowed disabled:bg-line disabled:text-muted`}>
              인쇄 창 열기
            </button>
            <Link href={`/portfolios/${doc.id}/preview`} className={subBtn}>
              미리보기로
            </Link>
          </div>
        </div>
        {ready && (
          <div className="print-pages flex flex-col items-center gap-4 pb-8 print:gap-0 print:pb-0">
            {pagination.pages.map((p) => (
              <div key={p.key} className="print-page overflow-hidden bg-white shadow-card print:shadow-none" style={{ width: "320mm", height: "180mm" }}>
                <div style={{ width: CANVAS_W, height: CANVAS_H, transform: `scale(${(320 / 25.4 * 96) / CANVAS_W})`, transformOrigin: "top left" }}>
                  <PageFrame page={p} total={total} />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">미리보기 · {doc.title}</h1>
        <div className="flex gap-2">
          <Link href={`/portfolios/${doc.id}/edit`} className={subBtn}>
            편집으로 돌아가기
          </Link>
          {canPrint ? (
            <Link href={`/portfolios/${doc.id}/print`} className={primaryBtn}>
              PDF로 저장하기
            </Link>
          ) : (
            <button type="button" disabled className="min-h-11 cursor-not-allowed rounded-control bg-line px-4 text-muted">
              PDF로 저장하기
            </button>
          )}
        </div>
      </div>

      {!ready && (
        <p role="status" className="text-muted">
          글꼴과 이미지를 확인하며 페이지를 나누는 중이에요…
        </p>
      )}

      {ready && (
        <section aria-label="출력 전 점검" className="flex flex-col gap-2">
          <h2 className="font-bold">
            출력 전 점검 · 채워 주세요 {counts.block} · 확인 필요 {counts.warn} · 참고 {counts.info}
          </h2>
          <PreflightPanel checks={checks} id={doc.id} />
          {(blocked || counts.warn > 0) && <p className="text-sm text-muted">아래 항목이 있어도 &lsquo;PDF로 저장하기&rsquo;를 바로 누를 수 있어요.</p>}
        </section>
      )}

      {ready && (
        <section aria-label="전체 페이지" className="flex flex-col gap-4">
          <h2 className="font-bold">전체 {total}페이지</h2>
          {pagination.pages.map((p) => (
            <div key={p.key} className="flex flex-col gap-1">
              <ScaledPage page={p} total={total} />
              {p.overflow && <p className="text-sm text-danger">이 페이지는 내용이 칸에 다 들어가지 않아요. 글을 줄이거나 나눠 주세요.</p>}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}

export function PortfolioOutputScreen({ id, mode }: { id: string; mode: "preview" | "print" }) {
  const loaded = useOutputDoc(id);
  if (loaded.state === "loading") return <p className="p-4 text-muted" aria-live="polite">불러오는 중이에요…</p>;
  if (loaded.state === "notFound") return <Message title="포트폴리오를 찾을 수 없어요" body="체험 중에 만든 포트폴리오는 새로고침하면 사라져요. 삭제되었거나 주소가 올바르지 않을 수도 있어요." />;
  if (loaded.state === "error") return <Message title="불러오지 못했어요" body={loaded.message} />;
  return <OutputView key={mode} doc={loaded.doc} mode={mode} />;
}
