import type { ProjectAnswers } from "@/lib/validation/project-answers";
import { STEPS } from "@/templates/pm-v1";

export type StepStatus = "empty" | "partial" | "done";

export const STEP_STATUS_LABEL: Record<StepStatus, string> = {
  empty: "작성 전",
  partial: "작성 중",
  done: "작성 완료",
};

/**
 * 단계별 "주요 항목". 이 항목이 모두 채워지면 그 단계를 작성 완료로 본다.
 * 품질 점수가 아니라 작성 위치를 알려 주는 표시이며, 단계 이동을 막지 않는다.
 * "섹션.항목"은 그 항목, "섹션[].항목"은 반복 항목 중 하나라도 채워진 경우를 뜻한다.
 */
export const STEP_MAIN_FIELDS: Record<string, string[]> = {
  overview: ["overview.oneLine", "overview.context", "overview.purpose"],
  role: ["role.responsibility", "contribution[].task"],
  problem: ["problem.phenomenon", "problem.importance"],
  evidence: ["evidence[].description"],
  insight: ["insight.pattern", "insight.interpretation"],
  hypothesis: ["hypothesis.statement", "hypothesis.expectedBehavior"],
  solution: ["solution.selected", "solution.reason"],
  metrics: ["metrics[].name", "result.status", "result.summary"],
  execution: ["execution.steps", "execution.collaboration"],
  reflection: ["reflection.learning", "reflection.nextStep"],
};

/** 값이 하나라도 채워져 있는가. 빈 글·선택 안 함·꺼진 체크·빈 목록은 채워진 것으로 보지 않는다. */
export function isFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (typeof value === "number") return true;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.some(isFilled);
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).some(isFilled);
  return false;
}

function mainFieldFilled(answers: ProjectAnswers, path: string): boolean {
  const list = path.includes("[].");
  const [section, field] = path.split(list ? "[]." : ".");
  const data = (answers as unknown as Record<string, unknown>)[section];
  if (list) return Array.isArray(data) && data.some((item) => isFilled((item as Record<string, unknown>)[field]));
  return isFilled((data as Record<string, unknown> | undefined)?.[field]);
}

export function stepStatus(stepKey: string, answers: ProjectAnswers): StepStatus {
  const step = STEPS.find((s) => s.key === stepKey);
  if (!step) return "empty";
  const anyFilled = step.sections.some((section) => isFilled((answers as unknown as Record<string, unknown>)[section]));
  if (!anyFilled) return "empty";
  const main = STEP_MAIN_FIELDS[stepKey] ?? [];
  return main.length > 0 && main.every((path) => mainFieldFilled(answers, path)) ? "done" : "partial";
}
