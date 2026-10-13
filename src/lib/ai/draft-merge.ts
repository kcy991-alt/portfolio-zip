import {
  LIMITS,
  projectAnswersSchema,
  type ProjectAnswers,
  type SectionKey,
} from "@/lib/validation/project-answers";
import type { PdfDraft } from "./draft-schema";

// 모델이 돌려준 초안을 우리 답변 규칙(spec 7.2)에 맞게 다듬고, 사용자가 이미 쓴 내용을 건드리지 않고 빈 칸에만 채운다.

const clamp = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const blank = (v: string | null | undefined) => !v || v.trim() === "";
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const month = (v: string | null) => (v && MONTH.test(v.trim()) ? v.trim() : null);

/** 초안을 답변의 모양으로 바꾼다. 글자 수를 자르고, 모르는 값과 잘못된 형식은 비운다. 기여율·링크·실제 값은 넣지 않는다. */
export function draftToAnswers(draft: PdfDraft): ProjectAnswers {
  const t = LIMITS.text;
  const o = draft.overview;
  let startMonth = month(o.startMonth);
  let endMonth = month(o.endMonth);
  const ongoing = o.ongoing === true;
  if (ongoing) endMonth = null;
  if (startMonth && endMonth && endMonth < startMonth) {
    startMonth = null;
    endMonth = null;
  }

  const candidate = {
    overview: {
      oneLine: clamp(o.oneLine, LIMITS.intro),
      context: clamp(o.context, t),
      purpose: clamp(o.purpose, t),
      startMonth,
      endMonth,
      ongoing,
      projectType: o.projectType,
      teamSize: clamp(o.teamSize, 40),
    },
    role: { title: clamp(draft.role.title, LIMITS.title), responsibility: clamp(draft.role.responsibility, t) },
    contribution: draft.contribution
      .slice(0, LIMITS.contributionItems)
      .map((c) => ({ task: clamp(c.task, LIMITS.title), ownership: c.ownership, detail: clamp(c.detail, t), percentOptional: null }))
      .filter((c) => c.task || c.detail),
    problem: { targetUser: clamp(draft.problem.targetUser, t), phenomenon: clamp(draft.problem.phenomenon, t), importance: clamp(draft.problem.importance, t) },
    evidence: draft.evidence
      .slice(0, LIMITS.evidenceItems)
      .map((e) => ({ kind: clamp(e.kind, LIMITS.title), description: clamp(e.description, t), sourceUrl: "", observedAt: clamp(e.observedAt, 40), limitation: clamp(e.limitation, t) }))
      .filter((e) => e.kind || e.description),
    insight: { pattern: clamp(draft.insight.pattern, t), interpretation: clamp(draft.insight.interpretation, t), limitation: clamp(draft.insight.limitation, t) },
    hypothesis: { statement: clamp(draft.hypothesis.statement, t), expectedBehavior: clamp(draft.hypothesis.expectedBehavior, t) },
    solution: { selected: clamp(draft.solution.selected, t), alternatives: clamp(draft.solution.alternatives, t), reason: clamp(draft.solution.reason, t) },
    metrics: draft.metrics
      .slice(0, LIMITS.metricItems)
      .map((m) => ({
        name: clamp(m.name, LIMITS.title),
        purpose: m.purpose,
        baseline: clamp(m.baseline, 200),
        target: clamp(m.target, 200),
        unit: clamp(m.unit, 40),
        measurementPlan: clamp(m.measurementPlan, t),
        actualOptional: "",
      }))
      .filter((m) => m.name),
    result: {
      status: draft.result.status,
      type: draft.result.status === "observed" ? draft.result.type : null,
      summary: clamp(draft.result.summary, t),
      facts: clamp(draft.result.facts, t),
      limits: clamp(draft.result.limits, t),
      nextValidation: clamp(draft.result.nextValidation, t),
    },
    execution: { steps: clamp(draft.execution.steps, t), collaboration: clamp(draft.execution.collaboration, t), status: draft.execution.status },
    reflection: {
      learning: clamp(draft.reflection.learning, t),
      limitation: clamp(draft.reflection.limitation, t),
      nextStep: clamp(draft.reflection.nextStep, t),
      roleRelevanceOptional: clamp(draft.reflection.roleRelevanceOptional, t),
    },
  };
  return projectAnswersSchema.parse(candidate);
}

