"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { api, ApiError } from "@/lib/api/client";
import { Autosaver, type SaveResult, type SaveStatus } from "@/lib/autosave";
import type { Cover, Profile, Summary } from "@/lib/validation/portfolio";
import type { ProjectAnswers } from "@/lib/validation/project-answers";
import {
  addProjectCopy,
  moveProjectCopy,
  refreshProjectCopy,
  removeProjectCopy,
  type CopySource,
  type PortfolioDoc,
  type PortfolioImage,
} from "./model";

export type CopyPatch = { title?: string; answers?: ProjectAnswers };
export type ImagePatch = Partial<Pick<PortfolioImage, "caption" | "alt_text" | "decorative" | "include_in_output">>;

/** 편집 화면이 쓰는 동작 모음. 로그인한 사용자(서버 저장)와 체험(메모리)이 같은 모양을 쓴다. */
export type PortfolioEditorApi = {
  mode: "local" | "real";
  doc: PortfolioDoc;
  saveStatus: SaveStatus;
  /** 서버가 입력을 거절한 이유(400). 없으면 null */
  saveMessage: string | null;
  /** 동작(순서 바꾸기 등)이 실패했을 때의 안내 */
  actionError: string | null;
  clearActionError: () => void;
  retrySave: () => void;
  /** 저장하지 못한 내용이 있는가 */
  hasUnsaved: () => boolean;
  /** 충돌이 났을 때 "내 입력 복사"에 쓸 현재 내용 */
  exportMine: () => string;
  reloadLatest: () => void;

  setTitle: (title: string) => void;
  setCover: (cover: Cover) => void;
  setSummary: (summary: Summary) => void;
  setProfile: (profile: Profile) => void;

  /** 경험 원본을 골라 제작본에 복사한다. 새로 만든 사본 id 목록을 돌려준다. */
  addProjects: (sourceIds: string[]) => Promise<string[]>;
  removeProject: (copyId: string) => Promise<{ unlinked: number }>;
  moveProject: (copyId: string, direction: -1 | 1) => Promise<void>;
  refreshProject: (copyId: string) => Promise<void>;
  updateCopy: (copyId: string, patch: CopyPatch) => void;
  setPageHidden: (pageId: string, hidden: boolean) => void;
  setPageSections: (pageId: string, sectionKeys: string[]) => void;
  updateImage: (copyId: string, imageId: string, patch: ImagePatch) => void;
};

const STATUS_RANK: SaveStatus[] = ["conflict", "error", "saving", "dirty", "saved", "idle"];
const worst = (list: SaveStatus[]): SaveStatus => STATUS_RANK.find((s) => list.includes(s)) ?? "saved";

const mapDoc = (doc: PortfolioDoc, copyId: string, fn: (p: PortfolioDoc["projects"][number]) => PortfolioDoc["projects"][number]): PortfolioDoc => ({
  ...doc,
  projects: doc.projects.map((p) => (p.id === copyId ? fn(p) : p)),
});

// ---------------------------------------------------------------------------
// 로그인하지 않은 체험: 브라우저 메모리에만 반영한다
// ---------------------------------------------------------------------------

export function useLocalPortfolioEditor(
  doc: PortfolioDoc,
  update: (fn: (d: PortfolioDoc) => PortfolioDoc) => void,
  getSource: (projectId: string) => CopySource | undefined,
): PortfolioEditorApi {
  const [actionError, setActionError] = useState<string | null>(null);

  return useMemo<PortfolioEditorApi>(
    () => ({
      mode: "local",
      doc,
      saveStatus: "idle",
      saveMessage: null,
      actionError,
      clearActionError: () => setActionError(null),
      retrySave: () => {},
      hasUnsaved: () => false,
      exportMine: () => JSON.stringify(doc, null, 2),
      reloadLatest: () => {},

      setTitle: (title) => update((d) => ({ ...d, title })),
      setCover: (cover) => update((d) => ({ ...d, cover })),
      setSummary: (summary) => update((d) => ({ ...d, summary })),
      setProfile: (profile) => update((d) => ({ ...d, profile })),

      addProjects: async (sourceIds) => {
        const added: string[] = [];
        for (const id of sourceIds) {
          const source = getSource(id);
          if (!source) continue;
          // 상태 갱신 함수는 나중에 실행되므로 사본 id는 미리 정해 둔다
          const copyId = `local-pp-${crypto.randomUUID()}`;
          update((d) => addProjectCopy(d, source, copyId).doc);
          trackEvent("project_added_to_portfolio", "guest");
          added.push(copyId);
        }
        return added;
      },
      removeProject: async (copyId) => {
        const { unlinkedSummaryItems } = removeProjectCopy(doc, copyId); // 안내에 쓸 개수는 지금 화면의 내용으로 센다
        update((d) => removeProjectCopy(d, copyId).doc);
        return { unlinked: unlinkedSummaryItems };
      },
      moveProject: async (copyId, direction) => update((d) => moveProjectCopy(d, copyId, direction)),
      refreshProject: async (copyId) => {
        const sourceId = doc.projects.find((p) => p.id === copyId)?.source_project_id;
        const source = sourceId ? getSource(sourceId) : undefined;
        if (!source) throw new Error("원본 프로젝트를 찾을 수 없어요. 삭제되었거나 휴지통에 있을 수 있어요.");
        update((d) => refreshProjectCopy(d, copyId, source));
      },
      updateCopy: (copyId, patch) => update((d) => mapDoc(d, copyId, (p) => ({ ...p, ...patch }))),
      setPageHidden: (pageId, hidden) => update((d) => ({ ...d, pages: d.pages.map((p) => (p.id === pageId ? { ...p, hidden } : p)) })),
      setPageSections: (pageId, keys) => update((d) => ({ ...d, pages: d.pages.map((p) => (p.id === pageId ? { ...p, section_keys: keys } : p)) })),
      updateImage: (copyId, imageId, patch) =>
        update((d) => mapDoc(d, copyId, (p) => ({ ...p, images: p.images.map((i) => (i.id === imageId ? { ...i, ...patch } : i)) }))),
    }),
    [doc, update, getSource, actionError],
  );
}

