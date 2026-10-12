"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useState } from "react";
import { Logo } from "@/components/logo";
import { useWorkspace } from "@/components/workspace-data";

function Sidebar({ onNavigate, account }: { onNavigate?: () => void; account?: React.ReactNode }) {
  const pathname = usePathname();
  const { folders, projects, portfolios } = useWorkspace();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => setCollapsed((c) => ({ ...c, [id]: !c[id] }));

  const groups = [
    ...folders.map((f) => ({ id: f.id, name: f.name })),
    { id: "unsorted", name: "미분류" },
  ];

  return (
    <nav aria-label="프로젝트 아카이브" className="flex h-full flex-col gap-4 overflow-y-auto p-4 text-sm">
      <Link href="/workspace" onClick={onNavigate} className="inline-flex min-h-11 items-center text-base" aria-label="프로젝트 아카이브로">
        <Logo />
      </Link>

      <div>
        {/* 제목을 눌러도 프로젝트 아카이브 화면으로 간다 */}
        <Link
          href="/workspace"
          onClick={onNavigate}
          aria-current={pathname === "/workspace" ? "page" : undefined}
          className={`mb-1 flex min-h-11 items-center rounded-control px-2 font-medium hover:bg-canvas hover:text-ink ${pathname === "/workspace" ? "bg-accent-soft text-accent" : "text-muted"}`}
        >
          프로젝트 아카이브
        </Link>
        <ul className="flex flex-col gap-1">
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
        <Link
          href="/portfolios"
          onClick={onNavigate}
          className="mb-1 flex min-h-11 items-center rounded-control px-2 font-medium text-ink hover:bg-canvas"
        >
          포트폴리오 만들기
        </Link>
        <Link
          href="/portfolios"
          onClick={onNavigate}
          aria-current={pathname.startsWith("/portfolios") ? "page" : undefined}
          className={`flex min-h-11 items-center justify-between rounded-control px-2 ${
            pathname.startsWith("/portfolios") ? "bg-accent-soft font-medium text-accent" : "hover:bg-canvas"
          }`}
        >
          <span>내 포트폴리오</span>
          <span className="text-xs text-muted">{portfolios.length}</span>
        </Link>
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

export function WorkspaceShell({ children, account }: { children: React.ReactNode; account?: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-1 print:block print:min-h-0">
      <a href="#content" className="skip-link print:hidden">
        본문으로 건너뛰기
      </a>
      {/* 1,280px 이상: 고정 사이드바 240px */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 border-r border-line bg-panel xl:block print:!hidden">
        <Suspense fallback={null}>
          <Sidebar account={account} />
        </Suspense>
      </aside>

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

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-line bg-panel px-4 xl:hidden print:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="min-h-11 min-w-11 rounded-control border border-line px-3 text-sm"
          >
            메뉴
          </button>
          <Logo />
        </header>
        <div id="content" tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none">
          {children}
        </div>
      </div>
    </div>
  );
}