export type MergeResult = {
  answers: ProjectAnswers;
  /** 새로 채운 항목(문자열 칸·선택 칸·목록 항목)의 수 */
  filledCount: number;
  /** 하나라도 채운 섹션 */
  filledSections: SectionKey[];
};

const SECTION_ORDER: SectionKey[] = ["overview", "role", "contribution", "problem", "evidence", "insight", "hypothesis", "solution", "metrics", "result", "execution", "reflection"];

/**
 * 초안을 현재 답변에 합친다. 사용자가 이미 쓴 칸은 절대 바꾸지 않고 비어 있는 칸만 채운다.
 * 목록(기여·근거·지표)은 지금 비어 있을 때만 통째로 넣는다(섞으면 사용자가 쓴 항목과 뒤죽박죽이 되므로).
 */
export function mergeDraft(current: ProjectAnswers, draft: ProjectAnswers): MergeResult {
  const next: ProjectAnswers = structuredClone(current);
  const filled = new Set<SectionKey>();
  let count = 0;
  const mark = (s: SectionKey) => {
    filled.add(s);
    count += 1;
  };

  // 문자열 칸만 있는 섹션
  const fillText = <S extends "role" | "problem" | "insight" | "hypothesis" | "solution" | "reflection">(section: S) => {
    const cur = next[section] as Record<string, string>;
    const src = draft[section] as Record<string, string>;
    for (const key of Object.keys(src)) {
      if (blank(cur[key]) && !blank(src[key])) {
        cur[key] = src[key];
        mark(section);
      }
    }
  };
  (["role", "problem", "insight", "hypothesis", "solution", "reflection"] as const).forEach(fillText);

  // 프로젝트 개요
  const co = next.overview;
  const d = draft.overview;
  for (const key of ["oneLine", "context", "purpose", "teamSize"] as const) {
    if (blank(co[key]) && !blank(d[key])) {
      co[key] = d[key];
      mark("overview");
    }
  }
  if (co.projectType === null && d.projectType !== null) {
    co.projectType = d.projectType;
    mark("overview");
  }
  // 기간은 사용자가 아직 아무것도 고르지 않았을 때만 통째로 넣는다
  if (!co.startMonth && !co.endMonth && !co.ongoing && (d.startMonth || d.endMonth || d.ongoing)) {
    co.startMonth = d.startMonth;
    co.endMonth = d.endMonth;
    co.ongoing = d.ongoing;
    mark("overview");
  }

  // 목록
  if (next.contribution.every((c) => blank(c.task) && blank(c.detail)) && draft.contribution.length > 0) {
    next.contribution = draft.contribution;
    mark("contribution");
  }
  if (next.evidence.every((e) => blank(e.kind) && blank(e.description)) && draft.evidence.length > 0) {
    next.evidence = draft.evidence;
    mark("evidence");
  }
  if (next.metrics.every((m) => blank(m.name)) && draft.metrics.length > 0) {
    next.metrics = draft.metrics;
    mark("metrics");
  }

  // 결과·실행: 문자열 칸과 선택 칸
  const res = next.result;
  for (const key of ["summary", "facts", "limits", "nextValidation"] as const) {
    if (blank(res[key]) && !blank(draft.result[key])) {
      res[key] = draft.result[key];
      mark("result");
    }
  }
  if (res.status === null && draft.result.status !== null) {
    res.status = draft.result.status;
    res.type = draft.result.status === "observed" ? draft.result.type : null;
    mark("result");
  }
  const ex = next.execution;
  for (const key of ["steps", "collaboration"] as const) {
    if (blank(ex[key]) && !blank(draft.execution[key])) {
      ex[key] = draft.execution[key];
      mark("execution");
    }
  }
  if (ex.status === null && draft.execution.status !== null) {
    ex.status = draft.execution.status;
    mark("execution");
  }

  // 합친 결과가 규칙에 맞는지 마지막으로 확인한다(기간 순서 같은 것). 어긋나면 합치기 전 답변을 그대로 돌려준다.
  const checked = projectAnswersSchema.safeParse(next);
  if (!checked.success) return { answers: current, filledCount: 0, filledSections: [] };
  return { answers: checked.data, filledCount: count, filledSections: SECTION_ORDER.filter((s) => filled.has(s)) };
}
