"use client";

import Link from "next/link";
import { AnimatePresence, ListRow } from "@/components/app-motion";
import { DismissibleTip } from "@/components/dismissible-tip";
import { useWorkspace, type ProjectItem } from "@/components/workspace-data";
import { useWorkspaceDialogs } from "@/components/workspace-dialogs";

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("ko-KR");

function ProjectRow({ project }: { project: ProjectItem }) {
  const { openMoveProject, openDeleteProject } = useWorkspaceDialogs();
  return (
    <ListRow className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-panel p-2 hover:border-accent">
      <Link href={`/workspace/projects/${project.id}`} className="flex min-h-12 min-w-0 flex-1 flex-wrap items-center justify-between gap-2 px-2">
        <span className="block min-w-0 truncate font-medium">{project.title}</span>
        <span className="text-sm text-muted">
          {project.record_status === "draft" ? "초안" : "기록 완료"} · {formatDate(project.updated_at)}
        </span>
      </Link>
      <button type="button" onClick={() => openMoveProject(project)} className="min-h-11 rounded-control px-3 text-sm text-muted hover:bg-canvas hover:text-ink">
        폴더 이동
      </button>
      <button type="button" onClick={() => openDeleteProject(project)} className="min-h-11 rounded-control px-3 text-sm text-danger hover:bg-danger/5">
        삭제
      </button>
    </ListRow>
  );
}

export function WorkspaceHome() {
  const { mode, folders, projects, error, reload } = useWorkspace();
  const { openNewFolder, openNewProject, openRenameFolder, openDeleteFolder } = useWorkspaceDialogs();
  const ready = mode !== "loading";
  const empty = ready && folders.length === 0 && projects.length === 0;

  const groups = [
    ...folders.map((f) => ({ key: f.id, folder: f, name: f.name, items: projects.filter((p) => p.folder_id === f.id) })),
    { key: "unsorted", folder: null, name: "미분류", items: projects.filter((p) => p.folder_id === null) },
  ];

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
        <h1 className="text-2xl font-bold">프로젝트 아카이브</h1>
        {ready && (
          <div className="flex gap-2">
            <button type="button" onClick={openNewFolder} className="min-h-11 rounded-control border border-line bg-panel px-4 text-sm hover:bg-canvas">
              새 폴더
            </button>
            <button type="button" onClick={() => openNewProject(null)} className="min-h-11 rounded-control bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover">
              새 프로젝트
            </button>
          </div>
        )}
      </div>

      {mode === "loading" && (
        <p className="text-muted" aria-live="polite">
          불러오는 중이에요…
        </p>
      )}

      {error && (
        <div role="alert" className="mb-4 rounded-card border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          {error}{" "}
          <button type="button" onClick={() => void reload()} className="font-medium underline underline-offset-2">
            다시 시도
          </button>
        </div>
      )}

      {empty && (
        <>
          <DismissibleTip />
          <section className="flex flex-col items-center rounded-card border border-line bg-panel px-4 py-16 text-center shadow-card">
            <h2 className="text-[22px] font-bold sm:text-[28px]">첫 프로젝트를 기록해 보세요</h2>
            <p className="mt-2 max-w-md text-muted">10단계 질문을 따라 경험을 정리해 보세요. 처음에는 프로젝트 이름과 역할 등 기본 정보만 작성해도 괜찮아요.</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={() => openNewProject(null)} className="min-h-12 rounded-control bg-accent px-6 font-semibold text-white hover:bg-accent-hover">
                새 프로젝트
              </button>
              <button type="button" onClick={openNewFolder} className="min-h-12 rounded-control border border-line px-6 font-medium hover:bg-canvas">
                새 폴더
              </button>
            </div>
          </section>
        </>
      )}

      {ready && !empty && (
        <div className="flex flex-col gap-8">
          {groups.map((g) => (
            <section key={g.key} aria-label={g.name}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-medium text-muted">
                  {g.name} <span className="text-sm">({g.items.length})</span>
                </h2>
                {g.folder && (
                  <div className="flex gap-1">
                    <button type="button" onClick={() => openNewProject(g.folder!.id)} className="min-h-11 rounded-control px-3 text-sm text-accent hover:bg-accent-soft">
                      + 프로젝트
                    </button>
                    <button type="button" onClick={() => openRenameFolder(g.folder!)} className="min-h-11 rounded-control px-3 text-sm text-muted hover:bg-canvas hover:text-ink">
                      이름 변경
                    </button>
                    <button type="button" onClick={() => openDeleteFolder(g.folder!)} className="min-h-11 rounded-control px-3 text-sm text-danger hover:bg-danger/5">
                      삭제
                    </button>
                  </div>
                )}
              </div>
              {g.items.length === 0 ? (
                <p className="rounded-card border border-dashed border-line p-4 text-sm text-muted">프로젝트가 없어요.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  <AnimatePresence initial={false}>
                    {g.items.map((p) => (
                      <ProjectRow key={p.id} project={p} />
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
