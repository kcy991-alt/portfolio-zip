import { STEPS, visibleStepIndexes } from "@/templates/pm-v1";
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
  onManage,
  className = "",
}: {
  stepIndex: number;
  answers: ProjectAnswers;
  onSelect: (index: number) => void;
  /** 있으면 "단계 추가·빼기" 버튼을 보여 준다 */
  onManage?: () => void;
  className?: string;
}) {
  const step = STEPS[stepIndex];
  // 뺀 단계는 세지 않는다. 위치는 쓰는 단계 안에서의 순서다.
  const visible = visibleStepIndexes(answers);
  const position = Math.max(visible.indexOf(stepIndex), 0) + 1;
  const percent = Math.round((position / visible.length) * 100);

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-end justify-between gap-3">
        <p className="min-w-0 text-base font-semibold" aria-live="polite">
          {position}/{visible.length} 단계 · {step.label}
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
        aria-valuetext={`${visible.length}단계 중 ${position}단계, ${percent}%`}
        className="h-3 overflow-hidden rounded-full bg-line"
      >
        <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${percent}%` }} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-2">
          <span className="shrink-0 whitespace-nowrap text-muted">단계 선택</span>
          <select value={stepIndex} onChange={(e) => onSelect(Number(e.target.value))} className="min-h-11 min-w-0 rounded-control border border-line bg-panel px-2">
            {visible.map((i, n) => (
              <option key={STEPS[i].key} value={i}>
                {n + 1}. {STEPS[i].label} · {STEP_STATUS_LABEL[stepStatus(STEPS[i].key, answers)]}
              </option>
            ))}
          </select>
        </label>
        {onManage && (
          <button type="button" onClick={onManage} className="min-h-11 shrink-0 whitespace-nowrap rounded-control border border-line px-3 hover:bg-canvas">
            단계 추가·빼기
          </button>
        )}
      </div>
    </div>
  );
}