// ---------------------------------------------------------------------------
// 로그인한 사용자: 서버에 자동 저장한다 (spec 10.3)
// ---------------------------------------------------------------------------

type MetaPayload = { title: string; cover: Cover; summary: Summary; profile: Profile };
type CopyPayload = { title: string; answers: ProjectAnswers };

export function useRemotePortfolioEditor(initial: PortfolioDoc, reloadLatest: () => void): PortfolioEditorApi {
  const portfolioId = initial.id;
  const [doc, setDocState] = useState(initial);
  const docRef = useRef(initial);
  const [statuses, setStatuses] = useState<Record<string, SaveStatus>>({});
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const metaSaver = useRef<Autosaver<MetaPayload> | null>(null);
  const copySavers = useRef(new Map<string, Autosaver<CopyPayload>>());

  const setDoc = useCallback((next: PortfolioDoc | ((d: PortfolioDoc) => PortfolioDoc)) => {
    const value = typeof next === "function" ? next(docRef.current) : next;
    docRef.current = value;
    setDocState(value);
  }, []);

  const toResult = useCallback((e: unknown): SaveResult => {
    setSaveMessage(e instanceof ApiError && e.status === 400 ? e.message : null);
    return { ok: false, kind: e instanceof ApiError && e.status === 409 ? "conflict" : "error" };
  }, []);

  useEffect(() => {
    const meta = new Autosaver<MetaPayload>({
      initialRevision: initial.revision,
      onStatus: (s) => setStatuses((prev) => ({ ...prev, meta: s })),
      save: async (payload, expectedRevision) => {
        try {
          const data = await api<{ revision: number }>(`/api/portfolios/${portfolioId}`, { method: "PATCH", body: { expected_revision: expectedRevision, ...payload } });
          setSaveMessage(null);
          return { ok: true, revision: data.revision };
        } catch (e) {
          return toResult(e);
        }
      },
    });
    metaSaver.current = meta;
    const savers = copySavers.current;
    return () => {
      meta.dispose();
      savers.forEach((s) => s.dispose());
      savers.clear();
      metaSaver.current = null;
    };
  }, [initial.revision, portfolioId, toResult]);

  const copySaver = useCallback(
    (copyId: string) => {
      const existing = copySavers.current.get(copyId);
      if (existing) return existing;
      const project = docRef.current.projects.find((p) => p.id === copyId);
      const saver = new Autosaver<CopyPayload>({
        initialRevision: project?.revision ?? 1,
        onStatus: (s) => setStatuses((prev) => ({ ...prev, [copyId]: s })),
        save: async (payload, expectedRevision) => {
          try {
            const data = await api<{ revision: number }>(`/api/portfolio-projects/${copyId}`, { method: "PATCH", body: { expected_revision: expectedRevision, ...payload } });
            setSaveMessage(null);
            return { ok: true, revision: data.revision };
          } catch (e) {
            return toResult(e);
          }
        },
      });
      copySavers.current.set(copyId, saver);
      return saver;
    },
    [toResult],
  );

  const allSavers = () => [metaSaver.current, ...copySavers.current.values()].filter((s): s is NonNullable<typeof s> => Boolean(s));
  const flushAll = async () => {
    await Promise.all(allSavers().map((s) => s.flush()));
  };

  // 저장하지 못한 내용이 있는데 탭을 닫으려 하면 경고한다 (완벽한 저장 보장은 아니다)
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if ([metaSaver.current, ...copySavers.current.values()].some((s) => s?.hasUnsaved)) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const commitMeta = (patch: Partial<MetaPayload>) => {
    setDoc((d) => ({ ...d, ...patch }));
    const d = docRef.current;
    metaSaver.current?.change({ title: d.title, cover: d.cover, summary: d.summary, profile: d.profile });
  };

  const fail = (e: unknown, fallback: string) => setActionError(e instanceof Error ? e.message : fallback);

  return {
    mode: "real",
    doc,
    saveStatus: worst(Object.values(statuses)),
    saveMessage,
    actionError,
    clearActionError: () => setActionError(null),
    retrySave: () => allSavers().forEach((s) => void s.retry()),
    hasUnsaved: () => allSavers().some((s) => s.hasUnsaved),
    exportMine: () => JSON.stringify(docRef.current, null, 2),
    reloadLatest,

    setTitle: (title) => commitMeta({ title }),
    setCover: (cover) => commitMeta({ cover }),
    setSummary: (summary) => commitMeta({ summary }),
    setProfile: (profile) => commitMeta({ profile }),

    addProjects: async (sourceIds) => {
      await flushAll();
      const added: string[] = [];
      for (const projectId of sourceIds) {
        const res = await api<{ copyId: string; doc: PortfolioDoc | null }>(`/api/portfolios/${portfolioId}/projects`, { method: "POST", body: { project_id: projectId } });
        added.push(res.copyId);
        trackEvent("project_added_to_portfolio", "member");
        if (res.doc) setDoc((d) => ({ ...res.doc!, title: d.title, cover: d.cover, summary: d.summary, profile: d.profile, revision: d.revision }));
      }
      return added;
    },
    removeProject: async (copyId) => {
      await flushAll();
      const res = await api<{ portfolioRevision: number | null }>(`/api/portfolio-projects/${copyId}`, { method: "DELETE" });
      const removed = removeProjectCopy(docRef.current, copyId);
      const unlinked = removed.unlinkedSummaryItems;
      setDoc({ ...removed.doc, revision: res.portfolioRevision ?? removed.doc.revision });
      if (res.portfolioRevision) metaSaver.current?.setRevision(res.portfolioRevision);
      copySavers.current.get(copyId)?.dispose();
      copySavers.current.delete(copyId);
      return { unlinked };
    },
    moveProject: async (copyId, direction) => {
      const before = docRef.current;
      const next = moveProjectCopy(before, copyId, direction);
      if (next === before) return;
      setDoc(next);
      try {
        const ids = [...next.projects].sort((a, b) => a.sort_order - b.sort_order).map((p) => p.id);
        await api(`/api/portfolios/${portfolioId}/projects/reorder`, { method: "POST", body: { ids } });
      } catch (e) {
        setDoc(before);
        fail(e, "순서를 바꾸지 못했어요.");
      }
    },
    refreshProject: async (copyId) => {
      await flushAll();
      await api(`/api/portfolio-projects/${copyId}/refresh`, { method: "POST" });
      reloadLatest(); // 서버의 최신 내용으로 다시 불러온다
    },
    updateCopy: (copyId, patch) => {
      setDoc((d) => mapDoc(d, copyId, (p) => ({ ...p, ...patch })));
      const p = docRef.current.projects.find((x) => x.id === copyId);
      if (p) copySaver(copyId).change({ title: p.title, answers: p.answers });
    },
    setPageHidden: (pageId, hidden) => {
      const before = docRef.current;
      setDoc((d) => ({ ...d, pages: d.pages.map((p) => (p.id === pageId ? { ...p, hidden } : p)) }));
      api(`/api/portfolio-pages/${pageId}`, { method: "PATCH", body: { hidden } }).catch((e) => {
        setDoc(before);
        fail(e, "페이지 설정을 저장하지 못했어요.");
      });
    },
    setPageSections: (pageId, keys) => {
      const before = docRef.current;
      setDoc((d) => ({ ...d, pages: d.pages.map((p) => (p.id === pageId ? { ...p, section_keys: keys } : p)) }));
      api(`/api/portfolio-pages/${pageId}`, { method: "PATCH", body: { section_keys: keys } }).catch((e) => {
        setDoc(before);
        fail(e, "페이지 설정을 저장하지 못했어요.");
      });
    },
    updateImage: (copyId, imageId, patch) => {
      const before = docRef.current;
      setDoc((d) => mapDoc(d, copyId, (p) => ({ ...p, images: p.images.map((i) => (i.id === imageId ? { ...i, ...patch } : i)) })));
      api(`/api/portfolio-assets/${imageId}`, { method: "PATCH", body: patch }).catch((e) => {
        setDoc(before);
        fail(e, "이미지 설정을 저장하지 못했어요.");
      });
    },
  };
}
