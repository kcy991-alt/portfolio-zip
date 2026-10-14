"use client";

import { STEP_STATUS_LABEL, stepStatus } from "@/lib/step-status";
import type { ProjectAnswers } from "@/lib/validation/project-answers";
import { hiddenStepKeys, isRemovableStep, STEPS } from "@/templates/pm-v1";
import { Modal } from "./modal";

/**
 * 프로젝트에서 쓸 단계를 고르는 창. 뺀 단계는 작성 화면에서 건너뛰고 포트폴리오 출력에도 나오지 않는다.
 * 쓴 내용은 지우지 않고 숨기기만 하므로, 다시 넣으면 그대로 돌아온다.
 * 개요·역할·문제 정의·성공 지표는 핵심 항목이 들어 있어서 뺄 수 없다.
 */
export function StepManager({ answers, onToggle, onClose }: { answers: ProjectAnswers; onToggle: (key: string) => void; onClose: () => void }) {
  const hidden = hiddenStepKeys(answers);

  return (
    <Modal title="단계 추가·빼기" description="쓰지 않을 단계는 빼 두세요. 뺀 단계는 작성 화면과 포트폴리오에서 숨겨져요." onClose={onClose}>
      <ul className="flex flex-col">
        {STEPS.map((s) => {
          const removable = isRemovableStep(s.key);
          const on = !hidden.has(s.key);
          return (
            <li key={s.key} className="border-b border-line last:border-0">
              <label className={`flex min-h-12 items-center gap-3 py-1 ${removable ? "cursor-pointer" : ""}`}>
                <input type="checkbox" checked={on} disabled={!removable} onChange={() => onToggle(s.key)} className="size-5 accent-accent" />
                <span className="min-w-0 flex-1 font-medium">{s.label}</span>
                {removable ? (
                  !on && stepStatus(s.key, answers) !== "empty" ? (
                    <span className="shrink-0 text-xs text-muted">쓴 내용은 보관돼요</span>
                  ) : (
                    <span className="shrink-0 text-xs text-muted">{STEP_STATUS_LABEL[stepStatus(s.key, answers)]}</span>
                  )
                ) : (
                  <span className="shrink-0 rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-muted">필수</span>
                )}
              </label>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm text-muted">뺀 단계에 쓴 내용은 지워지지 않아요. 다시 넣으면 그대로 나타나요.</p>
      <div className="mt-4 flex justify-end">
        <button type="button" data-autofocus onClick={onClose} className="min-h-11 rounded-control bg-accent px-5 font-semibold text-white hover:bg-accent-hover">
          완료
        </button>
      </div>
    </Modal>
  );
}

/** 단계 하나를 넣거나 뺀 새 답변. 뺄 수 없는 단계는 그대로 돌려준다. */
export function toggleStepHidden(answers: ProjectAnswers, key: string): ProjectAnswers {
  if (!isRemovableStep(key)) return answers;
  const hidden = hiddenStepKeys(answers);
  if (hidden.has(key)) hidden.delete(key);
  else hidden.add(key);
  return { ...answers, hiddenSteps: [...hidden] as ProjectAnswers["hiddenSteps"] };
}
