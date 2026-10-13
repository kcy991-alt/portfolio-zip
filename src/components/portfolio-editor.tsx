"use client";

import Link from "next/link";
import { AnimatedMessage, SaveStatusChip } from "@/components/app-motion";
import { useEffect, useState } from "react";
import { orderedPages, PAGE_TYPE_LABEL, type PortfolioDoc, type PortfolioPageDoc } from "@/lib/portfolio/model";
import type { PortfolioEditorApi } from "@/lib/portfolio/use-portfolio-editor";
import { useDebounced } from "@/lib/use-debounced";
import { pageOfZone } from "@/templates/pm-v1";
import { GatedButton } from "./gated-button";
import { Modal } from "./modal";
import { ProjectCopyPanel } from "./portfolio-copy-panel";
import { CoverForm, ProfileForm, SummaryForm } from "./portfolio-forms";
import { OutputPages } from "./output-pages";
import { usePagination } from "./portfolio-output";
import { ProfileImport } from "./profile-import";
import { useWorkspace } from "./workspace-data";

const STATUS_TEXT = {
  idle: "저장됨",
  dirty: "저장 대기 중…",
  saving: "저장 중…",
  saved: "저장됨",
  error: "저장 실패",
  conflict: "저장 멈춤 · 다른 곳에서 수정됨",
} as const;

