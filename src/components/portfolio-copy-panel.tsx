"use client";

import { useId, useState } from "react";
import { DEFAULT_PAGE_SECTIONS, PAGE_TYPE_LABEL, type PortfolioDoc, type PortfolioImage, type PortfolioPageDoc } from "@/lib/portfolio/model";
import type { PortfolioEditorApi } from "@/lib/portfolio/use-portfolio-editor";
import type { SectionKey } from "@/lib/validation/project-answers";
import { STEPS, visibleStepIndexes, zoneOfField } from "@/templates/pm-v1";
import { SECTION_FORMS } from "@/templates/pm-v1/fields";
import { inputClass, Modal } from "./modal";
import { SectionForm } from "./section-form";
import { StepManager, toggleStepHidden } from "./step-manager";

type Copy = PortfolioDoc["projects"][number];

function ImageRow({ image, onChange }: { image: PortfolioImage; onChange: (patch: Partial<PortfolioImage>) => void }) {
  const id = useId();
  const [caption, setCaption] = useState(image.caption);
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-control border border-line p-2">
      <div className="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded bg-canvas">
        {image.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.url} alt={image.decorative ? "" : image.alt_text} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-xs text-muted">없음</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="sr-only">
          캡션
        </label>
        <input
          id={id}
          value={caption}
          maxLength={150}
          placeholder="캡션"
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => caption !== image.caption && onChange({ caption })}
          className={inputClass}
        />
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={image.include_in_output} onChange={(e) => onChange({ include_in_output: e.target.checked })} className="size-5 accent-accent" />
        출력에 포함
      </label>
    </li>
  );
}

