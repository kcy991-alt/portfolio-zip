"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatedMessage, SaveStatusChip } from "@/components/app-motion";
import { trackEvent } from "@/lib/analytics";
import { api, ApiError } from "@/lib/api/client";
import { Autosaver, type SaveResult, type SaveStatus } from "@/lib/autosave";
import { STEPS, visibleStepIndexes, zoneOfField } from "@/templates/pm-v1";
import { StepProgress } from "./step-progress";
import { StepManager, toggleStepHidden } from "./step-manager";
import { SECTION_FORMS } from "@/templates/pm-v1/fields";
import type { ProjectAnswers, SectionKey } from "@/lib/validation/project-answers";
import { REPRESENTATIVE } from "@/lib/storage/asset-limits";
import { useProjectAssets } from "@/lib/use-project-assets";
import { GatedButton } from "./gated-button";
import { ImageSlot } from "./image-slot";
import { Modal } from "./modal";
import { AiDraftImport } from "./ai-draft-import";
import { ProjectOutputPreview } from "./project-output-preview";
import { SectionForm } from "./section-form";
import type { LocalProjectData } from "./workspace-data";

export type RealProject = {
  id: string;
  title: string;
  answers: ProjectAnswers;
  record_status: "draft" | "done";
  revision: number;
  last_step: number;
};

type Props =
  // 로그인하지 않은 체험: 내용은 브라우저 메모리에만 두고 저장하지 않는다
  | { mode: "local"; project: LocalProjectData; onLocalChange: (patch: Partial<Omit<LocalProjectData, "id">>) => void }
  // 로그인한 사용자: 서버에 자동 저장한다
  | { mode: "real"; project: RealProject; onReload: () => void };

type Payload = { title: string; answers: ProjectAnswers; record_status: "draft" | "done"; last_step: number };

const STATUS_TEXT: Record<SaveStatus, string> = {
  idle: "저장됨",
  dirty: "저장 대기 중…",
  saving: "저장 중…",
  saved: "저장됨",
  error: "저장 실패",
  conflict: "저장 멈춤 · 다른 곳에서 수정됨",
};

const firstFieldName = (s: SectionKey) => SECTION_FORMS[s].fields[0].name;