function AddProjectDialog({ api, onClose, onAdded }: { api: PortfolioEditorApi; onClose: () => void; onAdded: (copyIds: string[]) => void }) {
  const { projects, reload } = useWorkspace();
  const [picked, setPicked] = useState<string[]>([]);
  // 창을 열 때 프로젝트 아카이브의 최신 목록을 가져온다(다른 탭에서 방금 만든 프로젝트도 보이도록)
  useEffect(() => {
    void reload();
  }, [reload]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const addedCount = (projectId: string) => api.doc.projects.filter((p) => p.source_project_id === projectId).length;

  const submit = async () => {
    setBusy(true);
    try {
      const ids = await api.addProjects(picked);
      onClose();
      onAdded(ids);
    } catch (e) {
      setError(e instanceof Error ? e.message : "프로젝트를 추가하지 못했어요.");
      setBusy(false);
    }
  };

  return (
    <Modal title="프로젝트 추가" description="프로젝트 아카이브의 프로젝트를 복사해서 담아요. 담은 뒤에 고쳐도 원본은 바뀌지 않아요." onClose={onClose}>
      {projects.length === 0 ? (
        <p className="text-sm text-muted">프로젝트 아카이브에 프로젝트가 없어요. 먼저 프로젝트를 만들어 주세요.</p>
      ) : (
        <ul className="flex max-h-72 flex-col overflow-y-auto">
          {projects.map((p) => {
            const added = addedCount(p.id);
            return (
              <li key={p.id}>
                <label className="flex min-h-11 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={picked.includes(p.id)}
                    onChange={(e) => setPicked((list) => (e.target.checked ? [...list, p.id] : list.filter((id) => id !== p.id)))}
                    className="size-5 accent-accent"
                  />
                  <span className="min-w-0 flex-1 truncate">{p.title}</span>
                  {added > 0 && <span className="text-xs text-muted">이미 {added}번 담음</span>}
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="min-h-11 rounded-control px-4 text-muted hover:bg-canvas">
          취소
        </button>
        <button
          type="button"
          disabled={busy || picked.length === 0}
          onClick={() => void submit()}
          className="min-h-11 rounded-control bg-accent px-5 font-semibold text-white hover:bg-accent-hover disabled:bg-line disabled:text-muted"
        >
          {busy ? "담는 중…" : `${picked.length}개 담기`}
        </button>
      </div>
    </Modal>
  );
}

function PageButton({ page, label, selected, onSelect }: { page: PortfolioPageDoc; label: string; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? "page" : undefined}
      className={`min-h-11 rounded-control border px-3 text-sm ${
        selected ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-panel hover:bg-canvas"
      } ${page.hidden ? "text-muted line-through" : ""}`}
    >
      {label}
      {page.hidden && <span className="sr-only"> (포트폴리오에 넣지 않음)</span>}
    </button>
  );
}

export function PortfolioEditorView({ api }: { api: PortfolioEditorApi }) {
  const { doc } = api;
  const pages = orderedPages(doc);
  const [selectedId, setSelectedIdState] = useState<string | null>(null);
  // 프로젝트를 담은 직후에는 새 사본의 첫 페이지(소개)를 보여 준다. 담은 결과가 화면에 반영된 뒤에 찾아야 해서 사본 id만 기억해 둔다.
  const [pendingCopyId, setPendingCopyId] = useState<string | null>(null);
  const [tab, setTab] = useState<"list" | "edit" | "preview">("edit");
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);

  const setSelectedId = (id: string) => {
    setPendingCopyId(null);
    setSelectedIdState(id);
  };
  const pendingPage = pendingCopyId ? doc.pages.find((p) => p.portfolio_project_id === pendingCopyId && p.type === "project_intro") : undefined;
  const selected = pendingPage ?? pages.find((p) => p.id === selectedId) ?? pages[0];
  const copies = [...doc.projects].sort((a, b) => a.sort_order - b.sort_order);
  const selectedCopy = selected.portfolio_project_id ? doc.projects.find((p) => p.id === selected.portfolio_project_id) : undefined;

  // 지금 입력 중인 항목이 미리보기의 어느 구역인지. 어느 페이지에서 정했는지도 함께 기억해서, 다른 페이지로 옮기면 강조가 사라진다.
  const [zoneState, setZoneState] = useState<{ pageId: string; zone: string } | null>(null);
  const activeZone = zoneState && zoneState.pageId === selected.id ? zoneState.zone : null;
  /** 표지·Summary·프로필의 입력 칸에 포커스가 가면 현재 페이지의 그 구역을 강조한다 */
  const markZone = (zone: string) => setZoneState({ pageId: selected.id, zone });
  /** 프로젝트 사본의 입력 칸에 포커스가 가면 그 구역이 있는 페이지로 옮기고 강조한다 */
  const selectZone = (copyId: string, zone: string) => {
    const type = pageOfZone(zone);
    const page = doc.pages.find((p) => p.portfolio_project_id === copyId && p.type === type);
    if (!page) return;
    setSelectedId(page.id);
    setZoneState({ pageId: page.id, zone });
  };

  const copyMine = async () => {
    try {
      await navigator.clipboard.writeText(api.exportMine());
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const panel = !selected ? null : selected.type === "cover" ? (
    <CoverForm cover={doc.cover} onChange={api.setCover} onActiveZone={markZone} />
  ) : selected.type === "summary" ? (
    <SummaryForm summary={doc.summary} projects={copies} onChange={api.setSummary} onActiveZone={markZone} />
  ) : selected.type === "profile" ? (
    <div className="flex flex-col gap-4">
      <ProfileImport current={doc.profile} onApply={api.setProfile} />
      <ProfileForm profile={doc.profile} onChange={api.setProfile} onActiveZone={markZone} />
    </div>
  ) : selectedCopy ? (
    <ProjectCopyPanel key={selectedCopy.id} api={api} copy={selectedCopy} page={selected} onSelectZone={selectZone} />
  ) : null;

  const list = (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-1 text-sm font-medium text-muted">기본 페이지</p>
        <div className="flex flex-col gap-1">
          {pages
            .filter((p) => !p.portfolio_project_id)
            .map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-2">
                <PageButton page={p} label={PAGE_TYPE_LABEL[p.type]} selected={selected.id === p.id} onSelect={() => setSelectedId(p.id)} />
                {p.type !== "cover" && (
                  <label className="flex min-h-11 items-center gap-2 text-sm text-muted">
                    <input type="checkbox" checked={!p.hidden} onChange={(e) => api.setPageHidden(p.id, !e.target.checked)} className="size-5 accent-accent" />
                    넣기
                  </label>
                )}
              </div>
            ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium text-muted">프로젝트 ({copies.length})</p>
        {copies.length === 0 && <p className="text-sm text-muted">아직 담은 프로젝트가 없어요.</p>}
        <ul className="flex flex-col gap-3">
          {copies.map((copy, index) => (
            <li key={copy.id} className="rounded-card border border-line bg-panel p-2">
              <div className="flex items-center gap-1">
                <p className="min-w-0 flex-1 truncate px-1 text-sm font-medium">{copy.title || "제목 없음"}</p>
                <button type="button" disabled={index === 0} onClick={() => void api.moveProject(copy.id, -1)} aria-label={`${copy.title} 위로`} className="min-h-11 min-w-11 rounded-control border border-line hover:bg-canvas disabled:text-muted">
                  ↑
                </button>
                <button type="button" disabled={index === copies.length - 1} onClick={() => void api.moveProject(copy.id, 1)} aria-label={`${copy.title} 아래로`} className="min-h-11 min-w-11 rounded-control border border-line hover:bg-canvas disabled:text-muted">
                  ↓
                </button>
              </div>
              {copy.source_changed && <p className="mt-1 px-1 text-xs text-accent">원본 업데이트 있음</p>}
              <div className="mt-1 flex flex-wrap gap-1">
                {pages
                  .filter((p) => p.portfolio_project_id === copy.id)
                  .map((p) => (
                    <PageButton key={p.id} page={p} label={PAGE_TYPE_LABEL[p.type]} selected={selected.id === p.id} onSelect={() => setSelectedId(p.id)} />
                  ))}
              </div>
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setAdding(true)} className="mt-3 min-h-11 w-full rounded-control border border-accent px-4 text-sm font-medium text-accent hover:bg-accent-soft">
          + 프로젝트 추가
        </button>
      </div>
    </div>
  );

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="border-b border-line bg-panel px-4 py-3">
        <h1 className="sr-only">포트폴리오 편집</h1>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <label htmlFor="portfolio-title" className="sr-only">
              포트폴리오 제목
            </label>
            <input
              id="portfolio-title"
              value={doc.title}
              maxLength={80}
              onChange={(e) => api.setTitle(e.target.value)}
              aria-invalid={doc.title.trim() === "" ? true : undefined}
              className="min-h-11 w-full min-w-0 rounded-control border border-transparent bg-transparent px-1 py-1 text-xl font-bold hover:border-line focus:border-accent"
            />
            <AnimatedMessage show={doc.title.trim() === ""}>
              <p className="text-sm text-danger">제목을 입력해 주세요.</p>
            </AnimatedMessage>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {api.mode === "real" ? (
              <SaveStatusChip
                statusKey={api.saveStatus === "idle" ? "saved" : api.saveStatus}
                kind={api.saveStatus === "saved" || api.saveStatus === "idle" ? "saved" : api.saveStatus === "error" || api.saveStatus === "conflict" ? "error" : "neutral"}
                className={`rounded px-2 py-1 ${api.saveStatus === "error" || api.saveStatus === "conflict" ? "bg-danger/5 text-danger" : "bg-canvas text-muted"}`}
              >
                {STATUS_TEXT[api.saveStatus]}
                {api.saveStatus === "error" && (
                  <button type="button" onClick={api.retrySave} className="ml-2 font-medium underline underline-offset-2">
                    다시 시도
                  </button>
                )}
              </SaveStatusChip>
            ) : (
              <>
                <span role="status" className="rounded bg-canvas px-2 py-1 text-muted">
                  저장되지 않음 · 로그인하면 저장돼요
                </span>
                <GatedButton
                  label="저장"
                  reason="작성한 포트폴리오를 보관하려면 로그인해야 해요."
                  className="min-h-11 rounded-control bg-accent px-4 font-semibold text-white hover:bg-accent-hover"
                  disabledClassName="min-h-11 cursor-not-allowed rounded-control bg-line px-4 text-muted"
                />
              </>
            )}
            {api.saveStatus === "saved" || api.saveStatus === "idle" ? (
              <Link href={`/portfolios/${api.doc.id}/preview`} className="inline-flex min-h-11 items-center rounded-control border border-line px-4 hover:bg-canvas">
                미리보기·PDF 저장
              </Link>
            ) : (
              <button type="button" disabled title="저장이 끝나면 열 수 있어요" className="min-h-11 cursor-not-allowed rounded-control border border-line px-4 text-muted">
                미리보기·PDF 저장 (저장 중…)
              </button>
            )}
          </div>
        </div>

        {api.saveStatus === "error" && api.mode === "real" && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {api.saveMessage ? (
              <>
                입력한 내용 중 확인이 필요한 곳이 있어서 저장하지 못했어요: <strong>{api.saveMessage}</strong> 고치면 자동으로 다시 저장돼요.
              </>
            ) : (
              <>저장하지 못했어요. 입력한 내용은 이 화면에 그대로 있어요. 연결을 확인하고 &lsquo;다시 시도&rsquo;를 눌러 주세요. 새로고침하면 저장되지 않은 내용은 사라져요.</>
            )}
          </p>
        )}
        {api.actionError && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {api.actionError}{" "}
            <button type="button" onClick={api.clearActionError} className="font-medium underline underline-offset-2">
              닫기
            </button>
          </p>
        )}

        {/* 1,280px 미만: 구성/입력/미리보기 탭 전환 */}
        <div role="tablist" aria-label="화면 전환" className="mt-3 flex gap-2 xl:hidden">
          {(
            [
              ["list", "페이지 구성"],
              ["edit", "입력"],
              ["preview", "미리보기"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`min-h-11 rounded-control border px-4 text-sm ${tab === key ? "border-accent bg-accent-soft font-medium text-accent" : "border-line"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="grid flex-1 gap-6 p-4 xl:grid-cols-[260px_minmax(0,1fr)_minmax(360px,440px)]">
        <aside className={tab === "list" ? "" : "hidden xl:block"} aria-label="페이지 구성">
          {list}
        </aside>
        <section className={`xl:sticky xl:top-4 xl:self-start ${tab === "preview" ? "" : "hidden xl:block"}`} aria-label="페이지 미리보기">
          <h2 className="mb-2 text-base font-bold">미리보기 · {selected ? PAGE_TYPE_LABEL[selected.type] : ""}</h2>
          {selected && <OutputPreview doc={doc} page={selected} activeZone={activeZone} />}
          <p className="mt-2 text-sm text-muted">PDF로 저장했을 때와 같은 모습이에요. 비어 있는 부분은 출력에서도 나오지 않아요.</p>
        </section>
        <section className={tab === "edit" ? "" : "hidden xl:block"} aria-label="입력">
          {panel}
        </section>
      </div>

      {adding && (
        <AddProjectDialog
          api={api}
          onClose={() => setAdding(false)}
          onAdded={(ids) => setPendingCopyId(ids[0] ?? null)}
        />
      )}

      {api.mode === "real" && api.saveStatus === "conflict" && (
        <Modal title="다른 곳에서 수정됐어요" description="다른 탭이나 기기에서 이 포트폴리오를 먼저 저장했어요. 내용이 섞이지 않도록 지금 화면은 저장을 멈췄어요." onClose={() => {}}>
          <p className="text-sm text-muted">&lsquo;최신 버전 열기&rsquo;를 누르면 저장된 내용을 불러와요. 지금 입력한 내용은 사라지니, 필요하면 먼저 &lsquo;내 입력 복사&rsquo;로 가져가세요.</p>
          {copied && <p className="mt-2 text-sm text-accent">복사했어요. 메모장 같은 곳에 붙여 넣어 보관하세요.</p>}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
            <button type="button" data-autofocus onClick={api.reloadLatest} className="min-h-12 flex-1 rounded-control bg-accent px-4 font-semibold text-white hover:bg-accent-hover">
              최신 버전 열기
            </button>
            <button type="button" onClick={copyMine} className="min-h-12 flex-1 rounded-control border border-line px-4 hover:bg-canvas">
              내 입력 복사
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}

/**
 * 가운데 미리보기. 미리보기·PDF 저장 화면과 같은 출력용 렌더러(16:9 페이지, 쪽 나누기)를 그대로 써서 저장했을 때와 같은 모습을 보여 준다(spec 9.2).
 * 한 페이지가 여러 장으로 나뉘면 나뉜 장을 모두 보여 준다. 출력과 같게 빈 구역은 숨기고, 페이지 전체가 비었을 때만 안내를 띄운다.
 * 오른쪽에서 지금 입력 중인 구역(activeZone)은 파란 윤곽선과 "작성 위치" 표시로 알린다. 이 표시는 출력에는 나오지 않는다.
 */
function OutputPreview({ doc, page, activeZone }: { doc: PortfolioDoc; page: PortfolioPageDoc; activeZone: string | null }) {
  const pagination = usePagination(useDebounced(doc, 300));
  const mine = pagination.pages.filter((p) => p.logicalId === page.id);

  const note = (text: string) => <p className="rounded-card border border-dashed border-line bg-panel p-6 text-sm text-muted">{text}</p>;
  if (page.hidden) return note("이 페이지는 포트폴리오에 넣지 않도록 해서 출력에 나오지 않아요. 왼쪽에서 \u2018넣기\u2019를 켜면 나와요.");
  if (pagination.status === "measuring" && mine.length === 0) return note("미리보기를 그리는 중이에요…");
  if (mine.length === 0) return note("아직 쓴 내용이 없어요. 오른쪽에서 입력하면 여기에 나타나요. 비어 있는 페이지는 출력에도 나오지 않아요.");

  return <OutputPages pages={mine} total={pagination.pages.length} activeZone={activeZone} />;
}
