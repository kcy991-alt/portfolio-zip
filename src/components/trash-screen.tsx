"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/components/workspace-data";
import { useWorkspaceDialogs } from "@/components/workspace-dialogs";
import { daysLeft, TRASH_DAYS, type TrashItem } from "@/lib/trash";

type Filter = "all" | "project" | "portfolio" | "folder";
const FILTERS: [Filter, string][] = [
  ["all", "전체"],
  ["project", "프로젝트"],
  ["portfolio", "포트폴리오"],
  ["folder", "폴더"],
];
const TYPE_LABEL = { project: "프로젝트", portfolio: "포트폴리오", folder: "폴더" } as const;

function Row({ item, onRestore, busy }: { item: TrashItem; onRestore: (item: TrashItem) => void; busy: boolean }) {
  const { openPurge } = useWorkspaceDialogs();
  const left = daysLeft(item.deleted_at);
  const origin =
    item.type !== "project"
      ? ""
      : item.original_folder
        ? `${item.original_folder.name}${item.original_folder.deleted ? " (삭제된 폴더)" : ""}`
        : "미분류";

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-card border border-line bg-panel p-3">
      <span className="rounded-full border border-line bg-canvas px-2.5 py-0.5 text-xs text-muted">{TYPE_LABEL[item.type]}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{item.name}</p>
        <p className="text-sm text-muted">
          {item.type === "project" ? `원래 위치: ${origin} · ` : ""}
          {new Date(item.deleted_at).toLocaleDateString("ko-KR")} 삭제
        </p>
      </div>
      <span className={`text-sm ${left <= 3 ? "font-medium text-danger" : "text-muted"}`}>{left === 0 ? "오늘 삭제됨" : `${left}일 남음`}</span>
      <div className="flex gap-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => onRestore(item)}
          className="min-h-11 rounded-control bg-accent-soft px-3 text-sm font-medium text-accent hover:bg-accent-soft-hover disabled:text-muted"
        >
          복원
        </button>
        <button type="button" onClick={() => openPurge(item)} className="min-h-11 rounded-control px-3 text-sm text-danger hover:bg-danger/5">
          영구 삭제
        </button>
      </div>
    </li>
  );
}

export function TrashScreen() {
  const { mode, trash, loadTrash, restoreTrash } = useWorkspace();
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (mode === "loading") return;
    let alive = true;
    loadTrash()
      .then(() => alive && setError(null))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "휴지통을 불러오지 못했어요."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [mode, loadTrash, attempt]);

  const retry = () => {
    setLoading(true);
    setError(null);
    setAttempt((n) => n + 1);
  };

  const restore = async (item: TrashItem) => {
    setBusy(true);
    setMessage(null);
    try {
      const { movedToUnsorted } = await restoreTrash(item);
      setMessage(
        movedToUnsorted
          ? `'${item.name}'을(를) 복원했어요. 원래 폴더가 없어서 미분류에 있어요.`
          : `'${item.name}'을(를) 복원했어요.`,
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "복원하지 못했어요.");
    } finally {
      setBusy(false);
    }
  };

  const shown = trash.filter((t) => filter === "all" || t.type === filter);
  const count = (f: Filter) => trash.filter((t) => f === "all" || t.type === f).length;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-bold">휴지통</h1>
      <p className="mt-1 text-muted">삭제한 항목은 {TRASH_DAYS}일 동안 보관하고, 그 뒤에는 자동으로 영구 삭제돼요.</p>
      {mode === "local" && (
        <p role="note" className="mt-4 rounded-card bg-accent-soft p-3 text-sm">
          로그인하지 않아서 이 휴지통도 저장되지 않아요. 새로고침하면 비워져요.
        </p>
      )}

      <div role="tablist" aria-label="종류" className="mt-6 flex gap-2">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={`min-h-11 rounded-control border px-4 text-sm ${filter === key ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-panel"}`}
          >
            {label} <span className="text-muted">{count(key)}</span>
          </button>
        ))}
      </div>

      <div aria-live="polite" className="mt-4 min-h-6 text-sm text-accent">
        {message}
      </div>

      {(loading || mode === "loading") && <p className="mt-2 text-muted">불러오는 중이에요…</p>}
      {error && (
        <p role="alert" className="mt-2 rounded-card border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
          {error}{" "}
          <button type="button" onClick={retry} className="font-medium underline underline-offset-2">
            다시 시도
          </button>
        </p>
      )}

      {!loading && !error && shown.length === 0 && (
        <p className="mt-4 rounded-card border border-dashed border-line p-8 text-center text-muted">휴지통이 비어 있어요.</p>
      )}

      {shown.length > 0 && (
        <ul className="mt-2 flex flex-col gap-2">
          {shown.map((item) => (
            <Row key={`${item.type}-${item.id}`} item={item} onRestore={restore} busy={busy} />
          ))}
        </ul>
      )}
    </main>
  );
}
