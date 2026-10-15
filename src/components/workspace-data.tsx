"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-context";
import { api } from "@/lib/api/client";
import { trackEvent } from "@/lib/analytics";
import { leaving } from "@/lib/auth/google";
import { createLocalPortfolio, type PortfolioDoc } from "@/lib/portfolio/model";
import type { TrashItem } from "@/lib/trash";
import { emptyMyProfile, type MyProfile } from "@/lib/validation/portfolio";
import { emptyProjectAnswers, overviewSchema, type ProjectAnswers } from "@/lib/validation/project-answers";

export type FolderItem = { id: string; name: string };
export type ProjectItem = {
  id: string;
  title: string;
  folder_id: string | null;
  record_status: "draft" | "done";
  updated_at: string;
};
export type PortfolioListItem = { id: string; title: string; project_count: number; updated_at: string };

export type NewProjectInput = {
  title: string;
  folder_id: string | null;
  startMonth: string | null;
  endMonth: string | null;
  ongoing: boolean;
  projectType: string | null;
};

/** 로그인하지 않은 사용자가 체험 중에 만든 프로젝트의 전체 내용. 브라우저 메모리에만 있고 저장되지 않는다. */
export type LocalProjectData = {
  id: string;
  title: string;
  answers: ProjectAnswers;
  record_status: "draft" | "done";
  last_step: number;
};

type LocalPatch = Partial<Pick<LocalProjectData, "title" | "answers" | "record_status" | "last_step">>;

type Ctx = {
  /** local: 로그인 전(체험, 저장되지 않음), real: 로그인한 사용자의 실제 데이터 */
  mode: "loading" | "local" | "real";
  folders: FolderItem[];
  projects: ProjectItem[];
  portfolios: PortfolioListItem[];
  trash: TrashItem[];
  error: string | null;
  reload: () => Promise<void>;
  /** 휴지통 화면을 열 때 목록을 서버에서 새로 가져온다(체험 중에는 아무 일도 없다) */
  loadTrash: () => Promise<void>;
  createFolder: (name: string) => Promise<FolderItem>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string, moveToUnsorted: boolean) => Promise<void>;
  createProject: (input: NewProjectInput) => Promise<ProjectItem>;
  moveProject: (id: string, folderId: string | null) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  createPortfolio: (title: string) => Promise<{ id: string }>;
  deletePortfolio: (id: string) => Promise<void>;
  /** 복원한다. 프로젝트의 원래 폴더가 없어져 미분류로 돌아오면 movedToUnsorted가 true다. */
  restoreTrash: (item: TrashItem) => Promise<{ movedToUnsorted: boolean }>;
  purgeTrash: (item: TrashItem) => Promise<void>;
  getLocalProject: (id: string) => LocalProjectData | undefined;
  updateLocalProject: (id: string, patch: LocalPatch) => void;
  getLocalPortfolio: (id: string) => PortfolioDoc | undefined;
  updateLocalPortfolio: (id: string, update: (doc: PortfolioDoc) => PortfolioDoc) => void;
  /** 체험 중 마이페이지 프로필(브라우저 메모리에만 있다) */
  localMyProfile: MyProfile;
  setLocalMyProfile: (profile: MyProfile) => void;
  /** 포트폴리오에서 "마이페이지에서 불러오기"를 누를 때 쓴다. 로그인했으면 서버의 저장본, 체험 중이면 메모리의 내용이다. */
  fetchMyProfile: () => Promise<MyProfile>;
};

const never = async () => {
  throw new Error("지금은 쓸 수 없어요.");
};

const WorkspaceDataContext = createContext<Ctx>({
  mode: "loading",
  folders: [],
  projects: [],
  portfolios: [],
  trash: [],
  error: null,
  reload: async () => {},
  loadTrash: async () => {},
  createFolder: never,
  renameFolder: never,
  deleteFolder: never,
  createProject: never,
  moveProject: never,
  deleteProject: never,
  createPortfolio: never,
  deletePortfolio: never,
  restoreTrash: never,
  purgeTrash: never,
  getLocalProject: () => undefined,
  updateLocalProject: () => {},
  getLocalPortfolio: () => undefined,
  updateLocalPortfolio: () => {},
  localMyProfile: emptyMyProfile(),
  setLocalMyProfile: () => {},
  fetchMyProfile: async () => emptyMyProfile(),
});

