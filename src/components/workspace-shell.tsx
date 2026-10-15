"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { useWorkspace } from "@/components/workspace-data";

/** 사이드바 맨 위 아이콘: 패널 왼쪽 칸이 채워진 모양. 펼쳐 있으면 접기, 접혀 있으면 펼치기 버튼이다. */
export function SidebarToggleIcon() {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="3.5" width="15" height="13" rx="2.5" />
      <path d="M7.5 3.5v13" />
    </svg>
  );
}

/**
 * 구역 제목. 누르면 그 구역 전체 화면이 열리고, 그 구역의 하위 메뉴가 아래에 펼쳐진다.
 * 이미 그 구역 안에 있을 때 다시 누르면 하위 메뉴만 접거나 펼친다.
 */
function SectionLink({
  href,
  step,
  label,
  active,
  open,
  onNavigate,
  onToggle,
  controls,
}: {
  href: string;
  step: number;
  label: string;
  active: boolean;
  open: boolean;
  onNavigate?: () => void;
  onToggle: () => void;
  controls: string;
}) {
  return (
    <Link
      href={href}
      onClick={() => {
        onToggle();
        onNavigate?.();
      }}
      aria-expanded={open}
      aria-controls={controls}
      aria-current={active ? "page" : undefined}
      className={`mb-1 flex min-h-11 items-center gap-2 rounded-control border px-2 font-semibold transition-colors ${
        active ? "border-accent bg-accent-soft text-accent" : "border-line bg-panel text-ink hover:border-accent hover:bg-accent-soft hover:text-accent"
      }`}
    >
      <span aria-hidden className={`flex size-5 shrink-0 items-center justify-center rounded-full text-xs ${active ? "bg-accent text-white" : "bg-canvas text-muted"}`}>
        {step}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span aria-hidden className={`shrink-0 text-muted transition-transform ${open ? "rotate-90" : ""}`}>
        ›
      </span>
    </Link>
  );
}

