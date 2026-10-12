"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api/client";
import { projectAnswersSchema } from "@/lib/validation/project-answers";
import { useAuth } from "./auth-context";
import { ProjectEditor, type RealProject } from "./project-editor";
import { useWorkspace } from "./workspace-data";

type Loaded =
  | { state: "loading" }
  | { state: "ready"; project: RealProject; version: number }
  | { state: "notFound" }
  | { state: "error"; message: string };

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

function RealProjectScreen({ id }: { id: string }) {
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });

  const load = useCallback(async () => {
    setLoaded({ state: "loading" });
    try {
      const data = await api<{
        id: string;
        title: string;
        answers: unknown;
        record_status: "draft" | "done";
        revision: number;
        last_step: number;
      }>(`/api/projects/${id}`);
      // 예전 버전에서 저장된 값이 일부 비어 있어도 안전하게 열리도록 기본값으로 채운다
      const answers = projectAnswersSchema.parse(data.answers ?? {});
      setLoaded((prev) => ({
        state: "ready",
        version: prev.state === "ready" ? prev.version + 1 : 0,
        project: { id: data.id, title: data.title, answers, record_status: data.record_status, revision: data.revision, last_step: data.last_step },
      }));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setLoaded({ state: "notFound" });
      else setLoaded({ state: "error", message: e instanceof Error ? e.message : "프로젝트를 불러오지 못했어요." });
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 화면이 열릴 때 서버에서 프로젝트를 가져온다
    void load();
  }, [load]);

  if (loaded.state === "loading") return <p className="p-4 text-muted" aria-live="polite">프로젝트를 불러오는 중이에요…</p>;
  if (loaded.state === "notFound") {
    return (
      <Message title="프로젝트를 찾을 수 없어요" body="삭제되었거나 주소가 올바르지 않아요.">
        <Link href="/workspace" className={primaryLink}>
          프로젝트 아카이브로
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
  return <ProjectEditor key={`${loaded.project.id}-${loaded.version}`} mode="real" project={loaded.project} onReload={() => void load()} />;
}

/** 프로젝트 화면. 로그인하지 않은 사용자는 브라우저 메모리의 체험 프로젝트(id가 local-로 시작)를, 로그인한 사용자는 서버의 프로젝트를 연다. */
export function ProjectScreen({ id }: { id: string }) {
  const { status } = useAuth();
  const { getLocalProject, updateLocalProject } = useWorkspace();

  if (status === "loading") return <p className="p-4 text-muted">확인하는 중이에요…</p>;

  if (status === "guest") {
    const local = getLocalProject(id);
    if (!local) {
      return (
        <Message title="체험 중에 만든 프로젝트는 새로고침하면 사라져요" body="로그인하지 않고 만든 프로젝트는 저장되지 않아서 이 주소로는 다시 열 수 없어요.">
          <Link href="/workspace" className={primaryLink}>
            프로젝트 아카이브로
          </Link>
        </Message>
      );
    }
    return <ProjectEditor key={local.id} mode="local" project={local} onLocalChange={(patch) => updateLocalProject(id, patch)} />;
  }

  return <RealProjectScreen id={id} />;
}
