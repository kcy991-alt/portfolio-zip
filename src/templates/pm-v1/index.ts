import { OPTIONAL_STEP_KEYS, type ProjectAnswers, type SectionKey } from "@/lib/validation/project-answers";

export const TEMPLATE_KEY = "pm";
export const TEMPLATE_VERSION = 1;

export type PageType = "project_intro" | "project_analysis" | "project_execution" | "project_result";

export type StepDefinition = {
  /** 1~10 입력 순서. 강제 제출 단계가 아니라 제안 순서다 (spec 7.1). */
  order: number;
  key: string;
  label: string;
  /** 이 단계에서 입력하는 섹션 키 */
  sections: SectionKey[];
  /** 질문 문장. 입력 후에도 라벨로 남는다. */
  questions: string[];
  /** 있으면 작성 화면 위쪽에 질문 목록 대신 이 한 문장을 보여 준다(입력 칸의 질문과 겹칠 때). */
  intro?: string;
};

export const STEPS: StepDefinition[] = [
  {
    order: 1,
    key: "overview",
    label: "프로젝트 개요",
    sections: ["overview"],
    questions: ["어떤 프로젝트를 진행했나요?", "이 프로젝트를 시작한 이유는 무엇인가요?", "기간·유형은 무엇인가요?"],
    intro: "이 프로젝트가 무엇인지, 왜 시작했는지부터 정리해 보세요.",
  },
  { order: 2, key: "role", label: "역할·Contribution", sections: ["role", "contribution"], questions: ["무엇을 맡았나요?", "직접 한 일과 공동 수행한 일은 무엇인가요?"] },
  { order: 3, key: "problem", label: "문제 정의", sections: ["problem"], questions: ["어떤 현상이 누구에게 발생했나요?", "사용자·비즈니스에 왜 중요한가요?"] },
  { order: 4, key: "evidence", label: "데이터 및 근거", sections: ["evidence"], questions: ["어떤 데이터·VOC·관찰을 봤나요?", "출처와 범위는 무엇인가요?"] },
  { order: 5, key: "insight", label: "핵심 인사이트", sections: ["insight"], questions: ["발견한 패턴과 불편은 무엇인가요?", "현재 근거만으로 단정하기 어려운 점은 무엇인가요?"] },
  { order: 6, key: "hypothesis", label: "가설", sections: ["hypothesis"], questions: ["왜 문제가 생긴다고 생각하나요?", "어떤 개선으로 어떤 행동 변화를 예상하나요?"] },
  { order: 7, key: "solution", label: "해결안", sections: ["solution"], questions: ["무엇을 개선했고 왜 선택했나요?", "다른 대안보다 우선한 이유는 무엇인가요?"] },
  { order: 8, key: "metrics", label: "성공 지표", sections: ["metrics", "result"], questions: ["성공·중간·부작용·정성 지표는 무엇인가요?", "실제 결과 또는 미검증 계획은 무엇인가요?"] },
  { order: 9, key: "execution", label: "실행 계획", sections: ["execution"], questions: ["어떤 순서로 진행했거나 진행할 건가요?", "협업·검증 방법은 무엇인가요?"] },
  { order: 10, key: "reflection", label: "회고", sections: ["reflection"], questions: ["한계·배운 점·추가 데이터·다음 단계는 무엇인가요?"] },
];

/** 뺄 수 있는 단계인가. 개요·역할·문제 정의는 핵심 항목이 들어 있어서 뺄 수 없다. */
export const isRemovableStep = (key: string): boolean => (OPTIONAL_STEP_KEYS as readonly string[]).includes(key);

/** 숨긴 단계의 키 집합. 뺄 수 없는 단계 키가 섞여 있어도 무시한다. */
export function hiddenStepKeys(answers: Pick<ProjectAnswers, "hiddenSteps">): Set<string> {
  return new Set(answers.hiddenSteps.filter(isRemovableStep));
}

/** 숨기지 않은 단계의 STEPS 위치(0부터). 작성 화면은 이 목록 안에서만 이동한다. */
export function visibleStepIndexes(answers: Pick<ProjectAnswers, "hiddenSteps">): number[] {
  const hidden = hiddenStepKeys(answers);
  return STEPS.flatMap((s, i) => (hidden.has(s.key) ? [] : [i]));
}

/** 숨긴 단계에 속한 섹션들. 출력에서 이 섹션의 구역은 나오지 않는다. */
export function hiddenSections(answers: Pick<ProjectAnswers, "hiddenSteps">): Set<SectionKey> {
  const hidden = hiddenStepKeys(answers);
  return new Set(STEPS.filter((s) => hidden.has(s.key)).flatMap((s) => s.sections));
}

/** 포트폴리오 출력 구역. 섹션 키가 어느 페이지(A~D)의 어느 구역에 들어가는지 정의한다 (spec 7.1, 9.1). */
export type OutputZone = { page: PageType; zone: string };

export const OUTPUT_ZONES: Record<SectionKey, OutputZone[]> = {
  overview: [
    { page: "project_intro", zone: "프로젝트 정보" },
    { page: "project_intro", zone: "개요·선정 이유" },
  ],
  role: [{ page: "project_intro", zone: "역할" }],
  contribution: [{ page: "project_execution", zone: "Contribution" }],
  problem: [{ page: "project_analysis", zone: "Problem" }],
  evidence: [{ page: "project_analysis", zone: "Research & Evidence" }],
  insight: [{ page: "project_analysis", zone: "Insight" }],
  hypothesis: [{ page: "project_analysis", zone: "Hypothesis" }],
  solution: [
    { page: "project_execution", zone: "Solution" },
    { page: "project_execution", zone: "대안과 선택 이유" },
  ],
  metrics: [{ page: "project_execution", zone: "목표·검증 지표" }],
  result: [{ page: "project_result", zone: "Result" }],
  execution: [{ page: "project_execution", zone: "Execution" }],
  reflection: [{ page: "project_result", zone: "Reflection" }],
};

