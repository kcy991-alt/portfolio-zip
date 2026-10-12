"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api/client";
import type { CopySource, PortfolioDoc } from "@/lib/portfolio/model";
import { useLocalPortfolioEditor, useRemotePortfolioEditor } from "@/lib/portfolio/use-portfolio-editor";
import { useAuth } from "./auth-context";
import { PortfolioEditorView } from "./portfolio-editor";
import { useWorkspace } from "./workspace-data";

function Message({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="text-muted">{body}</p>
      {children}
    </main>
  );
}

const primaryLink = "inline-flex min-h-11 items-center rounded-control bg-accent px-4 font-semibold text-white hover:bg-accent-hover";

function LocalPortfolio({ doc, id }: { doc: PortfolioDoc; id: string }) {
  const { updateLocalPortfolio, getLocalProject } = useWorkspace();
  const update = useCallback((fn: (d: PortfolioDoc) => PortfolioDoc) => updateLocalPortfolio(id, fn), [updateLocalPortfolio, id]);
  const getSource = useCallback(
    (projectId: string): CopySource | undefined => {
      const p = getLocalProject(projectId);
      return p && { id: p.id, title: p.title, answers: p.answers };
    },
    [getLocalProject],
  );
  const editor = useLocalPortfolioEditor(doc, update, getSource);
  return <PortfolioEditorView api={editor} />;
}

function RemotePortfolioEditor({ doc, onReload }: { doc: PortfolioDoc; onReload: () => void }) {
  const editor = useRemotePortfolioEditor(doc, onReload);
  return <PortfolioEditorView api={editor} />;
}

type Loaded = { state: "loading" } | { state: "ready"; doc: PortfolioDoc; version: number } | { state: "notFound" } | { state: "error"; message: string };

function RemotePortfolio({ id }: { id: string }) {
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });

  const load = useCallback(async () => {
    setLoaded({ state: "loading" });
    try {
      const doc = await api<PortfolioDoc>(`/api/portfolios/${id}`);
      setLoaded((prev) => ({ state: "ready", doc, version: prev.state === "ready" ? prev.version + 1 : 0 }));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setLoaded({ state: "notFound" });
      else setLoaded({ state: "error", message: e instanceof Error ? e.message : "포트폴리오를 불러오지 못했어요." });
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 화면이 열릴 때 서버에서 포트폴리오를 가져온다
    void load();
  }, [load]);

  if (loaded.state === "loading") return <p className="p-4 text-muted" aria-live="polite">포트폴리오를 불러오는 중이에요…</p>;
  if (loaded.state === "notFound") {
    return (
      <Message title="포트폴리오를 찾을 수 없어요" body="삭제되었거나 주소가 올바르지 않아요.">
        <Link href="/portfolios" className={primaryLink}>
          포트폴리오 목록으로
        </Link>
      </Message>
    );
  }
  if (loaded.state === "error") {
    return (
      <Message title="불러오지 못했어요" body={loaded.message}>
        <button type="button" onClick={() => void load()} className="min-h-11 rounded-control bg-accent px-4 font-semibold text-white">
          다시 시도
        </button>
      </Message>
    );
  }
  return <RemotePortfolioEditor key={`${loaded.doc.id}-${loaded.version}`} doc={loaded.doc} onReload={() => void load()} />;
}

/** 포트폴리오 편집 화면. 로그인하지 않은 사용자는 브라우저 메모리의 체험 포트폴리오(id가 local-로 시작)를, 로그인한 사용자는 서버의 제작본을 연다. */
export function PortfolioScreen({ id }: { id: string }) {
  const { status } = useAuth();
  const { getLocalPortfolio } = useWorkspace();

  if (status === "loading") return <p className="p-4 text-muted">확인하는 중이에요…</p>;

  if (status === "guest") {
    const doc = getLocalPortfolio(id);
    if (!doc) {
      return (
        <Message title="체험 중에 만든 포트폴리오는 새로고침하면 사라져요" body="로그인하지 않고 만든 포트폴리오는 저장되지 않아서 이 주소로는 다시 열 수 없어요.">
          <Link href="/portfolios" className={primaryLink}>
            포트폴리오 목록으로
          </Link>
        </Message>
      );
    }
    return <LocalPortfolio key={doc.id} doc={doc} id={id} />;
  }

  return <RemotePortfolio id={id} />;
}