export function ProjectEditor(props: Props) {
  const real = props.mode === "real" ? props.project : null;
  const base = props.project; // 처음 열 때의 값(두 모드 모두 같은 모양)

  const [titleInput, setTitleInput] = useState(base.title);
  const [lastValidTitle, setLastValidTitle] = useState(base.title);
  const [answers, setAnswers] = useState<ProjectAnswers>(base.answers);
  const [recordStatus, setRecordStatus] = useState<"draft" | "done">(base.record_status);
  // 마지막으로 보던 단계가 지금은 숨겨져 있으면 가까운 보이는 단계에서 시작한다
  const [stepIndex, setStepIndex] = useState(() => {
    const saved = Math.min(Math.max(base.last_step, 1), STEPS.length) - 1;
    const visible = visibleStepIndexes(base.answers);
    return visible.find((i) => i >= saved) ?? visible[visible.length - 1];
  });
  const [managing, setManaging] = useState(false);
  // 지금 입력 중인 항목이 포트폴리오 페이지의 어느 구역에 들어가는지 (미리보기에서 그 구역만 강조한다)
  const firstZone = (index: number) => zoneOfField(STEPS[index].sections[0], firstFieldName(STEPS[index].sections[0]));
  const [activeZone, setActiveZone] = useState<string>(firstZone(stepIndex));
  const [tab, setTab] = useState<"write" | "preview">("write");
  // 넓은 화면에서 미리보기를 접으면 입력 영역이 넓어진다. 입력 중인 내용과 현재 단계는 그대로다.
  const [previewOpen, setPreviewOpen] = useState(true);
  // 이미지는 로그인한 사용자의 프로젝트에만 붙일 수 있다 (비로그인 체험에는 저장소가 없다)
  const assetsHook = useProjectAssets(real ? real.id : null);
  const assets = real ? assetsHook : null;
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [copied, setCopied] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // 서버에 보낼 최신 값. 제목이 비어 있으면 마지막으로 유효했던 제목을 유지한다.
  const latest = useRef<Payload>({
    title: base.title,
    answers,
    record_status: base.record_status,
    last_step: stepIndex + 1,
  });
  const saver = useRef<Autosaver<Payload> | null>(null);
  const recordSavedSent = useRef(false);

  const step = STEPS[stepIndex];
  // 숨긴 단계는 건너뛴다. 이전·다음은 보이는 단계 안에서 움직인다.
  const visible = visibleStepIndexes(answers);
  const position = Math.max(visible.indexOf(stepIndex), 0);
  const prevIndex: number | undefined = visible[position - 1];
  const nextIndex: number | undefined = visible[position + 1];
  const trimmedTitle = titleInput.trim();
  // 미리보기에는 마지막으로 유효했던 제목을 쓴다(비어 있으면 이전 제목 유지)
  const title = trimmedTitle === "" ? lastValidTitle : trimmedTitle;

  useEffect(() => {
    if (!real) return;
    const instance = new Autosaver<Payload>({
      initialRevision: real.revision,
      onStatus: (status) => {
        setSaveStatus(status);
        if (status === "saved" && !recordSavedSent.current) {
          recordSavedSent.current = true; // 화면을 연 뒤 첫 저장 성공만 센다
          trackEvent("core_record_saved", "member");
        }
        if (status === "error") trackEvent("save_failed", "member");
      },
      save: async (payload, expectedRevision): Promise<SaveResult> => {
        try {
          const data = await api<{ revision: number }>(`/api/projects/${real.id}`, {
            method: "PATCH",
            body: { expected_revision: expectedRevision, ...payload },
          });
          setSaveMessage(null);
          return { ok: true, revision: data.revision };
        } catch (e) {
          // 서버가 입력을 거절한 경우(400)에는 이유를 보여 줘서 사용자가 고칠 수 있게 한다
          setSaveMessage(e instanceof ApiError && e.status === 400 ? e.message : null);
          return { ok: false, kind: e instanceof ApiError && e.status === 409 ? "conflict" : "error" };
        }
      },
    });
    saver.current = instance;
    return () => {
      instance.dispose();
      saver.current = null;
    };
  }, [real]);

  // 저장하지 못한 내용이 있는데 탭을 닫으려 하면 경고한다 (완벽한 저장 보장은 아니다)
  useEffect(() => {
    if (!real) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saver.current?.hasUnsaved) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [real]);

  // 입력이 바뀌면 로그인한 사용자는 서버에 자동 저장하고, 체험 중인 사용자는 브라우저 메모리에만 반영한다.
  const commit = (patch: Partial<Payload>) => {
    latest.current = { ...latest.current, ...patch };
    if (props.mode === "local") props.onLocalChange(patch);
    else saver.current?.change(latest.current);
  };

  const onAnswersChange = (next: ProjectAnswers) => {
    setAnswers(next);
    commit({ answers: next });
  };

  const onTitleChange = (value: string) => {
    setTitleInput(value);
    if (value.trim() !== "") {
      setLastValidTitle(value.trim());
      commit({ title: value.trim() });
    }
  };

  const onRecordStatusChange = (value: "draft" | "done") => {
    setRecordStatus(value);
    commit({ record_status: value });
    void saver.current?.flush();
  };

  const goToStep = (index: number) => {
    setStepIndex(index);
    setActiveZone(firstZone(index));
    commit({ last_step: index + 1 });
    void saver.current?.flush(); // 단계를 옮길 때 저장을 시도한다 (체험 중에는 저장하지 않으므로 아무 일도 없다)
  };

  const showZone = (zone: string) => setActiveZone(zone);

  // 단계를 넣거나 뺀다. 지금 보고 있는 단계를 빼면 가까운 보이는 단계로 옮긴다. 쓴 내용은 지우지 않는다.
  const onToggleStep = (key: string) => {
    const next = toggleStepHidden(answers, key);
    if (next === answers) return;
    onAnswersChange(next);
    const nowVisible = visibleStepIndexes(next);
    if (!nowVisible.includes(stepIndex)) goToStep(nowVisible.find((i) => i > stepIndex) ?? nowVisible[nowVisible.length - 1]);
  };
  // 섹션 안의 버튼 같은 곳에 포커스가 가면 그 섹션의 첫 구역을, 입력 항목에 가면 그 항목의 구역을 강조한다
  const focusSection = (s: SectionKey) => showZone(zoneOfField(s, ""));
  const focusField = (s: SectionKey, field: string) => showZone(zoneOfField(s, field));

  const copyMine = async () => {
    const text = JSON.stringify({ title: latest.current.title, answers: latest.current.answers }, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const form = (
    <div className="flex flex-col gap-4" onBlurCapture={() => void saver.current?.flush()}>
      <AiDraftImport projectId={base.id} answers={answers} onApply={onAnswersChange} />
      <div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">{step.label}</h2>
          {/* 입력 칸 맨 아래까지 내려가지 않고도 단계를 옮길 수 있는 작은 아이콘. 양쪽을 항상 보이게 두고, 끝 단계에서는 흐리게(비활성) 한다. 마지막 단계는 아래쪽 "포트폴리오 만들기"로 이어진다 */}
          <div className="flex shrink-0 items-center">
            {(
              [
                { label: "이전 단계로", title: "이전 단계", to: prevIndex ?? stepIndex, disabled: prevIndex === undefined, path: "M19 12H5M11 6l-6 6 6 6" },
                { label: "다음 단계로", title: "다음 단계", to: nextIndex ?? stepIndex, disabled: nextIndex === undefined, path: "M5 12h14M13 6l6 6-6 6" },
              ] as const
            ).map((b) => (
              <button
                key={b.label}
                type="button"
                disabled={b.disabled}
                onClick={() => goToStep(b.to)}
                aria-label={b.label}
                title={b.title}
                className="flex size-11 items-center justify-center rounded-full text-muted hover:bg-canvas hover:text-accent disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted"
              >
                <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={b.path} />
                </svg>
              </button>
            ))}
          </div>
        </div>
        {step.intro ? (
          <p className="mt-2 text-muted">{step.intro}</p>
        ) : (
          <ul className="mt-2 list-disc pl-5 text-muted">
            {step.questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        )}
      </div>

      {step.sections.map((s) => (
        <SectionForm
          key={s}
          section={s}
          answers={answers}
          onChange={onAnswersChange}
          onFocusSection={focusSection}
          onFocusField={focusField}
          footer={
            <>
              {/* 프로젝트 개요 단계에서는 소개 페이지의 대표 이미지도 붙인다 */}
              {s === "overview" && <ImageSlot sectionKey={REPRESENTATIVE} assets={assets} mode={props.mode} />}
              <ImageSlot sectionKey={s} assets={assets} mode={props.mode} />
            </>
          }
        />
      ))}

      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-2 border-t border-line bg-panel px-4 py-3 xl:static xl:mx-0 xl:border-0 xl:bg-transparent xl:p-0">
        <button
          type="button"
          disabled={prevIndex === undefined}
          onClick={() => prevIndex !== undefined && goToStep(prevIndex)}
          className="min-h-12 rounded-control border border-line bg-panel px-4 hover:bg-canvas disabled:text-muted xl:min-h-11"
        >
          이전 단계
        </button>
        <span className="text-sm text-muted xl:hidden">
          {position + 1} / {visible.length}
        </span>
        {nextIndex === undefined ? (
          // 마지막 단계에서는 다음 단계가 없으므로, 기록한 프로젝트로 포트폴리오를 만들러 간다
          <Link href="/portfolios" className="inline-flex min-h-12 items-center rounded-control bg-accent px-5 font-medium text-white hover:bg-accent-hover xl:min-h-11">
            포트폴리오 만들기
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => goToStep(nextIndex)}
            className="min-h-12 rounded-control bg-accent px-5 font-medium text-white hover:bg-accent-hover xl:min-h-11"
          >
            다음 단계
          </button>
        )}
      </div>
    </div>
  );

  // 단계·진행률·미리보기를 한 카드에 모아, 어디를 쓰고 있는지 한눈에 보이게 한다
  const preview = (
    <div className="rounded-card border border-line bg-panel p-4">
      <StepProgress stepIndex={stepIndex} answers={answers} onSelect={goToStep} onManage={() => setManaging(true)} className="hidden border-b border-line pb-4 xl:flex" />
      <div className="xl:mt-4">
        <ProjectOutputPreview
          title={title}
          answers={answers}
          activeZone={activeZone}
          images={assets?.items}
          onCollapse={() => setPreviewOpen(false)}
        />
      </div>
    </div>
  );

  return (
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="border-b border-line bg-panel px-4 py-3">
        <h1 className="sr-only">프로젝트 편집</h1>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <label htmlFor="project-title" className="sr-only">
              프로젝트 제목
            </label>
            <input
              id="project-title"
              value={titleInput}
              maxLength={80}
              onChange={(e) => onTitleChange(e.target.value)}
              aria-invalid={trimmedTitle === "" ? true : undefined}
              className="min-h-11 w-full min-w-0 rounded-control border border-transparent bg-transparent px-1 py-1 text-xl font-bold hover:border-line focus:border-accent"
            />
            <AnimatedMessage show={trimmedTitle === ""}>
              <p className="text-sm text-danger">제목을 입력해 주세요. 비워 두면 이전 제목이 유지돼요.</p>
            </AnimatedMessage>
          </div>

          {/* 저장 상태와 저장 버튼, 기록 상태 */}
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              {real ? (
                <SaveStatusChip
                  statusKey={saveStatus === "idle" ? "saved" : saveStatus}
                  kind={saveStatus === "saved" || saveStatus === "idle" ? "saved" : saveStatus === "error" || saveStatus === "conflict" ? "error" : "neutral"}
                  className={`rounded px-2 py-1 ${saveStatus === "error" || saveStatus === "conflict" ? "bg-danger/5 text-danger" : "bg-canvas text-muted"}`}
                >
                  {saveStatus === "saved" || saveStatus === "idle" ? "자동 저장됨" : STATUS_TEXT[saveStatus]}
                  {saveStatus === "error" && (
                    <button type="button" onClick={() => void saver.current?.retry()} className="ml-2 font-medium underline underline-offset-2">
                      다시 시도
                    </button>
                  )}
                </SaveStatusChip>
              ) : (
                <>
                  <span role="status" className="rounded bg-canvas px-2 py-1 text-muted">
                    체험 중 · 저장되지 않아요
                  </span>
                  <GatedButton
                    label="로그인하고 저장"
                    reason="작성한 내용을 보관하려면 로그인해야 해요."
                    className="min-h-11 rounded-control bg-accent px-4 font-semibold text-white hover:bg-accent-hover"
                    disabledClassName="min-h-11 cursor-not-allowed rounded-control bg-line px-4 text-muted"
                  />
                </>
              )}
            </div>
            <label className="flex items-center gap-2">
              <span className="text-muted">기록 상태</span>
              <select
                value={recordStatus}
                onChange={(e) => onRecordStatusChange(e.target.value as "draft" | "done")}
                className="min-h-11 rounded-control border border-line bg-panel px-2"
              >
                <option value="draft">초안</option>
                <option value="done">기록 완료</option>
              </select>
            </label>
          </div>
        </div>

        {saveStatus === "error" && real && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {saveMessage ? (
              <>
                입력한 내용 중 확인이 필요한 곳이 있어서 저장하지 못했어요: <strong>{saveMessage}</strong> 고치면 자동으로 다시 저장돼요. 입력한 내용은 이 화면에 그대로 있어요. 새로고침하면 저장되지 않은 내용은 사라져요.
              </>
            ) : (
              <>저장하지 못했어요. 입력한 내용은 이 화면에 그대로 있어요. 연결을 확인하고 &lsquo;다시 시도&rsquo;를 눌러 주세요. 새로고침하면 저장되지 않은 내용은 사라져요.</>
            )}
          </p>
        )}

        {/* 넓은 화면에서는 단계·진행률이 오른쪽 미리보기 카드에 들어간다. 좁은 화면이나 미리보기를 접었을 때만 여기에 보인다 */}
        <StepProgress stepIndex={stepIndex} answers={answers} onSelect={goToStep} onManage={() => setManaging(true)} className={`mt-3 ${previewOpen ? "xl:hidden" : ""}`} />

        {/* 1,280px 미만: 작성/미리보기 탭 전환 */}
        <div role="tablist" aria-label="화면 전환" className="mt-3 flex gap-2 xl:hidden">
          {(["write", "preview"] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`min-h-11 rounded-control border px-4 text-sm ${tab === t ? "border-accent bg-accent-soft font-medium text-accent" : "border-line"}`}
            >
              {t === "write" ? "작성" : "미리보기"}
            </button>
          ))}
        </div>
      </header>

      <div className={`grid flex-1 gap-6 p-4 ${previewOpen ? "xl:grid-cols-[minmax(420px,1.5fr)_minmax(0,1fr)]" : "xl:mx-auto xl:w-full xl:max-w-4xl xl:grid-cols-1"}`}>
        <div className={tab === "write" ? "" : "hidden xl:block"}>
          {!previewOpen && (
            <div className="mb-3 hidden justify-end xl:flex">
              <button type="button" onClick={() => setPreviewOpen(true)} className="min-h-11 rounded-control border border-line px-3 text-sm hover:bg-canvas">
                미리보기 펼치기
              </button>
            </div>
          )}
          {form}
        </div>
        <div className={`xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:self-start xl:overflow-y-auto ${tab === "preview" ? "" : "hidden xl:block"} ${previewOpen ? "" : "xl:hidden"}`}>{preview}</div>
      </div>

      {managing && <StepManager answers={answers} onToggle={onToggleStep} onClose={() => setManaging(false)} />}

      {real && saveStatus === "conflict" && props.mode === "real" && (
        <Modal
          title="다른 곳에서 수정됐어요"
          description="다른 탭이나 기기에서 이 프로젝트를 먼저 저장했어요. 내용이 섞이지 않도록 지금 화면은 저장을 멈췄어요."
          onClose={() => {}}
        >
          <p className="text-sm text-muted">
            &lsquo;최신 버전 열기&rsquo;를 누르면 저장된 내용을 불러와요. 지금 입력한 내용은 사라지니, 필요하면 먼저 &lsquo;내 입력 복사&rsquo;로 가져가세요.
          </p>
          {copied && <p className="mt-2 text-sm text-accent">복사했어요. 메모장 같은 곳에 붙여 넣어 보관하세요.</p>}
          <div className="mt-6 flex flex-col gap-2 sm:flex-row-reverse">
            <button type="button" data-autofocus onClick={props.onReload} className="min-h-12 flex-1 rounded-control bg-accent px-4 font-semibold text-white hover:bg-accent-hover">
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