/** 프로젝트 페이지(A~D)별 구역 순서 (spec 9.1). 구역 이름은 OUTPUT_ZONES의 zone과 같다. */
export const PAGE_ORDER: PageType[] = ["project_intro", "project_analysis", "project_execution", "project_result"];

/** 섹션에 붙인 이미지가 미리보기·출력에서 보이는 구역. 대표 이미지는 "대표 이미지" 구역이다. */
export const IMAGE_ZONE: Record<SectionKey, string> = {
  overview: "개요·선정 이유",
  role: "역할",
  contribution: "Contribution",
  problem: "Problem",
  evidence: "Research & Evidence",
  insight: "Insight",
  hypothesis: "Hypothesis",
  solution: "Solution",
  metrics: "목표·검증 지표",
  result: "Result",
  execution: "Execution",
  reflection: "Reflection",
};
export const REPRESENTATIVE_ZONE = "대표 이미지";

export const PAGE_LAYOUT: Record<PageType, { title: string; zones: string[] }> = {
  project_intro: { title: "소개", zones: ["프로젝트 정보", "개요·선정 이유", "역할", "대표 이미지"] },
  project_analysis: { title: "분석", zones: ["Problem", "Research & Evidence", "Insight", "Hypothesis"] },
  project_execution: { title: "실행", zones: ["Solution", "대안과 선택 이유", "목표·검증 지표", "Execution", "Contribution"] },
  project_result: { title: "결과", zones: ["Result", "Reflection"] },
};

/**
 * 구역 하나가 어떤 섹션에서 오는지. 페이지에서 섹션을 숨기면 그 섹션에서만 오는 구역도 함께 숨긴다.
 * "프로젝트 정보"와 "대표 이미지"는 개요(overview) 섹션에서 온다.
 */
export function sectionsOfZone(page: PageType, zone: string): SectionKey[] {
  if (zone === "프로젝트 정보" || zone === REPRESENTATIVE_ZONE) return ["overview"];
  return (Object.keys(OUTPUT_ZONES) as SectionKey[]).filter((s) => OUTPUT_ZONES[s].some((z) => z.page === page && z.zone === zone));
}

/**
 * 핵심 필드 (spec 1.3, 9.3): 프로젝트명, 역할, 문제, 직접 행동, 결과 상태와 결과 설명.
 * 품질 점수가 아니라 누락 확인용이다. 프로젝트명은 project.title에 있다.
 */
export const CORE_FIELDS = [
  "role.responsibility",
  "problem.phenomenon",
  "contribution",
  "result.status",
  "result.summary",
] as const;

/** 수치가 없을 때 상단 가이드 (spec 7.4). 그대로 노출한다. */
export const RESULT_GUIDE_HEADLINE =
  "수치가 없어도 정리할 수 있어요. 확인한 피드백, 완성한 산출물, 적용 범위를 쓰고 측정하지 않은 효과는 구분해 주세요.";

export const RESULT_STATUS_GUIDE: Record<
  "observed" | "not_measured" | "not_executed",
  { label: string; question: string; outputLabel: string | null }
> = {
  observed: { label: "결과를 확인했어요", question: "어떤 값이나 피드백, 산출물이 어느 기간·대상에서 확인됐나요? 출처는 무엇인가요?", outputLabel: null },
  not_measured: { label: "실행했지만 효과는 측정하지 못했어요", question: "확인한 산출물과 측정하지 못한 효과는 무엇인가요?", outputLabel: "효과 미측정" },
  not_executed: { label: "아직 실행하지 않은 기획·과제예요", question: "목표·가설·검증 계획은 무엇인가요?", outputLabel: "제안·검증 예정" },
};

/**
 * 입력 항목이 포트폴리오 페이지의 어느 구역에 들어가는지. 목록에 없는 항목은 섹션의 첫 구역(OUTPUT_ZONES)에 들어간다.
 * 한 섹션이 여러 구역에 걸칠 때만 적는다.
 */
const FIELD_ZONE: Partial<Record<SectionKey, Record<string, string>>> = {
  overview: {
    startMonth: "프로젝트 정보",
    endMonth: "프로젝트 정보",
    ongoing: "프로젝트 정보",
    projectType: "프로젝트 정보",
    teamSize: "프로젝트 정보",
    oneLine: "개요·선정 이유",
    context: "개요·선정 이유",
    purpose: "개요·선정 이유",
  },
  solution: { selected: "Solution", alternatives: "대안과 선택 이유", reason: "대안과 선택 이유" },
  // 진행 상태는 소개 페이지의 "프로젝트 정보"에 표시된다
  execution: { status: "프로젝트 정보" },
};

export function zoneOfField(section: SectionKey, field: string): string {
  return FIELD_ZONE[section]?.[field] ?? OUTPUT_ZONES[section][0].zone;
}

/** 구역이 들어 있는 프로젝트 페이지 */
export function pageOfZone(zone: string): PageType {
  return PAGE_ORDER.find((p) => PAGE_LAYOUT[p].zones.includes(zone)) ?? "project_intro";
}