function Sidebar({ onNavigate, account, onClose }: { onNavigate?: () => void; account?: React.ReactNode; onClose?: () => void }) {
  const pathname = usePathname();
  const { folders, projects, portfolios } = useWorkspace();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // 지금 보고 있는 화면이 속한 구역은 하위 메뉴를 펼쳐 둔다. 직접 접고 편 선택(manual)은 다른 화면으로 가면 초기화한다.
  const inArchive = pathname.startsWith("/workspace") && pathname !== "/workspace/trash";
  const inPortfolio = pathname.startsWith("/portfolios");
  const [manual, setManual] = useState<{ archive?: boolean; portfolio?: boolean }>({});
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setManual({});
  }
  const archiveOpen = manual.archive ?? inArchive;
  const portfolioOpen = manual.portfolio ?? inPortfolio;

  const toggle = (id: string) => setCollapsed((c) => ({ ...c, [id]: !c[id] }));

  const groups = [
    ...folders.map((f) => ({ id: f.id, name: f.name })),
    { id: "unsorted", name: "미분류" },
  ];

  return (
    <nav aria-label="프로젝트 아카이브" className="flex h-full flex-col gap-4 overflow-y-auto p-4 text-sm">
      <div className="flex items-center justify-between gap-2">
        <Link href="/" onClick={onNavigate} className="inline-flex min-h-11 items-center text-base" aria-label="portfolio_zip 첫 화면으로">
          <Logo />
        </Link>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="사이드바 접기"
            title="사이드바 접기"
            className="flex size-11 shrink-0 items-center justify-center rounded-control text-muted hover:bg-canvas hover:text-ink"
          >
            <SidebarToggleIcon />
          </button>
        )}
      </div>

      {/* 두 메뉴가 순서대로 쓰는 것인지 헷갈린다는 의견이 있어서, 로고 바로 아래에 짧게 안내한다 */}
      <ol className="-mt-2 flex list-none flex-col gap-1 break-keep rounded-control bg-canvas px-3 py-2 text-xs leading-relaxed text-muted">
        <li className="flex gap-1.5">
          <span aria-hidden>①</span>
          <span>
            <strong className="font-semibold text-ink">프로젝트 아카이브</strong>에서 경험을 정리하고,
          </span>
        </li>
        <li className="flex gap-1.5">
          <span aria-hidden>②</span>
          <span>
            <strong className="font-semibold text-ink">포트폴리오 만들기</strong>에서 정리한 프로젝트를 모아 포트폴리오를 완성해요.
          </span>
        </li>
      </ol>

      <div>
        {/* 제목을 눌러도 프로젝트 아카이브 화면으로 간다 */}
        <SectionLink
          href="/workspace"
          step={1}
          label="프로젝트 아카이브"
          active={inArchive}
          open={archiveOpen}
          controls="sidebar-archive"
          onNavigate={onNavigate}
          onToggle={() => inArchive && setManual((m) => ({ ...m, archive: !archiveOpen }))}
        />
        <ul id="sidebar-archive" className={`flex-col gap-1 ${archiveOpen ? "flex" : "hidden"}`}>
          {groups.map((g) => {
            const items = projects.filter((p) => (g.id === "unsorted" ? p.folder_id === null : p.folder_id === g.id));
            const isClosed = collapsed[g.id];
            return (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => toggle(g.id)}
                  aria-expanded={!isClosed}
                  className="flex min-h-11 w-full items-center gap-2 rounded-control px-2 text-left hover:bg-canvas"
                >
                  <span aria-hidden>{isClosed ? "▸" : "▾"}</span>
                  <span className="truncate">{g.name}</span>
                  <span className="ml-auto text-xs text-muted">{items.length}</span>
                </button>
                {!isClosed && (
                  <ul className="ml-4 flex flex-col gap-1 border-l border-line pl-2">
                    {items.length === 0 && <li className="px-2 py-1 text-muted">프로젝트가 없어요</li>}
                    {items.map((p) => {
                      const href = `/workspace/projects/${p.id}`;
                      const active = pathname === href;
                      return (
                        <li key={p.id}>
                          <Link
                            href={href}
                            onClick={onNavigate}
                            aria-current={active ? "page" : undefined}
                            className={`flex min-h-11 items-center rounded-control px-2 ${
                              active ? "bg-accent-soft font-medium text-accent" : "hover:bg-canvas"
                            }`}
                          >
                            <span className="truncate">{p.title}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-col gap-1 text-muted">
        {/* 제목을 눌러도 포트폴리오 화면으로 간다 */}
        <SectionLink
          href="/portfolios"
          step={2}
          label="포트폴리오 만들기"
          active={inPortfolio}
          open={portfolioOpen}
          controls="sidebar-portfolio"
          onNavigate={onNavigate}
          onToggle={() => inPortfolio && setManual((m) => ({ ...m, portfolio: !portfolioOpen }))}
        />
        <div id="sidebar-portfolio" hidden={!portfolioOpen}>
          <Link
            href="/portfolios"
            onClick={onNavigate}
            aria-current={inPortfolio ? "page" : undefined}
            className={`flex min-h-11 items-center justify-between rounded-control px-2 ${inPortfolio ? "bg-accent-soft font-medium text-accent" : "hover:bg-canvas"}`}
          >
            <span>내 포트폴리오</span>
            <span className="text-xs text-muted">{portfolios.length}</span>
          </Link>
        </div>
        <Link
          href="/workspace/trash"
          onClick={onNavigate}
          aria-current={pathname === "/workspace/trash" ? "page" : undefined}
          className={`flex min-h-11 items-center justify-between rounded-control px-2 ${
            pathname === "/workspace/trash" ? "bg-accent-soft font-medium text-accent" : "hover:bg-canvas"
          }`}
        >
          <span>휴지통</span>
          <span className="text-xs text-muted">30일 보관</span>
        </Link>
        <Link
          href="/mypage"
          onClick={onNavigate}
          aria-current={pathname === "/mypage" ? "page" : undefined}
          className={`flex min-h-11 items-center rounded-control px-2 ${pathname === "/mypage" ? "bg-accent-soft font-medium text-accent" : "hover:bg-canvas"}`}
        >
          마이페이지
        </Link>
        <Link
          href="/settings"
          onClick={onNavigate}
          aria-current={pathname === "/settings" ? "page" : undefined}
          className={`flex min-h-11 items-center rounded-control px-2 ${pathname === "/settings" ? "bg-accent-soft font-medium text-accent" : "hover:bg-canvas"}`}
        >
          설정
        </Link>
      </div>

      {account}
    </nav>
  );
}

/** 지금 주소를 알려 준다. usePathname은 Suspense 안에서만 쓸 수 있어서(Cache Components) 따로 둔다. */
function PathWatcher({ onPath }: { onPath: (path: string) => void }) {
  const pathname = usePathname();
  // 화면이 그려지기 전에 알려서, 사이드바가 열렸다 닫히는 깜빡임을 줄인다
  useLayoutEffect(() => onPath(pathname), [pathname, onPath]);
  return null;
}

const EDITOR_PATH = /^\/portfolios\/[^/]+\/edit(\/|$)/;

export function WorkspaceShell({ children, account }: { children: React.ReactNode; account?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  // 1,280px 이상에서 사이드바를 접어 작성 공간을 넓힌다. 선택은 이번 방문(탭) 동안만 기억해서, 새로 들어오면 항상 펼쳐 보인다.
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // 포트폴리오 편집 화면은 페이지 미리보기를 크게 보려고, 들어갈 때마다 사이드바를 닫은 채로 시작한다. 거기서 펼쳐도 기억하지 않는다.
  const [onEditor, setOnEditor] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const shown = onEditor ? editorOpen : sidebarOpen;

  const onPath = useCallback((path: string) => {
    const editor = EDITOR_PATH.test(path);
    setOnEditor(editor);
    if (editor) setEditorOpen(false);
  }, []);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 서버 렌더와 맞추려고 처음엔 펼친 채로 그린 뒤, 이번 방문에 접은 값이 있으면 반영한다
      if (sessionStorage.getItem("sidebar-open") === "0") setSidebarOpen(false);
      // 예전에 접은 선택을 브라우저에 오래 남겨 두던 값은 지운다(그 값 때문에 처음 들어와도 접혀 있었다)
      localStorage.removeItem("sidebar-open");
    } catch {
      // 저장소를 못 쓰면 기본값(펼침)을 쓴다
    }
  }, []);

  const changeSidebar = (value: boolean) => {
    if (onEditor) {
      setEditorOpen(value);
      return;
    }
    setSidebarOpen(value);
    try {
      sessionStorage.setItem("sidebar-open", value ? "1" : "0");
    } catch {
      // 기억하지 못해도 이번 화면에서는 바뀐다
    }
  };

  return (
    <div className="flex min-h-screen flex-1 print:block print:min-h-0">
      <a href="#content" className="skip-link print:hidden">
        본문으로 건너뛰기
      </a>
      <Suspense fallback={null}>
        <PathWatcher onPath={onPath} />
      </Suspense>
      {/* 1,280px 이상: 고정 사이드바 240px. 접으면 왼쪽 위에 펼치기 버튼만 남는다 */}
      {shown ? (
        <aside id="app-sidebar" className="sticky top-0 hidden h-screen w-72 shrink-0 border-r border-line bg-panel xl:block print:!hidden">
          <Suspense fallback={null}>
            <Sidebar account={account} onClose={() => changeSidebar(false)} />
          </Suspense>
        </aside>
      ) : (
        <button
          type="button"
          onClick={() => changeSidebar(true)}
          aria-label="사이드바 펼치기"
          aria-controls="app-sidebar"
          aria-expanded={false}
          title="사이드바 펼치기"
          className="fixed left-3 top-3 z-30 hidden size-11 items-center justify-center rounded-control border border-line bg-panel text-muted shadow-sm hover:text-ink xl:flex print:!hidden"
        >
          <SidebarToggleIcon />
        </button>
      )}

      {/* 1,280px 미만: 서랍형 탐색 */}
      {open && (
        <div className="fixed inset-0 z-40 xl:hidden" role="dialog" aria-modal="true" aria-label="탐색">
          <button
            type="button"
            aria-label="탐색 닫기"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[85vw] bg-panel shadow-lg">
            <Suspense fallback={null}>
              <Sidebar onNavigate={() => setOpen(false)} account={account} />
            </Suspense>
          </aside>
        </div>
      )}

      <div className={`flex min-w-0 flex-1 flex-col ${shown ? "" : "xl:pl-16"}`}>
        <header className="flex h-14 items-center gap-3 border-b border-line bg-panel px-4 xl:hidden print:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="min-h-11 min-w-11 rounded-control border border-line px-3 text-sm"
          >
            메뉴
          </button>
          <Link href="/" className="inline-flex min-h-11 items-center" aria-label="portfolio_zip 첫 화면으로">
            <Logo />
          </Link>
        </header>
        <div id="content" tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none">
          {children}
        </div>
      </div>
    </div>
  );
}
