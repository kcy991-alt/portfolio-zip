import { blankPdfDraft, PDF_DRAFT_RULES, type PdfDraft } from "./draft-schema";
import { EXECUTION_STATUSES, METRIC_PURPOSES, OWNERSHIPS, PROJECT_TYPES, RESULT_STATUSES, RESULT_TYPES } from "@/lib/validation/project-answers";

// 사용자가 자기 AI(ChatGPT·Claude 등) 채팅에 붙여 넣을 지침을 만들고, 그 AI가 준 결과(JSON)를 읽어 초안으로 바꾼다.
// 이 서비스는 문서를 받지 않고 AI를 부르지도 않는다(서버·API 키·요금 없음). 모두 브라우저에서 처리한다.

const GUIDE = `각 칸의 뜻:
- overview: 프로젝트 개요. startMonth·endMonth는 "YYYY-MM" 형식이고 문서에 연·월이 분명할 때만 쓰며 아니면 null. ongoing은 진행 중이라고 분명히 밝힌 경우만 true.
  projectType은 ${PROJECT_TYPES.map((v) => `"${v}"`).join(" | ")} 중 하나 또는 null (work 실제 업무, intern 인턴, education 교육·과제, personal 개인, other 기타).
- role: 이 문서 작성자가 맡은 역할 이름(title)과 맡은 범위(responsibility).
- contribution: 작성자가 직접 한 일(핵심 3~5개). ownership은 ${OWNERSHIPS.map((v) => `"${v}"`).join(" | ")} 또는 null (lead 주도, joint 공동, support 지원).
- problem: 누구에게(targetUser) 어떤 현상이(phenomenon) 왜 중요한지(importance).
- evidence: 문서에 나온 조사·데이터·관찰(핵심 3~5개). kind는 인터뷰·설문 같은 종류.
- insight / hypothesis / solution: 발견·해석, 가설, 선택한 해결안과 대안·이유.
- metrics: 성공·검증 지표(핵심 3~5개). purpose는 ${METRIC_PURPOSES.map((v) => `"${v}"`).join(" | ")} 또는 null. baseline·target은 문서에 적힌 값만.
- result: status는 ${RESULT_STATUSES.map((v) => `"${v}"`).join(" | ")} 또는 null, type은 ${RESULT_TYPES.map((v) => `"${v}"`).join(" | ")} 또는 null(status가 "observed"일 때만).
- execution: 진행 순서(steps)·협업(collaboration). status는 ${EXECUTION_STATUSES.map((v) => `"${v}"`).join(" | ")} 또는 null.
- reflection: 배운 점·한계·다음 단계.`;

/** AI 채팅에 붙여 넣을 전체 지침. 기획서 PDF는 사용자가 채팅에 직접 첨부한다. */
export function buildCopyPrompt(): string {
  return `당신은 기획·PM 지원자의 프로젝트 문서(서비스 기획안, PRD 등)를 읽고, 포트폴리오용 10단계 입력 칸에 들어갈 초안을 뽑는 도우미입니다.
첨부한 문서를 읽고, 아래 형식의 JSON으로만 답해 주세요.

${PDF_DRAFT_RULES}

출력 형식:
- 설명이나 인사 없이 JSON 코드블록 하나만 출력합니다.
- 모든 키를 빠짐없이 쓰고, 문서에 없는 칸은 빈 문자열("")이나 null, 빈 배열([])로 둡니다.
- 아래는 빈 견본입니다. 이 구조 그대로 채워 주세요.

${GUIDE}

\`\`\`json
${JSON.stringify(blankPdfDraft(), null, 2)}
\`\`\``;
}

// ---- 붙여 넣은 결과 읽기 ----

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const arr = (v: unknown): Raw[] => (Array.isArray(v) ? v.map(obj) : []);
const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const nullableStr = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v : null);
const pick = <T extends string>(v: unknown, list: readonly T[]): T | null => (typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : null);