/** 프로젝트 사본을 고치는 패널. 여기서 고쳐도 프로젝트 아카이브의 원본은 바뀌지 않는다 (spec 5.3). */
export function ProjectCopyPanel({
  api,
  copy,
  page,
  onSelectZone,
}: {
  api: PortfolioEditorApi;
  copy: Copy;
  page: PortfolioPageDoc;
  /** 입력 칸에 포커스가 가면, 그 칸이 들어가는 미리보기 구역을 알린다 */
  onSelectZone: (copyId: string, zone: string) => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [confirm, setConfirm] = useState<"refresh" | "remove" | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [managing, setManaging] = useState(false);
  // 뺀 단계는 고치기 목록에서 빠진다. 보고 있던 단계를 빼면 첫 번째 보이는 단계로 돌아간다.
  const visible = visibleStepIndexes(copy.answers);
  const current = visible.includes(stepIndex) ? stepIndex : visible[0];
  const step = STEPS[current];
  const titleId = useId();
  const stepId = useId();

  const type = page.type as keyof typeof DEFAULT_PAGE_SECTIONS;
  const pageSections = DEFAULT_PAGE_SECTIONS[type] ?? [];
  const copyPages = api.doc.pages.filter((p) => p.portfolio_project_id === copy.id);

  const run = async (action: () => Promise<void>, done: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setConfirm(null);
      setMessage(done);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "처리하지 못했어요.");
    } finally {
      setBusy(false);
    }
  };

  const linkedSummaryCount = api.doc.summary.items.filter((i) => i.projectIds.includes(copy.id)).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-card border border-line bg-panel p-4">
        <h3 className="text-lg font-bold">프로젝트 사본</h3>
        <p className="mt-1 text-sm text-muted">프로젝트 아카이브의 프로젝트를 복사한 거예요. 여기서 고쳐도 원본은 바뀌지 않아요.</p>
        {copy.source_changed && <p className="mt-2 rounded-control bg-accent-soft p-2 text-sm text-accent">원본이 수정되었어요. 아래 &lsquo;원본에서 다시 가져오기&rsquo;로 최신 내용을 가져올 수 있어요.</p>}
        {!copy.source_available && <p className="mt-2 rounded-control bg-canvas p-2 text-sm text-muted">원본 프로젝트가 삭제되었거나 휴지통에 있어서 다시 가져올 수 없어요. 이 사본은 그대로 쓸 수 있어요.</p>}

        <div className="mt-3">
          <label htmlFor={titleId} className="text-sm font-medium">
            제목
          </label>
          <input id={titleId} value={copy.title} maxLength={80} onChange={(e) => api.updateCopy(copy.id, { title: e.target.value })} className={`${inputClass} mt-1`} />
          {copy.title.trim() === "" && <p className="mt-1 text-sm text-danger">제목을 입력해 주세요.</p>}
        </div>
      </div>

      <div className="rounded-card border border-line bg-panel p-4">
        <h3 className="font-bold">
          {PAGE_TYPE_LABEL[page.type]} 페이지 설정
        </h3>
        <label className="mt-2 flex min-h-11 items-center gap-3">
          <input type="checkbox" checked={!page.hidden} onChange={(e) => api.setPageHidden(page.id, !e.target.checked)} className="size-5 accent-accent" />
          이 페이지를 포트폴리오에 넣어요
        </label>
        <p className="mt-2 text-sm font-medium">이 페이지에 보일 섹션</p>
        <ul className="mt-1 flex flex-col">
          {pageSections.map((key) => (
            <li key={key}>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={page.section_keys.includes(key)}
                  onChange={(e) => api.setPageSections(page.id, e.target.checked ? [...page.section_keys, key] : page.section_keys.filter((k) => k !== key))}
                  className="size-5 accent-accent"
                />
                {SECTION_FORMS[key as SectionKey].title}
              </label>
            </li>
          ))}
        </ul>
        {copyPages.length > 0 && <p className="mt-1 text-sm text-muted">소개·분석·실행·결과 4장이 기본으로 만들어져요. 필요 없는 페이지는 빼도 돼요.</p>}
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2 rounded-card border border-line bg-panel p-3">
          <label htmlFor={stepId} className="text-sm text-muted">
            내용 고치기
          </label>
          <select id={stepId} value={current} onChange={(e) => setStepIndex(Number(e.target.value))} className="min-h-11 rounded-control border border-line bg-panel px-2">
            {visible.map((i, n) => (
              <option key={STEPS[i].key} value={i}>
                {n + 1}. {STEPS[i].label}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setManaging(true)} className="min-h-11 rounded-control border border-line px-3 text-sm hover:bg-canvas">
            단계 추가·빼기
          </button>
        </div>
        {step.sections.map((s) => (
          <SectionForm
            key={`${copy.id}-${s}`}
            section={s}
            answers={copy.answers}
            onChange={(answers) => api.updateCopy(copy.id, { answers })}
            onFocusSection={(section) => onSelectZone(copy.id, zoneOfField(section, ""))}
            onFocusField={(section, field) => onSelectZone(copy.id, zoneOfField(section, field))}
          />
        ))}
      </div>

      {copy.images.length > 0 && (
        <div className="rounded-card border border-line bg-panel p-4">
          <h3 className="font-bold">이미지 선택</h3>
          <p className="mt-1 text-sm text-muted">이 제작본에 넣을 이미지를 골라요. 원본의 이미지 설정은 바뀌지 않아요.</p>
          <ul className="mt-2 flex flex-col gap-2">
            {copy.images.map((img) => (
              <ImageRow key={img.id} image={img} onChange={(patch) => api.updateImage(copy.id, img.id, patch)} />
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-card border border-line bg-panel p-4">
        <h3 className="font-bold">사본 관리</h3>
        {message && (
          <p role="status" className="mt-2 text-sm text-accent">
            {message}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!copy.source_available || busy}
            onClick={() => setConfirm("refresh")}
            className="min-h-11 rounded-control border border-line px-4 text-sm hover:bg-canvas disabled:text-muted"
          >
            원본에서 다시 가져오기
          </button>
          <button type="button" disabled={busy} onClick={() => setConfirm("remove")} className="min-h-11 rounded-control px-4 text-sm text-danger hover:bg-danger/5">
            이 제작본에서 빼기
          </button>
        </div>
      </div>

      {managing && <StepManager answers={copy.answers} onToggle={(key) => api.updateCopy(copy.id, { answers: toggleStepHidden(copy.answers, key) })} onClose={() => setManaging(false)} />}

      {confirm === "refresh" && (
        <Modal title="원본에서 다시 가져올까요?" onClose={() => setConfirm(null)}>
          <p className="text-sm">
            <strong>{copy.title}</strong> 사본의 제목과 모든 답변이 프로젝트 아카이브의 최신 원본으로 <strong className="text-danger">교체돼요</strong>. 이 제작본에서 고친 문장은 사라지고, 부분만 합치는 기능은 없어요. 페이지 표시 설정은 그대로 유지돼요.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={() => setConfirm(null)} className="min-h-11 rounded-control px-4 text-muted hover:bg-canvas">
              취소
            </button>
            <button
              type="button"
              data-autofocus
              disabled={busy}
              onClick={() => void run(() => api.refreshProject(copy.id), "원본의 최신 내용으로 바꿨어요.")}
              className="min-h-11 rounded-control bg-accent px-5 font-semibold text-white hover:bg-accent-hover disabled:bg-line disabled:text-muted"
            >
              {busy ? "가져오는 중…" : "교체하기"}
            </button>
          </div>
        </Modal>
      )}

      {confirm === "remove" && (
        <Modal title="이 제작본에서 뺄까요?" onClose={() => setConfirm(null)}>
          <p className="text-sm">
            <strong>{copy.title}</strong> 사본과 그 페이지가 이 포트폴리오에서 빠져요. <strong>프로젝트 아카이브의 원본은 그대로 남아요.</strong>
          </p>
          {linkedSummaryCount > 0 && <p className="mt-2 text-sm text-muted">Summary 항목 {linkedSummaryCount}개의 프로젝트 연결은 풀리고, 적어 둔 문장은 그대로 유지돼요.</p>}
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={() => setConfirm(null)} className="min-h-11 rounded-control px-4 text-muted hover:bg-canvas">
              취소
            </button>
            <button
              type="button"
              data-autofocus
              disabled={busy}
              onClick={() => void run(async () => void (await api.removeProject(copy.id)), "빠졌어요.")}
              className="min-h-11 rounded-control bg-danger px-5 font-semibold text-white disabled:bg-line disabled:text-muted"
            >
              {busy ? "빼는 중…" : "빼기"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
