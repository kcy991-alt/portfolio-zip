"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from "react";
import { AnimatedMessage, AnimatePresence } from "@/components/app-motion";
import { MonthPicker } from "@/components/month-picker";
import { inputClass, Modal } from "@/components/modal";
import { useWorkspace, type FolderItem, type PortfolioListItem, type ProjectItem } from "@/components/workspace-data";
import { portfolioTitleSchema } from "@/lib/validation/portfolio";
import { ApiError } from "@/lib/api/client";
import { TRASH_DAYS, type TrashItem } from "@/lib/trash";
import { folderNameSchema, projectTitleSchema } from "@/lib/validation/api";

type Dialog =
  | { kind: "newFolder" }
  | { kind: "newProject"; folderId: string | null }
  | { kind: "renameFolder"; folder: FolderItem }
  | { kind: "deleteFolder"; folder: FolderItem }
  | { kind: "moveProject"; project: ProjectItem }
  | { kind: "deleteProject"; project: ProjectItem }
  | { kind: "purge"; item: TrashItem }
  | { kind: "newPortfolio" }
  | { kind: "deletePortfolio"; portfolio: PortfolioListItem };

type Api = {
  openNewPortfolio: () => void;
  openDeletePortfolio: (portfolio: PortfolioListItem) => void;
  openDeleteProject: (project: ProjectItem) => void;
  openPurge: (item: TrashItem) => void;
  openNewFolder: () => void;
  openNewProject: (folderId?: string | null) => void;
  openRenameFolder: (folder: FolderItem) => void;
  openDeleteFolder: (folder: FolderItem) => void;
  openMoveProject: (project: ProjectItem) => void;
};

const noop = () => {};
const Ctx = createContext<Api>({
  openNewPortfolio: noop,
  openDeletePortfolio: noop,
  openDeleteProject: noop,
  openPurge: noop,
  openNewFolder: noop,
  openNewProject: noop,
  openRenameFolder: noop,
  openDeleteFolder: noop,
  openMoveProject: noop,
});

export const useWorkspaceDialogs = () => useContext(Ctx);

export function WorkspaceDialogsProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<Dialog | null>(null);
  // 닫히는 움직임이 어떤 이유로 끝나지 않아도 창이 화면에 남지 않도록, 닫은 지 0.6초 뒤에도 새 창이 없으면 남은 것을 정리한다
  const [epoch, setEpoch] = useState(0);
  const isOpen = useRef(false);
  useEffect(() => {
    isOpen.current = dialog !== null;
  }, [dialog]);
  const close = useCallback(() => {
    setDialog(null);
    setTimeout(() => {
      if (!isOpen.current) setEpoch((n) => n + 1);
    }, 600);
  }, []);

  const api: Api = {
    openNewPortfolio: () => setDialog({ kind: "newPortfolio" }),
    openDeletePortfolio: (portfolio) => setDialog({ kind: "deletePortfolio", portfolio }),
    openDeleteProject: (project) => setDialog({ kind: "deleteProject", project }),
    openPurge: (item) => setDialog({ kind: "purge", item }),
    openNewFolder: () => setDialog({ kind: "newFolder" }),
    openNewProject: (folderId = null) => setDialog({ kind: "newProject", folderId }),
    openRenameFolder: (folder) => setDialog({ kind: "renameFolder", folder }),
    openDeleteFolder: (folder) => setDialog({ kind: "deleteFolder", folder }),
    openMoveProject: (project) => setDialog({ kind: "moveProject", project }),
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      {/* 창이 닫힐 때도 사라지는 움직임이 끝난 뒤에 지워지도록 AnimatePresence로 감싼다 */}
      <AnimatePresence key={epoch}>
        {dialog?.kind === "newFolder" && <NewFolderDialog key="newFolder" onClose={close} />}
        {dialog?.kind === "newProject" && <NewProjectDialog key="newProject" defaultFolderId={dialog.folderId} onClose={close} />}
        {dialog?.kind === "renameFolder" && <RenameFolderDialog key="renameFolder" folder={dialog.folder} onClose={close} />}
        {dialog?.kind === "deleteFolder" && <DeleteFolderDialog key="deleteFolder" folder={dialog.folder} onClose={close} />}
        {dialog?.kind === "moveProject" && <MoveProjectDialog key="moveProject" project={dialog.project} onClose={close} />}
        {dialog?.kind === "deleteProject" && <DeleteProjectDialog key="deleteProject" project={dialog.project} onClose={close} />}
        {dialog?.kind === "purge" && <PurgeDialog key="purge" item={dialog.item} onClose={close} />}
        {dialog?.kind === "newPortfolio" && <NewPortfolioDialog key="newPortfolio" onClose={close} />}
        {dialog?.kind === "deletePortfolio" && <DeletePortfolioDialog key="deletePortfolio" portfolio={dialog.portfolio} onClose={close} />}
      </AnimatePresence>
    </Ctx.Provider>
  );
}