/** AI가 형식을 조금 틀려도(빠진 키, 잘못된 선택값) 읽을 수 있는 만큼 읽는다. 알 수 없는 선택값은 비운다. */
export function coerceDraft(raw: unknown): PdfDraft {
  const r = obj(raw);
  const o = obj(r.overview);
  const role = obj(r.role);
  const problem = obj(r.problem);
  const insight = obj(r.insight);
  const hypothesis = obj(r.hypothesis);
  const solution = obj(r.solution);
  const result = obj(r.result);
  const execution = obj(r.execution);
  const reflection = obj(r.reflection);

  return {
    overview: {
      oneLine: str(o.oneLine),
      context: str(o.context),
      purpose: str(o.purpose),
      startMonth: nullableStr(o.startMonth),
      endMonth: nullableStr(o.endMonth),
      ongoing: o.ongoing === true,
      projectType: pick(o.projectType, PROJECT_TYPES),
      teamSize: str(o.teamSize),
    },
    role: { title: str(role.title), responsibility: str(role.responsibility) },
    contribution: arr(r.contribution).map((c) => ({ task: str(c.task), ownership: pick(c.ownership, OWNERSHIPS), detail: str(c.detail) })),
    problem: { targetUser: str(problem.targetUser), phenomenon: str(problem.phenomenon), importance: str(problem.importance) },
    evidence: arr(r.evidence).map((e) => ({ kind: str(e.kind), description: str(e.description), observedAt: str(e.observedAt), limitation: str(e.limitation) })),
    insight: { pattern: str(insight.pattern), interpretation: str(insight.interpretation), limitation: str(insight.limitation) },
    hypothesis: { statement: str(hypothesis.statement), expectedBehavior: str(hypothesis.expectedBehavior) },
    solution: { selected: str(solution.selected), alternatives: str(solution.alternatives), reason: str(solution.reason) },
    metrics: arr(r.metrics).map((m) => ({
      name: str(m.name),
      purpose: pick(m.purpose, METRIC_PURPOSES),
      baseline: str(m.baseline),
      target: str(m.target),
      unit: str(m.unit),
      measurementPlan: str(m.measurementPlan),
    })),
    result: {
      status: pick(result.status, RESULT_STATUSES),
      type: pick(result.type, RESULT_TYPES),
      summary: str(result.summary),
      facts: str(result.facts),
      limits: str(result.limits),
      nextValidation: str(result.nextValidation),
    },
    execution: { steps: str(execution.steps), collaboration: str(execution.collaboration), status: pick(execution.status, EXECUTION_STATUSES) },
    reflection: { learning: str(reflection.learning), limitation: str(reflection.limitation), nextStep: str(reflection.nextStep), roleRelevanceOptional: str(reflection.roleRelevanceOptional) },
  };
}

const SECTION_KEYS = ["overview", "role", "contribution", "problem", "evidence", "insight", "hypothesis", "solution", "metrics", "result", "execution", "reflection"];

export type ParsedPaste = { ok: true; draft: PdfDraft } | { ok: false; reason: "empty" | "not_json" | "wrong_shape" };

/** 사용자가 붙여 넣은 글에서 JSON을 찾아 초안으로 바꾼다. 코드블록(```json)이나 앞뒤 설명이 붙어 있어도 읽는다. */
export function parsePastedDraft(text: string): ParsedPaste {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, reason: "empty" };

  const fenced = trimmed.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  const candidate = fenced && fenced[1].includes("{") ? fenced[1] : trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return { ok: false, reason: "not_json" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return { ok: false, reason: "not_json" };
  }
  const top = obj(parsed);
  // 지침의 형식과 전혀 다른 JSON(섹션 이름이 하나도 없음)은 받지 않는다
  if (!SECTION_KEYS.some((k) => k in top)) return { ok: false, reason: "wrong_shape" };
  return { ok: true, draft: coerceDraft(top) };
}
