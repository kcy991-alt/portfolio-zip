import { STEPS } from "@/templates/pm-v1";
import { STEP_STATUS_LABEL, stepStatus } from "@/lib/step-status";
import type { ProjectAnswers } from "@/lib/validation/project-answers";

/**
 * 지금 몇 단계를 쓰고 있는지 한눈에 보여 주는 묶음: 단계 이름, 진행 퍼센트 바, 단계 선택.
 * 퍼센트는 "현재 단계의 위치"(예: 3/10 → 30%)이며 입력 완성도나 품질 점수가 아니다(spec 8.2).
 */
export function StepProgress({
  stepIndex,
  answers,
  onSelect,
  className = "",
}: {
  stepIndex: number;
  answers: ProjectAnswers;
  onSelect: (index: number) => void;
  className?: string;
}) {
  const step = STEPS[stepIndex];
  const percent = Math.round((step.order / STEPS.length) * 100);

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-end justify-between gap-3">
        <p className="min-w-0 text-base font-semibold" aria-live="polite">
          {step.order}/{STEPS.length} 단계 · {step.label}
          <span className="ml-2 rounded-full bg-canvas px-2 py-0.5 align-middle text-xs font-medium text-muted">{STEP_STATUS_LABEL[stepStatus(step.key, answers)]}</span>
        </p>
        <p className="shrink-0 text-2xl font-bold leading-none text-accent" aria-hidden>
          {percent}%
        </p>
      </div>

      <div
        role="progressbar"
        aria-label="작성 진행 위치"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${STEPS.length}단계 중 ${step.order}단계, ${percent}%`}
        className="h-3 overflow-hidden rounded-full bg-line"
      >
        <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${percent}%` }} />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <span className="shrink-0 whitespace-nowrap text-muted">단계 선택</span>
        <select value={stepIndex} onChange={(e) => onSelect(Number(e.target.value))} className="min-h-11 min-w-0 rounded-control border border-line bg-panel px-2">
          {STEPS.map((x, i) => (
            <option key={x.key} value={i}>
              {x.order}. {x.label} · {STEP_STATUS_LABEL[stepStatus(x.key, answers)]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