const errorMessage = (e: unknown) => (e instanceof ApiError || e instanceof Error ? e.message : "처리하지 못했어요. 잠시 뒤 다시 시도해 주세요.");

function Actions({ onClose, submitLabel, busy, danger }: { onClose: () => void; submitLabel: string; busy: boolean; danger?: boolean }) {
  return (
    <div className="mt-6 flex justify-end gap-2">
      <button type="button" onClick={onClose} className="min-h-11 rounded-control px-4 text-muted hover:bg-canvas">
        취소
      </button>
      <button
        type="submit"
        disabled={busy}
        className={`min-h-11 rounded-control px-5 font-semibold text-white disabled:cursor-wait disabled:bg-line disabled:text-muted ${
          danger ? "bg-danger hover:opacity-90" : "bg-accent hover:bg-accent-hover"
        }`}
      >
        {busy ? "처리 중…" : submitLabel}
      </button>
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  return (
    <AnimatedMessage show={Boolean(message)}>
      <p role="alert" className="mt-3 text-sm text-danger">
        {message}
      </p>
    </AnimatedMessage>
  );
}

function NewFolderDialog({ onClose }: { onClose: () => void }) {
  const { createFolder } = useWorkspace();
  const id = useId();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = folderNameSchema.safeParse(name);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setBusy(true);
    try {
      await createFolder(parsed.data);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="새 폴더" description="회사, 인턴, 동아리, 교육 어디든 좋아요." onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <label htmlFor={id} className="text-sm font-medium">
          폴더 이름
        </label>
        <input id={id} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={`${inputClass} mt-1`} placeholder="예: A회사 · 기획 인턴" />
        <p className="mt-1 text-right text-sm text-muted">{name.length}/60</p>
        <FormError message={error} />
        <Actions onClose={onClose} submitLabel="만들기" busy={busy} />
      </form>
    </Modal>
  );
}

function RenameFolderDialog({ folder, onClose }: { folder: FolderItem; onClose: () => void }) {
  const { renameFolder } = useWorkspace();
  const id = useId();
  const [name, setName] = useState(folder.name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = folderNameSchema.safeParse(name);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setBusy(true);
    try {
      await renameFolder(folder.id, parsed.data);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="폴더 이름 바꾸기" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <label htmlFor={id} className="text-sm font-medium">
          폴더 이름
        </label>
        <input id={id} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className={`${inputClass} mt-1`} />
        <p className="mt-1 text-right text-sm text-muted">{name.length}/60</p>
        <FormError message={error} />
        <Actions onClose={onClose} submitLabel="저장" busy={busy} />
      </form>
    </Modal>
  );
}

function DeleteFolderDialog({ folder, onClose }: { folder: FolderItem; onClose: () => void }) {
  const { projects, deleteFolder } = useWorkspace();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const count = projects.filter((p) => p.folder_id === folder.id).length;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await deleteFolder(folder.id, count > 0);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="폴더 삭제" onClose={onClose}>
      <form onSubmit={submit}>
        <p>
          <strong>{folder.name}</strong> 폴더를 삭제할까요?
        </p>
        {count > 0 ? (
          <p className="mt-2 text-sm text-muted">
            폴더 안의 프로젝트 {count}개는 지워지지 않고 <strong>미분류</strong>로 옮겨져요.
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted">비어 있는 폴더예요.</p>
        )}
        <p className="mt-2 text-sm text-muted">폴더는 휴지통에서 {TRASH_DAYS}일 동안 보관돼요.</p>
        <FormError message={error} />
        <Actions onClose={onClose} submitLabel={count > 0 ? "미분류로 옮기고 삭제" : "삭제"} busy={busy} danger />
      </form>
    </Modal>
  );
}

const TYPES = [
  ["work", "실제 업무"],
  ["intern", "인턴"],
  ["education", "교육·과제"],
  ["personal", "개인"],
  ["other", "기타"],
] as const;

function NewProjectDialog({ defaultFolderId, onClose }: { defaultFolderId: string | null; onClose: () => void }) {
  const router = useRouter();
  const { folders, createProject, createFolder } = useWorkspace();
  const titleId = useId();
  const folderId = useId();
  const newFolderId = useId();
  // 폴더를 고르다가 바로 새 폴더를 만들 수 있다
  const [addingFolder, setAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderError, setFolderError] = useState<string | null>(null);
  const [folderBusy, setFolderBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState<string>(defaultFolderId ?? "");
  const [startMonth, setStartMonth] = useState("");
  const [endMonth, setEndMonth] = useState("");
  const [ongoing, setOngoing] = useState(false);
  const [type, setType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const addFolder = async () => {
    const parsed = folderNameSchema.safeParse(newFolderName);
    if (!parsed.success) return setFolderError(parsed.error.issues[0].message);
    setFolderBusy(true);
    setFolderError(null);
    try {
      const created = await createFolder(parsed.data);
      setFolder(created.id); // 방금 만든 폴더를 바로 선택한다
      setNewFolderName("");
      setAddingFolder(false);
    } catch (err) {
      setFolderError(errorMessage(err));
    } finally {
      setFolderBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = projectTitleSchema.safeParse(title);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    if (startMonth && endMonth && !ongoing && endMonth < startMonth) return setError("종료 월은 시작 월 이후여야 해요.");
    setBusy(true);
    try {
      const project = await createProject({
        title: parsed.data,
        folder_id: folder || null,
        startMonth: startMonth || null,
        endMonth: ongoing ? null : endMonth || null,
        ongoing,
        projectType: type,
      });
      onClose();
      router.push(`/workspace/projects/${project.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="새 프로젝트" description="제목만 있으면 만들 수 있어요. 나머지는 나중에 채워도 괜찮아요." onClose={onClose}>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div>
          <label htmlFor={titleId} className="text-sm font-medium">
            프로젝트 제목 <span className="text-danger">*</span>
          </label>
          <input id={titleId} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} className={`${inputClass} mt-1`} placeholder="예: 온보딩 개선" />
          <p className="mt-1 text-right text-sm text-muted">{title.length}/80</p>
        </div>

        <div>
          <label htmlFor={folderId} className="text-sm font-medium">
            저장할 폴더
          </label>
          <select id={folderId} value={folder} onChange={(e) => setFolder(e.target.value)} className={`${inputClass} mt-1`}>
            <option value="">미분류</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-sm text-muted">나중에 언제든 다른 폴더로 옮길 수 있어요.</p>
          {addingFolder ? (
            <div className="mt-2 rounded-control bg-canvas p-3">
              <label htmlFor={newFolderId} className="text-sm font-medium">
                새 폴더 이름
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id={newFolderId}
                  value={newFolderName}
                  maxLength={60}
                  autoFocus
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    // 프로젝트 만들기 전체가 제출되지 않도록, 엔터는 폴더 추가로만 쓴다
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void addFolder();
                    }
                  }}
                  className={inputClass}
                  placeholder="예: A회사 · 기획 인턴"
                />
                <button type="button" onClick={() => void addFolder()} disabled={folderBusy} className="min-h-11 shrink-0 rounded-control bg-accent px-4 font-semibold text-white hover:bg-accent-hover disabled:opacity-50">
                  {folderBusy ? "추가 중…" : "추가"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingFolder(false);
                    setFolderError(null);
                  }}
                  className="min-h-11 shrink-0 rounded-control px-3 text-muted hover:text-ink"
                >
                  취소
                </button>
              </div>
              {folderError && (
                <p role="alert" className="mt-2 text-sm text-danger">
                  {folderError}
                </p>
              )}
            </div>
          ) : (
            <button type="button" onClick={() => setAddingFolder(true)} className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-accent hover:underline">
              + 새 폴더 만들기
            </button>
          )}
        </div>

        <fieldset>
          <legend className="text-sm font-medium">기간 (선택)</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="mb-1 text-sm font-medium">시작</p>
              <MonthPicker value={startMonth} onChange={setStartMonth} className={inputClass} label="시작 월" />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">
                종료
                {ongoing && <span className="ml-1 font-normal text-muted">(진행 중이라 비워 둬요)</span>}
              </p>
              <MonthPicker value={ongoing ? "" : endMonth} disabled={ongoing} onChange={setEndMonth} className={`${inputClass} disabled:bg-canvas`} label="종료 월" />
            </div>
          </div>
          <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={ongoing} onChange={(e) => setOngoing(e.target.checked)} className="size-5 accent-accent" />
            아직 진행 중이에요
          </label>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium">프로젝트 유형 (선택)</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {TYPES.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={type === value}
                onClick={() => setType(type === value ? null : value)}
                className={`min-h-11 rounded-full border px-4 text-sm ${
                  type === value ? "border-accent/30 bg-accent-soft font-medium text-accent" : "border-line hover:bg-canvas"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>

        <FormError message={error} />
        <Actions onClose={onClose} submitLabel="만들고 작성 시작하기" busy={busy} />
      </form>
    </Modal>
  );
}

function MoveProjectDialog({ project, onClose }: { project: ProjectItem; onClose: () => void }) {
  const { folders, moveProject } = useWorkspace();
  const id = useId();
  const [folder, setFolder] = useState(project.folder_id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await moveProject(project.id, folder || null);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="폴더 이동" description={project.title} onClose={onClose}>
      <form onSubmit={submit}>
        <label htmlFor={id} className="text-sm font-medium">
          옮길 폴더
        </label>
        <select id={id} value={folder} onChange={(e) => setFolder(e.target.value)} className={`${inputClass} mt-1`}>
          <option value="">미분류</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <FormError message={error} />
        <Actions onClose={onClose} submitLabel="옮기기" busy={busy} />
      </form>
    </Modal>
  );
}

function DeleteProjectDialog({ project, onClose }: { project: ProjectItem; onClose: () => void }) {
  const { deleteProject } = useWorkspace();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await deleteProject(project.id);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="프로젝트 삭제" onClose={onClose}>
      <form onSubmit={submit}>
        <p>
          <strong>{project.title}</strong> 프로젝트를 휴지통으로 보낼까요?
        </p>
        <p className="mt-2 text-sm text-muted">휴지통에서 {TRASH_DAYS}일 동안 보관하고, 그 안에는 언제든 복원할 수 있어요.</p>
        <FormError message={error} />
        <Actions onClose={onClose} submitLabel="휴지통으로 보내기" busy={busy} danger />
      </form>
    </Modal>
  );
}

/** 영구 삭제는 되돌릴 수 없으므로 한 번 더 확인한다 (spec F13) */
function PurgeDialog({ item, onClose }: { item: TrashItem; onClose: () => void }) {
  const { purgeTrash } = useWorkspace();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await purgeTrash(item);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="영구 삭제" onClose={onClose}>
      <form onSubmit={submit}>
        <p>
          <strong>{item.name}</strong> {item.type === "folder" ? "폴더" : item.type === "portfolio" ? "포트폴리오" : "프로젝트"}를 영구 삭제할까요?
        </p>
        <p className="mt-2 text-sm text-danger">영구 삭제하면 다시 복원할 수 없어요.</p>
        <FormError message={error} />
        <Actions onClose={onClose} submitLabel="영구 삭제" busy={busy} danger />
      </form>
    </Modal>
  );
}
function NewPortfolioDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { createPortfolio } = useWorkspace();
  const id = useId();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = portfolioTitleSchema.safeParse(title);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setBusy(true);
    try {
      const created = await createPortfolio(parsed.data);
      onClose();
      router.push(`/portfolios/${created.id}/edit`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="새 포트폴리오 만들기" description="지원할 곳에 맞게 포트폴리오를 만들어 보세요." onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <label htmlFor={id} className="text-sm font-medium">
          포트폴리오 이름
        </label>
        <input id={id} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} className={`${inputClass} mt-1`} placeholder="예: 2026 서비스 기획 지원 포트폴리오" />
        <p className="mt-1 text-sm text-muted">나중에 변경할 수 있어요.</p>
        <FormError message={error} />
        <section aria-label="PM 포트폴리오 구성 TIP" className="mt-4 rounded-card border border-line bg-accent-soft p-4 text-sm">
          <h3 className="flex items-center gap-2 font-bold">
            <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
              <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3Z" />
            </svg>
            PM 포트폴리오 구성 TIP
          </h3>
          <p className="mt-2">
            핵심 프로젝트 <strong>2~3개</strong>를 골라 문제 해결 과정과 성과를 보여주세요.
          </p>
          <ol className="mt-2 flex flex-wrap gap-x-1.5 gap-y-1 font-medium">
            {["표지", "역량 요약", "자기소개", "프로젝트"].map((t, i) => (
              <li key={t} className="flex items-center gap-1.5">
                {i > 0 && (
                  <span aria-hidden className="text-muted">
                    →
                  </span>
                )}
                <span className="rounded-full bg-panel px-2.5 py-0.5">{t}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-muted">포트폴리오를 만든 후 각 항목을 작성할 수 있어요.</p>
        </section>
        <Actions onClose={onClose} submitLabel="포트폴리오 만들기" busy={busy} />
      </form>
    </Modal>
  );
}

function DeletePortfolioDialog({ portfolio, onClose }: { portfolio: PortfolioListItem; onClose: () => void }) {
  const { deletePortfolio } = useWorkspace();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await deletePortfolio(portfolio.id);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="포트폴리오 삭제" onClose={onClose}>
      <form onSubmit={submit}>
        <p>
          <strong>{portfolio.title}</strong> 포트폴리오를 휴지통으로 보낼까요?
        </p>
        <p className="mt-2 text-sm text-muted">
          휴지통에서 {TRASH_DAYS}일 동안 보관하고, 그 안에는 복원할 수 있어요. 프로젝트 아카이브의 프로젝트 원본은 지워지지 않아요.
        </p>
        <FormError message={error} />
        <Actions onClose={onClose} submitLabel="휴지통으로 보내기" busy={busy} danger />
      </form>
    </Modal>
  );
}