export function useWorkspace() {
  return useContext(WorkspaceDataContext);
}

type LocalProject = LocalProjectData & { folder_id: string | null; updated_at: string };
type LocalPortfolio = { doc: PortfolioDoc; updated_at: string };
type LocalTrashEntry = { item: TrashItem; project?: LocalProject; folder?: FolderItem; portfolio?: LocalPortfolio };

const toItem = (p: LocalProject): ProjectItem => ({
  id: p.id,
  title: p.title,
  folder_id: p.folder_id,
  record_status: p.record_status,
  updated_at: p.updated_at,
});

export function WorkspaceDataProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();

  // 로그인한 사용자의 실제 데이터 (서버에서 가져온다)
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [portfolios, setPortfolios] = useState<PortfolioListItem[]>([]);
  const [trash, setTrash] = useState<TrashItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 로그인하지 않은 사용자의 체험 데이터 (브라우저 메모리에만 있다. 새로고침하면 사라진다)
  const [localFolders, setLocalFolders] = useState<FolderItem[]>([]);
  const [localProjects, setLocalProjects] = useState<LocalProject[]>([]);
  const [localPortfolios, setLocalPortfolios] = useState<LocalPortfolio[]>([]);
  const [localTrash, setLocalTrash] = useState<LocalTrashEntry[]>([]);
  const [localMyProfile, setLocalMyProfile] = useState<MyProfile>(emptyMyProfile);

  const load = useCallback(async () => {
    try {
      const [f, p, pf] = await Promise.all([
        api<FolderItem[]>("/api/folders"),
        api<ProjectItem[]>("/api/projects"),
        api<PortfolioListItem[]>("/api/portfolios"),
      ]);
      setFolders(f);
      setProjects(p);
      setPortfolios(pf);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "불러오지 못했어요.");
    } finally {
      setLoaded(true);
    }
  }, []);

  const loadTrash = useCallback(async () => {
    setTrash(await api<TrashItem[]>("/api/trash"));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 로그인 상태가 확인되면 서버에서 데이터를 가져온다
    if (status === "signedIn") void load();
  }, [status, load]);

  const mode: Ctx["mode"] = status === "loading" ? "loading" : status === "guest" ? "local" : loaded ? "real" : "loading";

  // 체험 중에 만든 내용이 있는데 창을 닫거나 새로고침하려 하면 사라진다고 경고한다 (로그인하러 가는 경우는 제외)
  const hasLocalContent =
    localFolders.length > 0 ||
    localProjects.length > 0 ||
    localPortfolios.length > 0 ||
    localTrash.length > 0 ||
    JSON.stringify(localMyProfile) !== JSON.stringify(emptyMyProfile());
  useEffect(() => {
    if (mode !== "local" || !hasLocalContent) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!leaving.forLogin) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [mode, hasLocalContent]);

  const value = useMemo<Ctx>(() => {
    if (mode === "local") {
      const now = () => new Date().toISOString();
      return {
        mode,
        folders: localFolders,
        projects: localProjects.map(toItem),
        portfolios: localPortfolios.map((p) => ({ id: p.doc.id, title: p.doc.title, project_count: p.doc.projects.length, updated_at: p.updated_at })),
        trash: [...localTrash].map((e) => e.item).sort((a, b) => b.deleted_at.localeCompare(a.deleted_at)),
        error: null,
        reload: async () => {},
        loadTrash: async () => {},
        createFolder: async (name) => {
          const folder = { id: `local-${crypto.randomUUID()}`, name };
          setLocalFolders((list) => [...list, folder]);
          return folder;
        },
        renameFolder: async (id, name) => {
          setLocalFolders((list) => list.map((f) => (f.id === id ? { ...f, name } : f)));
        },
        deleteFolder: async (id) => {
          // 서버와 같게: 폴더 안의 프로젝트는 지워지지 않고 미분류로 옮겨지고, 폴더는 휴지통으로 간다
          const folder = localFolders.find((f) => f.id === id);
          if (!folder) return;
          setLocalProjects((list) => list.map((p) => (p.folder_id === id ? { ...p, folder_id: null } : p)));
          setLocalFolders((list) => list.filter((f) => f.id !== id));
          setLocalTrash((list) => [
            ...list,
            { item: { type: "folder", id, name: folder.name, deleted_at: now(), original_folder: null }, folder },
          ]);
        },
        createProject: async (input) => {
          const overview = overviewSchema.safeParse({
            ...emptyProjectAnswers().overview,
            startMonth: input.startMonth,
            endMonth: input.endMonth,
            ongoing: input.ongoing,
            projectType: input.projectType,
          });
          if (!overview.success) throw new Error(overview.error.issues[0]?.message ?? "기간을 확인해 주세요.");
          const project: LocalProject = {
            id: `local-${crypto.randomUUID()}`,
            title: input.title,
            folder_id: input.folder_id,
            answers: { ...emptyProjectAnswers(), overview: overview.data },
            record_status: "draft",
            last_step: 1,
            updated_at: now(),
          };
          setLocalProjects((list) => [project, ...list]);
          trackEvent("project_created", "guest");
          return toItem(project);
        },
        moveProject: async (id, folderId) => {
          setLocalProjects((list) => list.map((p) => (p.id === id ? { ...p, folder_id: folderId } : p)));
        },
        deleteProject: async (id) => {
          const project = localProjects.find((p) => p.id === id);
          if (!project) return;
          const folder = project.folder_id ? localFolders.find((f) => f.id === project.folder_id) : undefined;
          setLocalProjects((list) => list.filter((p) => p.id !== id));
          setLocalTrash((list) => [
            ...list,
            {
              item: {
                type: "project",
                id,
                name: project.title,
                deleted_at: now(),
                original_folder: folder ? { name: folder.name, deleted: false } : null,
              },
              project,
            },
          ]);
        },
        createPortfolio: async (title) => {
          const doc = createLocalPortfolio(title);
          setLocalPortfolios((list) => [{ doc, updated_at: now() }, ...list]);
          trackEvent("portfolio_created", "guest");
          return { id: doc.id };
        },
        deletePortfolio: async (id) => {
          const entry = localPortfolios.find((p) => p.doc.id === id);
          if (!entry) return;
          setLocalPortfolios((list) => list.filter((p) => p.doc.id !== id));
          setLocalTrash((list) => [
            ...list,
            { item: { type: "portfolio", id, name: entry.doc.title, deleted_at: now(), original_folder: null }, portfolio: entry },
          ]);
        },
        restoreTrash: async (item) => {
          const entry = localTrash.find((e) => e.item.id === item.id);
          if (!entry) return { movedToUnsorted: false };
          setLocalTrash((list) => list.filter((e) => e.item.id !== item.id));
          if (entry.portfolio) {
            setLocalPortfolios((list) => [entry.portfolio!, ...list]);
            return { movedToUnsorted: false };
          }
          if (entry.folder) {
            setLocalFolders((list) => [...list, entry.folder!]);
            return { movedToUnsorted: false };
          }
          const project = entry.project!;
          const folderStillExists = project.folder_id !== null && localFolders.some((f) => f.id === project.folder_id);
          setLocalProjects((list) => [{ ...project, folder_id: folderStillExists ? project.folder_id : null }, ...list]);
          return { movedToUnsorted: project.folder_id !== null && !folderStillExists };
        },
        purgeTrash: async (item) => {
          setLocalTrash((list) => list.filter((e) => e.item.id !== item.id));
        },
        getLocalProject: (id) => {
          const p = localProjects.find((x) => x.id === id);
          return p && { id: p.id, title: p.title, answers: p.answers, record_status: p.record_status, last_step: p.last_step };
        },
        updateLocalProject: (id, patch) => {
          setLocalProjects((list) => list.map((p) => (p.id === id ? { ...p, ...patch, updated_at: now() } : p)));
        },
        getLocalPortfolio: (id) => localPortfolios.find((p) => p.doc.id === id)?.doc,
        updateLocalPortfolio: (id, update) => {
          setLocalPortfolios((list) => list.map((p) => (p.doc.id === id ? { doc: update(p.doc), updated_at: now() } : p)));
        },
        localMyProfile,
        setLocalMyProfile,
        fetchMyProfile: async () => localMyProfile,
      };
    }

    return {
      mode,
      folders,
      projects,
      portfolios,
      trash,
      error,
      reload: load,
      loadTrash,
      createFolder: async (name) => {
        const folder = await api<FolderItem>("/api/folders", { method: "POST", body: { name } });
        setFolders((list) => [...list, folder]);
        return folder;
      },
      renameFolder: async (id, name) => {
        await api("/api/folders/" + id, { method: "PATCH", body: { name } });
        setFolders((list) => list.map((f) => (f.id === id ? { ...f, name } : f)));
      },
      deleteFolder: async (id, moveToUnsorted) => {
        await api(`/api/folders/${id}${moveToUnsorted ? "?moveToUnsorted=true" : ""}`, { method: "DELETE" });
        setFolders((list) => list.filter((f) => f.id !== id));
        setProjects((list) => list.map((p) => (p.folder_id === id ? { ...p, folder_id: null } : p)));
      },
      createProject: async (input) => {
        const project = await api<ProjectItem>("/api/projects", { method: "POST", body: input });
        setProjects((list) => [project, ...list]);
        trackEvent("project_created", "member");
        return project;
      },
      moveProject: async (id, folderId) => {
        await api(`/api/projects/${id}/move`, { method: "POST", body: { folder_id: folderId } });
        setProjects((list) => list.map((p) => (p.id === id ? { ...p, folder_id: folderId } : p)));
      },
      deleteProject: async (id) => {
        await api(`/api/projects/${id}`, { method: "DELETE" });
        setProjects((list) => list.filter((p) => p.id !== id));
      },
      createPortfolio: async (title) => {
        const created = await api<{ id: string }>("/api/portfolios", { method: "POST", body: { title } });
        setPortfolios((list) => [{ id: created.id, title, project_count: 0, updated_at: new Date().toISOString() }, ...list]);
        trackEvent("portfolio_created", "member");
        return created;
      },
      deletePortfolio: async (id) => {
        await api(`/api/portfolios/${id}`, { method: "DELETE" });
        setPortfolios((list) => list.filter((p) => p.id !== id));
      },
      restoreTrash: async (item) => {
        const result = await api<{ movedToUnsorted?: boolean }>(`/api/trash/${item.type}/${item.id}/restore`, { method: "POST" });
        setTrash((list) => list.filter((t) => !(t.type === item.type && t.id === item.id)));
        await load(); // 복원된 항목이 보관함·포트폴리오 목록에 다시 보이도록 새로 가져온다
        return { movedToUnsorted: result?.movedToUnsorted === true };
      },
      purgeTrash: async (item) => {
        await api(`/api/trash/${item.type}/${item.id}/purge`, { method: "DELETE" });
        setTrash((list) => list.filter((t) => !(t.type === item.type && t.id === item.id)));
      },
      getLocalProject: () => undefined,
      updateLocalProject: () => {},
      getLocalPortfolio: () => undefined,
      updateLocalPortfolio: () => {},
      localMyProfile,
      setLocalMyProfile,
      fetchMyProfile: async () => (await api<{ profile: MyProfile }>("/api/me/profile")).profile,
    };
  }, [mode, folders, projects, portfolios, trash, error, load, loadTrash, localFolders, localProjects, localPortfolios, localTrash, localMyProfile]);

  return <WorkspaceDataContext.Provider value={value}>{children}</WorkspaceDataContext.Provider>;
}
